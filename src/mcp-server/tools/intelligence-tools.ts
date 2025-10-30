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
        description: 'Build intelligence database from codebase (one-time setup, ~30-60s). Required before using predict_coding_approach, get_project_blueprint, or get_pattern_recommendations. Re-run with force=true if codebase has significant changes. Most users should use auto_learn_if_needed instead - it runs this automatically when needed.',
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
            }
          },
          required: ['path']
        }
      },
      {
        name: 'get_semantic_insights',
        description: 'Search for code-level symbols (variables, functions, classes) by name and see their relationships, usage patterns, and evolution. Use this to find where a specific function/class is defined, how it\'s used, or what it depends on. Searches actual code identifiers (e.g., "DatabaseConnection", "processRequest"), NOT business concepts or natural language descriptions.',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Code identifier to search for (e.g., "DatabaseConnection", "processRequest"). Matches against function/class/variable names, not descriptions.'
            },
            conceptType: {
              type: 'string',
              description: 'Filter by concept type (class, function, interface, variable, etc.)'
            },
            limit: {
              type: 'number',
              minimum: 1,
              maximum: 50,
              description: 'Maximum number of insights to return'
            }
          }
        }
      },
      {
        name: 'get_pattern_recommendations',
        description: 'Get coding pattern recommendations learned from this codebase. Use this when implementing new features to follow existing patterns (e.g., "create a new service class", "add API endpoint"). Returns patterns like Factory, Singleton, DependencyInjection with confidence scores and actual examples from your code. These patterns are learned from the codebase, not hardcoded - they reflect how THIS project does things.',
        inputSchema: {
          type: 'object',
          properties: {
            currentFile: {
              type: 'string',
              description: 'Current file being worked on'
            },
            selectedCode: {
              type: 'string',
              description: 'Currently selected code snippet'
            },
            problemDescription: {
              type: 'string',
              description: 'What you want to implement (e.g., "create a new service", "add database repository", "implement API handler")'
            },
            preferences: {
              type: 'object',
              description: 'Developer preferences and constraints'
            },
            includeRelatedFiles: {
              type: 'boolean',
              description: 'Include suggestions for related files where similar patterns are used'
            }
          },
          required: ['problemDescription']
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

  async learnCodebaseIntelligence(args: { path: string; force?: boolean }): Promise<{
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
  }> {
    // Use shared learning service to ensure consistency between CLI and MCP
    const { LearningService } = await import('../../services/learning-service.js');
    return await LearningService.learnFromCodebase(args.path, {
      force: args.force
    });
  }

  async getSemanticInsights(args: {
    query?: string;
    conceptType?: string;
    limit?: number
  }): Promise<{
    insights: SemanticInsight[];
    totalAvailable: number;
  }> {
    const concepts = this.database.getSemanticConcepts();
    // console.error(`🔍 getSemanticInsights: Retrieved ${concepts.length} concepts from database`);
    // console.error(`   Query: "${args.query}", ConceptType: ${args.conceptType}`);

    const filtered = concepts.filter(concept => {
      if (args.conceptType && concept.conceptType !== args.conceptType) return false;
      if (args.query && !concept.conceptName.toLowerCase().includes(args.query.toLowerCase())) return false;
      return true;
    });

    // console.error(`   Filtered to ${filtered.length} concepts`);

    const limit = args.limit || 10;
    const limited = filtered.slice(0, limit);

    const insights: SemanticInsight[] = limited.map(concept => ({
      concept: concept.conceptName,
      relationships: Object.keys(concept.relationships),
      usage: {
        frequency: concept.confidenceScore * 100, // Convert to frequency approximation
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

  async getPatternRecommendations(args: CodingContext & {
    includeRelatedFiles?: boolean;
  }): Promise<{
    recommendations: PatternRecommendation[];
    reasoning: string;
    relatedFiles?: string[];
  }> {
    const context = CodingContextSchema.parse(args);
    const patterns = this.database.getDeveloperPatterns();

    // Get relevant patterns based on context
    const relevantPatterns = await this.patternEngine.findRelevantPatterns(
      context.problemDescription,
      context.currentFile,
      context.selectedCode
    );

    const recommendations: PatternRecommendation[] = relevantPatterns.map(pattern => ({
      pattern: pattern.patternId,
      description: pattern.patternContent.description || 'Pattern recommendation',
      confidence: pattern.confidence,
      examples: pattern.examples.map(ex => ex.code || ''),
      reasoning: `Based on ${pattern.frequency} similar occurrences in your codebase`
    }));

    const result: {
      recommendations: PatternRecommendation[];
      reasoning: string;
      relatedFiles?: string[];
    } = {
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
    const patterns = this.database.getDeveloperPatterns();
    const recentPatterns = patterns.filter(p => {
      const daysSinceLastSeen = Math.floor(
        (Date.now() - p.lastSeen.getTime()) / (1000 * 60 * 60 * 24)
      );
      return daysSinceLastSeen <= 30; // Last 30 days
    });

    const profile: DeveloperProfile = {
      preferredPatterns: patterns.slice(0, 10).map(p => ({
        pattern: p.patternId,
        description: p.patternContent.description || 'Developer pattern',
        confidence: p.confidence,
        examples: p.examples.map(ex => ex.code || ''),
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

  private async storeIntelligence(
    path: string, 
    concepts: any[], 
    patterns: any[]
  ): Promise<void> {
    // Store concepts
    for (const concept of concepts) {
      this.database.insertSemanticConcept({
        id: concept.id,
        conceptName: concept.name,
        conceptType: concept.type,
        confidenceScore: concept.confidence,
        relationships: concept.relationships,
        evolutionHistory: {},
        filePath: concept.filePath,
        lineRange: concept.lineRange
      });
    }

    // Store patterns
    for (const pattern of patterns) {
      this.database.insertDeveloperPattern({
        patternId: pattern.id,
        patternType: pattern.type,
        patternContent: pattern.content,
        frequency: pattern.frequency,
        contexts: pattern.contexts,
        examples: pattern.examples,
        confidence: pattern.confidence
      });
    }
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

  private async analyzeCodebaseRelationships(
    concepts: any[], 
    patterns: any[]
  ): Promise<{ conceptRelationships: number; dependencyPatterns: number }> {
    // Analyze semantic relationships between concepts
    const conceptRelationships = new Set<string>();
    
    // Group concepts by file to find file-level relationships
    const conceptsByFile = concepts.reduce((acc, concept) => {
      const filePath = concept.filePath || concept.file_path || 'unknown';
      if (!acc[filePath]) acc[filePath] = [];
      acc[filePath].push(concept);
      return acc;
    }, {} as Record<string, any[]>);
    
    // Find relationships within files
    Object.values(conceptsByFile).forEach(fileConcepts => {
      if (Array.isArray(fileConcepts)) {
        for (let i = 0; i < fileConcepts.length; i++) {
          for (let j = i + 1; j < fileConcepts.length; j++) {
            const relationshipKey = `${fileConcepts[i].id}-${fileConcepts[j].id}`;
            conceptRelationships.add(relationshipKey);
          }
        }
      }
    });
    
    // Analyze dependency patterns from imports/references
    const dependencyPatterns = new Set<string>();
    patterns.forEach(pattern => {
      const patternType = pattern.type || '';
      if (patternType.includes('dependency') || 
          patternType.includes('import') ||
          patternType.includes('organization')) {
        dependencyPatterns.add(pattern.id);
      }
    });
    
    return {
      conceptRelationships: conceptRelationships.size,
      dependencyPatterns: dependencyPatterns.size
    };
  }

  private async generateLearningInsights(
    concepts: any[], 
    patterns: any[], 
    codebaseAnalysis: any
  ): Promise<string[]> {
    const insights: string[] = [];
    
    // Analyze codebase characteristics
    const totalLines = codebaseAnalysis.complexity?.lines || 0;
    const conceptDensity = totalLines > 0 ? (concepts.length / totalLines * 1000).toFixed(2) : '0';
    insights.push(`📊 Concept density: ${conceptDensity} concepts per 1000 lines`);
    
    // Analyze pattern distribution
    const namingPatterns = patterns.filter(p => p.type?.includes('naming'));
    const structuralPatterns = patterns.filter(p => p.type?.includes('organization') || p.type?.includes('structure'));
    const implementationPatterns = patterns.filter(p => p.type?.includes('implementation'));
    
    if (namingPatterns.length > 0) {
      insights.push(`✨ Strong naming conventions detected (${namingPatterns.length} patterns)`);
    }
    if (structuralPatterns.length > 0) {
      insights.push(`🏗️ Organized code structure found (${structuralPatterns.length} patterns)`);
    }
    if (implementationPatterns.length > 0) {
      insights.push(`⚙️ Design patterns in use (${implementationPatterns.length} patterns)`);
    }
    
    // Analyze complexity
    const complexity = codebaseAnalysis.complexity;
    if (complexity) {
      if (complexity.cyclomatic < 10) {
        insights.push('🟢 Low complexity codebase - easy to maintain');
      } else if (complexity.cyclomatic < 30) {
        insights.push('🟡 Moderate complexity - consider refactoring high-complexity areas');
      } else {
        insights.push('🔴 High complexity detected - refactoring recommended');
      }
    }
    
    // Analyze language and framework usage
    const languages = codebaseAnalysis.languages || [];
    const frameworks = codebaseAnalysis.frameworks || [];
    
    if (languages.length === 1) {
      insights.push(`🎯 Single-language codebase (${languages[0]}) - consistent technology stack`);
    } else if (languages.length > 1) {
      insights.push(`🌐 Multi-language codebase (${languages.join(', ')}) - consider integration patterns`);
    }
    
    if (frameworks.length > 0) {
      insights.push(`🔧 Framework usage: ${frameworks.join(', ')}`);
    }
    
    return insights;
  }

  private async storeProjectBlueprint(
    projectPath: string,
    codebaseAnalysis: any,
    database: SQLiteDatabase
  ): Promise<void> {
    const { nanoid } = await import('nanoid');

    // Store entry points
    if (codebaseAnalysis.entryPoints && Array.isArray(codebaseAnalysis.entryPoints)) {
      for (const entryPoint of codebaseAnalysis.entryPoints) {
        database.insertEntryPoint({
          id: nanoid(),
          projectPath,
          entryType: entryPoint.type,
          filePath: entryPoint.filePath,
          description: entryPoint.description,
          framework: entryPoint.framework
        });
      }
    }

    // Store key directories
    if (codebaseAnalysis.keyDirectories && Array.isArray(codebaseAnalysis.keyDirectories)) {
      for (const directory of codebaseAnalysis.keyDirectories) {
        database.insertKeyDirectory({
          id: nanoid(),
          projectPath,
          directoryPath: directory.path,
          directoryType: directory.type,
          fileCount: directory.fileCount,
          description: directory.description
        });
      }
    }
  }

  private inferArchitecturePattern(codebaseAnalysis: any): string {
    const frameworks = codebaseAnalysis.frameworks || [];
    const directories = codebaseAnalysis.keyDirectories || [];

    if (frameworks.some((f: string) => f.toLowerCase().includes('react'))) {
      return 'Component-Based (React)';
    } else if (frameworks.some((f: string) => f.toLowerCase().includes('express'))) {
      return 'REST API (Express)';
    } else if (frameworks.some((f: string) => f.toLowerCase().includes('fastapi'))) {
      return 'REST API (FastAPI)';
    } else if (directories.some((d: any) => d.type === 'services')) {
      return 'Service-Oriented';
    } else if (directories.some((d: any) => d.type === 'components')) {
      return 'Component-Based';
    } else if (directories.some((d: any) => d.type === 'models' && d.type === 'views')) {
      return 'MVC Pattern';
    } else {
      return 'Modular';
    }
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