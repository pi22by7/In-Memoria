import Database from 'better-sqlite3';
import { mkdirSync, existsSync } from 'fs';
import { dirname, isAbsolute } from 'path';
import { DatabaseMigrator } from './migrations.js';
import { Logger } from '../utils/logger.js';

export interface SemanticConcept {
  id: string;
  conceptName: string;
  conceptType: string;
  confidenceScore: number;
  relationships: Record<string, any>;
  evolutionHistory: Record<string, any>;
  filePath: string;
  lineRange: { start: number; end: number };
  createdAt: Date;
  updatedAt: Date;
}

export interface DeveloperPattern {
  patternId: string;
  patternType: string;
  patternContent: Record<string, any>;
  frequency: number;
  contexts: string[];
  examples: Record<string, any>[];
  confidence: number;
  createdAt: Date;
  lastSeen: Date;
}

export interface FileIntelligence {
  filePath: string;
  fileHash: string;
  semanticConcepts: string[];
  patternsUsed: string[];
  complexityMetrics: Record<string, number>;
  dependencies: string[];
  lastAnalyzed: Date;
  createdAt: Date;
}

export interface AIInsight {
  insightId: string;
  insightType: string;
  insightContent: Record<string, any>;
  confidenceScore: number;
  sourceAgent: string;
  validationStatus: 'pending' | 'validated' | 'rejected';
  impactPrediction: Record<string, any>;
  createdAt: Date;
}

export interface FeatureMap {
  id: string;
  projectPath: string;
  featureName: string;
  primaryFiles: string[];
  relatedFiles: string[];
  dependencies: string[];
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface EntryPoint {
  id: string;
  projectPath: string;
  entryType: string;
  filePath: string;
  description?: string;
  framework?: string;
  createdAt: Date;
}

export interface KeyDirectory {
  id: string;
  projectPath: string;
  directoryPath: string;
  directoryType: string;
  fileCount: number;
  description?: string;
  createdAt: Date;
}

export interface WorkSession {
  id: string;
  projectPath: string;
  sessionStart: Date;
  sessionEnd?: Date;
  lastFeature?: string;
  currentFiles: string[];
  completedTasks: string[];
  pendingTasks: string[];
  blockers: string[];
  sessionNotes?: string;
  lastUpdated: Date;
}

export interface ProjectDecision {
  id: string;
  projectPath: string;
  decisionKey: string;
  decisionValue: string;
  reasoning?: string;
  madeAt: Date;
}

export class SQLiteDatabase {
  private db: Database.Database;
  private migrator: DatabaseMigrator;

  constructor(dbPath: string = ':memory:') {
    // Ensure parent directory exists for file-based databases
    if (dbPath !== ':memory:') {
      const dir = dirname(dbPath);
      if (!existsSync(dir)) {
        Logger.info(`Creating database directory: ${dir}`);
        mkdirSync(dir, { recursive: true });
      }
    }
    
    this.db = new Database(dbPath);
    this.migrator = new DatabaseMigrator(this.db);
    this.initializeDatabase();
  }

  private initializeDatabase(): void {
    // Run migrations if needed
    if (this.migrator.needsMigration()) {
      Logger.info('Running database migrations...');
      this.migrator.migrate();
    } else {
      Logger.info('Database is up to date');
    }
  }

  getMigrator(): DatabaseMigrator {
    return this.migrator;
  }

  // Semantic Concepts
  insertSemanticConcept(concept: Omit<SemanticConcept, 'createdAt' | 'updatedAt'>): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO semantic_concepts (
        id, concept_name, concept_type, confidence_score, 
        relationships, evolution_history, file_path, line_range
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      concept.id,
      concept.conceptName,
      concept.conceptType,
      concept.confidenceScore,
      JSON.stringify(concept.relationships),
      JSON.stringify(concept.evolutionHistory),
      concept.filePath,
      JSON.stringify(concept.lineRange)
    );
  }

  getSemanticConcepts(filePath?: string): SemanticConcept[] {
    let query = 'SELECT * FROM semantic_concepts';
    let params: any[] = [];

    if (filePath) {
      query += ' WHERE file_path = ?';
      params = [filePath];
    }

    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params) as any[];

