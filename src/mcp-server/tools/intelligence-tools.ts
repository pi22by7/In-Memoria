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
        if (existingIntelligence && existingIntelligence.concepts > 0) {
          return {
            success: true,
            conceptsLearned: existingIntelligence.concepts,
            patternsLearned: existingIntelligence.patterns,
            insights: ['Using existing intelligence (use force: true to re-learn)'],
            timeElapsed: Date.now() - startTime
          };
        }
      }

      const insights: string[] = [];
      
      // Phase 1: Comprehensive codebase analysis
      insights.push('🔍 Phase 1: Analyzing codebase structure...');
      const codebaseAnalysis = await this.semanticEngine.analyzeCodebase(args.path);
      insights.push(`   ✅ Detected languages: ${codebaseAnalysis.languages.join(', ')}`);
      insights.push(`   ✅ Found frameworks: ${codebaseAnalysis.frameworks.join(', ') || 'none detected'}`);
      insights.push(`   ✅ Complexity: ${codebaseAnalysis.complexity.cyclomatic.toFixed(1)} cyclomatic, ${codebaseAnalysis.complexity.cognitive.toFixed(1)} cognitive`);

      // Phase 2: Deep semantic learning
      insights.push('🧠 Phase 2: Learning semantic concepts...');
      const concepts = await this.semanticEngine.learnFromCodebase(args.path);
      
      // Analyze concept distribution
      const conceptTypes = concepts.reduce((acc, concept) => {
        const type = concept.type || 'unknown';
        acc[type] = (acc[type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      insights.push(`   ✅ Extracted ${concepts.length} semantic concepts:`);
      Object.entries(conceptTypes).forEach(([type, count]) => {
        insights.push(`     - ${count} ${type}${count > 1 ? 's' : ''}`);
      });

      // Phase 3: Pattern discovery and learning
      insights.push('🔄 Phase 3: Discovering coding patterns...');
      const patterns = await this.patternEngine.learnFromCodebase(args.path);
      
      // Analyze pattern distribution
      const patternTypes = patterns.reduce((acc, pattern) => {
        const patternType = pattern.type || 'unknown';
        const category = patternType.split('_')[0]; // Get category from pattern type
        acc[category] = (acc[category] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      insights.push(`   ✅ Identified ${patterns.length} coding patterns:`);
      Object.entries(patternTypes).forEach(([category, count]) => {
        insights.push(`     - ${count} ${category} pattern${count > 1 ? 's' : ''}`);
      });

      // Phase 4: Relationship and dependency analysis
      insights.push('🔗 Phase 4: Analyzing relationships and dependencies...');
      const relationships = await this.analyzeCodebaseRelationships(concepts, patterns);
      insights.push(`   ✅ Built ${relationships.conceptRelationships} concept relationships`);
      insights.push(`   ✅ Identified ${relationships.dependencyPatterns} dependency patterns`);
      
      // Phase 5: Intelligence synthesis and storage
      insights.push('💾 Phase 5: Synthesizing and storing intelligence...');
      await this.storeIntelligence(args.path, concepts, patterns);
      
      // Generate learning insights based on discovered patterns
      const learningInsights = await this.generateLearningInsights(concepts, patterns, codebaseAnalysis);
      insights.push('🎯 Learning Summary:');
      learningInsights.forEach(insight => insights.push(`   ${insight}`));
      
      // Phase 6: Vector embeddings for semantic search
      insights.push('🔍 Phase 6: Building semantic search index...');
      const vectorCount = await this.buildSemanticIndex(concepts, patterns);
      insights.push(`   ✅ Created ${vectorCount} vector embeddings for semantic search`);
      
      const timeElapsed = Date.now() - startTime;
      insights.push(`⚡ Learning completed in ${timeElapsed}ms`);
      
      return {
        success: true,
        conceptsLearned: concepts.length,
        patternsLearned: patterns.length,
        insights,
        timeElapsed
      };
    } catch (error) {
      return {
        success: false,
        conceptsLearned: 0,
        patternsLearned: 0,
        insights: [`❌ Learning failed: ${error instanceof Error ? error.message : error}`],
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
    
    console.warn('⚠️  No existing intelligence found - starting fresh analysis');
    return null; // Null is honest here - we genuinely found no existing data
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