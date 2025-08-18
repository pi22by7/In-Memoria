#!/usr/bin/env node

import { spawn } from 'child_process';
import { readdir } from 'fs/promises';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const TESTS_TO_SKIP = ['run-all.js', 'README.md'];

async function runTest(testFile) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🧪 Running: ${testFile}`);
  console.log(`${'='.repeat(60)}\n`);

  return new Promise((resolve) => {
    const child = spawn('node', [join(__dirname, testFile)], {
      stdio: 'inherit',
      cwd: process.cwd()
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

async function runAllTests() {
  console.log('🚀 Running all manual integration tests...\n');
  console.log('ℹ️  Make sure to run "npm run build" first!\n');

  try {
    const files = await readdir(__dirname);
    const testFiles = files.filter(file => 
      file.startsWith('test-') && 
      file.endsWith('.js') && 
      !TESTS_TO_SKIP.includes(file)
    );

    if (testFiles.length === 0) {
      console.log('No test files found!');
      process.exit(1);
    }

    console.log(`Found ${testFiles.length} test files:\n${testFiles.map(f => `  - ${f}`).join('\n')}\n`);

    let passed = 0;
    let failed = 0;

    for (const testFile of testFiles) {
      const result = await runTest(testFile);
      if (result === 0) {
        passed++;
      } else {
        failed++;
      }
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log(`📊 TEST SUMMARY`);
    console.log(`${'='.repeat(60)}`);
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`📊 Total:  ${passed + failed}`);
    
    if (failed > 0) {
      console.log(`\n⚠️  Some tests failed. Check output above for details.`);
      process.exit(1);
    } else {
      console.log(`\n🎉 All manual tests passed!`);
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
  // Run specific test
  const testFile = args[0];
  if (!testFile.startsWith('test-') || !testFile.endsWith('.js')) {
    console.error('Test file must start with "test-" and end with ".js"');
    process.exit(1);
  }
  
  console.log(`🧪 Running specific test: ${testFile}\n`);
  runTest(testFile).then(code => process.exit(code));
} else {
  // Run all tests
  runAllTests();
}