import Database from 'better-sqlite3';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface Migration {
  version: number;
  name: string;
  up: string;
  down?: string;
}

export class DatabaseMigrator {
  private db: Database.Database;
  private migrations: Migration[] = [];

  constructor(db: Database.Database) {
    this.db = db;
    this.initializeMigrationsTable();
    this.loadMigrations();
  }

  private initializeMigrationsTable(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at DATETIME DEFAULT (datetime('now', 'utc'))
      );
    `);
  }

  private loadMigrations(): void {
    // Migration 1: Initial schema
    this.migrations.push({
      version: 1,
      name: 'initial_schema',
      up: this.loadMigrationFile('001_initial_schema.sql')
    });

    // Migration 2: Add indexes for performance
    this.migrations.push({
      version: 2,
      name: 'add_performance_indexes',
      up: `
        CREATE INDEX IF NOT EXISTS idx_semantic_concepts_file_path ON semantic_concepts(file_path);
        CREATE INDEX IF NOT EXISTS idx_semantic_concepts_concept_type ON semantic_concepts(concept_type);
        CREATE INDEX IF NOT EXISTS idx_developer_patterns_pattern_type ON developer_patterns(pattern_type);
        CREATE INDEX IF NOT EXISTS idx_file_intelligence_file_path ON file_intelligence(file_path);
        CREATE INDEX IF NOT EXISTS idx_ai_insights_insight_type ON ai_insights(insight_type);
        CREATE INDEX IF NOT EXISTS idx_ai_insights_source_agent ON ai_insights(source_agent);
      `,
      down: `
        DROP INDEX IF EXISTS idx_semantic_concepts_file_path;
        DROP INDEX IF EXISTS idx_semantic_concepts_concept_type;
        DROP INDEX IF EXISTS idx_developer_patterns_pattern_type;
        DROP INDEX IF EXISTS idx_file_intelligence_file_path;
        DROP INDEX IF EXISTS idx_ai_insights_insight_type;
        DROP INDEX IF EXISTS idx_ai_insights_source_agent;
      `
    });

    // Migration 3: Add vector embeddings support
    this.migrations.push({
      version: 3,
      name: 'add_vector_embeddings',
      up: `
        ALTER TABLE semantic_concepts ADD COLUMN embedding_vector BLOB;
        ALTER TABLE developer_patterns ADD COLUMN embedding_vector BLOB;
        
        CREATE TABLE IF NOT EXISTS vector_cache (
          id TEXT PRIMARY KEY,
          content_hash TEXT NOT NULL,
          embedding BLOB NOT NULL,
          created_at DATETIME DEFAULT (datetime('now', 'utc'))
        );
        
        CREATE INDEX IF NOT EXISTS idx_vector_cache_content_hash ON vector_cache(content_hash);
      `,
      down: `
        DROP TABLE IF EXISTS vector_cache;
        -- Note: SQLite doesn't support DROP COLUMN, so we leave the embedding_vector columns
      `
    });

    // Migration 4: Fix timezone handling - update existing timestamp columns to use UTC
    this.migrations.push({
      version: 4,
      name: 'fix_timezone_handling',
      up: `
        -- Create new tables with UTC timestamps
        DROP TABLE IF EXISTS semantic_concepts_new;
        CREATE TABLE semantic_concepts_new (
          id TEXT PRIMARY KEY,
          concept_name TEXT NOT NULL,
          concept_type TEXT NOT NULL,
          confidence_score REAL DEFAULT 0.0,
          relationships TEXT,
          evolution_history TEXT,
          file_path TEXT,
          line_range TEXT,
          created_at DATETIME DEFAULT (datetime('now', 'utc')),
          updated_at DATETIME DEFAULT (datetime('now', 'utc'))
        );

        -- Copy data with UTC conversion
        INSERT INTO semantic_concepts_new (id, concept_name, concept_type, confidence_score, relationships, evolution_history, file_path, line_range, created_at, updated_at)
        SELECT id, concept_name, concept_type, confidence_score, relationships, evolution_history, file_path, line_range, 
               datetime(created_at, 'utc'), datetime(updated_at, 'utc')
        FROM semantic_concepts;

        -- Replace old table
        DROP TABLE semantic_concepts;
        ALTER TABLE semantic_concepts_new RENAME TO semantic_concepts;

        -- Same for developer_patterns
        DROP TABLE IF EXISTS developer_patterns_new;
        CREATE TABLE developer_patterns_new (
          pattern_id TEXT PRIMARY KEY,
          pattern_type TEXT NOT NULL,
          pattern_content TEXT NOT NULL,
          frequency INTEGER DEFAULT 1,
          contexts TEXT,
          examples TEXT,
          confidence REAL DEFAULT 0.0,
          created_at DATETIME DEFAULT (datetime('now', 'utc')),
          last_seen DATETIME DEFAULT (datetime('now', 'utc'))
        );

