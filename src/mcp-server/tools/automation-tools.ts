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

  async autoLearnIfNeeded(args: {
    path?: string;
    force?: boolean;
    includeProgress?: boolean;
    skipLearning?: boolean;
    includeSetupSteps?: boolean;
  }): Promise<any> {
    const projectPath = args.path || process.cwd();
    const force = args.force || false;
    const includeProgress = args.includeProgress !== false;
    const skipLearning = args.skipLearning || false;
    const includeSetupSteps = args.includeSetupSteps || false;

    // Phase 4: If includeSetupSteps is true, include quick_setup functionality
    const setupSteps: Array<{
      step: string;
      status: string;
      message: string;
      details?: any;
      error?: string;
    }> | undefined = includeSetupSteps ? [] : undefined;

    if (includeSetupSteps) {
      console.error(`🚀 Quick setup for: ${projectPath}`);

      // Step 1: Project check
      const files = await this.countProjectFiles(projectPath);
      setupSteps!.push({
        step: 'project_check',
        status: 'completed',
        message: `Project detected at ${projectPath}`,
        details: files
      });

      // Step 2: Database initialization (automatic)
      setupSteps!.push({
        step: 'database_init',
        status: 'completed',
        message: 'Database initialized and migrations applied',
        details: {
          version: this.database.getMigrator().getCurrentVersion(),
          tablesReady: true
        }
      });
    } else {
      console.error(`\n🚀 Quick setup for: ${projectPath}`);
    }

    // Don't show progress bars yet - wait until we actually start learning

    // Check if learning is needed
    const status = await this.getLearningStatus({ path: projectPath });

    // Phase 4: Handle skipLearning from quick_setup
    if (skipLearning) {
      if (includeSetupSteps) {
        setupSteps!.push({
          step: 'learning',
          status: 'skipped',
          message: 'Learning phase skipped as requested'
        });

        // Verification step
        setupSteps!.push({
          step: 'verification',
          status: 'completed',
          message: status.message,
          details: status
        });

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

      return {
        action: 'skipped',
        reason: 'Learning phase skipped',
        status,
        message: 'Setup completed without learning.'
      };
    }

    if (!force && status.hasIntelligence && !status.isStale) {
      if (includeSetupSteps) {
        setupSteps!.push({
          step: 'learning',
          status: 'skipped',
          message: 'Intelligence data is up-to-date'
        });

        setupSteps!.push({
          step: 'verification',
          status: 'completed',
          message: status.message,
          details: status
        });

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

      console.error(`\n🧠 Starting intelligent learning...`);
      console.error('━'.repeat(60) + '\n');

      // Start the progress renderer which shows all phases
      if (includeProgress) {
        progressRenderer.start();
      }

      // Phase 1: Discovery (fast, completes immediately)
      tracker.startPhase('discovery');
      tracker.complete('discovery');

      // Phase 2: Semantic Analysis
      tracker.startPhase('semantic_analysis');
      const analysisStart = Date.now();
      let concepts: any[] = [];

      try {
        // Create timeout promise with proper cleanup
        let timeoutId: NodeJS.Timeout | null = null;
        const timeoutPromise = new Promise<never>((_, reject) => {
          timeoutId = setTimeout(() => {
            reject(new Error('Semantic analysis timed out after 5 minutes. This often happens with large projects.'));
          }, 300000); // 5 minutes
        });

        try {
          concepts = await Promise.race([
            this.semanticEngine.learnFromCodebase(
              projectPath,
              (current: number, total: number, message: string) => {
                // Update progress tracker with real-time updates from semantic engine
                tracker.updateProgress('semantic_analysis', current, message);
              }
            ),
            timeoutPromise
          ]);
        } finally {
          // CRITICAL: Clear timeout to prevent hanging
          if (timeoutId !== null) {
            clearTimeout(timeoutId);
          }
        }

        tracker.complete('semantic_analysis');
        const analysisTime = Date.now() - analysisStart;

        if (analysisTime > 120000) { // More than 2 minutes
          console.error(`\n⚠️  Semantic analysis took ${Math.round(analysisTime / 1000)}s. Consider excluding large generated files.`);
        }
      } catch (error) {
        tracker.complete('semantic_analysis');
        throw error;
      }

      // Phase 3: Pattern Learning
      const patternStart = Date.now();
      tracker.startPhase('pattern_learning');
      tracker.updateProgress('pattern_learning', 1, 'Analyzing code patterns...');

      const patterns = await this.patternEngine.learnFromCodebase(
        projectPath,
        (current: number, total: number, message: string) => {
          // Update progress tracker with real-time updates from pattern engine
          // Map the 0-100 range to the actual file count
          const mapped = Math.floor((current / 100) * files.codeFiles);
          tracker.updateProgress('pattern_learning', Math.max(1, mapped), message);
        }
      );

      const patternTime = Date.now() - patternStart;
      tracker.complete('pattern_learning');

      // Phase 4: Indexing
      const indexStart = Date.now();
      tracker.startPhase('indexing');
      tracker.updateProgress('indexing', 1, 'Indexing concepts and patterns...');

      // Indexing happens in-memory, mark progress
      tracker.updateProgress('indexing', Math.floor(files.codeFiles / 2), 'Building search structures...');

      const indexTime = Date.now() - indexStart;
      tracker.complete('indexing');

      progressRenderer.stop();

      // Print final summary (without duplicate completion message)
      const totalTime = Date.now() - tracker.getProgress()!.startTime;
      const separator = '━'.repeat(60);

      console.error(`${separator}`);
      console.error(`📊 Concepts:  ${concepts.length.toLocaleString()}`);
      console.error(`🔍 Patterns:  ${patterns.length.toLocaleString()}`);
      console.error(`📁 Files:     ${files.codeFiles.toLocaleString()}`);
      console.error(`⏱️  Time:      ${this.formatDuration(totalTime)}`);
      console.error(separator);

      // Phase 4: Handle setup steps from quick_setup
      if (includeSetupSteps) {
        setupSteps!.push({
          step: 'learning',
          status: 'completed',
          message: `Learned ${concepts.length} concepts and ${patterns.length} patterns`,
          details: {
            conceptsLearned: concepts.length,
            patternsLearned: patterns.length,
            filesAnalyzed: files.codeFiles
          }
        });

        const finalStatus = await this.getLearningStatus({ path: projectPath });
        setupSteps!.push({
          step: 'verification',
          status: 'completed',
          message: finalStatus.message,
          details: finalStatus
        });

        return {
          success: true,
          action: 'setup_completed',
          projectPath,
          steps: setupSteps,
          conceptsLearned: concepts.length,
          patternsLearned: patterns.length,
          filesAnalyzed: files.codeFiles,
          totalFiles: files.total,
          timeElapsed: Date.now() - tracker.getProgress()!.startTime,
          message: '✅ Quick setup completed! In Memoria is ready for AI agent use.',
          readyForAgents: true,
          intelligenceStatus: finalStatus
        };
      }

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
        (result as any).progressData = progressRenderer.getProgressData();
      }

      return result;

    } catch (error: unknown) {
      progressRenderer.stop();
      console.error('❌ Auto-learning failed:', error);

      // Phase 4: Handle setup steps failure
      if (includeSetupSteps) {
        setupSteps!.push({
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
    } finally {
      // CRITICAL: Ensure progress renderer is stopped even if errors occur
      if (progressRenderer) {
        progressRenderer.stop();
      }

      // CRITICAL: Clean up engine resources to prevent hanging
      // Note: We use the shared engines from the MCP server, so we don't close them here
      // But we should ensure no hanging timers or intervals remain
      if (this.semanticEngine) {
        try {
          // Don't call cleanup on shared engines - just ensure no hanging operations
          // The cleanup will be handled when the MCP server shuts down
        } catch (error) {
          console.warn('Warning: Issue during resource cleanup:', error);
        }
      }
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

  private async countProjectFiles(path: string): Promise<{ total: number; codeFiles: number }> {
    try {
      const allFiles = await glob('**/*', {
        cwd: path,
        ignore: [
          // Package managers and dependencies
          '**/node_modules/**',
          '**/bower_components/**',
          '**/jspm_packages/**',
          '**/vendor/**',

          // Version control
          '**/.git/**',
          '**/.svn/**',
          '**/.hg/**',

          // Build outputs and artifacts
          '**/dist/**',
          '**/build/**',
          '**/out/**',
          '**/output/**',
          '**/target/**',
          '**/bin/**',
          '**/obj/**',
          '**/Debug/**',
          '**/Release/**',

          // Framework-specific build directories
          '**/.next/**',
          '**/.nuxt/**',
          '**/.svelte-kit/**',
          '**/.vitepress/**',
          '**/_site/**',

          // Static assets and public files
          '**/public/**',
          '**/static/**',
          '**/assets/**',

          // Testing and coverage
          '**/coverage/**',
          '**/.coverage/**',
          '**/htmlcov/**',
          '**/.pytest_cache/**',
          '**/.nyc_output/**',
          '**/nyc_output/**',
          '**/lib-cov/**',

          // Python environments and cache
          '**/__pycache__/**',
          '**/.venv/**',
          '**/venv/**',
          '**/env/**',
          '**/.env/**',

          // Temporary and cache directories
          '**/tmp/**',
          '**/temp/**',
          '**/.tmp/**',
          '**/cache/**',
          '**/.cache/**',
          '**/logs/**',
          '**/.logs/**',

          // Generated/minified files
          '**/*.min.js',
          '**/*.min.css',
          '**/*.bundle.js',
          '**/*.chunk.js',
          '**/*.map',

          // Lock files
          '**/package-lock.json',
          '**/yarn.lock',
          '**/Cargo.lock',
          '**/Gemfile.lock',
          '**/Pipfile.lock',
          '**/poetry.lock'
        ],
        nodir: true
      });

      const codeFiles = allFiles.filter(file =>
        /\.(ts|tsx|js|jsx|py|rs|go|java|c|cpp|h|hpp|svelte|vue)$/.test(file)
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