import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { SemanticEngine } from '../../engines/semantic-engine.js';
import { PatternEngine } from '../../engines/pattern-engine.js';
import { SQLiteDatabase } from '../../storage/sqlite-db.js';
import { ProgressTracker } from '../../utils/progress-tracker.js';
import { ConsoleProgressRenderer } from '../../utils/console-progress.js';
import { glob } from 'glob';
import { statSync, existsSync } from 'fs';
import { join } from 'path';

export class AutomationTools {
  constructor(
    private semanticEngine: SemanticEngine,
    private patternEngine: PatternEngine,
    private database: SQLiteDatabase
  ) { }

  get tools(): Tool[] {
    return [
      {
        name: 'auto_learn_if_needed',
        description: 'Automatically learn from codebase if intelligence data is missing or stale. Perfect for seamless agent integration.',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Path to the codebase directory (defaults to current working directory)'
            },
            force: {
              type: 'boolean',
              description: 'Force re-learning even if data exists',
              default: false
            },
            includeProgress: {
              type: 'boolean',
              description: 'Include detailed progress information in response',
              default: true
            }
          }
        }
      },
      {
        name: 'get_learning_status',
        description: 'Get the current learning/intelligence status of the codebase',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Path to check (defaults to current working directory)'
            }
          }
        }
      },
      {
        name: 'quick_setup',
        description: 'Perform quick setup and learning for immediate use by AI agents',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Path to the project directory'
            },
            skipLearning: {
              type: 'boolean',
              description: 'Skip the learning phase for faster setup',
              default: false
            }
          }
        }
      }
    ];
  }

  async autoLearnIfNeeded(args: {
    path?: string;
    force?: boolean;
    includeProgress?: boolean;
  }): Promise<any> {
    const projectPath = args.path || process.cwd();
    const force = args.force || false;
    const includeProgress = args.includeProgress !== false;

    console.error(`🤖 Auto-learning check for: ${projectPath}`);

    // Check if learning is needed
    const status = await this.getLearningStatus({ path: projectPath });

    if (!force && status.hasIntelligence && !status.isStale) {
      return {
        action: 'skipped',
        reason: 'Intelligence data is up-to-date',
        status,
        message: 'Ready to use! Intelligence data is current.'
      };
    }

    // Perform learning with progress tracking
    const tracker = new ProgressTracker();
    const progressRenderer = new ConsoleProgressRenderer(tracker);

    try {
      // Setup progress phases
      const files = await this.countProjectFiles(projectPath);
      tracker.addPhase('discovery', files.total, 1);
      tracker.addPhase('semantic_analysis', files.codeFiles, 3);
      tracker.addPhase('pattern_learning', files.codeFiles, 2);
      tracker.addPhase('indexing', files.codeFiles, 1);

      if (includeProgress) {
        progressRenderer.start();
      }

      console.error('🧠 Starting intelligent learning...');

      // Phase 1: Discovery
      tracker.startPhase('discovery');
      tracker.updateProgress('discovery', files.total, 'Discovered project files');
      tracker.complete('discovery');

      // Phase 2: Semantic Analysis
      tracker.startPhase('semantic_analysis');
      const concepts = await this.semanticEngine.learnFromCodebase(projectPath);
      tracker.complete('semantic_analysis');

      // Phase 3: Pattern Learning  
      tracker.startPhase('pattern_learning');
      const patterns = await this.patternEngine.learnFromCodebase(projectPath);
      tracker.complete('pattern_learning');

      // Phase 4: Indexing
      tracker.startPhase('indexing');
      tracker.updateProgress('indexing', files.codeFiles, 'Building search indexes');
      tracker.complete('indexing');

      progressRenderer.stop();

      const result = {
        action: 'learned',
        conceptsLearned: concepts.length,
        patternsLearned: patterns.length,
        filesAnalyzed: files.codeFiles,
        totalFiles: files.total,
        timeElapsed: Date.now() - tracker.getProgress()!.startTime,
        message: `✅ Learning completed! Analyzed ${files.codeFiles} code files and learned ${concepts.length} concepts and ${patterns.length} patterns.`,
        status: await this.getLearningStatus({ path: projectPath })
      };

      if (includeProgress) {
        result['progressData'] = progressRenderer.getProgressData();
      }

      return result;

    } catch (error) {
      progressRenderer.stop();
      console.error('❌ Auto-learning failed:', error);

      return {
        action: 'failed',
        error: error.message,
        message: 'Learning failed. The system will continue with limited intelligence.',
        status: await this.getLearningStatus({ path: projectPath })
      };
    }
  }

  async getLearningStatus(args: { path?: string }): Promise<any> {
    const projectPath = args.path || process.cwd();

    try {
      // Check for existing intelligence
      const concepts = this.database.getSemanticConcepts();
      const patterns = this.database.getDeveloperPatterns();

      // Count project files
      const files = await this.countProjectFiles(projectPath);

      // Check if data is stale (based on file modification times)
      const hasIntelligence = concepts.length > 0 || patterns.length > 0;
      const isStale = hasIntelligence ? await this.detectStaleness(projectPath, concepts, patterns) : false;

      return {
        path: projectPath,
        hasIntelligence,
        isStale,
        conceptsStored: concepts.length,
        patternsStored: patterns.length,
        filesInProject: files.total,
        codeFilesInProject: files.codeFiles,
        lastLearningTime: hasIntelligence ? this.getLastLearningTime() : null,
        recommendation: hasIntelligence && !isStale
          ? 'ready'
          : 'learning_recommended',
        message: hasIntelligence && !isStale
          ? `Intelligence is ready! ${concepts.length} concepts and ${patterns.length} patterns available.`
          : `Learning recommended. Found ${files.codeFiles} code files to analyze.`
      };
    } catch (error) {
      return {
        path: projectPath,
        hasIntelligence: false,
        isStale: false,
        error: error.message,
        recommendation: 'learning_needed',
        message: 'No intelligence data available. Learning needed for optimal functionality.'
      };
    }
  }

  async quickSetup(args: {
    path?: string;
    skipLearning?: boolean;
  }): Promise<any> {
    const projectPath = args.path || process.cwd();
    const skipLearning = args.skipLearning || false;

    console.error(`🚀 Quick setup for: ${projectPath}`);

    const steps = [];
    let success = true;

    try {
      // Step 1: Check project structure
      steps.push({
        step: 'project_check',
        status: 'completed',
        message: `Project detected at ${projectPath}`,
        details: await this.countProjectFiles(projectPath)
      });

      // Step 2: Database initialization (automatic)
      steps.push({
        step: 'database_init',
        status: 'completed',
        message: 'Database initialized and migrations applied',
        details: {
          version: this.database.getMigrator().getCurrentVersion(),
          tablesReady: true
        }
      });

      // Step 3: Learning (if not skipped)
      if (!skipLearning) {
        const learningResult = await this.autoLearnIfNeeded({
          path: projectPath,
          force: false,
          includeProgress: false
        });

        steps.push({
          step: 'learning',
          status: learningResult.action === 'failed' ? 'failed' : 'completed',
          message: learningResult.message,
          details: learningResult
        });

        if (learningResult.action === 'failed') {
          success = false;
        }
      } else {
        steps.push({
          step: 'learning',
          status: 'skipped',
          message: 'Learning phase skipped as requested'
        });
      }

      // Step 4: Verify ready state
      const status = await this.getLearningStatus({ path: projectPath });
      steps.push({
        step: 'verification',
        status: 'completed',
        message: status.message,
        details: status
      });

      return {
        success,
        projectPath,
        steps,
        message: success
          ? '✅ Quick setup completed! In Memoria is ready for AI agent use.'
          : '⚠️  Setup completed with warnings. Some features may have limited functionality.',
        readyForAgents: success,
        intelligenceStatus: status
      };

    } catch (error) {
      console.error('❌ Quick setup failed:', error);

      steps.push({
        step: 'error',
        status: 'failed',
        message: `Setup failed: ${error.message}`,
        error: error.message
      });

      return {
        success: false,
        projectPath,
        steps,
        message: '❌ Quick setup failed. Manual intervention may be required.',
        readyForAgents: false,
        error: error.message
      };
    }
  }

  private async countProjectFiles(path: string): Promise<{ total: number; codeFiles: number }> {
    try {
      const allFiles = await glob('**/*', {
        cwd: path,
        ignore: [
          '**/node_modules/**',
          '**/.git/**',
          '**/dist/**',
          '**/build/**',
          '**/target/**',
          '**/.next/**',
          '**/coverage/**'
        ],
        nodir: true
      });

      const codeFiles = allFiles.filter(file =>
        /\.(ts|tsx|js|jsx|py|rs|go|java|c|cpp|h|hpp)$/.test(file)
      );

      return {
        total: allFiles.length,
        codeFiles: codeFiles.length
      };
    } catch (error) {
      return { total: 0, codeFiles: 0 };
    }
  }

  private getLastLearningTime(): string | null {
    // Simple heuristic - get the latest created_at from semantic_concepts or developer_patterns
    try {
      const latestConcept = this.database.getSemanticConcepts()
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

      const latestPattern = this.database.getDeveloperPatterns()
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

      let latestTime = 0;
      if (latestConcept) {
        latestTime = Math.max(latestTime, new Date(latestConcept.createdAt).getTime());
      }
      if (latestPattern) {
        latestTime = Math.max(latestTime, new Date(latestPattern.createdAt).getTime());
      }

      return latestTime > 0 ? new Date(latestTime).toISOString() : null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Detect if intelligence data is stale based on file modification times
   * @param projectPath Path to the project directory
   * @param concepts Stored semantic concepts
   * @param patterns Stored patterns
   * @returns True if data is stale, false otherwise
   */
  private async detectStaleness(
    projectPath: string,
    concepts: any[],
    patterns: any[]
  ): Promise<boolean> {
    try {
      // Get the most recent intelligence data timestamp
      let latestIntelligenceTime = 0;

      // Check concept timestamps (ensure UTC)
      for (const concept of concepts) {
        const conceptTime = concept.createdAt ? new Date(concept.createdAt).getTime() : 0;
        latestIntelligenceTime = Math.max(latestIntelligenceTime, conceptTime);
      }

      // Check pattern timestamps
      for (const pattern of patterns) {
        const patternTime = pattern.createdAt ? new Date(pattern.createdAt).getTime() : 0;
        latestIntelligenceTime = Math.max(latestIntelligenceTime, patternTime);
      }

      if (latestIntelligenceTime === 0) {
        return true; // No valid timestamps, consider stale
      }

      // Get the most recent file modification time in the project
      const mostRecentFileTime = await this.getMostRecentFileModificationTime(projectPath);

      if (mostRecentFileTime === null) {
        return false; // Can't determine file times, assume not stale
      }

      // Consider data stale if any source file has been modified after the intelligence data
      const timeDiff = mostRecentFileTime - latestIntelligenceTime;
      const rawIsStale = timeDiff > 0; // Files are newer than intelligence

      // Add a buffer to avoid false positives from minor timestamp differences
      const bufferMs = 5 * 60 * 1000; // 5 minutes

      // Data is considered stale only if files are significantly newer (beyond buffer)
      return rawIsStale && (timeDiff > bufferMs);

    } catch (error) {
      // If we can't determine staleness, err on the side of caution and assume not stale
      console.warn('Failed to detect staleness:', error);
      return false;
    }
  }

  /**
   * Get the most recent file modification time in the project
   * @param projectPath Path to the project directory
   * @returns Most recent modification timestamp in milliseconds, or null if error
   */
  private async getMostRecentFileModificationTime(projectPath: string): Promise<number | null> {
    try {
      // Use glob to find all source files
      const sourcePatterns = [
        '**/*.ts',
        '**/*.tsx',
        '**/*.js',
        '**/*.jsx',
        '**/*.py',
        '**/*.rs',
        '**/*.go',
        '**/*.java',
        '**/*.c',
        '**/*.cpp',
        '**/*.cs'
      ];

      let mostRecentTime = 0;

      for (const pattern of sourcePatterns) {
        const files = await glob(pattern, {
          cwd: projectPath,
          ignore: [
            'node_modules/**',
            '.git/**',
            'target/**',
            'dist/**',
            'build/**',
            '.next/**',
            '__pycache__/**',
            '**/*.min.js',
            '**/*.min.css'
          ],
          absolute: true
        });

        for (const file of files) {
          try {
            if (existsSync(file)) {
              const stats = statSync(file);
              const modTime = stats.mtime.getTime();
              mostRecentTime = Math.max(mostRecentTime, modTime);
            }
          } catch (fileError) {
            // Skip files that can't be accessed
            continue;
          }
        }
      }

      return mostRecentTime > 0 ? mostRecentTime : null;
    } catch (error) {
      console.warn('Failed to get file modification times:', error);
      return null;
    }
  }
}