/**
 * Global test setup file
 * This file runs before all tests
 */

import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

// Global test state
let globalTempDir: string | null = null;

/**
 * Setup before all tests
 */
beforeAll(() => {
    console.log('🧪 Starting In-Memoria test suite...\n');

    // Create global temp directory for test artifacts
    globalTempDir = mkdtempSync(join(tmpdir(), 'in-memoria-tests-'));

    // Set test environment variables
    process.env.NODE_ENV = 'test';
    process.env.IN_MEMORIA_TEST_MODE = 'true';
});

/**
 * Cleanup after all tests
 */
afterAll(() => {
    console.log('\n✅ Test suite completed\n');

    // Cleanup global temp directory
    if (globalTempDir && existsSync(globalTempDir)) {
        try {
            rmSync(globalTempDir, { recursive: true, force: true });
        } catch (error) {
            console.warn('Failed to cleanup global temp directory:', error);
        }
    }

    // Cleanup environment variables
    delete process.env.IN_MEMORIA_DB_PATH;
    delete process.env.IN_MEMORIA_TEST_MODE;
});

/**
 * Setup before each test
 */
beforeEach(() => {
    // Reset any global state if needed
});

/**
 * Cleanup after each test
 */
afterEach(() => {
    // Cleanup test-specific resources
    delete process.env.IN_MEMORIA_DB_PATH;
});

// Export utilities for tests
export function createTestTempDir(prefix: string = 'test-'): string {
    return mkdtempSync(join(tmpdir(), `in-memoria-${prefix}-`));
}

export function cleanupTestTempDir(dir: string): void {
    if (existsSync(dir)) {
        rmSync(dir, { recursive: true, force: true });
    }
}

export function getGlobalTempDir(): string {
    if (!globalTempDir) {
        throw new Error('Global temp directory not initialized');
    }
    return globalTempDir;
}
