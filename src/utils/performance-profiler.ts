/**
 * Performance profiling and optimization utilities for In Memoria
 * Helps identify and optimize hot paths in the codebase
 */

export interface PerformanceMetric {
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  metadata?: Record<string, any>;
}

export interface ProfileResult {
  totalDuration: number;
  operationCount: number;
  averageDuration: number;
  slowestOperations: PerformanceMetric[];
  metrics: PerformanceMetric[];
}

/**
 * Simple performance profiler for identifying bottlenecks
 */
export class PerformanceProfiler {
  private metrics: Map<string, PerformanceMetric[]> = new Map();
  private activeOperations: Map<string, PerformanceMetric> = new Map();

  /**
   * Start timing an operation
   */
  startOperation(name: string, metadata?: Record<string, any>): string {
    const operationId = `${name}_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const metric: PerformanceMetric = {
      name,
      startTime: performance.now(),
      metadata
    };
    
    this.activeOperations.set(operationId, metric);
    return operationId;
  }

  /**
   * End timing an operation
   */
  endOperation(operationId: string): PerformanceMetric | null {
    const metric = this.activeOperations.get(operationId);
    if (!metric) {
      console.warn(`No active operation found for ID: ${operationId}`);
      return null;
    }

    metric.endTime = performance.now();
    metric.duration = metric.endTime - metric.startTime;

    // Store in metrics collection
    const operationMetrics = this.metrics.get(metric.name) || [];
    operationMetrics.push(metric);
    this.metrics.set(metric.name, operationMetrics);

    this.activeOperations.delete(operationId);
    return metric;
  }

  /**
   * Time a synchronous operation
   */
  timeSync<T>(name: string, operation: () => T, metadata?: Record<string, any>): T {
    const operationId = this.startOperation(name, metadata);
    try {
      const result = operation();
      return result;
    } finally {
      this.endOperation(operationId);
    }
  }

  /**
   * Time an asynchronous operation
   */
  async timeAsync<T>(name: string, operation: () => Promise<T>, metadata?: Record<string, any>): Promise<T> {
    const operationId = this.startOperation(name, metadata);
    try {
      const result = await operation();
      return result;
    } finally {
      this.endOperation(operationId);
    }
  }

  /**
   * Get performance profile for a specific operation
   */
  getProfile(operationName: string): ProfileResult | null {
    const metrics = this.metrics.get(operationName);
    if (!metrics || metrics.length === 0) {
      return null;
    }

    const totalDuration = metrics.reduce((sum, metric) => sum + (metric.duration || 0), 0);
    const operationCount = metrics.length;
    const averageDuration = totalDuration / operationCount;

    // Find slowest operations
    const slowestOperations = [...metrics]
      .filter(m => m.duration !== undefined)
      .sort((a, b) => (b.duration || 0) - (a.duration || 0))
      .slice(0, 5);

    return {
      totalDuration,
      operationCount,
      averageDuration,
      slowestOperations,
      metrics: [...metrics]
    };
  }

  /**
   * Get all performance profiles
   */
  getAllProfiles(): Record<string, ProfileResult> {
    const profiles: Record<string, ProfileResult> = {};
    
    for (const operationName of this.metrics.keys()) {
      const profile = this.getProfile(operationName);
      if (profile) {
        profiles[operationName] = profile;
      }
    }

    return profiles;
  }

  /**
   * Get summary of all performance metrics
   */
  getSummary(): {
    totalOperations: number;
    totalTime: number;
    operationTypes: number;
    slowestOperation: PerformanceMetric | null;
    fastestOperation: PerformanceMetric | null;
  } {
    let totalOperations = 0;
    let totalTime = 0;
    let slowestOperation: PerformanceMetric | null = null;
    let fastestOperation: PerformanceMetric | null = null;

    for (const metrics of this.metrics.values()) {
      totalOperations += metrics.length;
      
      for (const metric of metrics) {
        if (metric.duration !== undefined) {
          totalTime += metric.duration;
          
          if (!slowestOperation || metric.duration > (slowestOperation.duration || 0)) {
            slowestOperation = metric;
          }
          
          if (!fastestOperation || metric.duration < (fastestOperation.duration || 0)) {
            fastestOperation = metric;
          }
        }
      }
    }

    return {
      totalOperations,
      totalTime,
      operationTypes: this.metrics.size,
      slowestOperation,
      fastestOperation
    };
  }

  /**
   * Clear all metrics
   */
  clear(): void {
    this.metrics.clear();
    this.activeOperations.clear();
  }

  /**
   * Generate performance report
   */
  generateReport(): string {
    const summary = this.getSummary();
    const profiles = this.getAllProfiles();

    const lines = [
      '🔍 Performance Profile Report',
      '================================',
      '',
      '📊 Summary:',
      `   Total Operations: ${summary.totalOperations}`,
      `   Total Time: ${summary.totalTime.toFixed(2)}ms`,
      `   Operation Types: ${summary.operationTypes}`,
      `   Average Time/Op: ${summary.totalOperations > 0 ? (summary.totalTime / summary.totalOperations).toFixed(2) : 0}ms`,
      ''
    ];

    if (summary.slowestOperation) {
      lines.push(
        '🐌 Slowest Operation:',
        `   ${summary.slowestOperation.name}: ${summary.slowestOperation.duration?.toFixed(2)}ms`,
        ''
      );
    }

    if (summary.fastestOperation) {
      lines.push(
        '⚡ Fastest Operation:',
        `   ${summary.fastestOperation.name}: ${summary.fastestOperation.duration?.toFixed(2)}ms`,
        ''
      );
    }

    lines.push('📈 Operation Profiles:');
    for (const [name, profile] of Object.entries(profiles)) {
      lines.push(
        `   ${name}:`,
        `     Count: ${profile.operationCount}`,
        `     Total: ${profile.totalDuration.toFixed(2)}ms`,
        `     Average: ${profile.averageDuration.toFixed(2)}ms`,
        `     Slowest: ${profile.slowestOperations[0]?.duration?.toFixed(2) || 0}ms`,
        ''
      );
    }

    return lines.join('\n');
  }
}

/**
 * Global performance profiler instance
 */
export const globalProfiler = new PerformanceProfiler();

/**
 * Decorator for timing class methods
 */
export function timed(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
  const originalMethod = descriptor.value;

  descriptor.value = function(...args: any[]) {
    const className = this.constructor.name;
    const operationName = `${className}.${propertyKey}`;
    
    if (originalMethod.constructor.name === 'AsyncFunction') {
      return globalProfiler.timeAsync(operationName, () => originalMethod.apply(this, args));
    } else {
      return globalProfiler.timeSync(operationName, () => originalMethod.apply(this, args));
    }
  };

  return descriptor;
}

/**
 * Performance optimization utilities
 */
export class PerformanceOptimizer {
  /**
   * Debounce function calls to reduce frequency
   */
  static debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number
  ): (...args: Parameters<T>) => void {
    let timeout: NodeJS.Timeout | null = null;
    
    return (...args: Parameters<T>) => {
      if (timeout) {
        clearTimeout(timeout);
      }
      
      timeout = setTimeout(() => {
        func(...args);
      }, wait);
    };
  }

  /**
   * Throttle function calls to limit frequency
   */
  static throttle<T extends (...args: any[]) => any>(
    func: T,
    limit: number
  ): (...args: Parameters<T>) => void {
    let inThrottle: boolean = false;
    
    return (...args: Parameters<T>) => {
      if (!inThrottle) {
        func(...args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }

  /**
   * Memoize function results for performance
   */
  static memoize<T extends (...args: any[]) => any>(
    func: T,
    getKey?: (...args: Parameters<T>) => string
  ): T {
    const cache = new Map<string, ReturnType<T>>();
    
    return ((...args: Parameters<T>) => {
      const key = getKey ? getKey(...args) : JSON.stringify(args);
      
      if (cache.has(key)) {
        return cache.get(key);
      }
      
      const result = func(...args);
      cache.set(key, result);
      return result;
    }) as T;
  }

  /**
   * Batch multiple operations together
   */
  static createBatcher<T, R>(
    batchProcessor: (items: T[]) => Promise<R[]>,
    batchSize: number = 10,
    batchDelay: number = 10
  ) {
    let batch: T[] = [];
    let resolvers: Array<(value: R) => void> = [];
    let rejectors: Array<(error: any) => void> = [];
    let timeoutId: NodeJS.Timeout | null = null;

    const processBatch = async () => {
      if (batch.length === 0) return;

      const currentBatch = [...batch];
      const currentResolvers = [...resolvers];
      const currentRejectors = [...rejectors];

      batch = [];
      resolvers = [];
      rejectors = [];

      try {
        const results = await batchProcessor(currentBatch);
        results.forEach((result, index) => {
          currentResolvers[index]?.(result);
        });
      } catch (error) {
        currentRejectors.forEach(reject => reject(error));
      }
    };

    const scheduleBatch = () => {
      if (timeoutId) return;
      
      timeoutId = setTimeout(() => {
        timeoutId = null;
        processBatch();
      }, batchDelay);
    };

    return (item: T): Promise<R> => {
      return new Promise<R>((resolve, reject) => {
        batch.push(item);
        resolvers.push(resolve);
        rejectors.push(reject);

        if (batch.length >= batchSize) {
          if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = null;
          }
          processBatch();
        } else {
          scheduleBatch();
        }
      });
    };
  }
}