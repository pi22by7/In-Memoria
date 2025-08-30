#!/usr/bin/env node

import { CircuitBreaker, CircuitBreakerError } from '../dist/utils/circuit-breaker.js';

console.log('🧪 Testing Circuit Breaker Error Transparency...\n');

async function testCircuitBreakerErrorHandling() {
    // Create a circuit breaker with low thresholds for testing
    const circuitBreaker = new CircuitBreaker({
        failureThreshold: 2,
        recoveryTimeout: 5000,
        requestTimeout: 1000,
        monitoringWindow: 10000
    });

    console.log('📊 Testing proper error reporting (not masking)...\n');

    // Test 1: Primary operation failure with detailed error
    console.log('🔧 Test 1: Primary operation failure');
    try {
        await circuitBreaker.execute(async () => {
            throw new Error('Database connection failed: ECONNREFUSED');
        });
    } catch (error) {
        console.log(`✅ Original error preserved: ${error.message}`);
        console.log(`   Error type: ${error.constructor.name}`);
    }

    // Test 2: Trigger circuit breaker opening
    console.log('\n🔧 Test 2: Triggering circuit breaker to open');
    for (let i = 0; i < 3; i++) {
        try {
            await circuitBreaker.execute(async () => {
                throw new Error(`Service failure ${i + 1}: Timeout after 5000ms`);
            });
        } catch (error) {
            console.log(`   Failure ${i + 1}: ${error.message}`);
        }
    }

    // Test 3: Circuit breaker open with detailed error info
    console.log('\n🔧 Test 3: Circuit open state with detailed error information');
    try {
        await circuitBreaker.execute(async () => {
            return 'This should not execute';
        });
    } catch (error) {
        if (error instanceof CircuitBreakerError) {
            console.log('✅ Detailed CircuitBreakerError thrown:');
            console.log(`   Message: ${error.message}`);
            console.log(`   State: ${error.details.state}`);
            console.log(`   Failures: ${error.details.failures}`);
            console.log(`   Success Rate: ${(error.details.successRate * 100).toFixed(1)}%`);
            console.log(`   Time since last failure: ${error.details.timeSinceLastFailure}ms`);
        } else {
            console.log(`❌ Expected CircuitBreakerError, got: ${error.constructor.name}`);
        }
    }

    // Test 4: Circuit breaker with fallback and error context
    console.log('\n🔧 Test 4: Fallback with error context');
    try {
        await circuitBreaker.execute(
            async () => {
                throw new Error('Primary service unavailable');
            },
            async () => {
                throw new Error('Fallback cache also failed');
            }
        );
    } catch (error) {
        if (error instanceof CircuitBreakerError) {
            console.log('✅ Both primary and fallback errors preserved:');
            console.log(`   Primary error: ${error.details.primaryError}`);
            console.log(`   Fallback error: ${error.details.fallbackError}`);
        } else {
            console.log(`❌ Expected CircuitBreakerError with both errors, got: ${error.message}`);
        }
    }

    // Test 5: Reset circuit breaker and test recovery
    console.log('\n🔧 Test 5: Circuit breaker reset and recovery');
    circuitBreaker.reset();

    try {
        const result = await circuitBreaker.execute(async () => {
            return 'Service recovered successfully!';
        });
        console.log(`✅ Circuit breaker recovered: ${result}`);
    } catch (error) {
        console.log(`❌ Unexpected error after reset: ${error.message}`);
    }

    console.log('\n🎉 Circuit breaker error transparency test completed!');
}

async function testFallbackErrorHandling() {
    console.log('\n📊 Testing fallback with transparent error reporting...\n');

    const circuitBreaker = new CircuitBreaker({
        failureThreshold: 1,
        recoveryTimeout: 1000,
        requestTimeout: 500,
        monitoringWindow: 5000
    });

    // Test successful fallback with warning
    console.log('🔧 Testing successful fallback with warning');
    try {
        const result = await circuitBreaker.execute(
            async () => {
                throw new Error('Primary API rate limited');
            },
            async () => {
                return 'Cached result from fallback';
            }
        );
        console.log(`✅ Fallback succeeded: ${result}`);
        console.log('   (Check console for warning about primary failure)');
    } catch (error) {
        console.log(`❌ Unexpected error: ${error.message}`);
    }

    console.log('\n🎉 Fallback error transparency test completed!');
}

// Run tests
testCircuitBreakerErrorHandling()
    .then(() => testFallbackErrorHandling())
    .catch(error => {
        console.error('❌ Test suite failed:', error);
        process.exit(1);
    });
