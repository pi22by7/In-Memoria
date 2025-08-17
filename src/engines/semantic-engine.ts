import { SemanticAnalyzer } from '../rust-bindings.js';
import { SQLiteDatabase, SemanticConcept } from '../storage/sqlite-db.js';
import { SemanticVectorDB } from '../storage/vector-db.js';
import { nanoid } from 'nanoid';

export interface CodebaseAnalysisResult {
  languages: string[];
  frameworks: string[];
  complexity: {
    cyclomatic: number;
    cognitive: number;
    lines: number;
  };
  concepts: Array<{
    name: string;
    type: string;
    confidence: number;
  }>;
}

export interface FileAnalysisResult {
  concepts: Array<{
    name: string;
    type: string;
    confidence: number;
    filePath: string;
    lineRange: { start: number; end: number };
  }>;
}

export class SemanticEngine {
  private rustAnalyzer: SemanticAnalyzer;

  constructor(
    private database: SQLiteDatabase,
    private vectorDB: SemanticVectorDB
  ) {
    this.rustAnalyzer = new SemanticAnalyzer();
  }

  async analyzeCodebase(path: string): Promise<CodebaseAnalysisResult> {
    try {
      const result = await this.rustAnalyzer.analyzeCodebase(path);
      return {
        languages: result.languages,
        frameworks: result.frameworks,
        complexity: {
          cyclomatic: result.complexity.cyclomatic,
          cognitive: result.complexity.cognitive,
          lines: result.complexity.lines
        },
        concepts: result.concepts.map(c => ({
          name: c.name,
          type: c.conceptType,
          confidence: c.confidence
        }))
      };
    } catch (error) {
      console.error('Rust analyzer error:', error);
      // Fallback to TypeScript analysis
      return this.fallbackAnalysis(path);
    }
  }

  async analyzeFileContent(filePath: string, content: string): Promise<FileAnalysisResult['concepts']> {
    try {
      const concepts = await this.rustAnalyzer.analyzeFileContent(filePath, content);
      return concepts.map(c => ({
        name: c.name,
        type: c.conceptType,
        confidence: c.confidence,
        filePath: c.filePath,
        lineRange: {
          start: c.lineRange.start,
          end: c.lineRange.end
        }
      }));
    } catch (error) {
      console.error('File analysis error:', error);
      return this.fallbackFileAnalysis(filePath, content);
    }
  }

  async learnFromCodebase(path: string): Promise<Array<{
    id: string;
    name: string;
    type: string;
    confidence: number;
    filePath: string;
    lineRange: { start: number; end: number };
    relationships: Record<string, any>;
  }>> {
    try {
      const concepts = await this.rustAnalyzer.learnFromCodebase(path);
      
      // Store in vector database for semantic search
      await this.vectorDB.initialize();
      
      const result = concepts.map(c => ({
        id: c.id,
        name: c.name,
        type: c.conceptType,
        confidence: c.confidence,
        filePath: c.filePath,
        lineRange: {
          start: c.lineRange.start,
          end: c.lineRange.end
        },
        relationships: c.relationships
      }));

      // Store concepts for persistence
      for (const concept of result) {
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

        // Store in vector DB if it's a significant concept
        if (concept.confidence > 0.5) {
          try {
            await this.vectorDB.storeCodeEmbedding(
              concept.name,
              {
                id: concept.id,
                filePath: concept.filePath,
                functionName: concept.type === 'function' ? concept.name : undefined,
                className: concept.type === 'class' ? concept.name : undefined,
                language: this.detectLanguageFromPath(concept.filePath),
                complexity: Math.floor(concept.confidence * 10),
                lineCount: concept.lineRange.end - concept.lineRange.start + 1,
                lastModified: new Date()
              }
            );
          } catch (vectorError) {
            console.warn('Failed to store vector embedding:', vectorError);
          }
        }
      }

      return result;
    } catch (error) {
      console.error('Learning error:', error);
      return [];
    }
  }

  async updateFromAnalysis(analysisData: any): Promise<void> {
    try {
      // Update the Rust analyzer with new analysis data
      await this.rustAnalyzer.updateFromAnalysis(JSON.stringify(analysisData));
      
      // Update local intelligence based on the analysis
      if (analysisData.change && analysisData.impact.affectedConcepts) {
        for (const conceptName of analysisData.impact.affectedConcepts) {
          const existingConcepts = this.database.getSemanticConcepts();
          const concept = existingConcepts.find(c => c.conceptName === conceptName);
          
          if (concept) {
            // Update concept's evolution history
            const updatedHistory = {
              ...concept.evolutionHistory,
              changes: [
                ...(concept.evolutionHistory.changes || []),
                {
                  timestamp: new Date(),
                  changeType: analysisData.change.type,
                  confidence: analysisData.impact.confidence
                }
              ]
            };

            this.database.insertSemanticConcept({
              ...concept,
              evolutionHistory: updatedHistory,
              confidenceScore: Math.min(1.0, concept.confidenceScore + 0.1) // Boost confidence
            });
          }
        }
      }
    } catch (error) {
      console.error('Failed to update from analysis:', error);
    }
  }

  async findRelatedConcepts(conceptId: string): Promise<string[]> {
    try {
      return await this.rustAnalyzer.getConceptRelationships(conceptId);
    } catch (error) {
      console.error('Failed to get relationships:', error);
      return [];
    }
  }

  async searchSemanticallySimilar(query: string, limit: number = 5): Promise<Array<{
    concept: string;
    similarity: number;
    filePath: string;
  }>> {
    try {
      await this.vectorDB.initialize();
      const results = await this.vectorDB.findSimilarCode(query, limit);
      
      return results.map(result => ({
        concept: result.metadata.functionName || result.metadata.className || 'unknown',
        similarity: result.similarity,
        filePath: result.metadata.filePath
      }));
    } catch (error) {
      console.error('Semantic search error:', error);
      return [];
    }
  }

  private async fallbackAnalysis(path: string): Promise<CodebaseAnalysisResult> {
    // TypeScript-based semantic analysis
    return {
      languages: ['unknown'],
      frameworks: [],
      complexity: {
        cyclomatic: 1,
        cognitive: 1,
        lines: 0
      },
      concepts: []
    };
  }

  private fallbackFileAnalysis(filePath: string, content: string): FileAnalysisResult['concepts'] {
    // Pattern-based semantic concept extraction
    const concepts: FileAnalysisResult['concepts'] = [];
    
    const lines = content.split('\n');
    
    // Look for class declarations
    lines.forEach((line, index) => {
      const classMatch = line.match(/class\s+(\w+)/);
      if (classMatch) {
        concepts.push({
          name: classMatch[1],
          type: 'class',
          confidence: 0.7,
          filePath,
          lineRange: { start: index + 1, end: index + 1 }
        });
      }

      // Look for function declarations
      const funcMatch = line.match(/function\s+(\w+)/) || line.match(/(\w+)\s*\(/);
      if (funcMatch) {
        concepts.push({
          name: funcMatch[1],
          type: 'function',
          confidence: 0.6,
          filePath,
          lineRange: { start: index + 1, end: index + 1 }
        });
      }
    });

    return concepts;
  }

  private detectLanguageFromPath(filePath: string): string {
    const ext = filePath.split('.').pop()?.toLowerCase();
    const languageMap: Record<string, string> = {
      'ts': 'typescript',
      'tsx': 'typescript',
      'js': 'javascript',
      'jsx': 'javascript',
      'py': 'python',
      'rs': 'rust',
      'go': 'go',
      'java': 'java'
    };
    return languageMap[ext || ''] || 'unknown';
  }
}