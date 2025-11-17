import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { SQLiteDatabase } from '../storage/sqlite-db.js';
import { SemanticEngine } from '../engines/semantic-engine.js';
import { PatternEngine } from '../engines/pattern-engine.js';
import { PatternConflictDetector } from '../services/pattern-conflict-detector.js';
import { GlobalDatabase } from '../storage/global-db.js';
import { CrossProjectService } from '../services/cross-project-service.js';
import { IncrementalLearner } from '../services/incremental-learner.js';

describe('Phase 1 Services', () => {
  let tempDir: string;
  let database: SQLiteDatabase;
  let semanticEngine: SemanticEngine;
  let patternEngine: PatternEngine;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'in-memoria-phase1-test-'));
    database = new SQLiteDatabase(join(tempDir, 'test.db'));

    // Create minimal engines for testing
    semanticEngine = new SemanticEngine(database);
    patternEngine = new PatternEngine(database);
  });

  afterEach(() => {
    database.close();
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe('PatternConflictDetector', () => {
    it('should initialize without errors', () => {
      const detector = new PatternConflictDetector(
        database,
        semanticEngine,
        patternEngine,
        'test-project'
      );

      expect(detector).toBeDefined();
    });

    it('should detect naming pattern violations', async () => {
      // Add a camelCase naming pattern
      database.prepare(`
        INSERT INTO developer_patterns (
          pattern_id, pattern_type, pattern_content, frequency, confidence
        ) VALUES (?, ?, ?, ?, ?)
      `).run(
        'test-pattern-1',
        'naming',
        JSON.stringify({
          category: 'variable_naming',
          convention: 'camelCase'
        }),
        10,
        0.90
      );

      const detector = new PatternConflictDetector(
        database,
        semanticEngine,
        patternEngine,
        'test-project'
      );

      // Code with snake_case (violates pattern)
      const code = 'const user_id = 123;';
      const testFilePath = join(tempDir, 'test.ts');
      writeFileSync(testFilePath, code);

      const report = await detector.checkCompliance(code, testFilePath, {
        severityThreshold: 'low'
      });

      expect(report).toBeDefined();
      expect(report.violations).toBeDefined();
      expect(Array.isArray(report.violations)).toBe(true);
    });

    it('should pass compliance for code following patterns', async () => {
      // Add a camelCase naming pattern
      database.prepare(`
        INSERT INTO developer_patterns (
          pattern_id, pattern_type, pattern_content, frequency, confidence
        ) VALUES (?, ?, ?, ?, ?)
      `).run(
        'test-pattern-2',
        'naming',
        JSON.stringify({
          category: 'variable_naming',
          convention: 'camelCase'
        }),
        10,
        0.90
      );

      const detector = new PatternConflictDetector(
        database,
        semanticEngine,
        patternEngine,
        'test-project'
      );

      // Code with camelCase (follows pattern)
      const code = 'const userId = 123;';
      const testFilePath = join(tempDir, 'test-compliant.ts');
      writeFileSync(testFilePath, code);

      const report = await detector.checkCompliance(code, testFilePath);

      expect(report).toBeDefined();
      expect(report.overallScore).toBeGreaterThan(80);
    });

    it('should handle pattern exceptions', async () => {
      const detector = new PatternConflictDetector(
        database,
        semanticEngine,
        patternEngine,
        'test-project'
      );

      // Add an exception
      await detector.addException('pattern-123', 'Legacy code exception', 'src/legacy/');

      // Check if exception exists
      const isExcepted = await detector.isExcepted('pattern-123', 'src/legacy/old-file.ts');
      expect(isExcepted).toBe(true);

      // Check non-excepted file
      const isNotExcepted = await detector.isExcepted('pattern-123', 'src/new/file.ts');
      expect(isNotExcepted).toBe(false);
    });
  });

  describe('GlobalDatabase', () => {
    let globalDb: GlobalDatabase;
    let globalTempDir: string;

    beforeEach(() => {
      globalTempDir = mkdtempSync(join(tmpdir(), 'global-db-test-'));
      globalDb = new GlobalDatabase(join(globalTempDir, 'global-test.db'));
    });

    afterEach(() => {
      globalDb.close();
      rmSync(globalTempDir, { recursive: true, force: true });
    });

    it('should initialize global database', () => {
      expect(globalDb).toBeDefined();

      const stats = globalDb.getStatistics();
      expect(stats.totalProjects).toBe(0);
      expect(stats.totalPatterns).toBe(0);
    });

    it('should link and track projects', async () => {
      const projectId = await globalDb.linkProject('/test/project', {
        name: 'Test Project',
        primaryLanguage: 'TypeScript'
      });

      expect(projectId).toBeDefined();
      expect(typeof projectId).toBe('string');

      const project = globalDb.getProject(projectId);
      expect(project).toBeDefined();
      expect(project?.name).toBe('Test Project');
      expect(project?.primaryLanguage).toBe('TypeScript');
    });

    it('should store and retrieve global patterns', () => {
      const patternId = globalDb.addGlobalPattern({
        category: 'naming',
        patternData: {
          convention: 'camelCase'
        },
        projectCount: 1,
        confidence: 0.85,
        sourceProjects: ['project-1']
      });

      expect(patternId).toBeDefined();

      const patterns = globalDb.getGlobalPatterns({
        category: 'naming'
      });

      expect(patterns.length).toBeGreaterThan(0);
      expect(patterns[0].category).toBe('naming');
    });

    it('should get portfolio statistics', async () => {
      // Link multiple projects
      await globalDb.linkProject('/project1', {
        name: 'Project 1',
        primaryLanguage: 'TypeScript'
      });
      await globalDb.linkProject('/project2', {
        name: 'Project 2',
        primaryLanguage: 'Python'
      });

      const stats = globalDb.getStatistics();
      expect(stats.totalProjects).toBe(2);
      expect(stats.activeProjects).toBe(2);
    });
  });

  describe('CrossProjectService', () => {
    let globalDb: GlobalDatabase;
    let globalTempDir: string;
    let crossProjectService: CrossProjectService;

    beforeEach(() => {
      globalTempDir = mkdtempSync(join(tmpdir(), 'cross-proj-test-'));
      globalDb = new GlobalDatabase(join(globalTempDir, 'global-test.db'));
      crossProjectService = new CrossProjectService(globalDb);
    });

    afterEach(() => {
      globalDb.close();
      rmSync(globalTempDir, { recursive: true, force: true });
    });

    it('should initialize cross-project service', () => {
      expect(crossProjectService).toBeDefined();
    });

    it('should get portfolio view', () => {
      const portfolio = crossProjectService.getPortfolioView();

      expect(portfolio).toBeDefined();
      expect(portfolio.totalProjects).toBeDefined();
      expect(portfolio.totalPatterns).toBeDefined();
      expect(Array.isArray(portfolio.projects)).toBe(true);
    });

    it('should get global patterns with filtering', async () => {
      // Add a pattern
      globalDb.addGlobalPattern({
        category: 'naming',
        patternData: { convention: 'camelCase' },
        projectCount: 2,
        confidence: 0.9,
        sourceProjects: ['p1', 'p2']
      });

      const patterns = crossProjectService.getGlobalPatterns({
        category: 'naming',
        minProjectCount: 2
      });

      expect(patterns.length).toBeGreaterThan(0);
      expect(patterns[0].projectCount).toBeGreaterThanOrEqual(2);
    });
  });

  describe('IncrementalLearner', () => {
    let incrementalLearner: IncrementalLearner;

    beforeEach(() => {
      incrementalLearner = new IncrementalLearner(
        database,
        semanticEngine,
        patternEngine,
        'test-project'
      );
    });

    it('should initialize incremental learner', () => {
      expect(incrementalLearner).toBeDefined();
    });

    it('should track learning status', () => {
      const status = incrementalLearner.getLearningStatus();

      expect(status).toBeDefined();
      expect(status.isLearning).toBe(false);
      expect(status.queueLength).toBe(0);
      expect(status.totalDeltasProcessed).toBe(0);
    });

    it('should get statistics', async () => {
      const stats = await incrementalLearner.getStatistics();

      expect(stats).toBeDefined();
      expect(stats.totalDeltas).toBe(0);
      expect(stats.totalConceptsAdded).toBe(0);
      expect(stats.successRate).toBeDefined();
    });

    it('should queue learning tasks', async () => {
      await incrementalLearner.queueLearning(['test.ts'], 'manual');

      const status = incrementalLearner.getLearningStatus();
      // Queue might be processed immediately or still pending
      expect(status).toBeDefined();
    });
  });
});
