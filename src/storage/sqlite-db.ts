import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { DatabaseMigrator } from './migrations.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface SemanticConcept {
  id: string;
  conceptName: string;
  conceptType: string;
  confidenceScore: number;
  relationships: Record<string, any>;
  evolutionHistory: Record<string, any>;
  filePath: string;
  lineRange: { start: number; end: number };
  createdAt: Date;
  updatedAt: Date;
}

export interface DeveloperPattern {
  patternId: string;
  patternType: string;
  patternContent: Record<string, any>;
  frequency: number;
  contexts: string[];
  examples: Record<string, any>[];
  confidence: number;
  createdAt: Date;
  lastSeen: Date;
}

export interface FileIntelligence {
  filePath: string;
  fileHash: string;
  semanticConcepts: string[];
  patternsUsed: string[];
  complexityMetrics: Record<string, number>;
  dependencies: string[];
  lastAnalyzed: Date;
  createdAt: Date;
}

export interface AIInsight {
  insightId: string;
  insightType: string;
  insightContent: Record<string, any>;
  confidenceScore: number;
  sourceAgent: string;
  validationStatus: 'pending' | 'validated' | 'rejected';
  impactPrediction: Record<string, any>;
  createdAt: Date;
}

export class SQLiteDatabase {
  private db: Database.Database;
  private migrator: DatabaseMigrator;

  constructor(dbPath: string = ':memory:') {
    this.db = new Database(dbPath);
    this.migrator = new DatabaseMigrator(this.db);
    this.initializeDatabase();
  }

  private initializeDatabase(): void {
    // Run migrations if needed
    if (this.migrator.needsMigration()) {
      console.log('Running database migrations...');
      this.migrator.migrate();
    } else {
      console.log('Database is up to date');
    }
  }

  getMigrator(): DatabaseMigrator {
    return this.migrator;
  }

  // Semantic Concepts
  insertSemanticConcept(concept: Omit<SemanticConcept, 'createdAt' | 'updatedAt'>): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO semantic_concepts (
        id, concept_name, concept_type, confidence_score, 
        relationships, evolution_history, file_path, line_range
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      concept.id,
      concept.conceptName,
      concept.conceptType,
      concept.confidenceScore,
      JSON.stringify(concept.relationships),
      JSON.stringify(concept.evolutionHistory),
      concept.filePath,
      JSON.stringify(concept.lineRange)
    );
  }

  getSemanticConcepts(filePath?: string): SemanticConcept[] {
    let query = 'SELECT * FROM semantic_concepts';
    let params: any[] = [];

    if (filePath) {
      query += ' WHERE file_path = ?';
      params = [filePath];
    }

    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params) as any[];

    return rows.map(row => ({
      id: row.id,
      conceptName: row.concept_name,
      conceptType: row.concept_type,
      confidenceScore: row.confidence_score,
      relationships: JSON.parse(row.relationships || '{}'),
      evolutionHistory: JSON.parse(row.evolution_history || '{}'),
      filePath: row.file_path,
      lineRange: JSON.parse(row.line_range || '{"start": 0, "end": 0}'),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    }));
  }

  // Developer Patterns
  insertDeveloperPattern(pattern: Omit<DeveloperPattern, 'createdAt' | 'lastSeen'>): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO developer_patterns (
        pattern_id, pattern_type, pattern_content, frequency,
        contexts, examples, confidence, last_seen
      ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);

    stmt.run(
      pattern.patternId,
      pattern.patternType,
      JSON.stringify(pattern.patternContent),
      pattern.frequency,
      JSON.stringify(pattern.contexts),
      JSON.stringify(pattern.examples),
      pattern.confidence
    );
  }

  getDeveloperPatterns(patternType?: string): DeveloperPattern[] {
    let query = 'SELECT * FROM developer_patterns';
    let params: any[] = [];

    if (patternType) {
      query += ' WHERE pattern_type = ?';
      params = [patternType];
    }

    query += ' ORDER BY frequency DESC, confidence DESC';

    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params) as any[];

    return rows.map(row => ({
      patternId: row.pattern_id,
      patternType: row.pattern_type,
      patternContent: JSON.parse(row.pattern_content),
      frequency: row.frequency,
      contexts: JSON.parse(row.contexts || '[]'),
      examples: JSON.parse(row.examples || '[]'),
      confidence: row.confidence,
      createdAt: new Date(row.created_at),
      lastSeen: new Date(row.last_seen)
    }));
  }

  // File Intelligence
  insertFileIntelligence(fileIntel: Omit<FileIntelligence, 'createdAt'>): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO file_intelligence (
        file_path, file_hash, semantic_concepts, patterns_used,
        complexity_metrics, dependencies, last_analyzed
      ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);

    stmt.run(
      fileIntel.filePath,
      fileIntel.fileHash,
      JSON.stringify(fileIntel.semanticConcepts),
      JSON.stringify(fileIntel.patternsUsed),
      JSON.stringify(fileIntel.complexityMetrics),
      JSON.stringify(fileIntel.dependencies)
    );
  }

  getFileIntelligence(filePath: string): FileIntelligence | null {
    const stmt = this.db.prepare('SELECT * FROM file_intelligence WHERE file_path = ?');
    const row = stmt.get(filePath) as any;

    if (!row) return null;

    return {
      filePath: row.file_path,
      fileHash: row.file_hash,
      semanticConcepts: JSON.parse(row.semantic_concepts || '[]'),
      patternsUsed: JSON.parse(row.patterns_used || '[]'),
      complexityMetrics: JSON.parse(row.complexity_metrics || '{}'),
      dependencies: JSON.parse(row.dependencies || '[]'),
      lastAnalyzed: new Date(row.last_analyzed),
      createdAt: new Date(row.created_at)
    };
  }

  // AI Insights
  insertAIInsight(insight: Omit<AIInsight, 'createdAt'>): void {
    const stmt = this.db.prepare(`
      INSERT INTO ai_insights (
        insight_id, insight_type, insight_content, confidence_score,
        source_agent, validation_status, impact_prediction
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      insight.insightId,
      insight.insightType,
      JSON.stringify(insight.insightContent),
      insight.confidenceScore,
      insight.sourceAgent,
      insight.validationStatus,
      JSON.stringify(insight.impactPrediction)
    );
  }

  getAIInsights(insightType?: string): AIInsight[] {
    let query = 'SELECT * FROM ai_insights';
    let params: any[] = [];

    if (insightType) {
      query += ' WHERE insight_type = ?';
      params = [insightType];
    }

    query += ' ORDER BY confidence_score DESC, created_at DESC';

    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params) as any[];

    return rows.map(row => ({
      insightId: row.insight_id,
      insightType: row.insight_type,
      insightContent: JSON.parse(row.insight_content),
      confidenceScore: row.confidence_score,
      sourceAgent: row.source_agent,
      validationStatus: row.validation_status as 'pending' | 'validated' | 'rejected',
      impactPrediction: JSON.parse(row.impact_prediction || '{}'),
      createdAt: new Date(row.created_at)
    }));
  }

  close(): void {
    this.db.close();
  }
}