        INSERT INTO developer_patterns_new (pattern_id, pattern_type, pattern_content, frequency, contexts, examples, confidence, created_at, last_seen)
        SELECT pattern_id, pattern_type, pattern_content, frequency, contexts, examples, confidence, 
               datetime(created_at, 'utc'), datetime(last_seen, 'utc')
        FROM developer_patterns;

        DROP TABLE developer_patterns;
        ALTER TABLE developer_patterns_new RENAME TO developer_patterns;

        -- Fix other tables similarly
        DROP TABLE IF EXISTS architectural_decisions_new;
        CREATE TABLE architectural_decisions_new (
          decision_id TEXT PRIMARY KEY,
          decision_context TEXT NOT NULL,
          decision_rationale TEXT,
          alternatives_considered TEXT,
          impact_analysis TEXT,
          decision_date DATETIME DEFAULT (datetime('now', 'utc')),
          files_affected TEXT,
          created_at DATETIME DEFAULT (datetime('now', 'utc'))
        );

        INSERT INTO architectural_decisions_new SELECT decision_id, decision_context, decision_rationale, alternatives_considered, impact_analysis, 
               datetime(decision_date, 'utc'), files_affected, datetime(created_at, 'utc')
        FROM architectural_decisions WHERE 1=1;

        DROP TABLE architectural_decisions;
        ALTER TABLE architectural_decisions_new RENAME TO architectural_decisions;

        -- Fix file_intelligence
        DROP TABLE IF EXISTS file_intelligence_new;
        CREATE TABLE file_intelligence_new (
          file_path TEXT PRIMARY KEY,
          file_hash TEXT NOT NULL,
          semantic_concepts TEXT,
          patterns_used TEXT,
          complexity_metrics TEXT,
          dependencies TEXT,
          last_analyzed DATETIME DEFAULT (datetime('now', 'utc')),
          created_at DATETIME DEFAULT (datetime('now', 'utc'))
        );

        INSERT INTO file_intelligence_new SELECT file_path, file_hash, semantic_concepts, patterns_used, complexity_metrics, dependencies,
               datetime(last_analyzed, 'utc'), datetime(created_at, 'utc')
        FROM file_intelligence WHERE 1=1;

        DROP TABLE file_intelligence;
        ALTER TABLE file_intelligence_new RENAME TO file_intelligence;

        -- Fix other tables
        DROP TABLE IF EXISTS shared_patterns_new;
        CREATE TABLE shared_patterns_new (
          pattern_id TEXT PRIMARY KEY,
          pattern_name TEXT NOT NULL,
          pattern_description TEXT,
          pattern_data TEXT,
          usage_count INTEGER DEFAULT 0,
          community_rating REAL DEFAULT 0.0,
          tags TEXT,
          created_at DATETIME DEFAULT (datetime('now', 'utc'))
        );

        INSERT INTO shared_patterns_new SELECT pattern_id, pattern_name, pattern_description, pattern_data, usage_count, community_rating, tags,
               datetime(created_at, 'utc')
        FROM shared_patterns WHERE 1=1;

        DROP TABLE shared_patterns;
        ALTER TABLE shared_patterns_new RENAME TO shared_patterns;

        DROP TABLE IF EXISTS ai_insights_new;
        CREATE TABLE ai_insights_new (
          insight_id TEXT PRIMARY KEY,
          insight_type TEXT NOT NULL,
          insight_content TEXT NOT NULL,
          confidence_score REAL DEFAULT 0.0,
          source_agent TEXT,
          validation_status TEXT DEFAULT 'pending',
          impact_prediction TEXT,
          created_at DATETIME DEFAULT (datetime('now', 'utc'))
        );

        INSERT INTO ai_insights_new SELECT insight_id, insight_type, insight_content, confidence_score, source_agent, validation_status, impact_prediction,
               datetime(created_at, 'utc')
        FROM ai_insights WHERE 1=1;

        DROP TABLE ai_insights;
        ALTER TABLE ai_insights_new RENAME TO ai_insights;

        DROP TABLE IF EXISTS project_metadata_new;
        CREATE TABLE project_metadata_new (
          project_id TEXT PRIMARY KEY,
          project_path TEXT NOT NULL,
          project_name TEXT,
          language_primary TEXT,
          languages_detected TEXT,
          framework_detected TEXT,
          intelligence_version TEXT,
          last_full_scan DATETIME,
          created_at DATETIME DEFAULT (datetime('now', 'utc')),
          updated_at DATETIME DEFAULT (datetime('now', 'utc'))
        );

        INSERT INTO project_metadata_new SELECT project_id, project_path, project_name, language_primary, languages_detected, framework_detected, intelligence_version,
               datetime(last_full_scan, 'utc'), datetime(created_at, 'utc'), datetime(updated_at, 'utc')
        FROM project_metadata WHERE 1=1;

        DROP TABLE project_metadata;
        ALTER TABLE project_metadata_new RENAME TO project_metadata;

