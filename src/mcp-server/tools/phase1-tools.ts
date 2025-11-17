import { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { SemanticEngine } from '../../engines/semantic-engine.js';
import type { PatternEngine } from '../../engines/pattern-engine.js';
import type { SqliteDatabase } from '../../storage/sqlite-db.js';
import { PatternConflictDetector } from '../../services/pattern-conflict-detector.js';
import { QuickFixGenerator } from '../../services/quick-fix-generator.js';
import { GlobalDatabase } from '../../storage/global-db.js';
import { CrossProjectService } from '../../services/cross-project-service.js';
import { IncrementalLearner } from '../../services/incremental-learner.js';
import { createGitService } from '../../services/git-integration.js';
import { getLogger } from '../../utils/logger.js';
import { readFileSync } from 'fs';

const logger = getLogger();

/**
 * Phase 1 tools - Incremental learning, pattern conflicts, and cross-project intelligence
 */
export class Phase1Tools {
  private patternDetector?: PatternConflictDetector;
  private quickFixGenerator: QuickFixGenerator;
  private globalDb?: GlobalDatabase;
  private crossProjectService?: CrossProjectService;
  private incrementalLearner?: IncrementalLearner;

  constructor(
    private semanticEngine: SemanticEngine,
    private patternEngine: PatternEngine,
    private database: SqliteDatabase,
    private projectId: string,
    private projectPath: string
  ) {
    this.quickFixGenerator = new QuickFixGenerator();

    // Initialize services lazily
    this.initializeServices();
  }

  private async initializeServices(): Promise<void> {
    try {
      // Initialize pattern detector
      this.patternDetector = new PatternConflictDetector(
        this.database,
        this.semanticEngine,
        this.patternEngine,
        this.projectId
      );

      // Initialize incremental learner
      this.incrementalLearner = new IncrementalLearner(
        this.database,
        this.semanticEngine,
        this.patternEngine,
        this.projectId
      );

      // Initialize global database and cross-project service
      try {
        this.globalDb = new GlobalDatabase();
        this.crossProjectService = new CrossProjectService(this.globalDb);
      } catch (error) {
        logger.warn('Global database initialization failed (cross-project features disabled):', error);
      }
    } catch (error) {
      logger.error('Failed to initialize Phase 1 services:', error);
    }
  }

  get tools(): Tool[] {
    return [
      {
        name: 'check_pattern_compliance',
        description: 'Check if code follows learned patterns (smart code review). Detects violations like inconsistent naming, wrong error handling, or misplaced files based on YOUR codebase patterns. Returns violations with severity (low/medium/high), explanations, and quick-fix suggestions. Use before committing code to catch inconsistencies early.',
        inputSchema: {
          type: 'object',
          properties: {
            file_path: {
              type: 'string',
              description: 'Path to file being checked'
            },
            code_snippet: {
              type: 'string',
              description: 'Code to check (optional, checks whole file if not provided)'
            },
            severity_threshold: {
              type: 'string',
              enum: ['low', 'medium', 'high'],
              description: 'Only report violations at or above this severity (default: medium)'
            },
            auto_fix: {
              type: 'boolean',
              description: 'Generate quick fix suggestions (default: true)'
            }
          },
          required: ['file_path']
        }
      },
      {
        name: 'get_learning_history',
        description: 'Get recent incremental learning updates. Shows what was learned from recent commits: concepts added/removed/modified, patterns updated, duration. Use to see learning progress or troubleshoot if intelligence seems stale.',
        inputSchema: {
          type: 'object',
          properties: {
            limit: {
              type: 'number',
              description: 'Number of recent learning deltas to retrieve (default: 10)',
              minimum: 1,
              maximum: 100
            },
            since_timestamp: {
              type: 'number',
              description: 'Only show deltas since this Unix timestamp (optional)'
            }
          }
        }
      },
      {
        name: 'link_project',
        description: 'Link a project to global intelligence for cross-project learning. Once linked, patterns from this project will be shared globally and you can search across all linked projects. Use when starting work on a new project to leverage experience from other projects.',
        inputSchema: {
          type: 'object',
          properties: {
            project_path: {
              type: 'string',
              description: 'Absolute path to project'
            },
            project_name: {
              type: 'string',
              description: 'Human-readable name (optional, defaults to directory name)'
            },
            description: {
              type: 'string',
              description: 'Project description (optional)'
            },
            auto_sync: {
              type: 'boolean',
              description: 'Automatically sync patterns to global DB (default: true)'
            }
          },
          required: ['project_path']
        }
      },
      {
        name: 'search_all_projects',
        description: 'Search code across ALL linked projects. Find where you\'ve solved similar problems before in any of your projects. Returns matches from all projects with scores and context. Use when you know you\'ve implemented something similar before but can\'t remember where.',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query (natural language or keywords)'
            },
            mode: {
              type: 'string',
              enum: ['semantic', 'text', 'pattern'],
              description: 'Search mode (default: semantic)'
            },
            project_filter: {
              type: 'array',
              items: { type: 'string' },
              description: 'Only search these projects (optional, project IDs or names)'
            },
            language_filter: {
              type: 'string',
              description: 'Only search files in this language (optional)'
            },
            limit: {
              type: 'number',
              description: 'Max results (default: 20)',
              minimum: 1,
              maximum: 100
            }
          },
          required: ['query']
        }
      },
      {
        name: 'get_global_patterns',
        description: 'Get patterns learned across ALL your projects. These are stronger than single-project patterns because they appear in multiple projects. Use to see your overall coding style and find patterns that work consistently across different codebases.',
        inputSchema: {
          type: 'object',
          properties: {
            category: {
              type: 'string',
              enum: ['naming', 'structural', 'implementation', 'testing', 'style'],
              description: 'Pattern category (optional)'
            },
            min_project_count: {
              type: 'number',
              description: 'Minimum number of projects that must have this pattern (default: 2)',
              minimum: 1
            },
            min_consensus: {
              type: 'number',
              description: 'Minimum consensus score 0-1 (default: 0.7)',
              minimum: 0,
              maximum: 1
            },
            language: {
              type: 'string',
              description: 'Filter by language (optional)'
            },
            limit: {
              type: 'number',
              description: 'Max patterns to return (default: 50)',
              minimum: 1,
              maximum: 200
            }
          }
        }
      },
      {
        name: 'get_portfolio_view',
        description: 'Get overview of all linked projects. Shows total projects, patterns, concepts, most used languages/frameworks. Use to see your entire portfolio at a glance or check if all projects are synced.',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      }
    ];
  }

  /**
   * Handle tool execution
   */
  async handleToolCall(name: string, args: any): Promise<any> {
    try {
      switch (name) {
        case 'check_pattern_compliance':
          return await this.checkPatternCompliance(args);

        case 'get_learning_history':
          return await this.getLearningHistory(args);

        case 'link_project':
          return await this.linkProject(args);

        case 'search_all_projects':
          return await this.searchAllProjects(args);

        case 'get_global_patterns':
          return await this.getGlobalPatterns(args);

        case 'get_portfolio_view':
          return await this.getPortfolioView(args);

        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    } catch (error) {
      logger.error(`Tool ${name} failed:`, error);
      throw error;
    }
  }

  private async checkPatternCompliance(args: {
    file_path: string;
    code_snippet?: string;
    severity_threshold?: 'low' | 'medium' | 'high';
    auto_fix?: boolean;
  }): Promise<any> {
    if (!this.patternDetector) {
      throw new Error('Pattern detector not initialized');
    }

    const code = args.code_snippet || readFileSync(args.file_path, 'utf-8');

    const report = await this.patternDetector.checkCompliance(code, args.file_path, {
      severityThreshold: args.severity_threshold || 'medium',
      autoFix: args.auto_fix !== false,
    });

    return {
      passed: report.passed,
      overallScore: report.overallScore,
      violations: report.violations.map((v) => ({
        type: v.type,
        severity: v.severity,
        message: v.message,
        location: v.location,
        suggestedFix: v.suggestedFix,
        confidence: Math.round(v.confidence * 100),
      })),
      warnings: report.warnings.map((v) => ({
        type: v.type,
        message: v.message,
        suggestedFix: v.suggestedFix,
      })),
      suggestions: report.suggestions.map((v) => ({
        type: v.type,
        message: v.message,
      })),
      checkDurationMs: report.checkDurationMs,
    };
  }

  private async getLearningHistory(args: { limit?: number; since_timestamp?: number }): Promise<any> {
    if (!this.incrementalLearner) {
      throw new Error('Incremental learner not initialized');
    }

    const deltas = await this.incrementalLearner.getRecentDeltas(args.limit || 10);

    // Filter by timestamp if provided
    const filtered = args.since_timestamp
      ? deltas.filter((d) => d.timestamp >= args.since_timestamp!)
      : deltas;

    return {
      deltas: filtered.map((d) => ({
        id: d.id,
        timestamp: d.timestamp,
        triggerType: d.triggerType,
        commitSha: d.commitSha,
        commitMessage: d.commitMessage,
        filesChanged: d.filesChanged.length,
        summary: {
          conceptsAdded: d.conceptsAdded,
          conceptsRemoved: d.conceptsRemoved,
          conceptsModified: d.conceptsModified,
          patternsAdded: d.patternsAdded,
          patternsModified: d.patternsModified,
        },
        durationMs: d.durationMs,
        status: d.status,
      })),
      totalDeltas: filtered.length,
      summary: {
        totalConceptsAdded: filtered.reduce((sum, d) => sum + d.conceptsAdded, 0),
        totalConceptsRemoved: filtered.reduce((sum, d) => sum + d.conceptsRemoved, 0),
        totalPatternsAdded: filtered.reduce((sum, d) => sum + d.patternsAdded, 0),
      },
    };
  }

  private async linkProject(args: {
    project_path: string;
    project_name?: string;
    description?: string;
    auto_sync?: boolean;
  }): Promise<any> {
    if (!this.crossProjectService) {
      throw new Error('Cross-project service not available');
    }

    const projectLink = await this.crossProjectService.linkProject(
      args.project_path,
      this.database,
      args.project_name,
      args.description
    );

    return {
      projectId: projectLink.id,
      name: projectLink.name,
      path: projectLink.path,
      linkedAt: projectLink.linkedAt,
      syncStatus: 'completed',
      patternsAdded: projectLink.patternCount,
      conceptsAdded: projectLink.conceptCount,
    };
  }

  private async searchAllProjects(args: {
    query: string;
    mode?: 'semantic' | 'text' | 'pattern';
    project_filter?: string[];
    language_filter?: string;
    limit?: number;
  }): Promise<any> {
    if (!this.crossProjectService) {
      throw new Error('Cross-project service not available');
    }

    const results = await this.crossProjectService.searchAllProjects({
      query: args.query,
      mode: args.mode || 'semantic',
      projectFilter: args.project_filter,
      languageFilter: args.language_filter,
      limit: args.limit || 20,
    });

    return {
      results: results.map((r) => ({
        projectId: r.projectId,
        projectName: r.projectName,
        filePath: r.filePath,
        match: {
          code: r.match.code,
          score: Math.round(r.match.score * 100),
          context: r.match.context,
        },
      })),
      totalResults: results.length,
      query: args.query,
      mode: args.mode || 'semantic',
    };
  }

  private async getGlobalPatterns(args: {
    category?: string;
    min_project_count?: number;
    min_consensus?: number;
    language?: string;
    limit?: number;
  }): Promise<any> {
    if (!this.crossProjectService) {
      throw new Error('Cross-project service not available');
    }

    const patterns = this.crossProjectService.getGlobalPatterns({
      category: args.category,
      minProjectCount: args.min_project_count || 2,
      minConsensus: args.min_consensus || 0.7,
      language: args.language,
      limit: args.limit || 50,
    });

    return {
      patterns: patterns.map((p) => ({
        id: p.id,
        category: p.category,
        pattern: p.patternData,
        projectCount: p.projectCount,
        confidence: Math.round(p.confidence * 100),
        sourceProjects: p.sourceProjects.length,
        example: p.exampleCode,
      })),
      totalPatterns: patterns.length,
    };
  }

  private async getPortfolioView(args: {}): Promise<any> {
    if (!this.crossProjectService) {
      throw new Error('Cross-project service not available');
    }

    const portfolio = this.crossProjectService.getPortfolioView();

    return {
      projects: portfolio.projects.map((p) => ({
        id: p.id,
        name: p.name,
        path: p.path,
        primaryLanguage: p.primaryLanguage,
        frameworks: p.frameworks,
        patternCount: p.patternCount,
        conceptCount: p.conceptCount,
        lastSynced: p.lastSynced,
        size: p.size,
      })),
      summary: {
        totalProjects: portfolio.totalProjects,
        totalPatterns: portfolio.totalPatterns,
        totalConcepts: portfolio.totalConcepts,
      },
      insights: {
        mostUsedLanguages: portfolio.mostUsedLanguages,
        mostUsedFrameworks: portfolio.mostUsedFrameworks,
      },
    };
  }
}
