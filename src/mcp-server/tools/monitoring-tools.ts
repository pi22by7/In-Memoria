import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { SemanticEngine } from '../../engines/semantic-engine.js';
import { PatternEngine } from '../../engines/pattern-engine.js';
import { SQLiteDatabase } from '../../storage/sqlite-db.js';
import { existsSync, statSync } from 'fs';
import { join } from 'path';

export class MonitoringTools {
  constructor(
    private semanticEngine: SemanticEngine,
    private patternEngine: PatternEngine,
    private database: SQLiteDatabase
  ) { }

  get tools(): Tool[] {
    return [
      {
        name: 'get_system_status',
        description: 'Get comprehensive system status including intelligence data, performance metrics, and health indicators',
        inputSchema: {
          type: 'object',
          properties: {
            includeMetrics: {
              type: 'boolean',
              description: 'Include detailed performance metrics',
              default: true
            },
            includeDiagnostics: {
              type: 'boolean',
              description: 'Include system diagnostics',
              default: false
            }
          }
        }
      },
      {
        name: 'get_intelligence_metrics',
        description: 'Get detailed metrics about the intelligence database and learning state',
        inputSchema: {
          type: 'object',
          properties: {
            includeBreakdown: {
              type: 'boolean',
              description: 'Include detailed breakdown by type and confidence',
              default: true
            }
          }
        }
      },
      {
        name: 'get_performance_status',
        description: 'Get performance metrics including database size, query times, and resource usage',
        inputSchema: {
          type: 'object',
          properties: {
            runBenchmark: {
              type: 'boolean',
              description: 'Run a quick performance benchmark',
              default: false
            }
          }
        }
      }
    ];
  }

  async getSystemStatus(args: {
    includeMetrics?: boolean;
    includeDiagnostics?: boolean;
  }): Promise<any> {
    const includeMetrics = args.includeMetrics !== false;
    const includeDiagnostics = args.includeDiagnostics || false;

    console.error('📊 Gathering system status...');

    const status = {
      timestamp: new Date().toISOString(),
      version: '0.4.1',
      status: 'operational',
      components: {} as any,
      intelligence: {} as any,
      performance: {} as any,
      diagnostics: {} as any
    };

    try {
      // Database component status
      status.components.database = await this.getDatabaseStatus();

      // Intelligence system status
      status.intelligence = await this.getIntelligenceStatus();

      // Performance metrics (if requested)
      if (includeMetrics) {
        status.performance = await this.getPerformanceMetrics();
      }

      // Diagnostics (if requested)
      if (includeDiagnostics) {
        status.diagnostics = await this.getBasicDiagnostics();
      }

      // Overall health assessment
      status.status = this.assessOverallHealth(status);

      return {
        success: true,
        status,
        message: `System is ${status.status}`,
        summary: this.generateStatusSummary(status)
      };

    } catch (error) {
      console.error('❌ Status check failed:', error);

      return {
        success: false,
        status: 'error',
        error: error.message,
        message: 'Failed to retrieve system status'
      };
    }
  }

