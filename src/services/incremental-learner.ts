import { nanoid } from 'nanoid';
import { Logger } from '../utils/logger.js';
import type { SQLiteDatabase } from '../storage/sqlite-db.js';
import type { SemanticEngine } from '../engines/semantic-engine.js';
import type { PatternEngine } from '../engines/pattern-engine.js';
import type { GitChange, GitCommit } from './git-integration.js';
import { EventEmitter } from 'eventemitter3';



export interface LearningDelta {
  id: string;
  projectId: string;
  timestamp: number;
  triggerType: 'commit' | 'save' | 'manual';
  commitSha?: string;
  commitMessage?: string;
  filesChanged: string[];
  conceptsAdded: number;
  conceptsRemoved: number;
  conceptsModified: number;
  patternsAdded: number;
  patternsRemoved: number;
  patternsModified: number;
  durationMs: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  errorMessage?: string;
}

export interface LearningStatus {
  isLearning: boolean;
  currentDelta?: LearningDelta;
  queueLength: number;
  lastCompletedDelta?: LearningDelta;
  totalDeltasProcessed: number;
}

export interface IncrementalLearningConfig {
  enabled: boolean;
  autoLearnOnCommit: boolean;
  autoLearnOnSave: boolean;
  batchSize: number;
  queueTimeoutMs: number;
  backgroundLearning: boolean;
}

interface QueuedLearningTask {
  id: string;
  files: string[];
  trigger: 'commit' | 'save' | 'manual';
  commitInfo?: GitCommit;
  priority: number;
  addedAt: number;
}

/**
 * Incremental learning service - learns from code changes incrementally
 * instead of requiring full codebase scans.
 */
export class IncrementalLearner extends EventEmitter {
  private db: SQLiteDatabase;
  private semanticEngine: SemanticEngine;
  private patternEngine: PatternEngine;
  private projectId: string;
  private config: IncrementalLearningConfig;

  private queue: QueuedLearningTask[] = [];
  private isProcessing: boolean = false;
  private currentDelta?: LearningDelta;
  private totalDeltasProcessed: number = 0;

  constructor(
    db: SQLiteDatabase,
    semanticEngine: SemanticEngine,
    patternEngine: PatternEngine,
    projectId: string,
    config: Partial<IncrementalLearningConfig> = {}
  ) {
    super();
    this.db = db;
    this.semanticEngine = semanticEngine;
    this.patternEngine = patternEngine;
    this.projectId = projectId;
    this.config = {
      enabled: true,
      autoLearnOnCommit: true,
      autoLearnOnSave: false,
      batchSize: 50,
      queueTimeoutMs: 5000,
      backgroundLearning: true,
      ...config,
    };
  }

  /**
   * Process git changes and update intelligence incrementally
   */
  async processChanges(changes: GitChange[], commitInfo?: GitCommit): Promise<LearningDelta> {
    const startTime = Date.now();
    const deltaId = nanoid();

    // Create delta record
    const delta: LearningDelta = {
      id: deltaId,
      projectId: this.projectId,
      timestamp: Date.now(),
      triggerType: commitInfo ? 'commit' : 'manual',
      commitSha: commitInfo?.sha,
      commitMessage: commitInfo?.message,
      filesChanged: changes.map(c => c.path),
      conceptsAdded: 0,
      conceptsRemoved: 0,
      conceptsModified: 0,
      patternsAdded: 0,
      patternsRemoved: 0,
      patternsModified: 0,
      durationMs: 0,
      status: 'pending',
    };

    try {
      // Save delta to database
      await this.saveDelta(delta);

      // Update status to processing
      delta.status = 'processing';
      await this.updateDelta(delta);
      this.currentDelta = delta;
      this.emit('delta:start', delta);

      // Process deletions first
      const deletions = changes.filter(c => c.type === 'deleted');
      for (const deletion of deletions) {
        await this.handleFileDeletion(deletion.path, delta);
      }

      // Process additions and modifications
      const modifications = changes.filter(c => c.type !== 'deleted');
      for (const change of modifications) {
        await this.handleFileChange(change, delta, commitInfo);
      }

      // Update patterns based on all changes
      await this.updatePatternsFromDelta(delta);

      // Mark as completed
      delta.status = 'completed';
      delta.durationMs = Date.now() - startTime;
      await this.updateDelta(delta);

      this.currentDelta = undefined;
      this.totalDeltasProcessed++;
      this.emit('delta:complete', delta);

      Logger.info(`Incremental learning completed in ${delta.durationMs}ms: +${delta.conceptsAdded} concepts, ~${delta.conceptsModified} modified, -${delta.conceptsRemoved} removed`);

      return delta;
    } catch (error) {
      delta.status = 'failed';
      delta.errorMessage = error instanceof Error ? error.message : String(error);
      delta.durationMs = Date.now() - startTime;
      await this.updateDelta(delta);

      this.currentDelta = undefined;
      this.emit('delta:error', delta, error);

      Logger.error('Incremental learning failed:', error);
      throw error;
    }
  }

