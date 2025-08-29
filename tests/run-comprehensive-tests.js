#!/usr/bin/env node

import { execSync } from 'child_process';
import { existsSync } from 'fs';

async function runAllTests() {
  console.log('🧪 Running comprehensive test suite for language support changes...\n');
  
  const tests = [
    {
      name: 'Rust Unit Tests',
      command: 'cd rust-core && cargo test',
      critical: true
    },
    {
      name: 'TypeScript Unit Tests',
      command: 'npm test',
      critical: true
    },
    {
      name: 'Comprehensive Language Support',
      command: 'node tests/test-comprehensive-language-support.js',
      critical: true
    },
    {
      name: 'File Extension Mapping',
      command: 'node tests/test-file-extension-mapping.js',
      critical: true
    },
    {
      name: 'Existing Language Detection',
      command: 'node tests/test-lang-detect.js',
      critical: false
    },
    {
      name: 'Tree-sitter Debug',
      command: 'node tests/test-tree-sitter-debug.js',
      critical: false
    }
  ];
  
  let passed = 0;
  let failed = 0;
  const results = [];
  
  for (const test of tests) {
    console.log(`🔍 Running: ${test.name}`);
    console.log(`   Command: ${test.command}`);
    
    try {
      const output = execSync(test.command, { 
        encoding: 'utf-8', 
        timeout: 60000,  // 60 second timeout
        maxBuffer: 1024 * 1024 * 10  // 10MB buffer
      });
      
      console.log(`   ✅ PASSED`);
      if (output.includes('❌') || output.includes('FAIL')) {
        console.log(`   ⚠️  Warning: Output contains failure indicators`);
        console.log('   Output excerpt:', output.split('\n').slice(-5).join('\n'));
      }
      
      passed++;
      results.push({ name: test.name, status: 'passed', critical: test.critical });
      
    } catch (error) {
      console.log(`   ❌ FAILED`);
      console.log(`   Error: ${error.message}`);
      
      if (error.stdout) {
        console.log('   Stdout:', error.stdout.split('\n').slice(-3).join('\n'));
      }
      if (error.stderr) {
        console.log('   Stderr:', error.stderr.split('\n').slice(-3).join('\n'));
      }
      
      failed++;
      results.push({ 
        name: test.name, 
        status: 'failed', 
        error: error.message,
        critical: test.critical 
      });
      
      // Stop on critical test failures
      if (test.critical) {
        console.log(`\n💥 Critical test failed: ${test.name}`);
        console.log('   Stopping test execution due to critical failure.\n');
        break;
      }
    }
    
    console.log('');
  }
  
  // Final summary
  console.log('📊 Test Suite Summary:');
  console.log(`   ✅ Passed: ${passed}`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log(`   📈 Success Rate: ${Math.round((passed / (passed + failed)) * 100)}%`);
  
  console.log('\n📋 Detailed Results:');
  results.forEach(result => {
    const icon = result.status === 'passed' ? '✅' : '❌';
    const critical = result.critical ? ' (CRITICAL)' : '';
    console.log(`   ${icon} ${result.name}${critical}`);
    if (result.error) {
      console.log(`      Error: ${result.error}`);
    }
  });
  
  // Check if we can build
  console.log('\n🔨 Testing build process...');
  try {
    console.log('   Building Rust core...');
    execSync('cd rust-core && cargo build', { encoding: 'utf-8' });
    console.log('   ✅ Rust build successful');
    
    console.log('   Building TypeScript...');
    execSync('npm run build', { encoding: 'utf-8' });
    console.log('   ✅ TypeScript build successful');
    
  } catch (buildError) {
    console.log('   ❌ Build failed:', buildError.message);
    failed++;
  }
  
  // Overall assessment
  const criticalFailures = results.filter(r => r.status === 'failed' && r.critical).length;
  
  if (criticalFailures === 0 && passed > failed) {
    console.log('\n🎉 All critical tests passed! Changes are ready for commit.');
    console.log('   ✨ Language support expansion appears successful.');
    process.exit(0);
  } else {
    console.log('\n⚠️  Some tests failed. Review failures before committing.');
    if (criticalFailures > 0) {
      console.log(`   💥 ${criticalFailures} critical failure(s) detected.`);
    }
    process.exit(1);
  }
}

runAllTests().catch(error => {
  console.error('💥 Test runner failed:', error);
  process.exit(1);
});
