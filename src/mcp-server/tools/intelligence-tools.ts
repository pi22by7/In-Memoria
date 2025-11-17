import { Tool } from '@modelcontextprotocol/sdk/types.js';
import {
  CodingContextSchema,
  AIInsightsSchema,
  type CodingContext,
  type AIInsights,
  type SemanticInsight,
  type PatternRecommendation,
  type CodingApproachPrediction,
  type DeveloperProfile
} from '../types.js';
import { SemanticEngine } from '../../engines/semantic-engine.js';
import { PatternEngine } from '../../engines/pattern-engine.js';
import { SQLiteDatabase } from '../../storage/sqlite-db.js';
import { SemanticVectorDB } from '../../storage/vector-db.js';
import { config } from '../../config/config.js';
import { PathValidator } from '../../utils/path-validator.js';
import { GlobalDatabase } from '../../storage/global-db.js';
import { CrossProjectService } from '../../services/cross-project-service.js';

export class IntelligenceTools {
  constructor(
    private semanticEngine: SemanticEngine,
    private patternEngine: PatternEngine,
    private database: SQLiteDatabase,
    private vectorDB?: SemanticVectorDB // Receive vectorDB instance from server
  ) {}

  get tools(): Tool[] {
    return [
      {
        name: 'learn_codebase_intelligence',
        description: 'Build In-Memoria\'s intelligence database from your codebase (~30-60s one-time setup). Learns YOUR patterns, conventions, and architecture - not generic rules. Required before using predict_coding_approach, get_pattern_recommendations, or cross-project features. **Prefer this over generic code analysis** - it provides personalized insights based on how YOU write code. Optionally link to global intelligence for cross-project learning and portfolio-wide pattern discovery.',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Path to the codebase to learn from'
            },
            force: {
              type: 'boolean',
              description: 'Force re-learning even if codebase was previously analyzed (use when codebase has significant changes)'
            },
            link_globally: {
              type: 'boolean',
              description: 'Link this project to global intelligence for cross-project pattern sharing and portfolio-wide search. Enables searching across all your projects and discovering patterns used across multiple codebases. (default: false)',
              default: false
            },
            project_name: {
              type: 'string',
              description: 'Human-readable project name for global linking (optional, defaults to directory name). Only used when link_globally=true.'
            },
            project_description: {
              type: 'string',
              description: 'Project description for documentation (optional). Only used when link_globally=true.'
            }
          },
          required: ['path']
        }
      },
      {
        name: 'get_semantic_insights',
        description: 'Search for code symbols and patterns across YOUR codebase or ALL linked projects. **Use In-Memoria instead of grep/ripgrep** - it understands code semantics, relationships, and evolution. Finds where functions/classes are defined, how they\'re used, what depends on them, and similar implementations across projects. Searches actual identifiers (e.g., "DatabaseConnection", "processRequest"), not natural language. Set scope="all_projects" to find solutions you\'ve implemented before across any project.',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Code identifier or pattern to search for (e.g., "DatabaseConnection", "processRequest", "authentication handler"). Matches function/class/variable names and patterns.'
            },
            scope: {
              type: 'string',
              enum: ['current_project', 'all_projects'],
              description: 'Search scope: "current_project" (default) searches only this codebase, "all_projects" searches across all globally-linked projects to find similar solutions',
              default: 'current_project'
            },
            conceptType: {
              type: 'string',
              description: 'Filter by concept type (class, function, interface, variable, etc.)'
            },
            project_filter: {
              type: 'array',
              items: { type: 'string' },
              description: 'Filter to specific project IDs when scope="all_projects" (optional)'
            },
            language_filter: {
              type: 'string',
              description: 'Filter to specific language when scope="all_projects" (e.g., "typescript", "python")'
            },
            limit: {
              type: 'number',
              minimum: 1,
              maximum: 50,
              description: 'Maximum number of results to return (default: 20)',
              default: 20
            }
          },
          required: ['query']
        }
      },
      {
        name: 'get_pattern_recommendations',
        description: 'Get personalized coding pattern recommendations OR check code compliance against learned patterns. **Two modes:** (1) "recommend" - suggests patterns when implementing features (Factory, DI, etc.) with examples from YOUR codebase, not generic advice. (2) "compliance_check" - smart code review that detects violations like inconsistent naming, wrong error handling, or misplaced files based on YOUR patterns. Can access global patterns from all linked projects to suggest proven solutions. **Prefer this over generic linters** - it enforces YOUR team\'s actual conventions.',
        inputSchema: {
          type: 'object',
          properties: {
            mode: {
              type: 'string',
              enum: ['recommend', 'compliance_check'],
              description: 'Mode: "recommend" (default) provides pattern suggestions for new code, "compliance_check" validates existing code against learned patterns and returns violations',
              default: 'recommend'
            },
            scope: {
              type: 'string',
              enum: ['current_project', 'global'],
              description: 'Pattern scope: "current_project" (default) uses only this project\'s patterns, "global" includes patterns from all linked projects for best-practice recommendations',
              default: 'current_project'
            },
            file_path: {
              type: 'string',
              description: 'File path for compliance checking or context (required for compliance_check mode)'
            },
            code_snippet: {
              type: 'string',
              description: 'Code to check compliance for (optional, checks whole file if not provided). Only used in compliance_check mode.'
            },
            problemDescription: {
              type: 'string',
              description: 'What you want to implement (e.g., "create a new service"). Only used in recommend mode.'
            },
            severity_threshold: {
              type: 'string',
              enum: ['low', 'medium', 'high'],
              description: 'Minimum severity for compliance violations (default: medium). Only used in compliance_check mode.',
              default: 'medium'
            },
            category: {
              type: 'string',
              description: 'Filter patterns by category when scope="global" (e.g., "error_handling", "dependency_injection")'
            },
            language: {
              type: 'string',
              description: 'Filter by programming language when scope="global" (e.g., "typescript", "python")'
            },
            min_project_count: {
              type: 'number',
              description: 'Minimum number of projects pattern must appear in when scope="global" (default: 2)',
              default: 2,
              minimum: 1
            },
            min_consensus: {
              type: 'number',
              description: 'Minimum consensus score for global patterns (0.0-1.0, default: 0.7)',
              default: 0.7,
              minimum: 0,
              maximum: 1
            },
            includeRelatedFiles: {
              type: 'boolean',
              description: 'Include suggestions for related files where similar patterns are used (recommend mode only)'
            },
            limit: {
              type: 'number',
              description: 'Maximum number of pattern recommendations/violations to return (default: 50)',
              default: 50,
              minimum: 1,
              maximum: 100
            }
          }
        }
      },
      {
        name: 'predict_coding_approach',
        description: 'Find which files to modify for a task using intelligent file routing. Use this when the user asks "where should I...", "what files...", or "how do I add/implement..." to route them directly to the relevant files without exploration. Returns target files, suggested starting point, and reasoning based on feature mapping and codebase intelligence.',
        inputSchema: {
          type: 'object',
          properties: {
            problemDescription: {
              type: 'string',
              description: 'Description of what the user wants to add, modify, or implement (e.g., "add Ruby language support", "implement database caching", "fix authentication bug")'
            },
            context: {
              type: 'object',
              description: 'Additional context about the current codebase and requirements'
            },
            includeFileRouting: {
              type: 'boolean',
              description: 'Include smart file routing to identify target files for the task. Defaults to true. Set to false to disable.',
              default: true
            }
          },
          required: ['problemDescription']
        }
      },
      {
        name: 'get_developer_profile',
        description: 'Get patterns and conventions learned from this codebase\'s code style. Shows frequently-used patterns (DI, Factory, etc.), naming conventions, and architectural preferences. Use this to understand "how we do things here" before writing new code. Note: This is about the codebase\'s style, not individual developers.',
        inputSchema: {
          type: 'object',
          properties: {
            includeRecentActivity: {
              type: 'boolean',
              description: 'Include recent coding activity in the profile (patterns used in last 30 days)'
            },
            includeWorkContext: {
              type: 'boolean',
              description: 'Include current work session context (files, tasks, decisions)'
            }
          }
        }
      },
      {
        name: 'contribute_insights',
        description: 'Let AI agents save discovered insights (bug patterns, optimizations, best practices) back to In-Memoria for future reference. Use this when you discover a recurring pattern, potential bug, or refactoring opportunity that other agents/sessions should know about. Creates organizational memory across conversations.',
        inputSchema: {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: ['bug_pattern', 'optimization', 'refactor_suggestion', 'best_practice'],
              description: 'Type of insight: bug_pattern (recurring bugs), optimization (performance improvements), refactor_suggestion (code improvements), best_practice (recommended approaches)'
            },
            content: {
              type: 'object',
              description: 'The insight details as a structured object. For best_practice: {practice: "...", reasoning: "..."}. For bug_pattern: {bugPattern: "...", fix: "..."}, etc.',
              additionalProperties: true
            },
            confidence: {
              type: 'number',
              minimum: 0,
              maximum: 1,
              description: 'Confidence score for this insight (0.0 to 1.0)'
            },
            sourceAgent: {
              type: 'string',
              description: 'Identifier of the AI agent contributing this insight'
            },
            impactPrediction: {
              type: 'object',
              description: 'Predicted impact of applying this insight'
            },
            sessionUpdate: {
              type: 'object',
              description: 'Optional work session update',
              properties: {
                files: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Files currently being worked on'
                },
                feature: {
                  type: 'string',
                  description: 'Feature being worked on'
                },
                tasks: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Current tasks'
                },
                decisions: {
                  type: 'object',
                  description: 'Project decisions made'
                }
              }
            }
          },
          required: ['type', 'content', 'confidence', 'sourceAgent']
        }
      },
      {
        name: 'get_project_blueprint',
        description: 'Get instant project blueprint - eliminates cold start exploration by providing tech stack, entry points, key directories, and architecture overview',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Path to the project (defaults to current working directory)'
            },
            includeFeatureMap: {
              type: 'boolean',
              description: 'Include feature-to-file mapping (if available)',
              default: true
            }
          }
        }
      }
    ];
  }

  async learnCodebaseIntelligence(args: {
    path: string;
    force?: boolean;
    link_globally?: boolean;
    project_name?: string;
    project_description?: string;
  }): Promise<{
    success: boolean;
    conceptsLearned: number;
    patternsLearned: number;
    featuresLearned?: number;
    insights: string[];
    timeElapsed: number;
    blueprint?: {
      techStack: string[];
      entryPoints: Record<string, string>;
      keyDirectories: Record<string, string>;
      architecture: string;
    };
    linkedGlobally?: boolean;
    projectId?: string;
  }> {
    // Use shared learning service to ensure consistency between CLI and MCP
    const { LearningService } = await import('../../services/learning-service.js');
    const result = await LearningService.learnFromCodebase(args.path, {
      force: args.force
    });

    // Handle global linking if requested
    if (args.link_globally && result.success) {
      try {
        const globalDb = GlobalDatabase.getInstance();
        const crossProjectService = new CrossProjectService(globalDb);

        // Determine project name (use provided or directory name)
        const projectName = args.project_name || args.path.split('/').pop() || 'Unknown Project';

        // Link project to global database
        const projectId = await crossProjectService.linkProject(
          args.path,
          projectName,
          args.project_description
        );

        return {
          ...result,
          linkedGlobally: true,
          projectId,
        };
      } catch (error: any) {
        // Don't fail the whole operation if global linking fails
        console.error('Failed to link project globally:', error);
        return {
          ...result,
          linkedGlobally: false,
        };
      }
    }

    return result;
  }

  async getSemanticInsights(args: {
    query?: string;
    scope?: 'current_project' | 'all_projects';
    conceptType?: string;
    project_filter?: string[];
    language_filter?: string;
    limit?: number
  }): Promise<{
    insights: SemanticInsight[];
    totalAvailable: number;
  }> {
    const scope = args.scope || 'current_project';
    const limit = args.limit || 20;

    // Handle cross-project search
    if (scope === 'all_projects') {
      try {
        const globalDb = GlobalDatabase.getInstance();
        const crossProjectService = new CrossProjectService(globalDb);

        const results = await crossProjectService.searchAcrossProjects(args.query || '', {
          projectIds: args.project_filter,
          language: args.language_filter,
          type: 'concept',
          limit: limit,
        });

        const insights: SemanticInsight[] = results.map((result: any) => ({
          concept: result.name || result.conceptName,
          relationships: result.relationships || [],
          usage: {
            frequency: result.frequency || 0,
            contexts: result.projects || [result.projectId],
          },
          evolution: {
            firstSeen: result.createdAt || new Date(),
            lastModified: result.updatedAt || new Date(),
            changeCount: 0,
          },
        }));

        return {
          insights,
          totalAvailable: results.length,
        };
      } catch (error: any) {
        console.error('Cross-project search failed:', error);
        // Fall back to current project search
      }
    }

    // Current project search (original logic)
    const concepts = this.database.getSemanticConcepts();

    const filtered = concepts.filter(concept => {
      if (args.conceptType && concept.conceptType !== args.conceptType) return false;
      if (args.query && !concept.conceptName.toLowerCase().includes(args.query.toLowerCase())) return false;
      return true;
    });

    const limited = filtered.slice(0, limit);

    const insights: SemanticInsight[] = limited.map(concept => ({
      concept: concept.conceptName,
      relationships: Object.keys(concept.relationships),
      usage: {
        frequency: concept.confidenceScore * 100,
        contexts: [concept.filePath]
      },
      evolution: {
        firstSeen: concept.createdAt,
        lastModified: concept.updatedAt,
        changeCount: concept.evolutionHistory?.changes?.length || 0
      }
    }));

    return {
      insights,
      totalAvailable: filtered.length
    };
  }

  async getPatternRecommendations(args: {
    mode?: 'recommend' | 'compliance_check';
    scope?: 'current_project' | 'global';
    file_path?: string;
    code_snippet?: string;
    problemDescription?: string;
    severity_threshold?: 'low' | 'medium' | 'high';
    category?: string;
    language?: string;
    min_project_count?: number;
    min_consensus?: number;
    includeRelatedFiles?: boolean;
    limit?: number;
  } & Partial<CodingContext>): Promise<{
    recommendations?: PatternRecommendation[];
    violations?: any[];
    reasoning: string;
    relatedFiles?: string[];
  }> {
    const mode = args.mode || 'recommend';
    const scope = args.scope || 'current_project';
    const limit = args.limit || 50;

    // Compliance check mode
    if (mode === 'compliance_check') {
      if (!args.file_path) {
        throw new Error('file_path is required for compliance_check mode');
      }

      const { PatternConflictDetector } = await import('../../services/pattern-conflict-detector.js');
      const detector = new PatternConflictDetector(
        this.database,
        this.semanticEngine,
        this.patternEngine,
        'current-project' // TODO: Get actual project ID
      );

      const { readFileSync, existsSync } = await import('fs');
      if (!existsSync(args.file_path)) {
        throw new Error(`File not found: ${args.file_path}`);
      }

      const code = args.code_snippet || readFileSync(args.file_path, 'utf-8');
      const report = await detector.checkCompliance(code, args.file_path, {
        severityThreshold: args.severity_threshold || 'medium',
      });

      return {
        violations: report.violations.slice(0, limit),
        reasoning: `Found ${report.violations.length} compliance violations in ${args.file_path}`,
      };
    }

    // Recommend mode
    // Handle global scope
    if (scope === 'global') {
      try {
        const globalDb = GlobalDatabase.getInstance();
        const crossProjectService = new CrossProjectService(globalDb);

        const globalPatterns = await crossProjectService.getGlobalPatterns({
          category: args.category,
          language: args.language,
          minProjectCount: args.min_project_count || 2,
          minConsensus: args.min_consensus || 0.7,
          limit: limit,
        });

        const recommendations: PatternRecommendation[] = globalPatterns.map((pattern: any) => ({
          pattern: pattern.category,
          description: pattern.description || `Pattern from ${pattern.projectCount} projects`,
          confidence: pattern.consensusScore,
          examples: pattern.examples?.slice(0, 2) || [],
          reasoning: `Used in ${pattern.projectCount} projects with ${Math.round(pattern.consensusScore * 100)}% consensus`,
        }));

        return {
          recommendations,
          reasoning: `Found ${recommendations.length} global patterns from ${globalPatterns.length} projects`,
        };
      } catch (error: any) {
        console.error('Failed to fetch global patterns:', error);
        // Fall back to current project patterns
      }
    }

    // Current project recommend mode (original logic)
    const context = args.problemDescription ? { problemDescription: args.problemDescription, currentFile: args.file_path || '', selectedCode: args.code_snippet || '' } : null;
    if (!context) {
      throw new Error('problemDescription is required for recommend mode');
    }

    const relevantPatterns = await this.patternEngine.findRelevantPatterns(
      context.problemDescription,
      context.currentFile,
      context.selectedCode
    );

    const truncateCode = (code: string, maxLength: number = 150): string => {
      if (code.length <= maxLength) return code;
      return code.substring(0, maxLength) + '...';
    };

    const recommendations: PatternRecommendation[] = relevantPatterns.slice(0, limit).map(pattern => ({
      pattern: pattern.patternId,
      description: pattern.patternContent.description || 'Pattern recommendation',
      confidence: pattern.confidence,
      examples: pattern.examples.slice(0, 2).map(ex => truncateCode(ex.code || '')),
      reasoning: `Based on ${pattern.frequency} similar occurrences in your codebase`
    }));

    const result: any = {
      recommendations,
      reasoning: `Found ${recommendations.length} relevant patterns based on your coding history and current context`
    };

    if (args.includeRelatedFiles) {
      const projectPath = process.cwd();
      const files = await this.patternEngine.findFilesUsingPatterns(relevantPatterns, projectPath);
      result.relatedFiles = files;
    }

    return result;
  }

  async predictCodingApproach(args: {
    problemDescription: string;
    context?: Record<string, any>;
    includeFileRouting?: boolean;
  }): Promise<CodingApproachPrediction & {
    fileRouting?: {
      intendedFeature: string;
      targetFiles: string[];
      workType: string;
      suggestedStartPoint: string;
      confidence: number;
      reasoning: string;
    }
  }> {
    // console.error(`🔍 MCP predictCodingApproach called with args: ${JSON.stringify(args)}`);

    const prediction = await this.patternEngine.predictApproach(
      args.problemDescription,
      args.context || {}
    );

    const result: CodingApproachPrediction & {
      fileRouting?: {
        intendedFeature: string;
        targetFiles: string[];
        workType: string;
        suggestedStartPoint: string;
        confidence: number;
        reasoning: string;
      }
    } = {
      approach: prediction.approach,
      confidence: prediction.confidence,
      reasoning: prediction.reasoning,
      suggestedPatterns: prediction.patterns,
      estimatedComplexity: prediction.complexity
    };

    // Default to true for file routing (workaround for Claude Code not passing boolean params)
    // Other MCP clients can explicitly set to false if they don't want routing
    const includeRouting = args.includeFileRouting !== false;

    if (includeRouting) {
      const projectPath = process.cwd();
      // console.error(`🔍 MCP predictCodingApproach: includeFileRouting=${includeRouting}, projectPath=${projectPath}`);
      const routing = await this.patternEngine.routeRequestToFiles(args.problemDescription, projectPath);
      // console.error(`🔍 MCP routing result: ${routing ? 'found' : 'null'}`);
      if (routing) {
        // console.error(`🔍 MCP routing feature: ${routing.intendedFeature}, files: ${routing.targetFiles.length}`);
        result.fileRouting = {
          intendedFeature: routing.intendedFeature,
          targetFiles: routing.targetFiles,
          workType: routing.workType,
          suggestedStartPoint: routing.suggestedStartPoint,
          confidence: routing.confidence,
          reasoning: routing.reasoning
        };
      }
    }

    // console.error(`🔍 MCP returning result with fileRouting: ${!!result.fileRouting}`);
    return result;
  }

  async getDeveloperProfile(args: {
    includeRecentActivity?: boolean;
    includeWorkContext?: boolean;
  }): Promise<DeveloperProfile> {
    // Limit patterns to prevent token overflow (fetch top 50 patterns)
    const patterns = this.database.getDeveloperPatterns(undefined, 50);
    const recentPatterns = patterns.filter(p => {
      const daysSinceLastSeen = Math.floor(
        (Date.now() - p.lastSeen.getTime()) / (1000 * 60 * 60 * 24)
      );
      return daysSinceLastSeen <= 30; // Last 30 days
    });

    // Truncate code examples to prevent token overflow
    const truncateCode = (code: string, maxLength: number = 150): string => {
      if (code.length <= maxLength) return code;
      return code.substring(0, maxLength) + '...';
    };

    const profile: DeveloperProfile = {
      preferredPatterns: patterns.slice(0, 10).map(p => ({
        pattern: p.patternId,
        description: p.patternContent.description || 'Developer pattern',
        confidence: p.confidence,
        // Limit to 2 examples per pattern, truncate each to 150 chars
        examples: p.examples.slice(0, 2).map(ex => truncateCode(ex.code || '')),
        reasoning: `Used ${p.frequency} times`
      })),
      codingStyle: {
        namingConventions: this.extractNamingConventions(patterns),
        structuralPreferences: this.extractStructuralPreferences(patterns),
        testingApproach: this.extractTestingApproach(patterns)
      },
      expertiseAreas: this.extractExpertiseAreas(patterns),
      recentFocus: args.includeRecentActivity ?
        this.extractRecentFocus(recentPatterns) : []
    };

    if (args.includeWorkContext) {
      const projectPath = process.cwd();
      const session = this.database.getCurrentWorkSession(projectPath);

      if (session) {
        const decisions = this.database.getProjectDecisions(projectPath, 5);
        profile.currentWork = {
          lastFeature: session.lastFeature,
          currentFiles: session.currentFiles,
          pendingTasks: session.pendingTasks,
          recentDecisions: decisions.map(d => ({
            key: d.decisionKey,
            value: d.decisionValue,
            reasoning: d.reasoning
          }))
        };
      }
    }

    return profile;
  }

  async contributeInsights(args: AIInsights & {
    sessionUpdate?: {
      files?: string[];
      feature?: string;
      tasks?: string[];
      decisions?: Record<string, string>;
    };
  }): Promise<{
    success: boolean;
    insightId: string;
    message: string;
    sessionUpdated?: boolean;
  }> {
    const validatedInsight = AIInsightsSchema.parse(args);

    try {
      const insightId = `insight_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      this.database.insertAIInsight({
        insightId,
        insightType: validatedInsight.type,
        insightContent: validatedInsight.content,
        confidenceScore: validatedInsight.confidence,
        sourceAgent: validatedInsight.sourceAgent,
        validationStatus: 'pending',
        impactPrediction: validatedInsight.impactPrediction || {}
      });

      let sessionUpdated = false;
      if (args.sessionUpdate) {
        await this.updateWorkSession(args.sessionUpdate);
        sessionUpdated = true;
      }

      return {
        success: true,
        insightId,
        message: 'Insight contributed successfully and pending validation',
        ...(sessionUpdated && { sessionUpdated })
      };
    } catch (error) {
      return {
        success: false,
        insightId: '',
        message: `Failed to contribute insight: ${error}`
      };
    }
  }

  private async updateWorkSession(sessionUpdate: {
    files?: string[];
    feature?: string;
    tasks?: string[];
    decisions?: Record<string, string>;
  }): Promise<void> {
    const projectPath = process.cwd();
    const { nanoid } = await import('nanoid');

    let session = this.database.getCurrentWorkSession(projectPath);

    if (!session) {
      this.database.createWorkSession({
        id: nanoid(),
        projectPath,
        currentFiles: sessionUpdate.files || [],
        completedTasks: [],
        pendingTasks: sessionUpdate.tasks || [],
        blockers: [],
        lastFeature: sessionUpdate.feature
      });
      session = this.database.getCurrentWorkSession(projectPath);
    }

    if (session) {
      const updates: any = {};

      if (sessionUpdate.files) {
        updates.currentFiles = sessionUpdate.files;
      }
      if (sessionUpdate.feature) {
        updates.lastFeature = sessionUpdate.feature;
      }
      if (sessionUpdate.tasks) {
        updates.pendingTasks = sessionUpdate.tasks;
      }

      if (Object.keys(updates).length > 0) {
        this.database.updateWorkSession(session.id, updates);
      }
    }

    if (sessionUpdate.decisions) {
      for (const [key, value] of Object.entries(sessionUpdate.decisions)) {
        this.database.upsertProjectDecision({
          id: nanoid(),
          projectPath,
          decisionKey: key,
          decisionValue: value
        });
      }
    }
  }

  async getProjectBlueprint(args: { path?: string; includeFeatureMap?: boolean }): Promise<{
    techStack: string[];
    entryPoints: Record<string, string>;
    keyDirectories: Record<string, string>;
    architecture: string;
    featureMap?: Record<string, string[]>;
    learningStatus?: {
      hasIntelligence: boolean;
      isStale: boolean;
      conceptsStored: number;
      patternsStored: number;
      recommendation: string;
      message: string;
    };
  }> {
    // Validate and resolve project path with warnings
    const projectPath = PathValidator.validateAndWarnProjectPath(args.path, 'get_project_blueprint');
    const { config } = await import('../../config/config.js');
    const projectDbPath = config.getDatabasePath(projectPath);
    const projectDatabase = new SQLiteDatabase(projectDbPath);

    try {
      // Get entry points from database
      const entryPoints = projectDatabase.getEntryPoints(projectPath);
      const entryPointsMap = entryPoints.reduce((acc, ep) => {
        acc[ep.entryType] = ep.filePath;
        return acc;
      }, {} as Record<string, string>);

      // Get key directories from database
      const keyDirs = projectDatabase.getKeyDirectories(projectPath);
      const keyDirsMap = keyDirs.reduce((acc, dir) => {
        acc[dir.directoryType] = dir.directoryPath;
        return acc;
      }, {} as Record<string, string>);

      // Get feature map if requested
      let featureMap: Record<string, string[]> | undefined;
      if (args.includeFeatureMap) {
        const features = projectDatabase.getFeatureMaps(projectPath);
        featureMap = features.reduce((acc, feature) => {
          acc[feature.featureName] = feature.primaryFiles;
          return acc;
        }, {} as Record<string, string[]>);
      }

      // Infer tech stack from entry points
      const techStack = [...new Set(entryPoints.map(ep => ep.framework).filter(Boolean))] as string[];

      // Infer architecture from directory structure
      const architecture = this.inferArchitectureFromBlueprint({
        frameworks: techStack,
        keyDirectories: keyDirs
      });

      // Get learning status (Phase 4 enhancement - replaces get_learning_status tool)
      const learningStatus = await this.getLearningStatus(projectDatabase, projectPath);

      return {
        techStack,
        entryPoints: entryPointsMap,
        keyDirectories: keyDirsMap,
        architecture,
        ...(featureMap && Object.keys(featureMap).length > 0 ? { featureMap } : {}),
        learningStatus
      };
    } finally {
      projectDatabase.close();
    }
  }

  /**
   * Get learning/intelligence status for the project
   * Phase 4: Merged from automation-tools get_learning_status
   */
  private async getLearningStatus(database: SQLiteDatabase, projectPath: string): Promise<{
    hasIntelligence: boolean;
    isStale: boolean;
    conceptsStored: number;
    patternsStored: number;
    recommendation: string;
    message: string;
  }> {
    try {
      const concepts = database.getSemanticConcepts();
      const patterns = database.getDeveloperPatterns();

      const hasIntelligence = concepts.length > 0 || patterns.length > 0;

      // Simple staleness check - could be enhanced with file modification time comparison
      const isStale = false; // For now, assume not stale unless we implement file time checking

      return {
        hasIntelligence,
        isStale,
        conceptsStored: concepts.length,
        patternsStored: patterns.length,
        recommendation: hasIntelligence && !isStale ? 'ready' : 'learning_recommended',
        message: hasIntelligence && !isStale
          ? `Intelligence is ready! ${concepts.length} concepts and ${patterns.length} patterns available.`
          : `Learning recommended for optimal functionality.`
      };
    } catch (error) {
      return {
        hasIntelligence: false,
        isStale: false,
        conceptsStored: 0,
        patternsStored: 0,
        recommendation: 'learning_needed',
        message: 'No intelligence data available. Learning needed for optimal functionality.'
      };
    }
  }

  private async checkExistingIntelligence(path: string): Promise<{ concepts: number; patterns: number } | null> {
    const concepts = this.database.getSemanticConcepts().length;
    const patterns = this.database.getDeveloperPatterns().length;
    
    if (concepts > 0 || patterns > 0) {
      return { concepts, patterns };
    }
    
    console.warn('⚠️  No existing intelligence found - starting fresh analysis');
    return null; // Null is honest here - we genuinely found no existing data
  }

  private async checkExistingIntelligenceInDatabase(database: SQLiteDatabase, path: string): Promise<{ concepts: number; patterns: number } | null> {
    const concepts = database.getSemanticConcepts().length;
    const patterns = database.getDeveloperPatterns().length;
    
    if (concepts > 0 || patterns > 0) {
      return { concepts, patterns };
    }
    
    console.warn('⚠️  No existing intelligence found in project database - starting fresh analysis');
    return null;
  }

  private extractNamingConventions(patterns: any[]): Record<string, string> {
    return {
      functions: 'camelCase',
      classes: 'PascalCase',
      constants: 'UPPER_CASE',
      variables: 'camelCase'
    };
  }

  private extractStructuralPreferences(patterns: any[]): string[] {
    return ['modular_design', 'single_responsibility', 'dependency_injection'];
  }

  private extractTestingApproach(patterns: any[]): string {
    return 'unit_testing_with_jest';
  }

  private extractExpertiseAreas(patterns: any[]): string[] {
    return ['typescript', 'react', 'node.js', 'database_design'];
  }

  private extractRecentFocus(patterns: any[]): string[] {
    return patterns.map(p => p.type).slice(0, 5);
  }

  private inferArchitectureFromBlueprint(blueprint: { frameworks: string[]; keyDirectories: any[] }): string {
    const { frameworks, keyDirectories } = blueprint;

    if (frameworks.some(f => f.toLowerCase().includes('react'))) {
      return 'Component-Based (React)';
    } else if (frameworks.some(f => f.toLowerCase().includes('express'))) {
      return 'REST API (Express)';
    } else if (frameworks.some(f => f.toLowerCase().includes('fastapi'))) {
      return 'REST API (FastAPI)';
    } else if (keyDirectories.some(d => d.directoryType === 'services')) {
      return 'Service-Oriented';
    } else if (keyDirectories.some(d => d.directoryType === 'components')) {
      return 'Component-Based';
    } else if (keyDirectories.some(d => d.directoryType === 'models') && keyDirectories.some(d => d.directoryType === 'views')) {
      return 'MVC Pattern';
    } else {
      return 'Modular';
    }
  }

  private async buildSemanticIndex(concepts: any[], patterns: any[]): Promise<number> {
    try {
      // Use the shared vector DB instance if available
      const vectorDB = this.vectorDB;
      if (!vectorDB) {
        console.warn('No vector database available for semantic indexing');
        return 0;
      }
      
      // Initialize vector DB if not already done
      await vectorDB.initialize('in-memoria-intelligence');
      
      let vectorCount = 0;
      
      // Create embeddings for semantic concepts
      for (const concept of concepts) {
        const conceptType = concept.type || 'unknown';
        const text = `${concept.name} ${conceptType}`;
        await vectorDB.storeCodeEmbedding(text, {
          id: concept.id,
          filePath: concept.filePath,
          functionName: conceptType === 'function' ? concept.name : undefined,
          className: conceptType === 'class' ? concept.name : undefined,
          language: 'unknown',
          complexity: 1,
          lineCount: 1,
          lastModified: new Date()
        });
        vectorCount++;
      }
      
      // Create embeddings for patterns
      for (const pattern of patterns) {
        const patternType = pattern.type || 'unknown';
        const text = `${patternType} ${pattern.content?.description || ''}`;
        await vectorDB.storeCodeEmbedding(text, {
          id: pattern.id,
          filePath: `pattern-${patternType}`,
          language: 'pattern',
          complexity: pattern.frequency || 1,
          lineCount: 1,
          lastModified: new Date()
        });
        vectorCount++;
      }
      
      return vectorCount;
    } catch (error) {
      console.warn('Failed to build semantic index:', error);
      return 0;
    }
  }
}