  /**
   * Queue files for learning (batched processing)
   */
  async queueLearning(
    files: string[],
    trigger: 'commit' | 'save' | 'manual' = 'manual',
    commitInfo?: GitCommit,
    priority: number = 0
  ): Promise<void> {
    if (!this.config.enabled) {
      Logger.debug('Incremental learning is disabled');
      return;
    }

    const task: QueuedLearningTask = {
      id: nanoid(),
      files,
      trigger,
      commitInfo,
      priority,
      addedAt: Date.now(),
    };

    this.queue.push(task);
    this.queue.sort((a, b) => b.priority - a.priority); // Higher priority first

    Logger.debug(`Queued ${files.length} files for learning (queue size: ${this.queue.length})`);
    this.emit('queue:add', task);

    // Start processing if not already running
    if (!this.isProcessing && this.config.backgroundLearning) {
      this.processQueue();
    }
  }

  /**
   * Process the learning queue
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;
    this.emit('queue:start');

    try {
      while (this.queue.length > 0) {
        const task = this.queue.shift()!;

        // Batch files up to batchSize
        const filesToProcess = task.files.slice(0, this.config.batchSize);
        const remainingFiles = task.files.slice(this.config.batchSize);

        // If there are remaining files, add them back to queue
        if (remainingFiles.length > 0) {
          this.queue.unshift({
            ...task,
            files: remainingFiles,
          });
        }

        // Convert files to GitChange format
        const changes: GitChange[] = filesToProcess.map(path => ({
          type: 'modified',
          path,
        }));

        // Process changes
        await this.processChanges(changes, task.commitInfo);

        // Wait before processing next batch
        if (this.queue.length > 0) {
          await new Promise(resolve => setTimeout(resolve, this.config.queueTimeoutMs));
        }
      }
    } catch (error) {
      Logger.error('Error processing learning queue:', error);
      this.emit('queue:error', error);
    } finally {
      this.isProcessing = false;
      this.emit('queue:complete');
    }
  }

  /**
   * Handle file deletion
   */
  private async handleFileDeletion(filePath: string, delta: LearningDelta): Promise<void> {
    try {
      // Get concepts from this file
      const fileIntelligence = this.db.getFileIntelligence(filePath);
      if (!fileIntelligence) {
        return; // File not learned yet
      }

      const conceptIds = JSON.parse(fileIntelligence.semanticConcepts || '[]');

      // Mark concepts as deleted
      for (const conceptId of conceptIds) {
        this.db.getDB().prepare(`
          UPDATE semantic_concepts
          SET is_deleted = 1,
              last_modified_commit = ?
          WHERE id = ?
        `).run(delta.commitSha || null, conceptId);

        delta.conceptsRemoved++;
      }

      // Delete file intelligence record
      this.db.getDB().prepare('DELETE FROM file_intelligence WHERE file_path = ?').run(filePath);

      Logger.debug(`Marked ${conceptIds.length} concepts as deleted from ${filePath}`);
    } catch (error) {
      Logger.error(`Failed to handle file deletion for ${filePath}:`, error);
    }
  }