  async getIntelligenceMetrics(args: {
    includeBreakdown?: boolean;
  }): Promise<any> {
    const includeBreakdown = args.includeBreakdown !== false;

    console.error('🧠 Analyzing intelligence metrics...');

    try {
      const concepts = this.database.getSemanticConcepts();
      const patterns = this.database.getDeveloperPatterns();

      const metrics = {
        concepts: {
          total: concepts.length,
          ...(includeBreakdown && { breakdown: {} as any })
        },
        patterns: {
          total: patterns.length,
          ...(includeBreakdown && { breakdown: {} as any })
        },
        quality: {} as any,
        coverage: {} as any,
        timestamps: {} as any
      };

      if (includeBreakdown && concepts.length > 0) {
        // Concepts breakdown
        const conceptsByType = concepts.reduce((acc, concept) => {
          acc[concept.conceptType] = (acc[concept.conceptType] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

        const conceptsByConfidence = {
          high: concepts.filter(c => c.confidenceScore >= 0.8).length,
          medium: concepts.filter(c => c.confidenceScore >= 0.5 && c.confidenceScore < 0.8).length,
          low: concepts.filter(c => c.confidenceScore < 0.5).length
        };

        metrics.concepts.breakdown = {
          byType: conceptsByType,
          byConfidence: conceptsByConfidence
        };

        // Quality metrics
        const avgConfidence = concepts.reduce((sum, c) => sum + c.confidenceScore, 0) / concepts.length;
        metrics.quality.averageConfidence = Math.round(avgConfidence * 100) / 100;
        metrics.quality.highConfidenceRatio = conceptsByConfidence.high / concepts.length;
      }

      if (includeBreakdown && patterns.length > 0) {
        // Patterns breakdown
        const patternsByType = patterns.reduce((acc, pattern) => {
          acc[pattern.patternType] = (acc[pattern.patternType] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

        const patternsByFrequency = {
          frequent: patterns.filter(p => p.frequency >= 10).length,
          common: patterns.filter(p => p.frequency >= 3 && p.frequency < 10).length,
          rare: patterns.filter(p => p.frequency < 3).length
        };

        metrics.patterns.breakdown = {
          byType: patternsByType,
          byFrequency: patternsByFrequency
        };

        // Pattern quality
        const avgFrequency = patterns.reduce((sum, p) => sum + p.frequency, 0) / patterns.length;
        metrics.quality.averagePatternFrequency = Math.round(avgFrequency * 100) / 100;
      }

      // Timestamps
      if (concepts.length > 0) {
        const latestConcept = concepts.reduce((latest, current) =>
          new Date(current.createdAt) > new Date(latest.createdAt) ? current : latest
        );
        metrics.timestamps.lastConceptLearned = latestConcept.createdAt;
      }

      if (patterns.length > 0) {
        const latestPattern = patterns.reduce((latest, current) =>
          new Date(current.createdAt) > new Date(latest.createdAt) ? current : latest
        );
        metrics.timestamps.lastPatternLearned = latestPattern.createdAt;
      }

      return {
        success: true,
        metrics,
        message: `Intelligence metrics: ${concepts.length} concepts, ${patterns.length} patterns`
      };

    } catch (error) {
      console.error('❌ Intelligence metrics failed:', error);

      return {
        success: false,
        error: error.message,
        message: 'Failed to retrieve intelligence metrics'
      };
    }
  }

  async getPerformanceStatus(args: {
    runBenchmark?: boolean;
  }): Promise<any> {
    const runBenchmark = args.runBenchmark || false;

    console.error('⚡ Checking performance status...');

    try {
      const performance = {
        database: {} as any,
        memory: {} as any,
        system: {} as any,
        benchmark: {} as any
      };

      // Database performance
      const dbPath = this.getDatabasePath();
      if (existsSync(dbPath)) {
        const stats = statSync(dbPath);
        performance.database.size = {
          bytes: stats.size,
          mb: Math.round(stats.size / (1024 * 1024) * 100) / 100
        };
        performance.database.lastModified = stats.mtime.toISOString();

        // Query performance test
        const queryStart = Date.now();
        const concepts = this.database.getSemanticConcepts();
        const queryTime = Date.now() - queryStart;

        performance.database.queryPerformance = {
          conceptQueryTime: queryTime,
          conceptCount: concepts.length,
          performanceRating: queryTime < 100 ? 'excellent' :
            queryTime < 500 ? 'good' :
              queryTime < 1000 ? 'fair' : 'poor'
        };
      }

      // Memory usage
      const memUsage = process.memoryUsage();
      performance.memory = {
        rss: Math.round(memUsage.rss / 1024 / 1024),
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
        external: Math.round(memUsage.external / 1024 / 1024),
        unit: 'MB'
      };

      // System info
      performance.system = {
        nodeVersion: process.version,
        platform: `${process.platform}-${process.arch}`,
        uptime: Math.round(process.uptime())
      };

      // Benchmark (if requested)
      if (runBenchmark) {
        console.error('🏃 Running performance benchmark...');
        performance.benchmark = await this.runQuickBenchmark();
      }

      return {
        success: true,
        performance,
        message: `Performance: DB ${performance.database?.size?.mb}MB, Memory ${performance.memory.heapUsed}MB`
      };

    } catch (error) {
      console.error('❌ Performance check failed:', error);

      return {
        success: false,
        error: error.message,
        message: 'Failed to retrieve performance metrics'
      };
    }
  }

  private async getDatabaseStatus(): Promise<any> {
    try {
      const concepts = this.database.getSemanticConcepts();
      const patterns = this.database.getDeveloperPatterns();

      const migrator = this.database.getMigrator();
      const currentVersion = migrator.getCurrentVersion();
      const latestVersion = migrator.getLatestVersion();

      return {
        status: 'healthy',
        connected: true,
        schemaVersion: currentVersion,
        latestVersion: latestVersion,
        needsMigration: currentVersion < latestVersion,
        dataCount: {
          concepts: concepts.length,
          patterns: patterns.length
        }
      };
    } catch (error) {
      return {
        status: 'error',
        connected: false,
        error: error.message
      };
    }
  }

  private async getIntelligenceStatus(): Promise<any> {
    try {
      const concepts = this.database.getSemanticConcepts();
      const patterns = this.database.getDeveloperPatterns();

      const hasData = concepts.length > 0 || patterns.length > 0;
      const dataQuality = hasData ? 'good' : 'empty';

      return {
        status: hasData ? 'ready' : 'needs_learning',
        dataQuality,
        conceptCount: concepts.length,
        patternCount: patterns.length,
        lastUpdate: this.getLastUpdateTime(concepts, patterns)
      };
    } catch (error) {
      return {
        status: 'error',
        error: error.message
      };
    }
  }

  private async getPerformanceMetrics(): Promise<any> {
    const memUsage = process.memoryUsage();

    return {
      memory: {
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024)
      },
      database: {
        size: this.getDatabaseSize()
      },
      uptime: Math.round(process.uptime())
    };
  }

  private async getBasicDiagnostics(): Promise<any> {
    return {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      environment: {
        hasOpenAI: !!process.env.OPENAI_API_KEY,
        workingDirectory: process.cwd()
      }
    };
  }

  private assessOverallHealth(status: any): string {
    if (status.components.database?.status === 'error') return 'critical';
    if (status.intelligence?.status === 'error') return 'degraded';
    if (status.intelligence?.status === 'needs_learning') return 'ready_for_learning';
    return 'operational';
  }

  private generateStatusSummary(status: any): string {
    const db = status.components.database;
    const intel = status.intelligence;

    if (status.status === 'operational') {
      return `All systems operational. ${intel.conceptCount} concepts, ${intel.patternCount} patterns ready.`;
    } else if (status.status === 'ready_for_learning') {
      return 'System ready but needs learning. Run auto_learn_if_needed to get started.';
    } else {
      return 'System issues detected. Check diagnostics for details.';
    }
  }

  private getDatabasePath(): string {
    // This is a simplified version - in reality you'd get this from configuration
    return join(process.cwd(), 'in-memoria.db');
  }

  private getDatabaseSize(): number {
    try {
      const dbPath = this.getDatabasePath();
      if (existsSync(dbPath)) {
        const stats = statSync(dbPath);
        return Math.round(stats.size / 1024 / 1024 * 100) / 100; // MB
      }
    } catch (error) {
      // Ignore errors
    }
    return 0;
  }

  private getLastUpdateTime(concepts: any[], patterns: any[]): string | null {
    let latestTime = 0;

    for (const concept of concepts) {
      const time = new Date(concept.createdAt).getTime();
      if (time > latestTime) latestTime = time;
    }

    for (const pattern of patterns) {
      const time = new Date(pattern.createdAt).getTime();
      if (time > latestTime) latestTime = time;
    }

    return latestTime > 0 ? new Date(latestTime).toISOString() : null;
  }

  private async runQuickBenchmark(): Promise<any> {
    const benchmark = {
      conceptQuery: 0,
      patternQuery: 0,
      memoryBaseline: process.memoryUsage().heapUsed,
      memoryDelta: 0
    };

    // Concept query benchmark
    const conceptStart = Date.now();
    this.database.getSemanticConcepts();
    benchmark.conceptQuery = Date.now() - conceptStart;

    // Pattern query benchmark
    const patternStart = Date.now();
    this.database.getDeveloperPatterns();
    benchmark.patternQuery = Date.now() - patternStart;

    // Memory after operations
    const memoryAfter = process.memoryUsage().heapUsed;
    benchmark.memoryDelta = Math.round((memoryAfter - benchmark.memoryBaseline) / 1024);

    return benchmark;
  }
}