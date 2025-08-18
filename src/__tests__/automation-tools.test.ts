import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AutomationTools } from '../mcp-server/tools/automation-tools.js';
import { SemanticEngine } from '../engines/semantic-engine.js';
import { PatternEngine } from '../engines/pattern-engine.js';
import { SQLiteDatabase } from '../storage/sqlite-db.js';
import { SemanticVectorDB } from '../storage/vector-db.js';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

describe('AutomationTools', () => {
  let tempDir: string;
  let projectDir: string;
  let database: SQLiteDatabase;
  let vectorDB: SemanticVectorDB;
  let semanticEngine: SemanticEngine;
  let patternEngine: PatternEngine;
  let automationTools: AutomationTools;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'automation-test-'));
    projectDir = join(tempDir, 'test-project');
    mkdirSync(projectDir, { recursive: true });
    
    // Create some test files
    writeFileSync(join(projectDir, 'package.json'), JSON.stringify({ name: 'test-project' }));
    writeFileSync(join(projectDir, 'index.ts'), 'export const hello = () => "world";');
    writeFileSync(join(projectDir, 'utils.ts'), 'export function add(a: number, b: number) { return a + b; }');
    
    database = new SQLiteDatabase(join(tempDir, 'test.db'));
    vectorDB = new SemanticVectorDB();
    semanticEngine = new SemanticEngine(database, vectorDB);
    patternEngine = new PatternEngine(database);
    automationTools = new AutomationTools(semanticEngine, patternEngine, database);
  });

  afterEach(() => {
    database.close();
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe('getLearningStatus', () => {
    it('should return correct status for empty database', async () => {
      const result = await automationTools.getLearningStatus({ path: projectDir });
      
      expect(result.hasIntelligence).toBe(false);
      expect(result.conceptsStored).toBe(0);
      expect(result.patternsStored).toBe(0);
      expect(result.recommendation).toBe('learning_recommended');
      expect(result.codeFilesInProject).toBeGreaterThan(0);
    });

    it('should detect existing intelligence data', async () => {
      // Add some test data
      database.insertSemanticConcept({
        id: 'test-concept',
        conceptName: 'TestFunction',
        conceptType: 'function',
        confidenceScore: 0.9,
        relationships: {},
        evolutionHistory: {},
        filePath: 'test.ts',
        lineRange: { start: 1, end: 5 }
      });

      const result = await automationTools.getLearningStatus({ path: projectDir });
      
      expect(result.hasIntelligence).toBe(true);
      expect(result.conceptsStored).toBe(1);
      expect(result.recommendation).toBe('ready');
    });
  });

  describe('autoLearnIfNeeded', () => {
    it('should skip learning when data is current', async () => {
      // Add some test intelligence data
      database.insertSemanticConcept({
        id: 'existing-concept',
        conceptName: 'ExistingFunction',
        conceptType: 'function',
        confidenceScore: 0.8,
        relationships: {},
        evolutionHistory: {},
        filePath: 'test.ts',
        lineRange: { start: 1, end: 3 }
      });

      const result = await automationTools.autoLearnIfNeeded({ 
        path: projectDir,
        includeProgress: false
      });

      expect(result.action).toBe('skipped');
      expect(result.reason).toBe('Intelligence data is up-to-date');
    });

    it('should perform learning when forced', async () => {
      const result = await automationTools.autoLearnIfNeeded({ 
        path: projectDir,
        force: true,
        includeProgress: false
      });

      expect(result.action).toBe('learned');
      expect(result.conceptsLearned).toBeGreaterThanOrEqual(0);
      expect(result.patternsLearned).toBeGreaterThanOrEqual(0);
      expect(result.filesAnalyzed).toBeGreaterThan(0);
      expect(typeof result.timeElapsed).toBe('number');
    });

    it('should handle learning errors gracefully', async () => {
      // Mock the semantic engine to throw an error
      const mockSemanticEngine = {
        learnFromCodebase: vi.fn().mockRejectedValue(new Error('Test error'))
      };
      
      const tools = new AutomationTools(database, {} as any, projectDir);
      (tools as any).semanticEngine = mockSemanticEngine;
      
      const result = await tools.autoLearnIfNeeded({ 
        path: projectDir,
        includeProgress: false,
        force: true  // Force learning to trigger the error
      });

      expect(result.action).toBe('failed');
      expect(result.error).toBeDefined();
    });
  });

  describe('quickSetup', () => {
    it('should perform complete setup successfully', async () => {
      const result = await automationTools.quickSetup({ 
        path: projectDir,
        skipLearning: true
      });

      expect(result.success).toBe(true);
      expect(result.steps).toHaveLength(4);
      expect(result.steps[0].step).toBe('project_check');
      expect(result.steps[1].step).toBe('database_init');
      expect(result.steps[2].step).toBe('learning');
      expect(result.steps[2].status).toBe('skipped');
      expect(result.steps[3].step).toBe('verification');
      expect(result.readyForAgents).toBe(true);
    });

    it('should include learning when not skipped', async () => {
      const result = await automationTools.quickSetup({ 
        path: projectDir,
        skipLearning: false
      });

      expect(result.success).toBe(true);
      expect(result.steps.find(s => s.step === 'learning')?.status).toMatch(/completed|failed/);
    });

    it('should handle setup errors gracefully', async () => {
      // Close database to force an error
      database.close();
      
      const result = await automationTools.quickSetup({ 
        path: projectDir
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('tools property', () => {
    it('should expose correct tool definitions', () => {
      const tools = automationTools.tools;
      
      expect(tools).toHaveLength(3);
      expect(tools.map(t => t.name)).toEqual([
        'auto_learn_if_needed',
        'get_learning_status', 
        'quick_setup'
      ]);
      
      // Check tool schemas
      tools.forEach(tool => {
        expect(tool.inputSchema).toBeDefined();
        expect(tool.description).toBeDefined();
      });
    });
  });
});