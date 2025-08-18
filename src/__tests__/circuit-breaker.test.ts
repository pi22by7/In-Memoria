import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CircuitBreaker, CircuitState, createOpenAICircuitBreaker, createRustAnalyzerCircuitBreaker } from '../utils/circuit-breaker.js';

describe('CircuitBreaker', () => {
  let circuitBreaker: CircuitBreaker;

  beforeEach(() => {
    circuitBreaker = new CircuitBreaker({
      failureThreshold: 3,
      recoveryTimeout: 100,
      requestTimeout: 50,
      monitoringWindow: 1000
    });
  });

  describe('basic functionality', () => {
    it('should start in CLOSED state', () => {
      const stats = circuitBreaker.getStats();
      expect(stats.state).toBe(CircuitState.CLOSED);
      expect(stats.failures).toBe(0);
      expect(stats.successes).toBe(0);
    });

    it('should execute successful operations', async () => {
      const operation = vi.fn().mockResolvedValue('success');
      
      const result = await circuitBreaker.execute(operation);
      
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
      
      const stats = circuitBreaker.getStats();
      expect(stats.successes).toBe(1);
      expect(stats.state).toBe(CircuitState.CLOSED);
    });

    it('should handle operation failures', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('Operation failed'));
      
      await expect(circuitBreaker.execute(operation)).rejects.toThrow('Operation failed');
      
      const stats = circuitBreaker.getStats();
      expect(stats.failures).toBe(1);
      expect(stats.state).toBe(CircuitState.CLOSED);
    });
  });

  describe('circuit opening', () => {
    it('should open circuit after failure threshold', async () => {
      const failingOperation = vi.fn().mockRejectedValue(new Error('Failure'));
      
      // Fail 3 times to reach threshold
      for (let i = 0; i < 3; i++) {
        await expect(circuitBreaker.execute(failingOperation)).rejects.toThrow();
      }
      
      const stats = circuitBreaker.getStats();
      expect(stats.state).toBe(CircuitState.OPEN);
      expect(stats.failures).toBe(3);
    });

    it('should fail fast when circuit is open', async () => {
      const failingOperation = vi.fn().mockRejectedValue(new Error('Failure'));
      
      // Open the circuit
      for (let i = 0; i < 3; i++) {
        await expect(circuitBreaker.execute(failingOperation)).rejects.toThrow();
      }
      
      // Next call should fail fast
      const fastOperation = vi.fn().mockResolvedValue('success');
      await expect(circuitBreaker.execute(fastOperation)).rejects.toThrow('Circuit breaker is OPEN');
      
      // Operation should not have been called
      expect(fastOperation).not.toHaveBeenCalled();
    });
  });

  describe('fallback functionality', () => {
    it('should use fallback when operation fails', async () => {
      const failingOperation = vi.fn().mockRejectedValue(new Error('Primary failed'));
      const fallback = vi.fn().mockResolvedValue('fallback result');
      
      const result = await circuitBreaker.execute(failingOperation, fallback);
      
      expect(result).toBe('fallback result');
      expect(failingOperation).toHaveBeenCalledTimes(1);
      expect(fallback).toHaveBeenCalledTimes(1);
    });

    it('should use fallback when circuit is open', async () => {
      // Open the circuit
      const failingOperation = vi.fn().mockRejectedValue(new Error('Failure'));
      for (let i = 0; i < 3; i++) {
        await expect(circuitBreaker.execute(failingOperation)).rejects.toThrow();
      }
      
      // Now try with fallback
      const operation = vi.fn().mockResolvedValue('success');
      const fallback = vi.fn().mockResolvedValue('fallback result');
      
      const result = await circuitBreaker.execute(operation, fallback);
      
      expect(result).toBe('fallback result');
      expect(operation).not.toHaveBeenCalled();
      expect(fallback).toHaveBeenCalledTimes(1);
    });

    it('should throw original error if fallback also fails', async () => {
      const primaryOperation = vi.fn().mockRejectedValue(new Error('Primary failed'));
      const fallback = vi.fn().mockRejectedValue(new Error('Fallback failed'));
      
      await expect(circuitBreaker.execute(primaryOperation, fallback)).rejects.toThrow('Primary failed');
    });
  });

  describe('half-open state and recovery', () => {
    it('should transition to HALF_OPEN after recovery timeout', async () => {
      // Open the circuit
      const failingOperation = vi.fn().mockRejectedValue(new Error('Failure'));
      for (let i = 0; i < 3; i++) {
        await expect(circuitBreaker.execute(failingOperation)).rejects.toThrow();
      }
      
      expect(circuitBreaker.getStats().state).toBe(CircuitState.OPEN);
      
      // Wait for recovery timeout
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Next operation should transition to HALF_OPEN
      const successOperation = vi.fn().mockResolvedValue('success');
      const result = await circuitBreaker.execute(successOperation);
      
      expect(result).toBe('success');
      expect(circuitBreaker.getStats().state).toBe(CircuitState.CLOSED);
    });

    it('should stay closed after successful recovery', async () => {
      // Open the circuit
      const failingOperation = vi.fn().mockRejectedValue(new Error('Failure'));
      for (let i = 0; i < 3; i++) {
        await expect(circuitBreaker.execute(failingOperation)).rejects.toThrow();
      }
      
      // Wait and recover
      await new Promise(resolve => setTimeout(resolve, 150));
      
      const successOperation = vi.fn().mockResolvedValue('success');
      await circuitBreaker.execute(successOperation);
      
      expect(circuitBreaker.getStats().state).toBe(CircuitState.CLOSED);
      
      // Should stay closed for subsequent operations
      await circuitBreaker.execute(successOperation);
      expect(circuitBreaker.getStats().state).toBe(CircuitState.CLOSED);
    });
  });

  describe('timeout handling', () => {
    it('should timeout long-running operations', async () => {
      const slowOperation = () => new Promise(resolve => setTimeout(resolve, 200));
      
      await expect(circuitBreaker.execute(slowOperation)).rejects.toThrow('Operation timed out after 50ms');
      
      const stats = circuitBreaker.getStats();
      expect(stats.failures).toBe(1);
    });
  });

  describe('reset functionality', () => {
    it('should reset circuit state and statistics', async () => {
      // Generate some activity
      const failingOperation = vi.fn().mockRejectedValue(new Error('Failure'));
      await expect(circuitBreaker.execute(failingOperation)).rejects.toThrow();
      
      circuitBreaker.reset();
      
      const stats = circuitBreaker.getStats();
      expect(stats.state).toBe(CircuitState.CLOSED);
      expect(stats.failures).toBe(0);
      expect(stats.successes).toBe(0);
      expect(stats.totalRequests).toBe(0);
    });
  });
});

describe('Pre-configured Circuit Breakers', () => {
  describe('createOpenAICircuitBreaker', () => {
    it('should create circuit breaker with appropriate settings', () => {
      const cb = createOpenAICircuitBreaker();
      const stats = cb.getStats();
      
      expect(stats.state).toBe(CircuitState.CLOSED);
      // Should be configured for external API calls (more tolerant)
    });
  });

  describe('createRustAnalyzerCircuitBreaker', () => {
    it('should create circuit breaker with appropriate settings', () => {
      const cb = createRustAnalyzerCircuitBreaker();
      const stats = cb.getStats();
      
      expect(stats.state).toBe(CircuitState.CLOSED);
      // Should be configured for internal operations (less tolerant)
    });
  });
});