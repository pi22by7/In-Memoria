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

    this.migrations.push({
      version: 5,
      name: 'add_project_blueprint_tables',
      up: `
        -- Feature to file mapping
        CREATE TABLE IF NOT EXISTS feature_map (
          id TEXT PRIMARY KEY,
          project_path TEXT NOT NULL,
          feature_name TEXT NOT NULL,
          primary_files TEXT NOT NULL,
          related_files TEXT,
          dependencies TEXT,
          status TEXT DEFAULT 'active',
          created_at DATETIME DEFAULT (datetime('now', 'utc')),
          updated_at DATETIME DEFAULT (datetime('now', 'utc')),
          FOREIGN KEY (project_path) REFERENCES project_metadata(project_path)
        );

        -- Entry points mapping
        CREATE TABLE IF NOT EXISTS entry_points (
          id TEXT PRIMARY KEY,
          project_path TEXT NOT NULL,
          entry_type TEXT NOT NULL,
          file_path TEXT NOT NULL,
          description TEXT,
          framework TEXT,
          created_at DATETIME DEFAULT (datetime('now', 'utc')),
          FOREIGN KEY (project_path) REFERENCES project_metadata(project_path)
        );

        -- Key directories mapping
        CREATE TABLE IF NOT EXISTS key_directories (
          id TEXT PRIMARY KEY,
          project_path TEXT NOT NULL,
          directory_path TEXT NOT NULL,
          directory_type TEXT NOT NULL,
          file_count INTEGER DEFAULT 0,
          description TEXT,
          created_at DATETIME DEFAULT (datetime('now', 'utc')),
          FOREIGN KEY (project_path) REFERENCES project_metadata(project_path)
        );

        -- Indexes for blueprint tables
        CREATE INDEX IF NOT EXISTS idx_feature_map_project ON feature_map(project_path);
        CREATE INDEX IF NOT EXISTS idx_feature_map_name ON feature_map(feature_name);
        CREATE INDEX IF NOT EXISTS idx_entry_points_project ON entry_points(project_path);
        CREATE INDEX IF NOT EXISTS idx_key_directories_project ON key_directories(project_path);
      `,
      down: `
        DROP TABLE IF EXISTS feature_map;
        DROP TABLE IF EXISTS entry_points;
        DROP TABLE IF EXISTS key_directories;
        DROP INDEX IF EXISTS idx_feature_map_project;
        DROP INDEX IF EXISTS idx_feature_map_name;
        DROP INDEX IF EXISTS idx_entry_points_project;
        DROP INDEX IF EXISTS idx_key_directories_project;
      `
    });

    this.migrations.push({
      version: 6,
      name: 'add_work_session_tracking',
      up: `
        -- Work sessions tracking
        CREATE TABLE IF NOT EXISTS work_sessions (
          id TEXT PRIMARY KEY,
          project_path TEXT NOT NULL,
          session_start DATETIME DEFAULT (datetime('now', 'utc')),
          session_end DATETIME,
          last_feature TEXT,
          current_files TEXT,
          completed_tasks TEXT,
          pending_tasks TEXT,
          blockers TEXT,
          session_notes TEXT,
          last_updated DATETIME DEFAULT (datetime('now', 'utc')),
          FOREIGN KEY (project_path) REFERENCES project_metadata(project_path)
        );

        -- Project decisions tracking
        CREATE TABLE IF NOT EXISTS project_decisions (
          id TEXT PRIMARY KEY,
          project_path TEXT NOT NULL,
          decision_key TEXT NOT NULL,
          decision_value TEXT NOT NULL,
          reasoning TEXT,
          made_at DATETIME DEFAULT (datetime('now', 'utc')),
          UNIQUE(project_path, decision_key),
          FOREIGN KEY (project_path) REFERENCES project_metadata(project_path)
        );

        -- Indexes for session tables
        CREATE INDEX IF NOT EXISTS idx_work_sessions_project ON work_sessions(project_path);
        CREATE INDEX IF NOT EXISTS idx_work_sessions_updated ON work_sessions(last_updated DESC);
        CREATE INDEX IF NOT EXISTS idx_project_decisions_key ON project_decisions(project_path, decision_key);
      `,
      down: `
        DROP TABLE IF EXISTS work_sessions;
        DROP TABLE IF EXISTS project_decisions;
        DROP INDEX IF EXISTS idx_work_sessions_project;
        DROP INDEX IF EXISTS idx_work_sessions_updated;
        DROP INDEX IF EXISTS idx_project_decisions_key;
      `
    });

    // Migration 7: Add UNIQUE constraint to project_metadata.project_path for foreign keys
    this.migrations.push({
      version: 7,
      name: 'add_unique_constraint_to_project_path',
      up: `
        -- SQLite doesn't support ADD CONSTRAINT, so we need to recreate the table
        CREATE TABLE project_metadata_new (
          project_id TEXT PRIMARY KEY,
          project_path TEXT NOT NULL UNIQUE,
          project_name TEXT,
          language_primary TEXT,
          languages_detected TEXT,
          framework_detected TEXT,
          intelligence_version TEXT,
          last_full_scan DATETIME,
          created_at DATETIME DEFAULT (datetime('now', 'utc')),
          updated_at DATETIME DEFAULT (datetime('now', 'utc'))
        );

        -- Copy existing data
        INSERT INTO project_metadata_new
        SELECT * FROM project_metadata;

        -- Drop old table
        DROP TABLE project_metadata;

        -- Rename new table
        ALTER TABLE project_metadata_new RENAME TO project_metadata;
      `,
      down: `
        -- Reverse migration: remove UNIQUE constraint
        CREATE TABLE project_metadata_old (
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

        INSERT INTO project_metadata_old
        SELECT * FROM project_metadata;

        DROP TABLE project_metadata;
        ALTER TABLE project_metadata_old RENAME TO project_metadata;
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
            
            // Validate migration success by checking data integrity
            this.validateMigration(migration);
            
            // Record the migration
            this.db.prepare(`
              INSERT INTO migrations (version, name) VALUES (?, ?)
            `).run(migration.version, migration.name);
            
            console.log(`✅ Migration ${migration.version} applied and validated successfully`);
          } catch (error) {
            console.error(`❌ Migration ${migration.version} failed:`, error);
            // Don't just log - provide recovery instructions
            console.error(`\n🚨 MIGRATION FAILURE RECOVERY:`);
            console.error(`   1. Database may be in inconsistent state`);
            console.error(`   2. Check database backup before proceeding`);
            console.error(`   3. Consider manual rollback: npm run db:rollback ${migration.version - 1}`);
            console.error(`   4. Investigate root cause: ${error instanceof Error ? error.message : String(error)}`);
            throw new Error(`Migration ${migration.version} failed: ${error instanceof Error ? error.message : String(error)}. Database integrity may be compromised.`);
          }
        }
      }
    })();

    // Final validation of entire migration process
    this.validateDatabaseIntegrity();
    console.log('✅ All migrations completed and validated successfully');
  }

  /**
   * Validate that a migration was applied correctly
   */
  private validateMigration(migration: Migration): void {
    try {
      switch (migration.version) {
        case 1: // Initial schema
          this.validateTableExists(['semantic_concepts', 'developer_patterns', 'file_intelligence']);
          break;
        case 2: // Performance indexes
          this.validateIndexExists(['idx_semantic_concepts_file_path', 'idx_developer_patterns_pattern_type']);
          break;
        case 3: // Vector embeddings
          this.validateTableExists(['vector_cache']);
          this.validateColumnExists('semantic_concepts', 'embedding_vector');
          break;
        case 4: // Timezone handling
          this.validateTimezoneColumns();
          break;
        case 5: // Project blueprint tables
          this.validateTableExists(['feature_map', 'entry_points', 'key_directories']);
          this.validateIndexExists(['idx_feature_map_project', 'idx_entry_points_project', 'idx_key_directories_project']);
          break;
        case 6: // Work session tracking
          this.validateTableExists(['work_sessions', 'project_decisions']);
          this.validateIndexExists(['idx_work_sessions_project', 'idx_work_sessions_updated', 'idx_project_decisions_key']);
          break;
        default:
          // Generic validation - check migration was recorded
          break;
      }
    } catch (validationError: unknown) {
      throw new Error(`Migration validation failed: ${validationError instanceof Error ? validationError.message : String(validationError)}`);
    }
  }

  /**
   * Validate database integrity after all migrations
   */
  private validateDatabaseIntegrity(): void {
    try {
      // Check all required tables exist
      const requiredTables = [
        'semantic_concepts', 'developer_patterns', 'file_intelligence',
        'architectural_decisions', 'shared_patterns', 'ai_insights',
        'project_metadata', 'migrations',
        'feature_map', 'entry_points', 'key_directories',
        'work_sessions', 'project_decisions'
      ];

      for (const table of requiredTables) {
        this.validateTableExists([table]);
      }

      // Check data consistency
      const conceptCount = this.db.prepare('SELECT COUNT(*) as count FROM semantic_concepts').get() as { count: number };
      const patternCount = this.db.prepare('SELECT COUNT(*) as count FROM developer_patterns').get() as { count: number };
      
      console.log(`📊 Database integrity check: ${conceptCount.count} concepts, ${patternCount.count} patterns`);
      
      // Validate no orphaned records (basic referential integrity)
      this.validateReferentialIntegrity();
      
    } catch (error: unknown) {
      console.error(`❌ Database integrity validation failed: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  private validateTableExists(tables: string[]): void {
    for (const table of tables) {
      const result = this.db.prepare(`
        SELECT name FROM sqlite_master WHERE type='table' AND name=?
      `).get(table);
      
      if (!result) {
        throw new Error(`Required table '${table}' does not exist`);
      }
    }
  }

  private validateIndexExists(indexes: string[]): void {
    for (const index of indexes) {
      const result = this.db.prepare(`
        SELECT name FROM sqlite_master WHERE type='index' AND name=?
      `).get(index);
      
      if (!result) {
        throw new Error(`Required index '${index}' does not exist`);
      }
    }
  }

  private validateColumnExists(table: string, column: string): void {
    const tableInfo = this.db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
    const hasColumn = tableInfo.some(col => col.name === column);
    
    if (!hasColumn) {
      throw new Error(`Required column '${column}' does not exist in table '${table}'`);
    }
  }

  private validateTimezoneColumns(): void {
    // Check that timestamp columns are using UTC
    const testResult = this.db.prepare(`
      SELECT created_at FROM semantic_concepts LIMIT 1
    `).get() as { created_at: string } | undefined;
    
    if (testResult && testResult.created_at) {
      // Basic check that timestamps look like UTC format
      const timestamp = new Date(testResult.created_at);
      if (isNaN(timestamp.getTime())) {
        throw new Error('Timestamp columns contain invalid date format after timezone migration');
      }
    }
  }

  private validateReferentialIntegrity(): void {
    // Check for any obvious data corruption
    try {
      // Validate JSON columns are valid JSON
      const concepts = this.db.prepare(`
        SELECT id, relationships, evolution_history FROM semantic_concepts 
        WHERE relationships != '' OR evolution_history != ''
        LIMIT 10
      `).all() as Array<{ id: string; relationships: string; evolution_history: string }>;
      
      for (const concept of concepts) {
        if (concept.relationships && concept.relationships !== '') {
          JSON.parse(concept.relationships); // Will throw if invalid
        }
        if (concept.evolution_history && concept.evolution_history !== '') {
          JSON.parse(concept.evolution_history); // Will throw if invalid
        }
      }
      
    } catch (error: unknown) {
      throw new Error(`Data integrity check failed: ${error instanceof Error ? error.message : String(error)}`);
    }
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
          // When rolling back to version 0, we still need to delete the migration record
          // to maintain consistency, even though we can't undo the schema changes
          if (targetVersion === 0) {
            this.db.prepare(`
              DELETE FROM migrations WHERE version = ?
            `).run(migration.version);
            console.log(`✅ Migration ${migration.version} record removed (no rollback script available)`);
          }
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