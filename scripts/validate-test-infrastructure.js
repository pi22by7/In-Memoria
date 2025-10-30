#!/usr/bin/env node

/**
 * Test Infrastructure Validation Script
 * 
 * Validates that the test consolidation is properly set up
 */

import { existsSync } from 'fs';
import { readFileSync } from 'fs';

const REQUIRED_FILES = [
    {
        path: 'vitest.config.ts',
        description: 'Vitest configuration',
        category: 'config'
    },
    {
        path: 'src/__tests__/setup.ts',
        description: 'Global test setup',
        category: 'infrastructure'
    },
    {
        path: 'src/__tests__/helpers/test-utils.ts',
        description: 'Test utilities',
        category: 'infrastructure'
    },
    {
        path: 'src/__tests__/helpers/mock-data.ts',
        description: 'Mock data generators',
        category: 'infrastructure'
    },
    {
        path: 'src/__tests__/helpers/test-reporter.ts',
        description: 'Test reporter',
        category: 'infrastructure'
    },
    {
        path: 'tests/run-all.js',
        description: 'Enhanced test runner',
        category: 'runner'
    },
    {
        path: 'docs/TESTING_STRATEGY.md',
        description: 'Testing strategy documentation',
        category: 'documentation'
    },
    {
        path: 'docs/TEST_CONSOLIDATION_SUMMARY.md',
        description: 'Consolidation summary',
        category: 'documentation'
    },
    {
        path: 'tests/README.md',
        description: 'Test directory documentation',
        category: 'documentation'
    },
    {
        path: '.github/workflows/tests.yml',
        description: 'CI/CD test workflow',
        category: 'ci'
    }
];

const REQUIRED_SCRIPTS = [
    'test',
    'test:watch',
    'test:ui',
    'test:unit',
    'test:coverage',
    'test:integration',
    'test:manual',
    'test:all'
];

function checkFile(file) {
    const exists = existsSync(file.path);
    const status = exists ? '✅' : '❌';
    console.log(`  ${status} ${file.path} - ${file.description}`);
    return exists;
}

function checkPackageScripts() {
    const packageJson = JSON.parse(readFileSync('package.json', 'utf-8'));
    const scripts = packageJson.scripts || {};

    let allPresent = true;

    for (const script of REQUIRED_SCRIPTS) {
        const exists = script in scripts;
        const status = exists ? '✅' : '❌';
        console.log(`  ${status} ${script}`);
        if (!exists) allPresent = false;
    }

    return allPresent;
}

function validateTestInfrastructure() {
    console.log('🔍 Validating Test Infrastructure\n');

    const results = {
        config: [],
        infrastructure: [],
        runner: [],
        documentation: [],
        ci: []
    };

    // Check files
    console.log('📁 Checking required files...\n');

    for (const file of REQUIRED_FILES) {
        const exists = checkFile(file);
        results[file.category].push({ file: file.path, exists });
    }

    console.log('\n📦 Checking package.json scripts...\n');
    const scriptsValid = checkPackageScripts();

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 VALIDATION SUMMARY');
    console.log('='.repeat(60) + '\n');

    let totalChecks = 0;
    let passedChecks = 0;

    for (const [category, checks] of Object.entries(results)) {
        const passed = checks.filter(c => c.exists).length;
        const total = checks.length;
        totalChecks += total;
        passedChecks += passed;

        const status = passed === total ? '✅' : '⚠️';
        console.log(`${status} ${category.toUpperCase()}: ${passed}/${total}`);
    }

    if (scriptsValid) {
        console.log(`✅ SCRIPTS: ${REQUIRED_SCRIPTS.length}/${REQUIRED_SCRIPTS.length}`);
        passedChecks += REQUIRED_SCRIPTS.length;
        totalChecks += REQUIRED_SCRIPTS.length;
    } else {
        console.log(`⚠️ SCRIPTS: Missing some required scripts`);
        totalChecks += REQUIRED_SCRIPTS.length;
    }

    console.log('\n' + '='.repeat(60));

    const allValid = passedChecks === totalChecks;

    if (allValid) {
        console.log('✅ All validation checks passed!\n');
        console.log('🚀 Test infrastructure is ready to use.\n');
        console.log('Next steps:');
        console.log('  1. Run: npm test');
        console.log('  2. Run: npm run test:coverage');
        console.log('  3. Review: docs/TESTING_STRATEGY.md');
        return 0;
    } else {
        console.log(`⚠️ ${totalChecks - passedChecks} validation checks failed.\n`);
        console.log('Please review the errors above and ensure all required files are present.');
        return 1;
    }
}

// Run validation
const exitCode = validateTestInfrastructure();
process.exit(exitCode);
