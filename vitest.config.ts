import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
    test: {
        // Test environment
        environment: 'node',

        // Global test configuration
        globals: true,

        // Test file patterns
        include: [
            'src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
        ],

        // Exclude patterns
        exclude: [
            '**/node_modules/**',
            '**/dist/**',
            '**/rust-core/target/**',
            '**/temp/**',
            '**/tests/**', // Manual integration tests
        ],

        // Coverage configuration
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html', 'lcov'],
            include: ['src/**/*.{js,ts}'],
            exclude: [
                'src/**/*.{test,spec}.{js,ts}',
                'src/__tests__/**',
                'src/**/__mocks__/**',
                'src/types/**',
                'dist/**',
            ],
            thresholds: {
                lines: 60,
                functions: 60,
                branches: 60,
                statements: 60,
            },
        },

        // Test execution
        testTimeout: 30000, // 30 seconds for complex operations
        hookTimeout: 10000, // 10 seconds for setup/teardown

        // Reporters
        reporters: ['verbose'],

        // Parallel execution
        maxConcurrency: 5,

        // Mock configuration
        mockReset: true,
        restoreMocks: true,
        clearMocks: true,

        // Setup files
        setupFiles: ['./src/__tests__/setup.ts'],
    },

    resolve: {
        alias: {
            '@': resolve(__dirname, './src'),
            '@tests': resolve(__dirname, './src/__tests__'),
        },
    },
});