  /**
   * Handle file change (addition or modification)
   */
  private async handleFileChange(
    change: GitChange,
    delta: LearningDelta,
    commitInfo?: GitCommit
  ): Promise<void> {
    try {
      // Analyze the file
      const analysis = await this.semanticEngine.analyzeFile(change.path, {
        includePatterns: true,
        includeComplexity: true,
      });

      if (!analysis) {
        Logger.debug(`No analysis results for ${change.path}`);
        return;
      }

      // Get previous concepts for this file
      const previousIntelligence = this.db.getFileIntelligence(change.path);
      const previousConceptIds = previousIntelligence
        ? JSON.parse(previousIntelligence.semanticConcepts || '[]')
        : [];

      // Extract current concepts
      const currentConceptIds: string[] = [];
      const newConcepts = analysis.topConcepts || [];

      for (const concept of newConcepts) {
        const conceptId = nanoid();
        currentConceptIds.push(conceptId);

        // Check if this is a new or modified concept
        const isNew = !previousConceptIds.includes(concept.name);

        // Save concept
        this.db.getDB().prepare(`
          INSERT OR REPLACE INTO semantic_concepts (
            id, concept_name, concept_type, confidence_score,
            relationships, file_path, line_range,
            created_commit, last_modified_commit,
            created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', 'utc'), datetime('now', 'utc'))
        `).run(
          conceptId,
          concept.name,
          concept.type,
          concept.confidence || 0.5,
          '{}', // relationships to be computed later
          change.path,
          JSON.stringify({ start: 0, end: 0 }), // line range from analysis if available
          isNew ? (delta.commitSha || null) : previousIntelligence?.last_learned_commit,
          delta.commitSha || null
        );

        if (isNew) {
          delta.conceptsAdded++;
        } else {
          delta.conceptsModified++;
        }
      }

      // Mark removed concepts as deleted
      for (const oldConceptId of previousConceptIds) {
        if (!currentConceptIds.includes(oldConceptId)) {
          this.db.getDB().prepare(`
            UPDATE semantic_concepts
            SET is_deleted = 1,
                last_modified_commit = ?
            WHERE id = ?
          `).run(delta.commitSha || null, oldConceptId);

          delta.conceptsRemoved++;
        }
      }

      // Update file intelligence
      this.db.saveFileIntelligence({
        filePath: change.path,
        fileHash: analysis.fileHash || '',
        semanticConcepts: currentConceptIds,
        patternsUsed: analysis.topPatterns?.map(p => p.name) || [],
        complexityMetrics: {
          cyclomatic: analysis.complexity?.cyclomatic || 0,
          cognitive: analysis.complexity?.cognitive || 0,
        },
        dependencies: [],
        lastAnalyzed: new Date().toISOString(),
        lastLearnedCommit: delta.commitSha,
        lastLearnedTimestamp: delta.timestamp,
      });

      Logger.debug(`Updated intelligence for ${change.path}: +${delta.conceptsAdded} concepts`);
    } catch (error) {
      Logger.error(`Failed to handle file change for ${change.path}:`, error);
    }
  }

  /**
   * Update patterns based on delta
   */
  private async updatePatternsFromDelta(delta: LearningDelta): Promise<void> {
    try {
      // Re-analyze patterns for changed files
      const patterns = await this.patternEngine.analyzePatterns(
        delta.filesChanged,
        'incremental'
      );

      // Update pattern counts and confidence
      for (const pattern of patterns) {
        const existing = this.db.getDB().prepare(`
          SELECT * FROM developer_patterns WHERE pattern_id = ?
        `).get(pattern.id) as any;

        if (existing) {
          // Increment frequency
          this.db.getDB().prepare(`
            UPDATE developer_patterns
            SET frequency = frequency + 1,
                last_seen = datetime('now', 'utc'),
                last_updated_commit = ?,
                version = version + 1
            WHERE pattern_id = ?
          `).run(delta.commitSha || null, pattern.id);

          delta.patternsModified++;
        } else {
          // New pattern
          this.db.getDB().prepare(`
            INSERT INTO developer_patterns (
              pattern_id, pattern_type, pattern_content,
              frequency, contexts, examples, confidence,
              created_at, last_seen, last_updated_commit, version
            ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now', 'utc'), datetime('now', 'utc'), ?, 1)
          `).run(
            pattern.id,
            pattern.type,
            JSON.stringify(pattern.content),
            1,
            JSON.stringify(pattern.contexts || []),
            JSON.stringify(pattern.examples || []),
            pattern.confidence || 0.5,
            delta.commitSha || null
          );

          delta.patternsAdded++;
        }
      }

      Logger.debug(`Updated patterns: +${delta.patternsAdded} new, ~${delta.patternsModified} modified`);
    } catch (error) {
      Logger.error('Failed to update patterns from delta:', error);
    }
  }

