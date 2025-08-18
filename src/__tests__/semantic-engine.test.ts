import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SemanticEngine } from '../engines/semantic-engine.js';
import { SQLiteDatabase } from '../storage/sqlite-db.js';
import { SemanticVectorDB } from '../storage/vector-db.js';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

describe('SemanticEngine', () => {
  let tempDir: string;
  let database: SQLiteDatabase;
  let vectorDB: SemanticVectorDB;
  let semanticEngine: SemanticEngine;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'in-memoria-test-'));
    database = new SQLiteDatabase(join(tempDir, 'test.db'));
    vectorDB = new SemanticVectorDB(); // No API key for tests
    semanticEngine = new SemanticEngine(database, vectorDB);
  });

  afterEach(() => {
    database.close();
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('should initialize without errors', () => {
    expect(semanticEngine).toBeDefined();
  });

  it('should analyze codebase structure', async () => {
    const testCodePath = './src';
    const analysis = await semanticEngine.analyzeCodebase(testCodePath);
    
    expect(analysis).toBeDefined();
    expect(Array.isArray(analysis.languages)).toBe(true);
    expect(Array.isArray(analysis.concepts)).toBe(true);
    expect(typeof analysis.complexity).toBe('object');
  });

  it('should analyze file content and extract concepts', async () => {
    const sampleCode = `
      export class TestClass {
        private value: number;
        
        constructor(value: number) {
          this.value = value;
        }
        
        getValue(): number {
          return this.value;
        }
      }
    `;
    
    const concepts = await semanticEngine.analyzeFileContent('./test.ts', sampleCode);
    expect(Array.isArray(concepts)).toBe(true);
  });
});