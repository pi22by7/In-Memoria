import Database from 'better-sqlite3';
import { existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';
import { getLogger } from '../utils/logger.js';
import { nanoid } from 'nanoid';

const logger = getLogger();

export interface GlobalProject {
  id: string;
  name: string;
  path: string;
  description?: string;
  primaryLanguage?: string;
  frameworks: string[];
  linkedAt: number;
  lastSynced?: number;
  patternCount: number;
  conceptCount: number;
  isActive: boolean;
}

export interface GlobalPattern {
  id: string;
  category: string;
  subcategory?: string;
  patternData: any;
  projectCount: number;
  totalFrequency: number;
  confidence: number;
  firstSeen: number;
  lastSeen: number;
  sourceProjects: string[];
  exampleCode?: string;
  language?: string;
}

export interface GlobalConcept {
  id: string;
  name: string;
  type: string;
  filePath: string;
  projectId: string;
  language: string;
  embeddingId?: string;
  metadata?: any;
  createdAt: number;
}

export interface PatternAggregation {
  id: string;
  patternSignature: string;
  category: string;
  occurrences: Array<{
    projectId: string;
    frequency: number;
    confidence: number;
  }>;
  aggregatedConfidence: number;
  consensusScore: number;
  createdAt: number;
  updatedAt: number;
}

export interface SyncResult {
  projectId: string;
  projectName: string;
  patternsAdded: number;
  patternsUpdated: number;
  conceptsAdded: number;
  durationMs: number;
  status: 'success' | 'failed';
  error?: string;
}

/**
 * Global database for cross-project intelligence
 */
export class GlobalDatabase {
  private db: Database.Database;
  private dbPath: string;

  constructor(dbPath?: string) {
    // Default to ~/.in-memoria/global-patterns.db
    this.dbPath = dbPath || join(homedir(), '.in-memoria', 'global-patterns.db');

    // Ensure directory exists
    const dir = dirname(this.dbPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    // Open database
    this.db = new Database(this.dbPath);
    this.db.pragma('journal_mode = WAL');

    // Initialize schema
    this.initializeSchema();

    logger.info(`Global database initialized at: ${this.dbPath}`);
  }

  /**
   * Initialize database schema
   */
  private initializeSchema(): void {
    this.db.exec(`
      -- Global projects registry
      CREATE TABLE IF NOT EXISTS global_projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        path TEXT NOT NULL UNIQUE,
        description TEXT,
        primary_language TEXT,
        frameworks TEXT,  -- JSON array
        linked_at INTEGER NOT NULL,
        last_synced INTEGER,
        pattern_count INTEGER DEFAULT 0,
        concept_count INTEGER DEFAULT 0,
        is_active INTEGER DEFAULT 1
      );

      CREATE INDEX IF NOT EXISTS idx_projects_path ON global_projects(path);
      CREATE INDEX IF NOT EXISTS idx_projects_active ON global_projects(is_active);

      -- Global patterns aggregated across projects
      CREATE TABLE IF NOT EXISTS global_patterns (
        id TEXT PRIMARY KEY,
        category TEXT NOT NULL,
        subcategory TEXT,
        pattern_data TEXT NOT NULL,  -- JSON
        project_count INTEGER DEFAULT 1,
        total_frequency INTEGER DEFAULT 1,
        confidence REAL NOT NULL,
        first_seen INTEGER NOT NULL,
        last_seen INTEGER NOT NULL,
        source_projects TEXT NOT NULL,  -- JSON array of project IDs
        example_code TEXT,
        language TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_global_patterns_category ON global_patterns(category);
      CREATE INDEX IF NOT EXISTS idx_global_patterns_project_count ON global_patterns(project_count);
      CREATE INDEX IF NOT EXISTS idx_global_patterns_confidence ON global_patterns(confidence);

      -- Global concepts for cross-project search
      CREATE TABLE IF NOT EXISTS global_concepts (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        file_path TEXT NOT NULL,
        project_id TEXT NOT NULL,
        language TEXT NOT NULL,
        embedding_id TEXT,
        metadata TEXT,  -- JSON
        created_at INTEGER NOT NULL,
        FOREIGN KEY (project_id) REFERENCES global_projects(id)
      );

      CREATE INDEX IF NOT EXISTS idx_global_concepts_name ON global_concepts(name);
      CREATE INDEX IF NOT EXISTS idx_global_concepts_type ON global_concepts(type);
      CREATE INDEX IF NOT EXISTS idx_global_concepts_project ON global_concepts(project_id);

      -- Pattern aggregations (pre-computed consensus)
      CREATE TABLE IF NOT EXISTS pattern_aggregations (
        id TEXT PRIMARY KEY,
        pattern_signature TEXT NOT NULL,  -- Normalized pattern key
        category TEXT NOT NULL,
        occurrences TEXT NOT NULL,  -- JSON: [{projectId, frequency, confidence}]
        aggregated_confidence REAL NOT NULL,
        consensus_score REAL NOT NULL,  -- 0-1: how consistent across projects
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE UNIQUE INDEX IF NOT EXISTS idx_aggregations_signature ON pattern_aggregations(pattern_signature);
      CREATE INDEX IF NOT EXISTS idx_aggregations_category ON pattern_aggregations(category);
      CREATE INDEX IF NOT EXISTS idx_aggregations_consensus ON pattern_aggregations(consensus_score);
    `);
  }

  /**
   * Link a project to global intelligence
   */
  async linkProject(projectPath: string, metadata: Partial<GlobalProject>): Promise<string> {
    const projectId = metadata.id || nanoid();
    const name = metadata.name || projectPath.split('/').pop() || 'Unnamed Project';

    this.db
      .prepare(
        `
      INSERT OR REPLACE INTO global_projects (
        id, name, path, description, primary_language, frameworks,
        linked_at, last_synced, pattern_count, concept_count, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
      )
      .run(
        projectId,
        name,
        projectPath,
        metadata.description || null,
        metadata.primaryLanguage || null,
        JSON.stringify(metadata.frameworks || []),
        Date.now(),
        metadata.lastSynced || null,
        metadata.patternCount || 0,
        metadata.conceptCount || 0,
        metadata.isActive !== undefined ? (metadata.isActive ? 1 : 0) : 1
      );

    logger.info(`Linked project ${name} (${projectId}) to global database`);
    return projectId;
  }

  /**
   * Unlink a project
   */
  async unlinkProject(projectId: string): Promise<void> {
    // Soft delete - mark as inactive
    this.db.prepare('UPDATE global_projects SET is_active = 0 WHERE id = ?').run(projectId);

    logger.info(`Unlinked project ${projectId} from global database`);
  }

  /**
   * Get all linked projects
   */
  getProjectRegistry(): GlobalProject[] {
    const rows = this.db
      .prepare(
        `
      SELECT * FROM global_projects
      WHERE is_active = 1
      ORDER BY last_synced DESC
    `
      )
      .all() as any[];

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      path: row.path,
      description: row.description,
      primaryLanguage: row.primary_language,
      frameworks: JSON.parse(row.frameworks || '[]'),
      linkedAt: row.linked_at,
      lastSynced: row.last_synced,
      patternCount: row.pattern_count,
      conceptCount: row.concept_count,
      isActive: row.is_active === 1,
    }));
  }

  /**
   * Get a specific project
   */
  getProject(projectId: string): GlobalProject | null {
    const row = this.db
      .prepare('SELECT * FROM global_projects WHERE id = ?')
      .get(projectId) as any;

    if (!row) return null;

    return {
      id: row.id,
      name: row.name,
      path: row.path,
      description: row.description,
      primaryLanguage: row.primary_language,
      frameworks: JSON.parse(row.frameworks || '[]'),
      linkedAt: row.linked_at,
      lastSynced: row.last_synced,
      patternCount: row.pattern_count,
      conceptCount: row.concept_count,
      isActive: row.is_active === 1,
    };
  }

  /**
   * Add or update a global pattern
   */
  addGlobalPattern(pattern: Partial<GlobalPattern> & { category: string }): string {
    const patternId = pattern.id || nanoid();

    // Check if pattern already exists
    const existing = this.db
      .prepare('SELECT * FROM global_patterns WHERE id = ?')
      .get(patternId) as any;

    if (existing) {
      // Update existing pattern
      this.db
        .prepare(
          `
        UPDATE global_patterns
        SET project_count = ?,
            total_frequency = ?,
            confidence = ?,
            last_seen = ?,
            source_projects = ?
        WHERE id = ?
      `
        )
        .run(
          pattern.projectCount || existing.project_count,
          pattern.totalFrequency || existing.total_frequency,
          pattern.confidence || existing.confidence,
          Date.now(),
          JSON.stringify(pattern.sourceProjects || JSON.parse(existing.source_projects)),
          patternId
        );
    } else {
      // Insert new pattern
      this.db
        .prepare(
          `
        INSERT INTO global_patterns (
          id, category, subcategory, pattern_data, project_count,
          total_frequency, confidence, first_seen, last_seen,
          source_projects, example_code, language
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
        )
        .run(
          patternId,
          pattern.category,
          pattern.subcategory || null,
          JSON.stringify(pattern.patternData || {}),
          pattern.projectCount || 1,
          pattern.totalFrequency || 1,
          pattern.confidence || 0.5,
          pattern.firstSeen || Date.now(),
          pattern.lastSeen || Date.now(),
          JSON.stringify(pattern.sourceProjects || []),
          pattern.exampleCode || null,
          pattern.language || null
        );
    }

    return patternId;
  }

  /**
   * Get global patterns
   */
  getGlobalPatterns(options: {
    category?: string;
    minProjectCount?: number;
    minConsensus?: number;
    language?: string;
    limit?: number;
  }): GlobalPattern[] {
    let query = 'SELECT * FROM global_patterns WHERE 1=1';
    const params: any[] = [];

    if (options.category) {
      query += ' AND category = ?';
      params.push(options.category);
    }

    if (options.minProjectCount) {
      query += ' AND project_count >= ?';
      params.push(options.minProjectCount);
    }

    if (options.language) {
      query += ' AND language = ?';
      params.push(options.language);
    }

    query += ' ORDER BY project_count DESC, confidence DESC';

    if (options.limit) {
      query += ' LIMIT ?';
      params.push(options.limit);
    }

    const rows = this.db.prepare(query).all(...params) as any[];

    return rows.map((row) => ({
      id: row.id,
      category: row.category,
      subcategory: row.subcategory,
      patternData: JSON.parse(row.pattern_data),
      projectCount: row.project_count,
      totalFrequency: row.total_frequency,
      confidence: row.confidence,
      firstSeen: row.first_seen,
      lastSeen: row.last_seen,
      sourceProjects: JSON.parse(row.source_projects),
      exampleCode: row.example_code,
      language: row.language,
    }));
  }

  /**
   * Add global concept
   */
  addGlobalConcept(concept: Omit<GlobalConcept, 'id'> & { id?: string }): string {
    const conceptId = concept.id || nanoid();

    this.db
      .prepare(
        `
      INSERT OR REPLACE INTO global_concepts (
        id, name, type, file_path, project_id, language,
        embedding_id, metadata, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
      )
      .run(
        conceptId,
        concept.name,
        concept.type,
        concept.filePath,
        concept.projectId,
        concept.language,
        concept.embeddingId || null,
        JSON.stringify(concept.metadata || {}),
        concept.createdAt || Date.now()
      );

    return conceptId;
  }

  /**
   * Search global concepts
   */
  searchGlobalConcepts(options: {
    query?: string;
    type?: string;
    projectIds?: string[];
    language?: string;
    limit?: number;
  }): GlobalConcept[] {
    let query = 'SELECT * FROM global_concepts WHERE 1=1';
    const params: any[] = [];

    if (options.query) {
      query += ' AND name LIKE ?';
      params.push(`%${options.query}%`);
    }

    if (options.type) {
      query += ' AND type = ?';
      params.push(options.type);
    }

    if (options.projectIds && options.projectIds.length > 0) {
      query += ` AND project_id IN (${options.projectIds.map(() => '?').join(',')})`;
      params.push(...options.projectIds);
    }

    if (options.language) {
      query += ' AND language = ?';
      params.push(options.language);
    }

    query += ' ORDER BY created_at DESC';

    if (options.limit) {
      query += ' LIMIT ?';
      params.push(options.limit);
    }

    const rows = this.db.prepare(query).all(...params) as any[];

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      type: row.type,
      filePath: row.file_path,
      projectId: row.project_id,
      language: row.language,
      embeddingId: row.embedding_id,
      metadata: JSON.parse(row.metadata || '{}'),
      createdAt: row.created_at,
    }));
  }

  /**
   * Create or update pattern aggregation
   */
  upsertPatternAggregation(aggregation: Omit<PatternAggregation, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): string {
    const aggId = aggregation.id || nanoid();

    const existing = this.db
      .prepare('SELECT * FROM pattern_aggregations WHERE pattern_signature = ?')
      .get(aggregation.patternSignature) as any;

    if (existing) {
      // Update existing
      this.db
        .prepare(
          `
        UPDATE pattern_aggregations
        SET occurrences = ?,
            aggregated_confidence = ?,
            consensus_score = ?,
            updated_at = ?
        WHERE id = ?
      `
        )
        .run(
          JSON.stringify(aggregation.occurrences),
          aggregation.aggregatedConfidence,
          aggregation.consensusScore,
          Date.now(),
          existing.id
        );

      return existing.id;
    } else {
      // Insert new
      this.db
        .prepare(
          `
        INSERT INTO pattern_aggregations (
          id, pattern_signature, category, occurrences,
          aggregated_confidence, consensus_score, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `
        )
        .run(
          aggId,
          aggregation.patternSignature,
          aggregation.category,
          JSON.stringify(aggregation.occurrences),
          aggregation.aggregatedConfidence,
          aggregation.consensusScore,
          Date.now(),
          Date.now()
        );

      return aggId;
    }
  }

  /**
   * Get pattern aggregations
   */
  getPatternAggregations(options: {
    category?: string;
    minConsensus?: number;
    limit?: number;
  }): PatternAggregation[] {
    let query = 'SELECT * FROM pattern_aggregations WHERE 1=1';
    const params: any[] = [];

    if (options.category) {
      query += ' AND category = ?';
      params.push(options.category);
    }

    if (options.minConsensus) {
      query += ' AND consensus_score >= ?';
      params.push(options.minConsensus);
    }

    query += ' ORDER BY consensus_score DESC, aggregated_confidence DESC';

    if (options.limit) {
      query += ' LIMIT ?';
      params.push(options.limit);
    }

    const rows = this.db.prepare(query).all(...params) as any[];

    return rows.map((row) => ({
      id: row.id,
      patternSignature: row.pattern_signature,
      category: row.category,
      occurrences: JSON.parse(row.occurrences),
      aggregatedConfidence: row.aggregated_confidence,
      consensusScore: row.consensus_score,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  /**
   * Update project statistics
   */
  updateProjectStats(projectId: string, stats: { patternCount?: number; conceptCount?: number }): void {
    const updates: string[] = [];
    const params: any[] = [];

    if (stats.patternCount !== undefined) {
      updates.push('pattern_count = ?');
      params.push(stats.patternCount);
    }

    if (stats.conceptCount !== undefined) {
      updates.push('concept_count = ?');
      params.push(stats.conceptCount);
    }

    if (updates.length > 0) {
      params.push(projectId);
      this.db.prepare(`UPDATE global_projects SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    }
  }

  /**
   * Mark project as synced
   */
  markProjectSynced(projectId: string): void {
    this.db
      .prepare('UPDATE global_projects SET last_synced = ? WHERE id = ?')
      .run(Date.now(), projectId);
  }

  /**
   * Get database statistics
   */
  getStatistics(): {
    totalProjects: number;
    activeProjects: number;
    totalPatterns: number;
    totalConcepts: number;
    averagePatternsPerProject: number;
    topLanguages: Array<{ language: string; count: number }>;
  } {
    const stats = this.db
      .prepare(
        `
      SELECT
        COUNT(*) as total_projects,
        SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active_projects,
        SUM(pattern_count) as total_patterns,
        SUM(concept_count) as total_concepts
      FROM global_projects
    `
      )
      .get() as any;

    const avgPatterns = stats.active_projects > 0 ? stats.total_patterns / stats.active_projects : 0;

    // Get top languages
    const languageStats = this.db
      .prepare(
        `
      SELECT primary_language as language, COUNT(*) as count
      FROM global_projects
      WHERE is_active = 1 AND primary_language IS NOT NULL
      GROUP BY primary_language
      ORDER BY count DESC
      LIMIT 5
    `
      )
      .all() as Array<{ language: string; count: number }>;

    return {
      totalProjects: stats.total_projects || 0,
      activeProjects: stats.active_projects || 0,
      totalPatterns: stats.total_patterns || 0,
      totalConcepts: stats.total_concepts || 0,
      averagePatternsPerProject: avgPatterns,
      topLanguages: languageStats,
    };
  }

  /**
   * Close database connection
   */
  close(): void {
    this.db.close();
    logger.info('Global database connection closed');
  }

  /**
   * Get database instance (for advanced queries)
   */
  getDb(): Database.Database {
    return this.db;
  }

  /**
   * Get database path
   */
  getDbPath(): string {
    return this.dbPath;
  }
}
