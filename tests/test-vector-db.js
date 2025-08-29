#!/usr/bin/env node

import { SemanticVectorDB } from '../dist/storage/vector-db.js';

async function testVectorDB() {
  console.log('🧪 Testing Vector Database Implementation...\n');

  // Test with and without OpenAI API key
  const apiKey = process.env.OPENAI_API_KEY;
  console.log(`OpenAI API Key: ${apiKey ? '✅ Available' : '❌ Not set'}`);

  const vectorDB = new SemanticVectorDB(apiKey);

  // Test code samples
  const testCodes = [
    {
      code: `
function fibonacci(n) {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}`,
      metadata: { id: 'test1', filePath: 'test.js', language: 'javascript', functionName: 'fibonacci' }
    },
    {
      code: `
class Calculator {
  add(a, b) {
    return a + b;
  }
  multiply(a, b) {
    return a * b;
  }
}`,
      metadata: { id: 'test2', filePath: 'calc.js', language: 'javascript', className: 'Calculator' }
    },
    {
      code: `
async function fetchUserData(userId) {
  const response = await fetch(\`/api/users/\${userId}\`);
  return response.json();
}`,
      metadata: { id: 'test3', filePath: 'api.js', language: 'javascript', functionName: 'fetchUserData' }
    }
  ];

  try {
    console.log('📊 Testing embedding generation...');

    for (const { code, metadata } of testCodes) {
      console.log(`\n🔧 Processing: ${metadata.functionName || metadata.className || metadata.id}`);

      const startTime = Date.now();

      // Test the private method by accessing it through a wrapper
      const vectorDB_internal = vectorDB;
      const embedding = await vectorDB_internal.generateRealSemanticEmbedding(code);

      const duration = Date.now() - startTime;

      console.log(`✅ Generated embedding: ${embedding.length} dimensions`);
      console.log(`⏱️  Time taken: ${duration}ms`);
      console.log(`📈 Sample values: [${embedding.slice(0, 5).map(v => v.toFixed(4)).join(', ')}, ...]`);
    }

    console.log('\n🎉 Vector database test completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

// Make generateRealSemanticEmbedding accessible for testing
SemanticVectorDB.prototype.testGenerateEmbedding = function (code) {
  return this.generateRealSemanticEmbedding(code);
};

testVectorDB().catch(console.error);
