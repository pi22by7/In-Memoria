import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SQLiteDatabase } from '../storage/sqlite-db.js';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

describe('SQLiteDatabase', () => {
  let tempDir: string;
  let database: SQLiteDatabase;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'in-memoria-db-test-'));
    database = new SQLiteDatabase(join(tempDir, 'test.db'));
  });

  afterEach(() => {
    database.close();
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('should initialize database with schema', () => {
    expect(database).toBeDefined();
    
    // Test that tables exist by trying to query them
    const concepts = database.getSemanticConcepts();
    expect(Array.isArray(concepts)).toBe(true);
    
    const patterns = database.getDeveloperPatterns();
    expect(Array.isArray(patterns)).toBe(true);
  });

  it('should store and retrieve semantic concepts', () => {
    const concept = {
      id: 'test-concept',
      conceptName: 'TestClass',
      conceptType: 'class',
      confidenceScore: 0.95,
      relationships: { extends: [] },
      evolutionHistory: { versions: [] },
      filePath: './test.ts',
      lineRange: { start: 1, end: 10 }
    };

    database.insertSemanticConcept(concept);
    
    const stored = database.getSemanticConcepts();
    expect(stored.length).toBe(1);
    expect(stored[0].conceptName).toBe('TestClass');
  });

  it('should handle database errors gracefully', () => {
    // Close database and try to use it
    database.close();
    
    expect(() => {
      database.getSemanticConcepts();
    }).toThrow();
  });
});