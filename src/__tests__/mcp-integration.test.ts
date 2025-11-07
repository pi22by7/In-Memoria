import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CodeCartographerMCP } from '../mcp-server/server.js';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

describe('MCP Server Integration', () => {
  let tempDir: string;
  let projectDir: string;
  let server: CodeCartographerMCP;
  let originalCwd: string;
  let originalEnv: any;

  beforeEach(async () => {
    tempDir = mkdtempSync(join(tmpdir(), 'mcp-integration-test-'));
    projectDir = join(tempDir, 'test-project');
    mkdirSync(projectDir, { recursive: true });

    // Create test project structure
    writeFileSync(join(projectDir, 'package.json'), JSON.stringify({
      name: 'test-project',
      version: '1.0.0',
      description: 'Test project for MCP integration'
    }));

    writeFileSync(join(projectDir, 'index.ts'), `
export class TestService {
  private data: string[] = [];
  
  async addData(item: string): Promise<void> {
    this.data.push(item);
  }
  
  getData(): string[] {
    return this.data;
  }
}
    `);

    writeFileSync(join(projectDir, 'utils.ts'), `
export function calculateSum(numbers: number[]): number {
  return numbers.reduce((sum, num) => sum + num, 0);
}

export function formatMessage(message: string): string {
  return \`[INFO] \${message}\`;
}
    `);

    // Set test environment
    originalCwd = process.cwd();
    originalEnv = { ...process.env };
    process.chdir(projectDir);
    process.env.IN_MEMORIA_DB_PATH = join(tempDir, 'test.db');

    server = new CodeCartographerMCP();

    // Initialize components without starting the transport (for testing)
    await server.initializeForTesting();
  });

  afterEach(async () => {
    try {
      await server.stop();
    } catch (error) {
      // Ignore cleanup errors
    }

    process.chdir(originalCwd);
    process.env = originalEnv;
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe('Server Initialization', () => {
    it('should initialize all components successfully', async () => {
      // Initialization happens in constructor, should not throw
      expect(server).toBeDefined();
    });
  });

  describe('Core Analysis Tools', () => {
    it('should analyze codebase successfully', async () => {
      const result = await server.routeToolCall('analyze_codebase', {
        path: projectDir
      });

      expect(result).toBeDefined();
      expect(typeof result).toBe('object');
      // The actual structure depends on the Rust analyzer, but should be an object
    });

    it('should analyze a single file', async () => {
      const result = await server.routeToolCall('analyze_codebase', {
        path: join(projectDir, 'index.ts')
      });

      expect(result).toBeDefined();
      expect(result.type).toBe('file');
      expect(result.language).toBeDefined();
    });

    it('should get project blueprint', async () => {
      const result = await server.routeToolCall('get_project_blueprint', {
        path: projectDir,
        includeFeatureMap: true
      });

      expect(Array.isArray(result.techStack)).toBe(true);
      expect(result.learningStatus).toBeDefined();
      expect(result.keyDirectories).toBeDefined();
    });

    it('should search codebase', async () => {
      const result = await server.routeToolCall('search_codebase', {
        query: 'TestService',
        type: 'text'
      });

      expect(result).toBeDefined();
      // Should find the TestService class
    });
  });

  describe('Automation Tools', () => {
    it('should expose learning status via blueprint', async () => {
      const result = await server.routeToolCall('get_project_blueprint', {
        path: projectDir
      });

      expect(result.learningStatus).toBeDefined();
      expect(result.learningStatus.recommendation).toMatch(/ready|learning_recommended|learning_needed/);
    });

    it('should auto-learn if needed', async () => {
      const result = await server.routeToolCall('auto_learn_if_needed', {
        path: projectDir,
        includeProgress: false
      });

      expect(result.action).toMatch(/skipped|learned|failed/);
      if (result.action === 'learned') {
        expect(typeof result.conceptsLearned).toBe('number');
        expect(typeof result.patternsLearned).toBe('number');
      }
    });

    it('should include setup steps when requested', async () => {
      const result = await server.routeToolCall('auto_learn_if_needed', {
        path: projectDir,
        skipLearning: true,
        includeSetupSteps: true
      });

      expect(result.success || result.action).toBeDefined();
      expect(Array.isArray(result.steps)).toBe(true);
      expect(result.steps.length).toBeGreaterThan(0);
    });
  });

  describe('Monitoring Tools', () => {
    it('should get system status', async () => {
      const result = await server.routeToolCall('get_system_status', {
        includeMetrics: true
      });

      expect(result.success).toBe(true);
      expect(result.status.version).toBe('0.5.8');
      expect(result.status.components.database).toBeDefined();
      expect(result.status.intelligence).toBeDefined();
      expect(result.status.status).toMatch(/operational|ready_for_learning|degraded|critical/);
    });

    it('should get intelligence metrics', async () => {
      const result = await server.routeToolCall('get_intelligence_metrics', {
        includeBreakdown: true
      });

      expect(result.success).toBe(true);
      expect(typeof result.metrics.concepts.total).toBe('number');
      expect(typeof result.metrics.patterns.total).toBe('number');
    });

    it('should get performance status', async () => {
      const result = await server.routeToolCall('get_performance_status', {
        runBenchmark: false
      });

      expect(result.success).toBe(true);
      expect(result.performance.memory).toBeDefined();
      expect(result.performance.system).toBeDefined();
      expect(typeof result.performance.memory.heapUsed).toBe('number');
    });

    it('should run performance benchmark', async () => {
      const result = await server.routeToolCall('get_performance_status', {
        runBenchmark: true
      });

      expect(result.success).toBe(true);
      expect(result.performance.benchmark).toBeDefined();
      expect(typeof result.performance.benchmark.conceptQuery).toBe('number');
    });
  });

  describe('Intelligence Tools', () => {
    it('should get semantic insights', async () => {
      const result = await server.routeToolCall('get_semantic_insights', {
        limit: 10
      });

      expect(result).toBeDefined();
      // Result structure depends on available intelligence data
    });

    it('should get pattern recommendations', async () => {
      const result = await server.routeToolCall('get_pattern_recommendations', {
        problemDescription: 'I need to create a data processing service'
      });

      expect(result).toBeDefined();
      // Should provide some kind of recommendation
    });

    it('should predict coding approach', async () => {
      const result = await server.routeToolCall('predict_coding_approach', {
        problemDescription: 'Building a REST API endpoint'
      });

      expect(result).toBeDefined();
      // Should provide approach prediction
    });

    it('should get developer profile', async () => {
      const result = await server.routeToolCall('get_developer_profile', {});

      expect(result).toBeDefined();
      // Profile information based on learned patterns
    });

    it('should accept insights contribution', async () => {
      const result = await server.routeToolCall('contribute_insights', {
        type: 'best_practice',
        content: { rule: 'Always validate inputs' },
        confidence: 0.9,
        sourceAgent: 'test-agent'
      });

      expect(result).toBeDefined();
      // Should accept the insight
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid tool names', async () => {
      await expect(server.routeToolCall('invalid_tool', {})).rejects.toThrow('Unknown tool');
    });

    it('should validate input parameters', async () => {
      await expect(server.routeToolCall('analyze_codebase', {
        path: '' // Invalid empty path
      })).rejects.toThrow();
    });

    it('should handle missing required parameters', async () => {
      await expect(server.routeToolCall('contribute_insights', {
        type: 'optimization'
        // Missing required fields
      })).rejects.toThrow();
    });
  });

  describe('Tool Completeness', () => {
    it('should list all supported tools', async () => {
      const expectedTools = [
        // Core Analysis
        'analyze_codebase',
        'search_codebase',
        // Intelligence
        'learn_codebase_intelligence',
        'get_semantic_insights',
        'get_pattern_recommendations',
        'predict_coding_approach',
        'get_developer_profile',
        'contribute_insights',
        'get_project_blueprint',
        // Automation
        'auto_learn_if_needed',
        // Monitoring
        'get_system_status',
        'get_intelligence_metrics',
        'get_performance_status',
        'health_check'
      ];

      const allTools = server.getAllTools().map(tool => tool.name);
      expectedTools.forEach(tool => expect(allTools).toContain(tool));
    });

    it('should have proper tool schemas', async () => {
      const toolsWithValidParams = [
        { name: 'get_system_status', params: {} },
        { name: 'get_project_blueprint', params: { path: projectDir } },
        { name: 'get_intelligence_metrics', params: {} },
        { name: 'health_check', params: { path: projectDir } }
      ];

      for (const { name, params } of toolsWithValidParams) {
        const result = await server.routeToolCall(name, params);
        expect(result).toBeDefined();
      }
    });
  });

  describe('End-to-End Workflow', () => {
    it('should support complete agent workflow', async () => {
      // 1. Check initial status
      const initialStatus = await server.routeToolCall('get_project_blueprint', {
        path: projectDir
      });
      expect(initialStatus.learningStatus).toBeDefined();

      // 2. Auto-learn if needed
      const learningResult = await server.routeToolCall('auto_learn_if_needed', {
        path: projectDir,
        includeProgress: false
      });
      expect(learningResult.action).toBeDefined();

      // 3. Get system status after learning
      const systemStatus = await server.routeToolCall('get_system_status', {});
      expect(systemStatus.success).toBe(true);

      // 4. Get intelligence metrics
      const metrics = await server.routeToolCall('get_intelligence_metrics', {});
      expect(metrics.success).toBe(true);

      // 5. Analyze the codebase
      const analysis = await server.routeToolCall('analyze_codebase', {
        path: projectDir
      });
      expect(analysis).toBeDefined();

      // Complete workflow should work without errors
    });
  });
});
