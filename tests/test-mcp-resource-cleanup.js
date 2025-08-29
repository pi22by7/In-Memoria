#!/usr/bin/env node

/**
 * Test script to check if MCP tools have hanging issues
 * This simulates multiple tool calls to detect resource leaks
 */

import { CodeCartographerMCP } from '../dist/mcp-server/server.js';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const TIMEOUT_MS = 60000; // 60 seconds - more time for real project analysis
const TEST_ITERATIONS = 2; // Fewer iterations but with real project

async function testWithTimeout(testName, testFunction) {
  console.log(`\n🧪 Testing ${testName}...`);
  
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => {
      reject(new Error(`Test '${testName}' timed out after ${TIMEOUT_MS}ms`));
    }, TIMEOUT_MS);
  });

  try {
    const startTime = Date.now();
    await Promise.race([testFunction(), timeoutPromise]);
    const duration = Date.now() - startTime;
    console.log(`✅ ${testName} completed in ${duration}ms`);
    return true;
  } catch (error) {
    console.log(`❌ ${testName} failed: ${error.message}`);
    return false;
  }
}

async function main() {
  // Use the actual In-Memoria project directory instead of creating a temp one
  const projectDir = process.cwd(); // This should be /home/pipi/Projects/FOSS/In-Memoria
  const tempDir = mkdtempSync(join(tmpdir(), 'mcp-hang-test-'));
  let server;

  try {
    console.log('🚀 Starting MCP Resource Hanging Test');
    console.log(`📁 Using real project: ${projectDir}`);

    // Set up environment with temporary database
    const originalDbPath = process.env.IN_MEMORIA_DB_PATH;
    process.env.IN_MEMORIA_DB_PATH = join(tempDir, 'test.db');

    server = new CodeCartographerMCP();
    await server.initializeForTesting();

    let allPassed = true;

    // Test 1: Multiple analysis calls (should process real files this time)
    allPassed &= await testWithTimeout('Multiple analyze_codebase calls', async () => {
      for (let i = 0; i < TEST_ITERATIONS; i++) {
        console.log(`  📊 Analysis iteration ${i + 1}/${TEST_ITERATIONS}`);
        const result = await server.routeToolCall('analyze_codebase', { path: projectDir });
        console.log(`    Found ${result.concepts?.length || 0} concepts, ${result.languages?.length || 0} languages`);
      }
    });

    // Test 2: Learning with real project
    allPassed &= await testWithTimeout('Learning with real project', async () => {
      console.log(`  🧠 Learning from real project (this may take longer)...`);
      const result = await server.routeToolCall('auto_learn_if_needed', { 
        path: projectDir,
        force: true,
        includeProgress: false 
      });
      console.log(`    Result: ${result.action}, concepts: ${result.conceptsLearned || 0}, patterns: ${result.patternsLearned || 0}`);
    });

    // Test 3: Status and insights after learning
    allPassed &= await testWithTimeout('Status checks after learning', async () => {
      const tools = [
        { name: 'get_project_structure', args: { path: projectDir } },
        { name: 'get_learning_status', args: { path: projectDir } },
        { name: 'get_semantic_insights', args: { limit: 3 } }
      ];

      for (const tool of tools) {
        console.log(`    Calling ${tool.name}...`);
        await server.routeToolCall(tool.name, tool.args);
      }
    });

    // Test 4: Server cleanup
    allPassed &= await testWithTimeout('Server cleanup', async () => {
      console.log('  🧹 Stopping server...');
      await server.stop();
      server = null; // Mark as cleaned up
    });

    // Restore environment
    if (originalDbPath) {
      process.env.IN_MEMORIA_DB_PATH = originalDbPath;
    } else {
      delete process.env.IN_MEMORIA_DB_PATH;
    }

    if (allPassed) {
      console.log('\n🎉 All tests passed! MCP tools handle resources correctly even with real project analysis.');
      process.exit(0);
    } else {
      console.log('\n⚠️  Some tests failed. Check for resource leaks or hanging issues.');
      process.exit(1);
    }

  } catch (error) {
    console.error('\n💥 Test crashed:', error);
    process.exit(1);
  } finally {
    // Cleanup
    if (server) {
      try {
        await server.stop();
      } catch (error) {
        console.warn('Warning: Server cleanup failed:', error);
      }
    }
    
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch (error) {
      console.warn('Warning: Temp directory cleanup failed:', error);
    }
  }
}

// Handle process signals
process.on('SIGINT', () => {
  console.log('\n🛑 Test interrupted by user');
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('\n💥 Uncaught exception:', error);
  process.exit(1);
});

main().catch(error => {
  console.error('💥 Main function crashed:', error);
  process.exit(1);
});