  /**
   * Get recent learning deltas
   */
  async getRecentDeltas(limit: number = 10): Promise<LearningDelta[]> {
    const rows = this.db.getDB().prepare(`
      SELECT * FROM learning_deltas
      WHERE project_id = ?
      ORDER BY timestamp DESC
      LIMIT ?
    `).all(this.projectId, limit) as any[];

    return rows.map(row => ({
      id: row.id,
      projectId: row.project_id,
      timestamp: row.timestamp,
      triggerType: row.trigger_type,
      commitSha: row.commit_sha,
      commitMessage: row.commit_message,
      filesChanged: JSON.parse(row.files_changed),
      conceptsAdded: row.concepts_added,
      conceptsRemoved: row.concepts_removed,
      conceptsModified: row.concepts_modified,
      patternsAdded: row.patterns_added,
      patternsRemoved: row.patterns_removed,
      patternsModified: row.patterns_modified,
      durationMs: row.duration_ms,
      status: row.status,
      errorMessage: row.error_message,
    }));
  }

  /**
   * Get learning status
   */
  getLearningStatus(): LearningStatus {
    return {
      isLearning: this.isProcessing,
      currentDelta: this.currentDelta,
      queueLength: this.queue.length,
      totalDeltasProcessed: this.totalDeltasProcessed,
    };
  }

  /**
   * Save delta to database
   */
  private async saveDelta(delta: LearningDelta): Promise<void> {
    this.db.getDB().prepare(`
      INSERT INTO learning_deltas (
        id, project_id, timestamp, trigger_type, commit_sha, commit_message,
        files_changed, concepts_added, concepts_removed, concepts_modified,
        patterns_added, patterns_removed, patterns_modified,
        duration_ms, status, error_message
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      delta.id,
      delta.projectId,
      delta.timestamp,
      delta.triggerType,
      delta.commitSha || null,
      delta.commitMessage || null,
      JSON.stringify(delta.filesChanged),
      delta.conceptsAdded,
      delta.conceptsRemoved,
      delta.conceptsModified,
      delta.patternsAdded,
      delta.patternsRemoved,
      delta.patternsModified,
      delta.durationMs,
      delta.status,
      delta.errorMessage || null
    );
  }

  /**
   * Update delta in database
   */
  private async updateDelta(delta: LearningDelta): Promise<void> {
    this.db.getDB().prepare(`
      UPDATE learning_deltas
      SET status = ?,
          concepts_added = ?,
          concepts_removed = ?,
          concepts_modified = ?,
          patterns_added = ?,
          patterns_removed = ?,
          patterns_modified = ?,
          duration_ms = ?,
          error_message = ?
      WHERE id = ?
    `).run(
      delta.status,
      delta.conceptsAdded,
      delta.conceptsRemoved,
      delta.conceptsModified,
      delta.patternsAdded,
      delta.patternsRemoved,
      delta.patternsModified,
      delta.durationMs,
      delta.errorMessage || null,
      delta.id
    );
  }

  /**
   * Clear the queue
   */
  clearQueue(): void {
    this.queue = [];
    this.emit('queue:clear');
  }

  /**
   * Stop processing
   */
  async stop(): Promise<void> {
    this.clearQueue();
    this.isProcessing = false;
    this.emit('stopped');
  }

  /**
   * Get statistics
   */
  async getStatistics(): Promise<{
    totalDeltas: number;
    totalConceptsAdded: number;
    totalConceptsRemoved: number;
    totalPatternsAdded: number;
    averageDurationMs: number;
    successRate: number;
  }> {
    const stats = this.db.getDB().prepare(`
      SELECT
        COUNT(*) as total_deltas,
        SUM(concepts_added) as total_concepts_added,
        SUM(concepts_removed) as total_concepts_removed,
        SUM(patterns_added) as total_patterns_added,
        AVG(duration_ms) as avg_duration_ms,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) * 100.0 / COUNT(*) as success_rate
      FROM learning_deltas
      WHERE project_id = ?
    `).get(this.projectId) as any;

    return {
      totalDeltas: stats.total_deltas || 0,
      totalConceptsAdded: stats.total_concepts_added || 0,
      totalConceptsRemoved: stats.total_concepts_removed || 0,
      totalPatternsAdded: stats.total_patterns_added || 0,
      averageDurationMs: stats.avg_duration_ms || 0,
      successRate: stats.success_rate || 0,
    };
  }
}
