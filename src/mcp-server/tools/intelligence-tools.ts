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

export class IntelligenceTools {
  constructor(
    private semanticEngine: SemanticEngine,
    private patternEngine: PatternEngine,
    private database: SQLiteDatabase
  ) {}

  get tools(): Tool[] {
    return [
      {
        name: 'learn_codebase_intelligence',
        description: 'Learn and extract intelligence from a codebase, building persistent knowledge',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Path to the codebase to learn from'
            },
            force: {
              type: 'boolean',
              description: 'Force re-learning even if codebase was previously analyzed'
            }
          },
          required: ['path']
        }
      },
      {
        name: 'get_semantic_insights',
        description: 'Retrieve semantic insights about code concepts and relationships',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Optional query to filter insights'
            },
            conceptType: {
              type: 'string',
              description: 'Filter by concept type (class, function, interface, etc.)'
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
        description: 'Get intelligent pattern recommendations based on coding context',
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
              description: 'Description of the problem being solved'
            },
            preferences: {
              type: 'object',
              description: 'Developer preferences and constraints'
            }
          },
          required: ['problemDescription']
        }
      },
      {
        name: 'predict_coding_approach',
        description: 'Predict the likely coding approach based on developer patterns and context',
        inputSchema: {
          type: 'object',
          properties: {
            problemDescription: {
              type: 'string',
              description: 'Description of the coding problem'
            },
            context: {
              type: 'object',
              description: 'Additional context about the current codebase and requirements'
            }
          },
          required: ['problemDescription']
        }
      },
      {
        name: 'get_developer_profile',
        description: 'Get the learned developer profile including patterns, preferences, and expertise',
        inputSchema: {
          type: 'object',
          properties: {
            includeRecentActivity: {
              type: 'boolean',
              description: 'Include recent coding activity in the profile'
            }
          }
        }
      },
      {
        name: 'contribute_insights',
        description: 'Allow AI agents to contribute insights back to the knowledge base',
        inputSchema: {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: ['bug_pattern', 'optimization', 'refactor_suggestion', 'best_practice'],
              description: 'Type of insight being contributed'
            },
            content: {
              type: 'object',
              description: 'The insight content and details'
            },
            confidence: {
              type: 'number',
              minimum: 0,
              maximum: 1,
              description: 'Confidence score for this insight'
            },
            sourceAgent: {
              type: 'string',
              description: 'Identifier of the AI agent contributing this insight'
            },
            impactPrediction: {
              type: 'object',
              description: 'Predicted impact of applying this insight'
            }
          },
          required: ['type', 'content', 'confidence', 'sourceAgent']
        }
      }
    ];
  }

  async learnCodebaseIntelligence(args: { path: string; force?: boolean }): Promise<{
    success: boolean;
    conceptsLearned: number;
    patternsLearned: number;
    insights: string[];
    timeElapsed: number;
  }> {
    const startTime = Date.now();
    
    try {
      // Check if already learned and not forcing re-learn
      if (!args.force) {
        const existingIntelligence = await this.checkExistingIntelligence(args.path);
        if (existingIntelligence) {
          return {
            success: true,
            conceptsLearned: existingIntelligence.concepts,
            patternsLearned: existingIntelligence.patterns,
            insights: ['Using existing intelligence (use force: true to re-learn)'],
            timeElapsed: Date.now() - startTime
          };
        }
      }

      // Learn semantic concepts
      const concepts = await this.semanticEngine.learnFromCodebase(args.path);
      
      // Learn patterns
      const patterns = await this.patternEngine.learnFromCodebase(args.path);
      
      // Store learned intelligence
      await this.storeIntelligence(args.path, concepts, patterns);
      
      return {
        success: true,
        conceptsLearned: concepts.length,
        patternsLearned: patterns.length,
        insights: [
          `Learned ${concepts.length} semantic concepts`,
          `Identified ${patterns.length} coding patterns`,
          'Intelligence stored for future sessions'
        ],
        timeElapsed: Date.now() - startTime
      };
    } catch (error) {
      return {
        success: false,
        conceptsLearned: 0,
        patternsLearned: 0,
        insights: [`Learning failed: ${error}`],
        timeElapsed: Date.now() - startTime
      };
    }
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
    const filtered = concepts.filter(concept => {
      if (args.conceptType && concept.conceptType !== args.conceptType) return false;
      if (args.query && !concept.conceptName.toLowerCase().includes(args.query.toLowerCase())) return false;
      return true;
    });

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

  async getPatternRecommendations(args: CodingContext): Promise<{
    recommendations: PatternRecommendation[];
    reasoning: string;
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

    return {
      recommendations,
      reasoning: `Found ${recommendations.length} relevant patterns based on your coding history and current context`
    };
  }

  async predictCodingApproach(args: { 
    problemDescription: string; 
    context?: Record<string, any> 
  }): Promise<CodingApproachPrediction> {
    const prediction = await this.patternEngine.predictApproach(
      args.problemDescription,
      args.context || {}
    );

    return {
      approach: prediction.approach,
      confidence: prediction.confidence,
      reasoning: prediction.reasoning,
      suggestedPatterns: prediction.patterns,
      estimatedComplexity: prediction.complexity
    };
  }

  async getDeveloperProfile(args: { includeRecentActivity?: boolean }): Promise<DeveloperProfile> {
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

    return profile;
  }

  async contributeInsights(args: AIInsights): Promise<{
    success: boolean;
    insightId: string;
    message: string;
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

      return {
        success: true,
        insightId,
        message: 'Insight contributed successfully and pending validation'
      };
    } catch (error) {
      return {
        success: false,
        insightId: '',
        message: `Failed to contribute insight: ${error}`
      };
    }
  }

  private async checkExistingIntelligence(path: string): Promise<{ concepts: number; patterns: number } | null> {
    const concepts = this.database.getSemanticConcepts().length;
    const patterns = this.database.getDeveloperPatterns().length;
    
    if (concepts > 0 || patterns > 0) {
      return { concepts, patterns };
    }
    
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
    return patterns.map(p => p.patternType).slice(0, 5);
  }
}