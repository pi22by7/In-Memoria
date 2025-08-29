/**
 * Circuit Breaker pattern implementation for external API calls
 * Protects against cascading failures and provides fallback mechanisms
 */

export enum CircuitState {
  CLOSED = 'CLOSED',     // Normal operation
  OPEN = 'OPEN',         // Circuit is open, calls fail fast
  HALF_OPEN = 'HALF_OPEN' // Testing if service is back
}

export interface CircuitBreakerOptions {
  failureThreshold: number;    // Number of failures before opening
  recoveryTimeout: number;     // Time to wait before half-open (ms)
  requestTimeout: number;      // Individual request timeout (ms)
  monitoringWindow: number;    // Time window for failure counting (ms)
}

export interface CircuitBreakerStats {
  state: CircuitState;
  failures: number;
  successes: number;
  lastFailureTime?: number;
  totalRequests: number;
}

export interface ErrorDetails {
  message: string;
  state: CircuitState;
  failures: number;
  lastFailureTime?: number;
  successRate: number;
  timeSinceLastFailure?: number;
  stats: CircuitBreakerStats;
}

export class CircuitBreakerError extends Error {
  public readonly details: ErrorDetails;
  public readonly options: CircuitBreakerOptions;
  
  constructor(message: string, details: any, options: CircuitBreakerOptions) {
    super(message);
    this.name = 'CircuitBreakerError';
    this.details = details;
    this.options = options;
  }
  
  toString(): string {
    return `${this.name}: ${this.message}\nDetails: ${JSON.stringify(this.details, null, 2)}`;
  }
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failures: number = 0;
  private successes: number = 0;
  private lastFailureTime?: number;
  private totalRequests: number = 0;
  private requestTimeouts: number[] = [];

  constructor(private options: CircuitBreakerOptions) {}

  async execute<T>(operation: () => Promise<T>, fallback?: () => Promise<T>): Promise<T> {
    this.totalRequests++;

    // Clean old failure records outside monitoring window
    this.cleanOldFailures();

    // Fast fail if circuit is open
    if (this.state === CircuitState.OPEN) {
      if (this.canAttemptReset()) {
        this.state = CircuitState.HALF_OPEN;
      } else {
        // Don't mask the real error - provide detailed failure information
        const errorDetails = this.getDetailedErrorInfo();
        if (fallback) {
          console.warn(`Circuit breaker OPEN: ${errorDetails.message}. Using fallback.`);
          return await fallback();
        }
        // Throw a proper error with context instead of generic message
        throw new CircuitBreakerError(
          'Circuit breaker is OPEN',
          errorDetails,
          this.options
        );
      }
    }

    try {
      // Execute with timeout
      const result = await this.executeWithTimeout(operation, this.options.requestTimeout);
      
      // Success
      this.onSuccess();
      return result;
    } catch (error) {
      // Failure - preserve original error details
      this.onFailure();
      
      // Try fallback
      if (fallback) {
        try {
          console.warn(`Primary operation failed: ${error instanceof Error ? error.message : String(error)}. Using fallback.`);
          return await fallback();
        } catch (fallbackError: unknown) {
          // Throw the original error with fallback context, not just original error
          throw new CircuitBreakerError(
            'Both primary and fallback operations failed',
            {
              primaryError: error instanceof Error ? error.message : String(error),
              fallbackError: fallbackError instanceof Error ? fallbackError.message : String(fallbackError),
              state: this.state,
              failures: this.failures,
              stats: this.getStats()
            },
            this.options
          );
        }
      }
      
      // No fallback - throw original error with circuit context
      throw error;
    }
  }

  private async executeWithTimeout<T>(
    operation: () => Promise<T>, 
    timeoutMs: number
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Operation timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      operation()
        .then(result => {
          clearTimeout(timeoutId);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  }

  private onSuccess(): void {
    this.successes++;
    
    if (this.state === CircuitState.HALF_OPEN) {
      // Reset to closed after successful test
      this.state = CircuitState.CLOSED;
      this.failures = 0;
      this.requestTimeouts = [];
    }
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();
    this.requestTimeouts.push(this.lastFailureTime);

    // Open circuit if threshold exceeded
    if (this.failures >= this.options.failureThreshold) {
      this.state = CircuitState.OPEN;
    }
  }

  private canAttemptReset(): boolean {
    return this.lastFailureTime !== undefined && 
           Date.now() - this.lastFailureTime >= this.options.recoveryTimeout;
  }

  private cleanOldFailures(): void {
    const cutoff = Date.now() - this.options.monitoringWindow;
    this.requestTimeouts = this.requestTimeouts.filter(time => time > cutoff);
    this.failures = this.requestTimeouts.length;
  }

  getStats(): CircuitBreakerStats {
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      lastFailureTime: this.lastFailureTime,
      totalRequests: this.totalRequests
    };
  }

  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failures = 0;
    this.successes = 0;
    this.lastFailureTime = undefined;
    this.totalRequests = 0;
    this.requestTimeouts = [];
  }

  private getDetailedErrorInfo(): ErrorDetails {
    const successRate = this.totalRequests > 0 
      ? this.successes / this.totalRequests 
      : 0;
    
    const timeSinceLastFailure = this.lastFailureTime
      ? Date.now() - this.lastFailureTime
      : undefined;

    return {
      message: `Circuit breaker is ${this.state}. Failures: ${this.failures}/${this.options.failureThreshold}`,
      state: this.state,
      failures: this.failures,
      lastFailureTime: this.lastFailureTime,
      successRate,
      timeSinceLastFailure,
      stats: this.getStats()
    };
  }
}

// Pre-configured circuit breakers for common services
export const createOpenAICircuitBreaker = (): CircuitBreaker => {
  return new CircuitBreaker({
    failureThreshold: 5,      // 5 failures
    recoveryTimeout: 30000,   // 30 seconds
    requestTimeout: 30000,    // 30 seconds per request
    monitoringWindow: 300000  // 5 minute window
  });
};

export const createRustAnalyzerCircuitBreaker = (): CircuitBreaker => {
  return new CircuitBreaker({
    failureThreshold: 3,      // 3 failures (Rust should be more reliable)
    recoveryTimeout: 5000,    // 5 seconds
    requestTimeout: 60000,    // 60 seconds for complex analysis
    monitoringWindow: 120000  // 2 minute window
  });
};