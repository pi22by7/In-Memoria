import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { SemanticEngine } from '../../engines/semantic-engine.js';
import { PatternEngine } from '../../engines/pattern-engine.js';
import { SQLiteDatabase } from '../../storage/sqlite-db.js';
import { ProgressTracker } from '../../utils/progress-tracker.js';
import { ConsoleProgressRenderer } from '../../utils/console-progress.js';
import { FileTraversal } from '../../utils/file-traversal.js';
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
        description: 'Automatically learn from codebase if intelligence data is missing or stale. Call this first before using other In-Memoria tools - it\'s a no-op if data already exists. Includes project setup and verification. Perfect for seamless agent integration.',
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
            },
            skipLearning: {
              type: 'boolean',
              description: 'Skip the learning phase for faster setup (Phase 4: merged from quick_setup)',
              default: false
            },
            includeSetupSteps: {
              type: 'boolean',
              description: 'Include detailed setup verification steps (Phase 4: merged from quick_setup)',
              default: false
            }
          }
        }
      }
      // DEPRECATED (Phase 4): Merged into get_project_blueprint - returns learning status in blueprint
      // {
      //   name: 'get_learning_status',
      //   description: 'Get the current learning/intelligence status of the codebase',
      //   inputSchema: {
      //     type: 'object',
      //     properties: {
      //       path: {
      //         type: 'string',
      //         description: 'Path to check (defaults to current working directory)'
      //       }
      //     }
      //   }
      // },
      // DEPRECATED (Phase 4): Merged into auto_learn_if_needed - same functionality
      // {
      //   name: 'quick_setup',
      //   description: 'Perform quick setup and learning for immediate use by AI agents',
      //   inputSchema: {
      //     type: 'object',
      //     properties: {
      //       path: {
      //         type: 'string',
      //         description: 'Path to the project directory'
      //       },
      //       skipLearning: {
      //         type: 'boolean',
      //         description: 'Skip the learning phase for faster setup',
      //         default: false
      //       }
      //     }
      //   }
      // }
    ];
  }

  /**
   * Auto-learn intelligence if needed (KISS: orchestration method)
   * Delegates to focused helper methods for clarity
   */
  async autoLearnIfNeeded(args: {
    path?: string;
    force?: boolean;
    includeProgress?: boolean;
    skipLearning?: boolean;
    includeSetupSteps?: boolean;
  }): Promise<any> {
    const projectPath = args.path || process.cwd();
    const setupSteps = await this.initializeSetupSteps(args.includeSetupSteps, projectPath);

    // Check if learning should be skipped
    const status = await this.getLearningStatus({ path: projectPath });
    const skipResult = this.shouldSkipLearning(args, status, setupSteps, projectPath);
    if (skipResult) return skipResult;

    // Perform learning with progress tracking
    const { tracker, progressRenderer, files } = await this.setupProgressTracking(projectPath, args.includeProgress);

    try {
      // Execute learning phases
      const concepts = await this.executeSemanticAnalysis(projectPath, tracker);
      const patterns = await this.executePatternLearning(projectPath, tracker, files);
      await this.executeIndexing(tracker, files);

      progressRenderer.stop();
      this.printLearningSummary(concepts, patterns, files, tracker);

      return this.buildLearningResult(args.includeSetupSteps, setupSteps, projectPath, concepts, patterns, files, tracker, progressRenderer, args.includeProgress);

    } catch (error: unknown) {
      progressRenderer.stop();
      return this.handleLearningError(error, args.includeSetupSteps, setupSteps, projectPath);
    } finally {
      progressRenderer.stop();
    }
  }

  /**
   * Initialize setup steps if includeSetupSteps is true
   */
  private async initializeSetupSteps(includeSetupSteps?: boolean, projectPath?: string): Promise<any[] | undefined> {
    if (!includeSetupSteps) {
      console.error(`\n🚀 Quick setup for: ${projectPath}`);
      return undefined;
    }

    console.error(`🚀 Quick setup for: ${projectPath}`);
    const steps: any[] = [];

    // Project check
    const files = await FileTraversal.countProjectFiles(projectPath!);
    steps.push({
      step: 'project_check',
      status: 'completed',
      message: `Project detected at ${projectPath}`,
      details: files
    });

    // Database initialization
    steps.push({
      step: 'database_init',
      status: 'completed',
      message: 'Database initialized and migrations applied',
      details: {
        version: this.database.getMigrator().getCurrentVersion(),
        tablesReady: true
      }
    });

    return steps;
  }

  /**
   * Check if learning should be skipped and return early result if so
   */
  private shouldSkipLearning(args: any, status: any, setupSteps: any[] | undefined, projectPath: string): any | null {
    // Skip if explicitly requested
    if (args.skipLearning) {
      if (setupSteps) {
        setupSteps.push({ step: 'learning', status: 'skipped', message: 'Learning phase skipped as requested' });
        setupSteps.push({ step: 'verification', status: 'completed', message: status.message, details: status });
        return {
          success: true,
          action: 'setup_completed',
          projectPath,
          steps: setupSteps,
          message: '✅ Quick setup completed! In Memoria is ready for AI agent use.',
          readyForAgents: status.hasIntelligence,
          intelligenceStatus: status
        };
      }
      return { action: 'skipped', reason: 'Learning phase skipped', status, message: 'Setup completed without learning.' };
    }

    // Skip if intelligence is up-to-date
    if (!args.force && status.hasIntelligence && !status.isStale) {
      if (setupSteps) {
        setupSteps.push({ step: 'learning', status: 'skipped', message: 'Intelligence data is up-to-date' });
        setupSteps.push({ step: 'verification', status: 'completed', message: status.message, details: status });
        return {
          success: true,
          action: 'setup_completed',
          projectPath,
          steps: setupSteps,
          message: '✅ Setup completed! Intelligence data is current.',
          readyForAgents: true,
          intelligenceStatus: status
        };
      }
      return { action: 'skipped', reason: 'Intelligence data is up-to-date', status, message: 'Ready to use! Intelligence data is current.' };
    }

    return null; // Continue with learning
  }

  /**
   * Setup progress tracking infrastructure
   */
  private async setupProgressTracking(projectPath: string, includeProgress?: boolean): Promise<{
    tracker: ProgressTracker;
    progressRenderer: ConsoleProgressRenderer;
    files: { total: number; codeFiles: number };
  }> {
    const tracker = new ProgressTracker();
    const progressRenderer = new ConsoleProgressRenderer(tracker);
    const files = await FileTraversal.countProjectFiles(projectPath);

    tracker.addPhase('discovery', files.total, 1);
    tracker.addPhase('semantic_analysis', files.codeFiles, 3);
    tracker.addPhase('pattern_learning', files.codeFiles, 2);
    tracker.addPhase('indexing', files.codeFiles, 1);

    console.error(`\n🧠 Starting intelligent learning...`);
    console.error('━'.repeat(60) + '\n');

    if (includeProgress) {
      progressRenderer.start();
    }

    // Discovery phase completes immediately
    tracker.startPhase('discovery');
    tracker.complete('discovery');

    return { tracker, progressRenderer, files };
  }

  /**
   * Execute semantic analysis with timeout and progress tracking
   */
  private async executeSemanticAnalysis(projectPath: string, tracker: ProgressTracker): Promise<any[]> {
    tracker.startPhase('semantic_analysis');
    const start = Date.now();

    try {
      let timeoutId: NodeJS.Timeout | null = null;
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error('Semantic analysis timed out after 5 minutes. This often happens with large projects.'));
        }, 300000);
      });

      try {
        const concepts = await Promise.race([
          this.semanticEngine.learnFromCodebase(projectPath, (current, total, message) => {
            tracker.updateProgress('semantic_analysis', current, message);
          }),
          timeoutPromise
        ]);

        tracker.complete('semantic_analysis');
        const elapsed = Date.now() - start;
        if (elapsed > 120000) {
          console.error(`\n⚠️  Semantic analysis took ${Math.round(elapsed / 1000)}s. Consider excluding large generated files.`);
        }

        return concepts;
      } finally {
        if (timeoutId) clearTimeout(timeoutId);
      }
    } catch (error) {
      tracker.complete('semantic_analysis');
      throw error;
    }
  }

  /**
   * Execute pattern learning with progress tracking
   */
  private async executePatternLearning(projectPath: string, tracker: ProgressTracker, files: { codeFiles: number }): Promise<any[]> {
    tracker.startPhase('pattern_learning');
    tracker.updateProgress('pattern_learning', 1, 'Analyzing code patterns...');

    const patterns = await this.patternEngine.learnFromCodebase(projectPath, (current, total, message) => {
      const mapped = Math.floor((current / 100) * files.codeFiles);
      tracker.updateProgress('pattern_learning', Math.max(1, mapped), message);
    });

    tracker.complete('pattern_learning');
    return patterns;
  }

  /**
   * Execute indexing phase
   */
  private async executeIndexing(tracker: ProgressTracker, files: { codeFiles: number }): Promise<void> {
    tracker.startPhase('indexing');
    tracker.updateProgress('indexing', 1, 'Indexing concepts and patterns...');
    tracker.updateProgress('indexing', Math.floor(files.codeFiles / 2), 'Building search structures...');
    tracker.complete('indexing');
  }

  /**
   * Print learning summary to console
   */
  private printLearningSummary(concepts: any[], patterns: any[], files: any, tracker: ProgressTracker): void {
    const totalTime = Date.now() - tracker.getProgress()!.startTime;
    const separator = '━'.repeat(60);

    console.error(`${separator}`);
    console.error(`📊 Concepts:  ${concepts.length.toLocaleString()}`);
    console.error(`🔍 Patterns:  ${patterns.length.toLocaleString()}`);
    console.error(`📁 Files:     ${files.codeFiles.toLocaleString()}`);
    console.error(`⏱️  Time:      ${this.formatDuration(totalTime)}`);
    console.error(separator);
  }

  /**
   * Build final learning result based on mode
   */
  private async buildLearningResult(
    includeSetupSteps: boolean | undefined,
    setupSteps: any[] | undefined,
    projectPath: string,
    concepts: any[],
    patterns: any[],
    files: any,
    tracker: ProgressTracker,
    progressRenderer: ConsoleProgressRenderer,
    includeProgress?: boolean
  ): Promise<any> {
    const elapsed = Date.now() - tracker.getProgress()!.startTime;

    if (includeSetupSteps && setupSteps) {
      setupSteps.push({
        step: 'learning',
        status: 'completed',
        message: `Learned ${concepts.length} concepts and ${patterns.length} patterns`,
        details: { conceptsLearned: concepts.length, patternsLearned: patterns.length, filesAnalyzed: files.codeFiles }
      });

      const finalStatus = await this.getLearningStatus({ path: projectPath });
      setupSteps.push({ step: 'verification', status: 'completed', message: finalStatus.message, details: finalStatus });

      return {
        success: true,
        action: 'setup_completed',
        projectPath,
        steps: setupSteps,
        conceptsLearned: concepts.length,
        patternsLearned: patterns.length,
        filesAnalyzed: files.codeFiles,
        totalFiles: files.total,
        timeElapsed: elapsed,
        message: '✅ Quick setup completed! In Memoria is ready for AI agent use.',
        readyForAgents: true,
        intelligenceStatus: finalStatus
      };
    }

    const result: any = {
      action: 'learned',
      conceptsLearned: concepts.length,
      patternsLearned: patterns.length,
      filesAnalyzed: files.codeFiles,
      totalFiles: files.total,
      timeElapsed: elapsed,
      message: `✅ Learning completed! Analyzed ${files.codeFiles} code files and learned ${concepts.length} concepts and ${patterns.length} patterns.`,
      status: await this.getLearningStatus({ path: projectPath })
    };

    if (includeProgress) {
      result.progressData = progressRenderer.getProgressData();
    }

    return result;
  }

  /**
   * Handle learning errors based on mode
   */
  private async handleLearningError(error: unknown, includeSetupSteps: boolean | undefined, setupSteps: any[] | undefined, projectPath: string): Promise<any> {
    console.error('❌ Auto-learning failed:', error);

    if (includeSetupSteps && setupSteps) {
      setupSteps.push({
        step: 'error',
        status: 'failed',
        message: `Setup failed: ${error instanceof Error ? error.message : String(error)}`,
        error: error instanceof Error ? error.message : String(error)
      });

      return {
        success: false,
        action: 'setup_failed',
        projectPath,
        steps: setupSteps,
        message: '❌ Quick setup failed. Manual intervention may be required.',
        readyForAgents: false,
        error: error instanceof Error ? error.message : String(error),
        status: await this.getLearningStatus({ path: projectPath })
      };
    }

    return {
      action: 'failed',
      error: error instanceof Error ? error.message : String(error),
      message: 'Learning failed. The system will continue with limited intelligence.',
      status: await this.getLearningStatus({ path: projectPath })
    };
  }

  async getLearningStatus(args: { path?: string }): Promise<any> {
    const projectPath = args.path || process.cwd();

    try {
      // Check for existing intelligence
      const concepts = this.database.getSemanticConcepts();
      const patterns = this.database.getDeveloperPatterns();

      // Count project files
      const files = await FileTraversal.countProjectFiles(projectPath);

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
    } catch (error: unknown) {
      return {
        path: projectPath,
        hasIntelligence: false,
        isStale: false,
        error: error instanceof Error ? error.message : String(error),
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
        details: await FileTraversal.countProjectFiles(projectPath)
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

    } catch (error: unknown) {
      console.error('❌ Quick setup failed:', error);

      steps.push({
        step: 'error',
        status: 'failed',
        message: `Setup failed: ${error instanceof Error ? error.message : String(error)}`,
        error: error instanceof Error ? error.message : String(error)
      });

      return {
        success: false,
        projectPath,
        steps,
        message: '❌ Quick setup failed. Manual intervention may be required.',
        readyForAgents: false,
        error: error instanceof Error ? error.message : String(error)
      };
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

  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
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
      // Use FileTraversal to find all code files
      const files = await FileTraversal.collectCodeFiles(projectPath);

      let mostRecentTime = 0;

      for (const file of files) {
        try {
          const absolutePath = join(projectPath, file);
          if (existsSync(absolutePath)) {
            const stats = statSync(absolutePath);
            const modTime = stats.mtime.getTime();
            mostRecentTime = Math.max(mostRecentTime, modTime);
          }
        } catch (fileError) {
          // Skip files that can't be accessed
          continue;
        }
      }

      return mostRecentTime > 0 ? mostRecentTime : null;
    } catch (error) {
      console.warn('Failed to get file modification times:', error);
      return null;
    }
  }
}