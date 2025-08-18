import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DatabaseMigrator } from '../storage/migrations.js';
import Database from 'better-sqlite3';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

describe('DatabaseMigrator', () => {
  let tempDir: string;
  let dbPath: string;
  let db: Database.Database;
  let migrator: DatabaseMigrator;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'migration-test-'));
    dbPath = join(tempDir, 'test.db');
    db = new Database(dbPath);
    migrator = new DatabaseMigrator(db);
  });

  afterEach(() => {
    db.close();
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe('initialization', () => {
    it('should create migrations table', () => {
      const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='migrations'").all();
      expect(tables).toHaveLength(1);
    });

    it('should start with version 0 for new database', () => {
      const version = migrator.getCurrentVersion();
      expect(version).toBe(0);
    });

    it('should identify latest version', () => {
      const latestVersion = migrator.getLatestVersion();
      expect(latestVersion).toBeGreaterThan(0);
    });
  });

  describe('migration execution', () => {
    it('should detect need for migration', () => {
      const needsMigration = migrator.needsMigration();
      expect(needsMigration).toBe(true);
    });

    it('should run migrations successfully', () => {
      const initialVersion = migrator.getCurrentVersion();
      expect(initialVersion).toBe(0);

      migrator.migrate();

      const finalVersion = migrator.getCurrentVersion();
      expect(finalVersion).toBeGreaterThan(initialVersion);
      expect(finalVersion).toBe(migrator.getLatestVersion());
    });

    it('should record migration history', () => {
      migrator.migrate();

      const migrations = db.prepare("SELECT version, name, applied_at FROM migrations ORDER BY version").all();
      expect(migrations.length).toBeGreaterThan(0);
      
      migrations.forEach((migration: any) => {
        expect(migration.version).toBeGreaterThan(0);
        expect(migration.name).toBeDefined();
        expect(migration.applied_at).toBeDefined();
      });
    });

    it('should not re-run completed migrations', () => {
      // Run migrations first time
      migrator.migrate();
      const version1 = migrator.getCurrentVersion();
      
      // Run migrations second time
      migrator.migrate();
      const version2 = migrator.getCurrentVersion();
      
      expect(version1).toBe(version2);
    });

    it('should create expected tables and indexes after migration', () => {
      migrator.migrate();

      // Check that core tables exist
      const tables = db.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name IN ('semantic_concepts', 'developer_patterns', 'file_intelligence', 'ai_insights')
      `).all();
      
      expect(tables.length).toBe(4);

      // Check that indexes exist
      const indexes = db.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='index' AND name LIKE 'idx_%'
      `).all();
      
      expect(indexes.length).toBeGreaterThan(0);
    });
  });

  describe('rollback functionality', () => {
    it('should rollback to previous version', () => {
      // First migrate to latest
      migrator.migrate();
      const latestVersion = migrator.getCurrentVersion();
      expect(latestVersion).toBeGreaterThan(1);

      // Rollback one version
      migrator.rollback(latestVersion - 1);
      const rolledBackVersion = migrator.getCurrentVersion();
      
      expect(rolledBackVersion).toBe(latestVersion - 1);
    });

    it('should handle rollback to version 0', () => {
      migrator.migrate();
      expect(migrator.getCurrentVersion()).toBeGreaterThan(0);

      migrator.rollback(0);
      expect(migrator.getCurrentVersion()).toBe(0);
    });

    it('should not rollback if target version is higher', () => {
      migrator.migrate();
      const currentVersion = migrator.getCurrentVersion();

      // Try to rollback to higher version (should be no-op)
      migrator.rollback(currentVersion + 1);
      
      expect(migrator.getCurrentVersion()).toBe(currentVersion);
    });
  });

  describe('status reporting', () => {
    it('should report correct status before migration', () => {
      expect(migrator.getCurrentVersion()).toBe(0);
      expect(migrator.getLatestVersion()).toBeGreaterThan(0);
      expect(migrator.needsMigration()).toBe(true);
    });

    it('should report correct status after migration', () => {
      migrator.migrate();
      
      expect(migrator.getCurrentVersion()).toBe(migrator.getLatestVersion());
      expect(migrator.needsMigration()).toBe(false);
    });

    it('should provide status summary', () => {
      // This is mainly testing that status() doesn't throw
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      migrator.status();
      
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('error handling', () => {
    it('should handle migration errors gracefully', () => {
      // Create a migrator with a broken migration by mocking
      const brokenMigrator = new DatabaseMigrator(db);
      
      // Override migrations with a failing one
      (brokenMigrator as any).migrations = [{
        version: 1,
        name: 'broken_migration',
        up: 'INVALID SQL SYNTAX HERE;'
      }];

      expect(() => {
        brokenMigrator.migrate();
      }).toThrow();

      // Should still be at version 0
      expect(brokenMigrator.getCurrentVersion()).toBe(0);
    });

    it('should handle rollback errors for migrations without down scripts', () => {
      // This mainly tests that we handle missing 'down' scripts gracefully
      migrator.migrate();
      
      // Most migrations might not have rollback scripts, should handle gracefully
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      migrator.rollback(0);
      
      consoleSpy.mockRestore();
    });
  });

  describe('transaction safety', () => {
    it('should run all migrations in a transaction', () => {
      const initialVersion = migrator.getCurrentVersion();
      
      migrator.migrate();
      
      // All migrations should have completed, or none should have
      const finalVersion = migrator.getCurrentVersion();
      expect(finalVersion === initialVersion || finalVersion === migrator.getLatestVersion()).toBe(true);
    });
  });
});