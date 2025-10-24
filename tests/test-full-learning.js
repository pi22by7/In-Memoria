#!/usr/bin/env node

import { CodeCartographerMCP } from '../dist/mcp-server/server.js';

const server = new CodeCartographerMCP();
await server.initializeForTesting();

console.log('\n🧪 Testing auto_learn_if_needed WITHOUT skipLearning (will run full learning)...\n');

try {
  const result = await server.routeToolCall('auto_learn_if_needed', {
    path: process.cwd(),
    includeSetupSteps: true,
    skipLearning: false,  // Explicitly NOT skipping learning
    force: true           // Force re-learning even if data exists
  });

  console.log('\n📊 Learning Result:');
  console.log('Action:', result.action);
  console.log('Success:', result.success);
  console.log('Concepts Learned:', result.conceptsLearned);
  console.log('Patterns Learned:', result.patternsLearned);
  console.log('Files Analyzed:', result.filesAnalyzed);
  console.log('Time Elapsed:', Math.round(result.timeElapsed / 1000) + 's');
  console.log('Message:', result.message);

  if (result.steps) {
    console.log('\nSetup Steps:');
    result.steps.forEach((step, i) => {
      console.log(`  ${i + 1}. [${step.status}] ${step.step}: ${step.message}`);
    });
  }
} catch (error) {
  console.error('\n❌ Test failed:', error);
  process.exitCode = 1;
} finally {
  console.log('\n🧹 Cleaning up...');
  await server.stop();
  console.log('✅ Cleanup complete');
  
  // Force exit after a short delay to ensure all async operations complete
  setTimeout(() => {
    console.log('🔚 Forcing process exit...');
    process.exit(process.exitCode || 0);
  }, 1000);
}
