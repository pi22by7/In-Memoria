import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MonitoringTools } from '../mcp-server/tools/monitoring-tools.js';
import { SemanticEngine } from '../engines/semantic-engine.js';
import { PatternEngine } from '../engines/pattern-engine.js';
import { SQLiteDatabase } from '../storage/sqlite-db.js';
import { SemanticVectorDB } from '../storage/vector-db.js';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

describe('MonitoringTools', () => {
  let tempDir: string;
  let database: SQLiteDatabase;
  let vectorDB: SemanticVectorDB;
  let semanticEngine: SemanticEngine;
  let patternEngine: PatternEngine;
  let monitoringTools: MonitoringTools;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'monitoring-test-'));
    database = new SQLiteDatabase(join(tempDir, 'test.db'));
    vectorDB = new SemanticVectorDB();
    semanticEngine = new SemanticEngine(database, vectorDB);
    patternEngine = new PatternEngine(database);
    monitoringTools = new MonitoringTools(semanticEngine, patternEngine, database);
  });

  afterEach(() => {
    database.close();
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe('getSystemStatus', () => {
    it('should return comprehensive system status', async () => {
      const result = await monitoringTools.getSystemStatus({
        includeMetrics: true,
        includeDiagnostics: true
      });

      expect(result.success).toBe(true);
      expect(result.status.version).toBe('0.5.6');
      expect(result.status.timestamp).toBeDefined();
      expect(result.status.components.database).toBeDefined();
      expect(result.status.intelligence).toBeDefined();
      expect(result.status.performance).toBeDefined();
      expect(result.status.diagnostics).toBeDefined();
    });

    it('should handle minimal status request', async () => {
      const result = await monitoringTools.getSystemStatus({
        includeMetrics: false,
        includeDiagnostics: false
      });

      expect(result.success).toBe(true);
      expect(result.status.performance).toEqual({});
      expect(result.status.diagnostics).toEqual({});
    });

    it('should assess overall health correctly', async () => {
      const result = await monitoringTools.getSystemStatus({});

      expect(result.status.status).toMatch(/operational|ready_for_learning|degraded|critical/);
      expect(result.message).toContain('System is');
      expect(result.summary).toBeDefined();
    });
  });

  describe('getIntelligenceMetrics', () => {
    it('should return metrics for empty database', async () => {
      const result = await monitoringTools.getIntelligenceMetrics({
        includeBreakdown: true
      });

      expect(result.success).toBe(true);
      expect(result.metrics.concepts.total).toBe(0);
      expect(result.metrics.patterns.total).toBe(0);
    });

    it('should return detailed metrics with data', async () => {
      // Add test data
      database.insertSemanticConcept({
        id: 'test-concept-1',
        conceptName: 'TestClass',
        conceptType: 'class',
        confidenceScore: 0.9,
        relationships: {},
        evolutionHistory: {},
        filePath: 'test.ts',
        lineRange: { start: 1, end: 10 }
      });

      database.insertSemanticConcept({
        id: 'test-concept-2',
        conceptName: 'TestFunction',
        conceptType: 'function',
        confidenceScore: 0.6,
        relationships: {},
        evolutionHistory: {},
        filePath: 'test.ts',
        lineRange: { start: 12, end: 15 }
      });

      const result = await monitoringTools.getIntelligenceMetrics({
        includeBreakdown: true
      });

      expect(result.success).toBe(true);
      expect(result.metrics.concepts.total).toBe(2);
      expect(result.metrics.concepts.breakdown.byType).toEqual({
        class: 1,
        function: 1
      });
      expect(result.metrics.concepts.breakdown.byConfidence.high).toBe(1);
      expect(result.metrics.concepts.breakdown.byConfidence.medium).toBe(1);
      expect(result.metrics.quality.averageConfidence).toBe(0.75);
    });

    it('should skip breakdown when requested', async () => {
      const result = await monitoringTools.getIntelligenceMetrics({
        includeBreakdown: false
      });

      expect(result.success).toBe(true);
      expect(result.metrics.concepts.breakdown).toBeUndefined();
    });
  });

  describe('getPerformanceStatus', () => {
    it('should return performance metrics', async () => {
      const result = await monitoringTools.getPerformanceStatus({
        runBenchmark: false
      });

      expect(result.success).toBe(true);
      expect(result.performance.memory).toBeDefined();
      expect(result.performance.memory.heapUsed).toBeGreaterThan(0);
      expect(result.performance.system.nodeVersion).toBeDefined();
      expect(result.performance.system.platform).toBeDefined();
    });

    it('should include database performance metrics', async () => {
      const result = await monitoringTools.getPerformanceStatus({});

      expect(result.success).toBe(true);
      expect(result.performance.database).toBeDefined();
      expect(result.performance.database.queryPerformance).toBeDefined();
      expect(result.performance.database.queryPerformance.performanceRating).toMatch(/excellent|good|fair|poor/);
    });

    it('should run benchmark when requested', async () => {
      const result = await monitoringTools.getPerformanceStatus({
        runBenchmark: true
      });

      expect(result.success).toBe(true);
      expect(result.performance.benchmark).toBeDefined();
      expect(result.performance.benchmark.conceptQuery).toBeGreaterThanOrEqual(0);
      expect(result.performance.benchmark.patternQuery).toBeGreaterThanOrEqual(0);
    });
  });

  describe('tools property', () => {
    it('should expose correct tool definitions', () => {
      const tools = monitoringTools.tools;

      expect(tools).toHaveLength(3);
      expect(tools.map(t => t.name)).toEqual([
        'get_system_status',
        'get_intelligence_metrics',
        'get_performance_status'
      ]);

      // Verify all tools have proper schemas
      tools.forEach(tool => {
        expect(tool.inputSchema).toBeDefined();
        expect(tool.description).toBeDefined();
      });
    });
  });
});