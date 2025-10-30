#!/usr/bin/env node

import { spawn } from 'child_process';
import { readdir, stat } from 'fs/promises';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const TESTS_TO_SKIP = ['run-all.js', 'run-comprehensive-tests.js', 'README.md', 'in-memoria.db'];

async function runTest(testFile, testPath) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🧪 Running: ${testFile}`);
  console.log(`${'='.repeat(60)}\n`);

  return new Promise((resolve) => {
    const child = spawn('node', [testPath], {
      stdio: 'inherit',
      cwd: process.cwd(),
      timeout: 60000 // 60 second timeout
    });

    child.on('close', (code) => {
      if (code === 0) {
        console.log(`\n✅ ${testFile} completed successfully`);
      } else {
        console.log(`\n❌ ${testFile} failed with code ${code}`);
      }
      resolve(code);
    });

    child.on('error', (error) => {
      console.error(`\n💥 ${testFile} error:`, error.message);
      resolve(1);
    });
  });
}

async function getTestFiles(directory, filter = null) {
  const entries = await readdir(directory);
  const testFiles = [];

  for (const entry of entries) {
    const fullPath = join(directory, entry);
    const stats = await stat(fullPath);

    if (stats.isDirectory() && entry === 'integration' && (!filter || filter === 'integration')) {
      // Get integration tests
      const integrationFiles = await readdir(fullPath);
      for (const file of integrationFiles) {
        if (file.endsWith('.js') && !TESTS_TO_SKIP.includes(file)) {
          testFiles.push({
            name: `integration/${file}`,
            path: join(fullPath, file),
            category: 'integration'
          });
        }
      }
    } else if (stats.isFile() &&
      entry.startsWith('test-') &&
      entry.endsWith('.js') &&
      !TESTS_TO_SKIP.includes(entry)) {

      // Skip if filter is set to integration only
      if (filter === 'integration') continue;

      testFiles.push({
        name: entry,
        path: fullPath,
        category: 'manual'
      });
    }
  }

  return testFiles;
}

async function runAllTests(filter = null) {
  const filterText = filter ? ` (${filter} only)` : '';
  console.log(`🚀 Running manual & integration tests${filterText}...\n`);
  console.log('ℹ️  Make sure to run "npm run build" first!\n');

  try {
    const testFiles = await getTestFiles(__dirname, filter);

    if (testFiles.length === 0) {
      console.log(`No test files found${filterText}!`);
      process.exit(1);
    }

    // Group by category
    const byCategory = testFiles.reduce((acc, test) => {
      if (!acc[test.category]) acc[test.category] = [];
      acc[test.category].push(test);
      return acc;
    }, {});

    console.log(`Found ${testFiles.length} test files:\n`);
    for (const [category, tests] of Object.entries(byCategory)) {
      console.log(`  ${category.toUpperCase()}:`);
      tests.forEach(test => console.log(`    - ${test.name}`));
    }
    console.log();

    let passed = 0;
    let failed = 0;
    const failedTests = [];

    // Run integration tests first
    if (byCategory.integration) {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`📦 INTEGRATION TESTS`);
      console.log(`${'='.repeat(60)}\n`);

      for (const test of byCategory.integration) {
        const result = await runTest(test.name, test.path);
        if (result === 0) {
          passed++;
        } else {
          failed++;
          failedTests.push(test.name);
        }
      }
    }

    // Then run manual tests
    if (byCategory.manual) {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`🔧 MANUAL TESTS`);
      console.log(`${'='.repeat(60)}\n`);

      for (const test of byCategory.manual) {
        const result = await runTest(test.name, test.path);
        if (result === 0) {
          passed++;
        } else {
          failed++;
          failedTests.push(test.name);
        }
      }
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log(`📊 TEST SUMMARY`);
    console.log(`${'='.repeat(60)}`);
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`📊 Total:  ${passed + failed}`);

    if (failed > 0) {
      console.log(`\n⚠️  Failed tests:`);
      failedTests.forEach(test => console.log(`   - ${test}`));
      console.log(`\n⚠️  Some tests failed. Check output above for details.`);
      process.exit(1);
    } else {
      console.log(`\n🎉 All tests passed!`);
      process.exit(0);
    }

  } catch (error) {
    console.error('Error running tests:', error);
    process.exit(1);
  }
}

// Handle command line arguments
const args = process.argv.slice(2);

if (args.length > 0) {
  const firstArg = args[0];

  // Check if it's a filter argument
  if (firstArg === 'integration' || firstArg === 'manual') {
    console.log(`🎯 Filtering tests: ${firstArg}\n`);
    runAllTests(firstArg);
  } else if (firstArg.startsWith('test-') && firstArg.endsWith('.js')) {
    // Run specific test file
    console.log(`🧪 Running specific test: ${firstArg}\n`);
    runTest(firstArg, join(__dirname, firstArg)).then(code => process.exit(code));
  } else if (firstArg.includes('/')) {
    // Run specific test with path (e.g., integration/test-mcp-client.js)
    const testPath = join(__dirname, firstArg);
    console.log(`🧪 Running specific test: ${firstArg}\n`);
    runTest(firstArg, testPath).then(code => process.exit(code));
  } else {
    console.error('Invalid argument. Usage:');
    console.error('  node run-all.js                          # Run all tests');
    console.error('  node run-all.js integration              # Run integration tests only');
    console.error('  node run-all.js manual                   # Run manual tests only');
    console.error('  node run-all.js test-simple.js           # Run specific test');
    console.error('  node run-all.js integration/test-mcp.js  # Run specific integration test');
    process.exit(1);
  }
} else {
  // Run all tests
  runAllTests();
}