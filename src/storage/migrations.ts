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
        applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
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
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        
        CREATE INDEX IF NOT EXISTS idx_vector_cache_content_hash ON vector_cache(content_hash);
      `,
      down: `
        DROP TABLE IF EXISTS vector_cache;
        -- Note: SQLite doesn't support DROP COLUMN, so we leave the embedding_vector columns
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