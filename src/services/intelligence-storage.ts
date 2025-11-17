import { nanoid } from 'nanoid';
import type { SQLiteDatabase } from '../storage/sqlite-db.js';
import type { SemanticVectorDB } from '../storage/vector-db.js';

/**
 * Intelligence Storage Service
 *
 * Centralizes storage logic for learned concepts, patterns, and insights.
 * Extracted from learning-service.ts and intelligence-tools.ts to eliminate duplication.
 */
export class IntelligenceStorageService {
  /**
   * Store learned concepts and patterns in database
   */
  static async storeIntelligence(
    database: SQLiteDatabase,
    path: string,
    concepts: any[],
    patterns: any[]
  ): Promise<void> {
    // Store concepts
    for (const concept of concepts) {
      database.insertSemanticConcept({
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
      database.insertDeveloperPattern({
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

  /**
   * Analyze relationships between concepts and patterns
   */
  static async analyzeCodebaseRelationships(
    concepts: any[],
    patterns: any[]
  ): Promise<{ conceptRelationships: number; dependencyPatterns: number }> {
    const conceptRelationships = new Set<string>();

    // Group concepts by file
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

    // Analyze dependency patterns
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

  /**
   * Generate learning insights from analyzed data
   */
  static async generateLearningInsights(
    concepts: any[],
    patterns: any[],
    codebaseAnalysis: any
  ): Promise<string[]> {
    const insights: string[] = [];

    // Analyze codebase characteristics
    const totalLines = codebaseAnalysis?.complexity?.lines || 0;
    const conceptDensity = totalLines > 0 ? (concepts.length / totalLines * 1000).toFixed(2) : '0';
    if (totalLines > 0) {
      insights.push(`📊 Concept density: ${conceptDensity} concepts per 1000 lines`);
    }

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
    const complexity = codebaseAnalysis?.complexity;
    if (complexity && typeof complexity.cyclomatic === 'number') {
      if (complexity.cyclomatic < 10) {
        insights.push('🟢 Low complexity codebase - easy to maintain');
      } else if (complexity.cyclomatic < 30) {
        insights.push('🟡 Moderate complexity - consider refactoring high-complexity areas');
      } else {
        insights.push('🔴 High complexity detected - refactoring recommended');
      }
    }

    // Analyze language and framework usage
    const languages = codebaseAnalysis?.languages || [];
    const frameworks = codebaseAnalysis?.frameworks || [];

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

  /**
   * Store project blueprint in database
   */
  static async storeProjectBlueprint(
    projectPath: string,
    codebaseAnalysis: any,
    database: SQLiteDatabase
  ): Promise<void> {
    // Store entry points (filter out invalid ones)
    if (codebaseAnalysis.entryPoints && Array.isArray(codebaseAnalysis.entryPoints)) {
      for (const entryPoint of codebaseAnalysis.entryPoints) {
        // Skip entry points with missing required fields
        if (!entryPoint.type || !entryPoint.filePath) {
          continue;
        }

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

    // Store key directories (filter out invalid ones)
    if (codebaseAnalysis.keyDirectories && Array.isArray(codebaseAnalysis.keyDirectories)) {
      for (const directory of codebaseAnalysis.keyDirectories) {
        // Skip directories with missing required fields
        if (!directory.path || !directory.type) {
          continue;
        }

        database.insertKeyDirectory({
          id: nanoid(),
          projectPath,
          directoryPath: directory.path,
          directoryType: directory.type,
          fileCount: directory.fileCount || 0,
          description: directory.description
        });
      }
    }
  }

  /**
   * Infer architecture pattern from codebase data
   */
  static inferArchitecturePattern(codebaseAnalysis: any): string {
    const frameworks = codebaseAnalysis?.frameworks || [];
    const directories = codebaseAnalysis?.keyDirectories || [];

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

  /**
   * Build semantic index for fast retrieval
   */
  static async buildSemanticIndex(
    vectorDB: SemanticVectorDB,
    concepts: any[],
    patterns: any[]
  ): Promise<number> {
    try {
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
