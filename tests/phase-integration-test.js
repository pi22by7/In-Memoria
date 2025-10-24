#!/usr/bin/env node

/**
 * Integration tests for Phase 1-4 features
 * Tests the consolidated MCP tools and their functionality
 */

import { CodeCartographerMCP } from '../dist/mcp-server/server.js';
import { existsSync, mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const testProjectPath = process.cwd();
let tempDbPath;
let server;

// Test utilities
function log(phase, message, status = '✓') {
  console.log(`[Phase ${phase}] ${status} ${message}`);
}

function error(phase, message, err) {
  console.error(`[Phase ${phase}] ✗ ${message}`);
  if (err) console.error(err);
  process.exit(1);
}

async function callTool(toolName, args) {
  try {
    return await server.routeToolCall(toolName, args);
  } catch (err) {
    throw new Error(`Tool '${toolName}' failed: ${err.message}`);
  }
}

// Phase 1: Project Blueprint
async function testPhase1() {
  console.log('\n=== Testing Phase 1: Project Blueprint ===\n');

  try {
    // Test get_project_blueprint - Phase 1 feature
    log(1, 'Testing get_project_blueprint (instant project intelligence)...');
    const blueprint = await callTool('get_project_blueprint', {
      path: testProjectPath,
      includeFeatureMap: true
    });

    if (!blueprint.techStack && !blueprint.entryPoints) {
      error(1, 'No blueprint data in response');
    }

    log(1, `Tech stack: ${blueprint.techStack?.join(', ') || 'none'}`);
    log(1, `Entry points: ${Object.keys(blueprint.entryPoints || {}).length}`);
    log(1, `Key directories: ${Object.keys(blueprint.keyDirectories || {}).length}`);
    log(1, `Architecture: ${blueprint.architecture || 'unknown'}`);
    if (blueprint.featureMap) {
      log(1, `Feature map: ${Object.keys(blueprint.featureMap).length} features`);
    }
    if (blueprint.learningStatus) {
      log(1, `Learning status: ${blueprint.learningStatus.message}`);
    }

    log(1, 'Phase 1 tests passed!', '✅');

  } catch (err) {
    error(1, 'Phase 1 test failed', err);
  }
}

// Phase 2: Work Context System
async function testPhase2() {
  console.log('\n=== Testing Phase 2: Work Context System ===\n');

  try {
    // Note: Phase 2 added database migrations for work_sessions table
    // Testing that the database has the required schema

    log(2, 'Checking work session tracking schema...');
    const db = server.database;

    // Check if work_sessions table exists
    const tables = db.db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='work_sessions'"
    ).all();

    if (tables.length === 0) {
      error(2, 'work_sessions table not found');
    }

    log(2, 'work_sessions table exists');

    // Check if project_decisions table exists
    const decisionsTables = db.db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='project_decisions'"
    ).all();

    if (decisionsTables.length === 0) {
      error(2, 'project_decisions table not found');
    }

    log(2, 'project_decisions table exists');
    log(2, 'Phase 2 tests passed!', '✅');

  } catch (err) {
    error(2, 'Phase 2 test failed', err);
  }
}

// Phase 3: Smart Navigation & Routing
async function testPhase3() {
  console.log('\n=== Testing Phase 3: Smart Navigation & Routing ===\n');

  try {
    // Test predict_coding_approach with file routing
    log(3, 'Testing predict_coding_approach with file routing...');
    const prediction = await callTool('predict_coding_approach', {
      problemDescription: 'Add a new MCP tool for code refactoring',
      includeFileRouting: true
    });

    // Check if we got a valid prediction
    if (!prediction.approach) {
      error(3, 'No approach in prediction response');
    }

    log(3, `Approach: ${prediction.approach}`);
    log(3, `Confidence: ${prediction.confidence}`);
    log(3, `Complexity: ${prediction.estimatedComplexity}`);

    if (!prediction.fileRouting) {
      log(3, 'No file routing in response (may be expected)', '⚠️');
    } else {
      log(3, `File routing suggests ${prediction.fileRouting.targetFiles?.length || 0} files`);
      log(3, `Work type: ${prediction.fileRouting.workType}`);
    }

    // Test search_codebase with semantic search
    log(3, 'Testing search_codebase with semantic search...');
    const searchResult = await callTool('search_codebase', {
      query: 'database migrations',
      type: 'semantic'
    });

    if (!searchResult.results) {
      error(3, 'No results in search_codebase response');
    }

    log(3, `Found ${searchResult.results?.length || 0} semantic matches (${searchResult.searchType})`);
    log(3, 'Phase 3 tests passed!', '✅');

  } catch (err) {
    error(3, 'Phase 3 test failed', err);
  }
}