    return rows.map(row => ({
      id: row.id,
      conceptName: row.concept_name,
      conceptType: row.concept_type,
      confidenceScore: row.confidence_score,
      relationships: JSON.parse(row.relationships || '{}'),
      evolutionHistory: JSON.parse(row.evolution_history || '{}'),
      filePath: row.file_path,
      lineRange: JSON.parse(row.line_range || '{"start": 0, "end": 0}'),
      createdAt: new Date(row.created_at + ' UTC'),
      updatedAt: new Date(row.updated_at + ' UTC')
    }));
  }

  // Developer Patterns
  insertDeveloperPattern(pattern: Omit<DeveloperPattern, 'createdAt' | 'lastSeen'>): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO developer_patterns (
        pattern_id, pattern_type, pattern_content, frequency,
        contexts, examples, confidence, last_seen
      ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);

    stmt.run(
      pattern.patternId,
      pattern.patternType,
      JSON.stringify(pattern.patternContent),
      pattern.frequency,
      JSON.stringify(pattern.contexts),
      JSON.stringify(pattern.examples),
      pattern.confidence
    );
  }

  getDeveloperPatterns(patternType?: string): DeveloperPattern[] {
    let query = 'SELECT * FROM developer_patterns';
    let params: any[] = [];

    if (patternType) {
      query += ' WHERE pattern_type = ?';
      params = [patternType];
    }

    query += ' ORDER BY frequency DESC, confidence DESC';

    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params) as any[];

    return rows.map(row => ({
      patternId: row.pattern_id,
      patternType: row.pattern_type,
      patternContent: JSON.parse(row.pattern_content),
      frequency: row.frequency,
      contexts: JSON.parse(row.contexts || '[]'),
      examples: JSON.parse(row.examples || '[]'),
      confidence: row.confidence,
      createdAt: new Date(row.created_at + ' UTC'),
      lastSeen: new Date(row.last_seen + ' UTC')
    }));
  }

  // File Intelligence
  insertFileIntelligence(fileIntel: Omit<FileIntelligence, 'createdAt'>): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO file_intelligence (
        file_path, file_hash, semantic_concepts, patterns_used,
        complexity_metrics, dependencies, last_analyzed
      ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);

    stmt.run(
      fileIntel.filePath,
      fileIntel.fileHash,
      JSON.stringify(fileIntel.semanticConcepts),
      JSON.stringify(fileIntel.patternsUsed),
      JSON.stringify(fileIntel.complexityMetrics),
      JSON.stringify(fileIntel.dependencies)
    );
  }

  getFileIntelligence(filePath: string): FileIntelligence | null {
    const stmt = this.db.prepare('SELECT * FROM file_intelligence WHERE file_path = ?');
    const row = stmt.get(filePath) as any;

    if (!row) return null;

    return {
      filePath: row.file_path,
      fileHash: row.file_hash,
      semanticConcepts: JSON.parse(row.semantic_concepts || '[]'),
      patternsUsed: JSON.parse(row.patterns_used || '[]'),
      complexityMetrics: JSON.parse(row.complexity_metrics || '{}'),
      dependencies: JSON.parse(row.dependencies || '[]'),
      lastAnalyzed: new Date(row.last_analyzed + ' UTC'),
      createdAt: new Date(row.created_at + ' UTC')
    };
  }

  // AI Insights
  insertAIInsight(insight: Omit<AIInsight, 'createdAt'>): void {
    const stmt = this.db.prepare(`
      INSERT INTO ai_insights (
        insight_id, insight_type, insight_content, confidence_score,
        source_agent, validation_status, impact_prediction
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      insight.insightId,
      insight.insightType,
      JSON.stringify(insight.insightContent),
      insight.confidenceScore,
      insight.sourceAgent,
      insight.validationStatus,
      JSON.stringify(insight.impactPrediction)
    );
  }

  getAIInsights(insightType?: string): AIInsight[] {
    let query = 'SELECT * FROM ai_insights';
    let params: any[] = [];

    if (insightType) {
      query += ' WHERE insight_type = ?';
      params = [insightType];
    }

    query += ' ORDER BY confidence_score DESC, created_at DESC';

    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params) as any[];

    return rows.map(row => ({
      insightId: row.insight_id,
      insightType: row.insight_type,
      insightContent: JSON.parse(row.insight_content),
      confidenceScore: row.confidence_score,
      sourceAgent: row.source_agent,
      validationStatus: row.validation_status as 'pending' | 'validated' | 'rejected',
      impactPrediction: JSON.parse(row.impact_prediction || '{}'),
      createdAt: new Date(row.created_at + ' UTC')
    }));
  }

  insertFeatureMap(feature: Omit<FeatureMap, 'createdAt' | 'updatedAt'>): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO feature_map (
        id, project_path, feature_name, primary_files, related_files,
        dependencies, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      feature.id,
      feature.projectPath,
      feature.featureName,
      JSON.stringify(feature.primaryFiles),
      JSON.stringify(feature.relatedFiles),
      JSON.stringify(feature.dependencies),
      feature.status
    );
  }

  getFeatureMaps(projectPath: string): FeatureMap[] {
    // Normalize path - try both absolute and relative (.) paths
    const paths = [projectPath];

    // If absolute path, also try relative "."
    if (isAbsolute(projectPath)) {
      paths.push('.');
    }

    // Try to find feature maps with any of the path variants
    let rows: any[] = [];
    for (const path of paths) {
      const stmt = this.db.prepare(`
        SELECT * FROM feature_map WHERE project_path = ? AND status = 'active'
        ORDER BY feature_name
      `);
      rows = stmt.all(path) as any[];
      if (rows.length > 0) break;
    }

    return rows.map(row => ({
      id: row.id,
      projectPath: row.project_path,
      featureName: row.feature_name,
      primaryFiles: JSON.parse(row.primary_files || '[]'),
      relatedFiles: JSON.parse(row.related_files || '[]'),
      dependencies: JSON.parse(row.dependencies || '[]'),
      status: row.status,
      createdAt: new Date(row.created_at + ' UTC'),
      updatedAt: new Date(row.updated_at + ' UTC')
    }));
  }

  searchFeatureMaps(projectPath: string, query: string): FeatureMap[] {
    const stmt = this.db.prepare(`
      SELECT * FROM feature_map
      WHERE project_path = ? AND status = 'active'
        AND (feature_name LIKE ? OR feature_name LIKE ? OR feature_name LIKE ?)
      ORDER BY feature_name
    `);
    const searchPattern = `%${query}%`;
    const rows = stmt.all(projectPath, searchPattern, searchPattern.toLowerCase(), searchPattern.toUpperCase()) as any[];

    return rows.map(row => ({
      id: row.id,
      projectPath: row.project_path,
      featureName: row.feature_name,
      primaryFiles: JSON.parse(row.primary_files || '[]'),
      relatedFiles: JSON.parse(row.related_files || '[]'),
      dependencies: JSON.parse(row.dependencies || '[]'),
      status: row.status,
      createdAt: new Date(row.created_at + ' UTC'),
      updatedAt: new Date(row.updated_at + ' UTC')
    }));
  }

  getFeatureByName(projectPath: string, featureName: string): FeatureMap | null {
    const stmt = this.db.prepare(`
      SELECT * FROM feature_map
      WHERE project_path = ? AND feature_name = ? AND status = 'active'
      LIMIT 1
    `);
    const row = stmt.get(projectPath, featureName) as any;

    if (!row) return null;

    return {
      id: row.id,
      projectPath: row.project_path,
      featureName: row.feature_name,
      primaryFiles: JSON.parse(row.primary_files || '[]'),
      relatedFiles: JSON.parse(row.related_files || '[]'),
      dependencies: JSON.parse(row.dependencies || '[]'),
      status: row.status,
      createdAt: new Date(row.created_at + ' UTC'),
      updatedAt: new Date(row.updated_at + ' UTC')
    };
  }

  insertEntryPoint(entryPoint: Omit<EntryPoint, 'createdAt'>): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO entry_points (
        id, project_path, entry_type, file_path, description, framework
      ) VALUES (?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      entryPoint.id,
      entryPoint.projectPath,
      entryPoint.entryType,
      entryPoint.filePath,
      entryPoint.description || null,
      entryPoint.framework || null
    );
  }

  getEntryPoints(projectPath: string): EntryPoint[] {
    // Normalize path - try both absolute and relative (.) paths
    const paths = [projectPath];

    // If absolute path, also try relative "."
    if (isAbsolute(projectPath)) {
      paths.push('.');
    }

    // Try to find entry points with any of the path variants
    let rows: any[] = [];
    for (const path of paths) {
      const stmt = this.db.prepare(`
        SELECT * FROM entry_points WHERE project_path = ?
        ORDER BY entry_type, file_path
      `);
      rows = stmt.all(path) as any[];
      if (rows.length > 0) break;
    }

    return rows.map(row => ({
      id: row.id,
      projectPath: row.project_path,
      entryType: row.entry_type,
      filePath: row.file_path,
      description: row.description,
      framework: row.framework,
      createdAt: new Date(row.created_at + ' UTC')
    }));
  }

  insertKeyDirectory(directory: Omit<KeyDirectory, 'createdAt'>): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO key_directories (
        id, project_path, directory_path, directory_type, file_count, description
      ) VALUES (?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      directory.id,
      directory.projectPath,
      directory.directoryPath,
      directory.directoryType,
      directory.fileCount,
      directory.description || null
    );
  }

  getKeyDirectories(projectPath: string): KeyDirectory[] {
    // Normalize path - try both absolute and relative (.) paths
    const paths = [projectPath];

    // If absolute path, also try relative "."
    if (isAbsolute(projectPath)) {
      paths.push('.');
    }

    // Try to find key directories with any of the path variants
    let rows: any[] = [];
    for (const path of paths) {
      const stmt = this.db.prepare(`
        SELECT * FROM key_directories WHERE project_path = ?
        ORDER BY directory_type, directory_path
      `);
      rows = stmt.all(path) as any[];
      if (rows.length > 0) break;
    }

    return rows.map(row => ({
      id: row.id,
      projectPath: row.project_path,
      directoryPath: row.directory_path,
      directoryType: row.directory_type,
      fileCount: row.file_count,
      description: row.description,
      createdAt: new Date(row.created_at + ' UTC')
    }));
  }

  insertProjectMetadata(metadata: {
    projectId: string;
    projectPath: string;
    projectName?: string;
    languagePrimary?: string;
    languagesDetected?: string[];
    frameworkDetected?: string[];
    intelligenceVersion?: string;
    lastFullScan?: Date;
  }): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO project_metadata (
        project_id, project_path, project_name, language_primary,
        languages_detected, framework_detected, intelligence_version, last_full_scan
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      metadata.projectId,
      metadata.projectPath,
      metadata.projectName || null,
      metadata.languagePrimary || null,
      metadata.languagesDetected ? JSON.stringify(metadata.languagesDetected) : null,
      metadata.frameworkDetected ? JSON.stringify(metadata.frameworkDetected) : null,
      metadata.intelligenceVersion || null,
      metadata.lastFullScan ? metadata.lastFullScan.toISOString() : null
    );
  }

  getProjectMetadata(projectPath: string): {
    projectId: string;
    projectPath: string;
    projectName?: string;
    languagePrimary?: string;
    languagesDetected: string[];
    frameworkDetected: string[];
    intelligenceVersion?: string;
    lastFullScan?: Date;
    createdAt: Date;
    updatedAt: Date;
  } | null {
    const stmt = this.db.prepare(`
      SELECT * FROM project_metadata WHERE project_path = ? LIMIT 1
    `);
    const row = stmt.get(projectPath) as any;

    if (!row) return null;

    return {
      projectId: row.project_id,
      projectPath: row.project_path,
      projectName: row.project_name,
      languagePrimary: row.language_primary,
      languagesDetected: JSON.parse(row.languages_detected || '[]'),
      frameworkDetected: JSON.parse(row.framework_detected || '[]'),
      intelligenceVersion: row.intelligence_version,
      lastFullScan: row.last_full_scan ? new Date(row.last_full_scan + ' UTC') : undefined,
      createdAt: new Date(row.created_at + ' UTC'),
      updatedAt: new Date(row.updated_at + ' UTC')
    };
  }

  createWorkSession(session: Omit<WorkSession, 'sessionStart' | 'lastUpdated'>): void {
    const stmt = this.db.prepare(`
      INSERT INTO work_sessions (
        id, project_path, session_end, last_feature, current_files,
        completed_tasks, pending_tasks, blockers, session_notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      session.id,
      session.projectPath,
      session.sessionEnd ? session.sessionEnd.toISOString() : null,
      session.lastFeature || null,
      JSON.stringify(session.currentFiles),
      JSON.stringify(session.completedTasks),
      JSON.stringify(session.pendingTasks),
      JSON.stringify(session.blockers),
      session.sessionNotes || null
    );
  }

  updateWorkSession(sessionId: string, updates: Partial<Omit<WorkSession, 'id' | 'projectPath' | 'sessionStart' | 'lastUpdated'>>): void {
    const fields: string[] = [];
    const values: any[] = [];

    if (updates.sessionEnd !== undefined) {
      fields.push('session_end = ?');
      values.push(updates.sessionEnd ? updates.sessionEnd.toISOString() : null);
    }
    if (updates.lastFeature !== undefined) {
      fields.push('last_feature = ?');
      values.push(updates.lastFeature);
    }
    if (updates.currentFiles !== undefined) {
      fields.push('current_files = ?');
      values.push(JSON.stringify(updates.currentFiles));
    }
    if (updates.completedTasks !== undefined) {
      fields.push('completed_tasks = ?');
      values.push(JSON.stringify(updates.completedTasks));
    }
    if (updates.pendingTasks !== undefined) {
      fields.push('pending_tasks = ?');
      values.push(JSON.stringify(updates.pendingTasks));
    }
    if (updates.blockers !== undefined) {
      fields.push('blockers = ?');
      values.push(JSON.stringify(updates.blockers));
    }
    if (updates.sessionNotes !== undefined) {
      fields.push('session_notes = ?');
      values.push(updates.sessionNotes);
    }

    if (fields.length === 0) return;

    fields.push('last_updated = CURRENT_TIMESTAMP');
    values.push(sessionId);

    const stmt = this.db.prepare(`
      UPDATE work_sessions SET ${fields.join(', ')} WHERE id = ?
    `);

    stmt.run(...values);
  }

  getCurrentWorkSession(projectPath: string): WorkSession | null {
    const stmt = this.db.prepare(`
      SELECT * FROM work_sessions
      WHERE project_path = ? AND session_end IS NULL
      ORDER BY session_start DESC
      LIMIT 1
    `);
    const row = stmt.get(projectPath) as any;

    if (!row) return null;

    return {
      id: row.id,
      projectPath: row.project_path,
      sessionStart: new Date(row.session_start + ' UTC'),
      sessionEnd: row.session_end ? new Date(row.session_end + ' UTC') : undefined,
      lastFeature: row.last_feature,
      currentFiles: JSON.parse(row.current_files || '[]'),
      completedTasks: JSON.parse(row.completed_tasks || '[]'),
      pendingTasks: JSON.parse(row.pending_tasks || '[]'),
      blockers: JSON.parse(row.blockers || '[]'),
      sessionNotes: row.session_notes,
      lastUpdated: new Date(row.last_updated + ' UTC')
    };
  }

  getWorkSessions(projectPath: string, limit = 10): WorkSession[] {
    const stmt = this.db.prepare(`
      SELECT * FROM work_sessions
      WHERE project_path = ?
      ORDER BY session_start DESC
      LIMIT ?
    `);
    const rows = stmt.all(projectPath, limit) as any[];

    return rows.map(row => ({
      id: row.id,
      projectPath: row.project_path,
      sessionStart: new Date(row.session_start + ' UTC'),
      sessionEnd: row.session_end ? new Date(row.session_end + ' UTC') : undefined,
      lastFeature: row.last_feature,
      currentFiles: JSON.parse(row.current_files || '[]'),
      completedTasks: JSON.parse(row.completed_tasks || '[]'),
      pendingTasks: JSON.parse(row.pending_tasks || '[]'),
      blockers: JSON.parse(row.blockers || '[]'),
      sessionNotes: row.session_notes,
      lastUpdated: new Date(row.last_updated + ' UTC')
    }));
  }

  upsertProjectDecision(decision: Omit<ProjectDecision, 'madeAt'>): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO project_decisions (
        id, project_path, decision_key, decision_value, reasoning
      ) VALUES (?, ?, ?, ?, ?)
    `);

    stmt.run(
      decision.id,
      decision.projectPath,
      decision.decisionKey,
      decision.decisionValue,
      decision.reasoning || null
    );
  }

  getProjectDecisions(projectPath: string, limit = 20): ProjectDecision[] {
    const stmt = this.db.prepare(`
      SELECT * FROM project_decisions
      WHERE project_path = ?
      ORDER BY made_at DESC
      LIMIT ?
    `);
    const rows = stmt.all(projectPath, limit) as any[];

    return rows.map(row => ({
      id: row.id,
      projectPath: row.project_path,
      decisionKey: row.decision_key,
      decisionValue: row.decision_value,
      reasoning: row.reasoning,
      madeAt: new Date(row.made_at + ' UTC')
    }));
  }

  getProjectDecision(projectPath: string, decisionKey: string): ProjectDecision | null {
    const stmt = this.db.prepare(`
      SELECT * FROM project_decisions
      WHERE project_path = ? AND decision_key = ?
    `);
    const row = stmt.get(projectPath, decisionKey) as any;

    if (!row) return null;

    return {
      id: row.id,
      projectPath: row.project_path,
      decisionKey: row.decision_key,
      decisionValue: row.decision_value,
      reasoning: row.reasoning,
      madeAt: new Date(row.made_at + ' UTC')
    };
  }

  close(): void {
    this.db.close();
  }
}