        -- Recreate indexes
        CREATE INDEX IF NOT EXISTS idx_semantic_concepts_type ON semantic_concepts(concept_type);
        CREATE INDEX IF NOT EXISTS idx_semantic_concepts_file ON semantic_concepts(file_path);
        CREATE INDEX IF NOT EXISTS idx_developer_patterns_type ON developer_patterns(pattern_type);
        CREATE INDEX IF NOT EXISTS idx_developer_patterns_frequency ON developer_patterns(frequency DESC);
        CREATE INDEX IF NOT EXISTS idx_file_intelligence_analyzed ON file_intelligence(last_analyzed);
        CREATE INDEX IF NOT EXISTS idx_ai_insights_type ON ai_insights(insight_type);
        CREATE INDEX IF NOT EXISTS idx_ai_insights_confidence ON ai_insights(confidence_score DESC);
      `,
      down: `
        -- This rollback is complex and risky, so we'll just warn
        SELECT 'WARNING: Rolling back timezone fix may cause data issues' as warning;
      `
    });
  }

  private loadMigrationFile(filename: string): string {
    const migrationPath = join(__dirname, 'migrations', filename);
    if (existsSync(migrationPath)) {
      return readFileSync(migrationPath, 'utf-8');
    }
    // Fallback to schema.sql for initial migration
    return readFileSync(join(__dirname, 'schema.sql'), 'utf-8');
  }

  getCurrentVersion(): number {
    const result = this.db.prepare(`
      SELECT MAX(version) as version FROM migrations
    `).get() as { version: number | null };
    
    return result?.version ?? 0;
  }

  getLatestVersion(): number {
    return Math.max(...this.migrations.map(m => m.version));
  }

  needsMigration(): boolean {
    return this.getCurrentVersion() < this.getLatestVersion();
  }

  migrate(): void {
    const currentVersion = this.getCurrentVersion();
    const targetVersion = this.getLatestVersion();

    console.log(`Migrating database from version ${currentVersion} to ${targetVersion}`);

    this.db.transaction(() => {
      for (const migration of this.migrations) {
        if (migration.version > currentVersion) {
          console.log(`Applying migration ${migration.version}: ${migration.name}`);
          
          try {
            // Execute the migration
            this.db.exec(migration.up);
            
            // Record the migration
            this.db.prepare(`
              INSERT INTO migrations (version, name) VALUES (?, ?)
            `).run(migration.version, migration.name);
            
            console.log(`✅ Migration ${migration.version} applied successfully`);
          } catch (error) {
            console.error(`❌ Migration ${migration.version} failed:`, error);
            throw error;
          }
        }
      }
    })();

    console.log('✅ All migrations completed successfully');
  }

  rollback(targetVersion?: number): void {
    const currentVersion = this.getCurrentVersion();
    const rollbackTo = targetVersion ?? currentVersion - 1;

    if (rollbackTo >= currentVersion) {
      console.log('No rollback needed');
      return;
    }

    console.log(`Rolling back database from version ${currentVersion} to ${rollbackTo}`);

    this.db.transaction(() => {
      // Find migrations to rollback (in reverse order)
      const migrationsToRollback = this.migrations
        .filter(m => m.version > rollbackTo && m.version <= currentVersion)
        .sort((a, b) => b.version - a.version);

      for (const migration of migrationsToRollback) {
        if (migration.down) {
          console.log(`Rolling back migration ${migration.version}: ${migration.name}`);
          
          try {
            // Execute the rollback
            this.db.exec(migration.down);
            
            // Remove migration record
            this.db.prepare(`
              DELETE FROM migrations WHERE version = ?
            `).run(migration.version);
            
            console.log(`✅ Migration ${migration.version} rolled back successfully`);
          } catch (error) {
            console.error(`❌ Rollback ${migration.version} failed:`, error);
            throw error;
          }
        } else {
          console.warn(`⚠️ Migration ${migration.version} has no rollback script`);
        }
      }
    })();

    console.log('✅ Rollback completed successfully');
  }

  status(): void {
    const currentVersion = this.getCurrentVersion();
    const latestVersion = this.getLatestVersion();
    
    console.log(`Database Status:`);
    console.log(`  Current version: ${currentVersion}`);
    console.log(`  Latest version: ${latestVersion}`);
    console.log(`  Needs migration: ${this.needsMigration()}`);
    
    console.log(`\nApplied migrations:`);
    const appliedMigrations = this.db.prepare(`
      SELECT version, name, applied_at FROM migrations ORDER BY version
    `).all() as Array<{ version: number; name: string; applied_at: string }>;
    
    for (const migration of appliedMigrations) {
      console.log(`  ✅ v${migration.version}: ${migration.name} (${migration.applied_at})`);
    }
    
    console.log(`\nPending migrations:`);
    const pendingMigrations = this.migrations.filter(m => m.version > currentVersion);
    for (const migration of pendingMigrations) {
      console.log(`  ⏳ v${migration.version}: ${migration.name}`);
    }
  }
}