// Phase 4: Tool Consolidation
async function testPhase4() {
  console.log('\n=== Testing Phase 4: Tool Consolidation (18→13 tools) ===\n');

  try {
    // Test auto_learn_if_needed (consolidated quick_setup functionality)
    log(4, 'Testing auto_learn_if_needed (consolidated from quick_setup)...');
    const autoLearn = await callTool('auto_learn_if_needed', {
      path: testProjectPath,
      skipLearning: true,
      includeSetupSteps: true
    });

    if (!autoLearn.success) {
      error(4, 'auto_learn_if_needed failed', autoLearn.error);
    }

    log(4, `Setup status: ${autoLearn.status || 'ready'}`);
    log(4, `Setup steps: ${autoLearn.setupSteps?.length || 0}`);

    // Test get_system_status (monitoring tool)
    log(4, 'Testing get_system_status...');
    const systemStatus = await callTool('get_system_status', {});

    if (!systemStatus.success) {
      error(4, 'get_system_status failed', systemStatus.error);
    }

    log(4, `System status: ${systemStatus.status || 'unknown'}`);
    log(4, `Database path: ${systemStatus.database?.path || 'N/A'}`);

    // Test get_intelligence_metrics
    log(4, 'Testing get_intelligence_metrics...');
    const metrics = await callTool('get_intelligence_metrics', {});

    if (!metrics.success) {
      error(4, 'get_intelligence_metrics failed', metrics.error);
    }

    log(4, `Intelligence metrics available: ${metrics.metrics ? 'yes' : 'no'}`);

    // Verify tool count (should be 13 tools total)
    log(4, 'Verifying tool count (should be 13)...');
    const tools = server.getAllTools();

    if (tools.length !== 13) {
      error(4, `Expected 13 tools, got ${tools.length}`);
    }

    log(4, `Tool count verified: ${tools.length} tools`);
    log(4, 'Phase 4 tests passed!', '✅');

  } catch (err) {
    error(4, 'Phase 4 test failed', err);
  }
}

// Main test runner
async function runTests() {
  console.log('🚀 Starting Phase 1-4 Integration Tests\n');
  console.log(`Project path: ${testProjectPath}`);

  try {
    // Initialize MCP server with temp database
    tempDbPath = mkdtempSync(join(tmpdir(), 'in-memoria-test-'));
    const dbPath = join(tempDbPath, 'test.db');

    log('Setup', `Creating test database at ${dbPath}`);

    // Set custom DB path via environment
    process.env.MEMORIA_DB_PATH = dbPath;

    server = new CodeCartographerMCP();
    await server.initializeComponents();
    log('Setup', 'MCP server initialized');

    // Run all phase tests
    await testPhase1();
    await testPhase2();
    await testPhase3();
    await testPhase4();

    console.log('\n✅ All Phase 1-4 integration tests passed!\n');
    process.exit(0);

  } catch (err) {
    console.error('\n❌ Test suite failed:', err);
    process.exit(1);
  } finally {
    // Cleanup
    if (tempDbPath && existsSync(tempDbPath)) {
      log('Cleanup', 'Removing temp database');
      rmSync(tempDbPath, { recursive: true, force: true });
    }
  }
}

runTests().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
