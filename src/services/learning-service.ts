import { SemanticEngine } from '../engines/semantic-engine.js';
import { PatternEngine } from '../engines/pattern-engine.js';
import { SQLiteDatabase } from '../storage/sqlite-db.js';
import { SemanticVectorDB } from '../storage/vector-db.js';
import { config } from '../config/config.js';
import { nanoid } from 'nanoid';
import { IntelligenceStorageService } from './intelligence-storage.js';

export interface LearningResult {
  success: boolean;
  conceptsLearned: number;
  patternsLearned: number;
  featuresLearned: number;
  insights: string[];
  timeElapsed: number;
  blueprint?: {
    techStack: string[];
    entryPoints: Record<string, string>;
    keyDirectories: Record<string, string>;
    architecture: string;
  };
}

export interface LearningOptions {
  force?: boolean;
  progressCallback?: (current: number, total: number, message: string) => void;
}

/**
 * Shared learning service used by both CLI and MCP tools
 * Ensures consistent behavior across all interfaces
 */
export class LearningService {
  /**
   * Learn from a codebase - shared implementation for CLI and MCP
   */
  static async learnFromCodebase(
    path: string,
    options: LearningOptions = {}
  ): Promise<LearningResult> {
    const startTime = Date.now();
    const insights: string[] = [];

    // Create project-specific database and engines
    const projectDbPath = config.getDatabasePath(path);
    const projectDatabase = new SQLiteDatabase(projectDbPath);
    const projectVectorDB = new SemanticVectorDB(process.env.OPENAI_API_KEY);
    const projectSemanticEngine = new SemanticEngine(projectDatabase, projectVectorDB);
    const projectPatternEngine = new PatternEngine(projectDatabase);

    try {
      console.error(`🗄️ Using project database: ${projectDbPath}`);

      // Check if already learned and not forcing re-learn
      if (!options.force) {
        const existingIntelligence = await this.checkExistingIntelligence(projectDatabase, path);
        if (existingIntelligence && existingIntelligence.concepts > 0) {
          return {
            success: true,
            conceptsLearned: existingIntelligence.concepts,
            patternsLearned: existingIntelligence.patterns,
            featuresLearned: existingIntelligence.features,
            insights: ['Using existing intelligence (use force: true to re-learn)'],
            timeElapsed: Date.now() - startTime
          };
        }
      }

      // Phase 1: Comprehensive codebase analysis
      insights.push('🔍 Phase 1: Analyzing codebase structure...');
      const codebaseAnalysis = await projectSemanticEngine.analyzeCodebase(path);
      insights.push(`   ✅ Detected languages: ${codebaseAnalysis.languages?.join(', ') || 'unknown'}`);
      insights.push(`   ✅ Found frameworks: ${codebaseAnalysis.frameworks?.join(', ') || 'none detected'}`);
      if (codebaseAnalysis.complexity) {
        insights.push(`   ✅ Complexity: ${codebaseAnalysis.complexity.cyclomatic?.toFixed(1) || 'N/A'} cyclomatic, ${codebaseAnalysis.complexity.cognitive?.toFixed(1) || 'N/A'} cognitive`);
      }

      // Phase 2: Deep semantic learning
      insights.push('🧠 Phase 2: Learning semantic concepts...');
      const concepts = await projectSemanticEngine.learnFromCodebase(path, options.progressCallback);

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
      const patterns = await projectPatternEngine.learnFromCodebase(path, options.progressCallback);

      // Analyze pattern distribution
      const patternTypes = patterns.reduce((acc, pattern) => {
        const patternType = pattern.type || 'unknown';
        const category = patternType.split('_')[0];
        acc[category] = (acc[category] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      insights.push(`   ✅ Identified ${patterns.length} coding patterns:`);
      Object.entries(patternTypes).forEach(([category, count]) => {
        insights.push(`     - ${count} ${category} pattern${count > 1 ? 's' : ''}`);
      });

      // Phase 4: Relationship and dependency analysis
      insights.push('🔗 Phase 4: Analyzing relationships and dependencies...');
      const relationships = await IntelligenceStorageService.analyzeCodebaseRelationships(concepts, patterns);
      insights.push(`   ✅ Built ${relationships.conceptRelationships} concept relationships`);
      insights.push(`   ✅ Identified ${relationships.dependencyPatterns} dependency patterns`);

      // Phase 5: Intelligence synthesis and storage
      insights.push('💾 Phase 5: Synthesizing and storing intelligence...');
      await IntelligenceStorageService.storeIntelligence(projectDatabase, path, concepts, patterns);

      // Generate learning insights
      const learningInsights = await IntelligenceStorageService.generateLearningInsights(concepts, patterns, codebaseAnalysis);
      insights.push('🎯 Learning Summary:');
      learningInsights.forEach(insight => insights.push(`   ${insight}`));

      // Phase 6: Vector embeddings for semantic search
      insights.push('🔍 Phase 6: Building semantic search index...');
      insights.push(`   ✅ Using free local embeddings (transformers.js)`);

      const vectorCount = await IntelligenceStorageService.buildSemanticIndex(projectVectorDB, concepts, patterns);
      insights.push(`   ✅ Created ${vectorCount} vector embeddings for semantic search`);

      // Phase 6.5: Ensure project metadata exists (required for foreign keys)
      insights.push('📋 Phase 6.5: Ensuring project metadata...');
      const existingMetadata = projectDatabase.getProjectMetadata(path);
      if (!existingMetadata) {
        projectDatabase.insertProjectMetadata({
          projectId: nanoid(),
          projectPath: path,
          projectName: path.split('/').pop() || 'unknown',
          languagePrimary: codebaseAnalysis.languages?.[0],
          languagesDetected: codebaseAnalysis.languages || [],
          frameworkDetected: codebaseAnalysis.frameworks || [],
          intelligenceVersion: '0.6.0',
          lastFullScan: new Date()
        });
        insights.push(`   ✅ Created project metadata for ${path}`);
      } else {
        insights.push(`   ✅ Project metadata already exists`);
      }

      // Phase 7: Feature mapping for intelligent file routing
      insights.push('🗺️  Phase 7: Building feature map for file routing...');
      const featureMaps = await projectPatternEngine.buildFeatureMap(path);

      // Debug: Log what we got from buildFeatureMap
      if (featureMaps.length > 0) {
        insights.push(`   🔍 Debug: Received ${featureMaps.length} feature maps from buildFeatureMap`);
        const sample = featureMaps[0];
        insights.push(`   🔍 Debug: Sample feature map: id=${sample?.id}, featureName=${sample?.featureName}, primaryFiles=${sample?.primaryFiles?.length || 0}`);
      }

      // Store feature maps in database (filter out invalid ones)
      let validFeatureMaps = 0;
      let skippedDueToMissingId = 0;
      let skippedDueToMissingName = 0;
      for (const featureMap of featureMaps) {
        // Skip feature maps with missing required fields
        if (!featureMap.id) {
          skippedDueToMissingId++;
          continue;
        }
        if (!featureMap.featureName) {
          skippedDueToMissingName++;
          continue;
        }

        projectDatabase.insertFeatureMap({
          id: featureMap.id,
          projectPath: path,
          featureName: featureMap.featureName,
          primaryFiles: featureMap.primaryFiles || [],
          relatedFiles: featureMap.relatedFiles || [],
          dependencies: featureMap.dependencies || [],
          status: 'active'
        });
        validFeatureMaps++;
      }
      const totalFiles = featureMaps.reduce((sum, fm) => sum + (fm.primaryFiles?.length || 0) + (fm.relatedFiles?.length || 0), 0);
      const totalSkipped = skippedDueToMissingId + skippedDueToMissingName;
      if (totalSkipped > 0) {
        insights.push(`   ⚠️  Skipped ${totalSkipped} invalid feature maps (${skippedDueToMissingId} missing ID, ${skippedDueToMissingName} missing name)`);
      }
      insights.push(`   ✅ Mapped ${validFeatureMaps} features to ${totalFiles} files`);

      // Phase 8: Store blueprint data
      insights.push('💾 Phase 8: Storing project blueprint...');
      await IntelligenceStorageService.storeProjectBlueprint(path, codebaseAnalysis, projectDatabase);

      const timeElapsed = Date.now() - startTime;
      insights.push(`⚡ Learning completed in ${timeElapsed}ms`);

      // Build blueprint summary
      const blueprint = {
        techStack: codebaseAnalysis.frameworks || [],
        entryPoints: (codebaseAnalysis.entryPoints || []).reduce((acc, ep) => {
          acc[ep.type] = ep.filePath;
          return acc;
        }, {} as Record<string, string>),
        keyDirectories: (codebaseAnalysis.keyDirectories || []).reduce((acc, dir) => {
          acc[dir.type] = dir.path;
          return acc;
        }, {} as Record<string, string>),
        architecture: IntelligenceStorageService.inferArchitecturePattern(codebaseAnalysis)
      };

      return {
        success: true,
        conceptsLearned: concepts.length,
        patternsLearned: patterns.length,
        featuresLearned: validFeatureMaps,
        insights,
        timeElapsed,
        blueprint
      };
    } catch (error) {
      return {
        success: false,
        conceptsLearned: 0,
        patternsLearned: 0,
        featuresLearned: 0,
        insights: [`❌ Learning failed: ${error instanceof Error ? error.message : error}`],
        timeElapsed: Date.now() - startTime
      };
    } finally {
      // Clean up project-specific resources
      if (projectSemanticEngine) {
        projectSemanticEngine.cleanup();
      }
      if (projectVectorDB) {
        try {
          await projectVectorDB.close();
        } catch (error) {
          console.warn('Warning: Failed to close project vector database:', error);
        }
      }
      if (projectDatabase) {
        projectDatabase.close();
      }
    }
  }

  private static async checkExistingIntelligence(
    database: SQLiteDatabase,
    path: string
  ): Promise<{ concepts: number; patterns: number; features: number } | null> {
    const concepts = database.getSemanticConcepts().length;
    const patterns = database.getDeveloperPatterns().length;
    const features = database.getFeatureMaps(path).length;

    if (concepts > 0 || patterns > 0) {
      return { concepts, patterns, features };
    }

    console.warn('⚠️  No existing intelligence found in project database - starting fresh analysis');
    return null;
  }
}
