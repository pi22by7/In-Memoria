#!/usr/bin/env node

import { spawn } from 'child_process';

// Advanced test for intelligence and automation tools
async function testAdvancedMCPFeatures() {
  console.log('🚀 Testing advanced MCP features...\n');

  const server = spawn('node', ['dist/index.js', 'server'], {
    stdio: ['pipe', 'pipe', 'pipe'],
    cwd: process.cwd()
  });

  let testResults = [];

  server.stderr.on('data', (data) => {
    if (data.toString().includes('In Memoria MCP Server started')) {
      runAdvancedTests();
    }
  });

  async function runAdvancedTests() {
    console.log('✅ Server ready for advanced testing...\n');

    const tests = [
      {
        name: 'Auto-Learn Intelligence',
        request: {
          method: 'tools/call',
          params: {
            name: 'auto_learn_if_needed',
            arguments: { path: '/tmp/mcp-test-project', includeProgress: true }
          }
        }
      },
      {
        name: 'Get Intelligence Metrics',
        request: {
          method: 'tools/call',
          params: {
            name: 'get_intelligence_metrics',
            arguments: { includeBreakdown: true }
          }
        }
      },
      {
        name: 'Get Performance Status',
        request: {
          method: 'tools/call',
          params: {
            name: 'get_performance_status',
            arguments: { runBenchmark: true }
          }
        }
      },
      {
        name: 'Search Codebase',
        request: {
          method: 'tools/call',
          params: {
            name: 'search_codebase',
            arguments: { 
              query: 'function',
              type: 'text',
              limit: 5
            }
          }
        }
      },
      {
        name: 'Get Semantic Insights',
        request: {
          method: 'tools/call',
          params: {
            name: 'get_semantic_insights',
            arguments: { conceptType: 'function', limit: 3 }
          }
        }
      },
      {
        name: 'Pattern Recommendations',
        request: {
          method: 'tools/call',
          params: {
            name: 'get_pattern_recommendations',
            arguments: { 
              problemDescription: 'Need to validate user input in JavaScript',
              currentFile: '/tmp/test.js'
            }
          }
        }
      },
      {
        name: 'Developer Profile',
        request: {
          method: 'tools/call',
          params: {
            name: 'get_developer_profile',
            arguments: { includeRecentActivity: true }
          }
        }
      }
    ];

    for (const test of tests) {
      await runSingleTest(test);
      await new Promise(resolve => setTimeout(resolve, 1500));
    }

    // Results
    console.log('\n📊 Advanced Test Results:');
    testResults.forEach(result => {
      const status = result.success ? '✅' : '❌';
      console.log(`${status} ${result.name}: ${result.message}`);
    });

    const successCount = testResults.filter(r => r.success).length;
    console.log(`\n🎯 Advanced Tests: ${successCount}/${testResults.length} passed`);

    server.kill('SIGTERM');
    console.log('\n🧹 Advanced testing completed');
  }

  function runSingleTest(test) {
    return new Promise((resolve) => {
      console.log(`🔬 Advanced test: ${test.name}`);
      
      const requestWithId = {
        jsonrpc: '2.0',
        id: Date.now(),
        ...test.request
      };

      let responseReceived = false;
      let timeout;

      const responseHandler = (data) => {
        if (responseReceived) return;
        
        try {
          const response = JSON.parse(data.toString());
          responseReceived = true;
          clearTimeout(timeout);
          
          if (response.error) {
            testResults.push({
              name: test.name,
              success: false,
              message: `Error: ${response.error.message}`
            });
          } else {
            // Check if result has meaningful content
            const hasContent = response.result && 
              (response.result.content || 
               response.result.length > 0 || 
               Object.keys(response.result).length > 0);
            
            testResults.push({
              name: test.name,
              success: true,
              message: hasContent ? 'Success with data' : 'Success (empty result)'
            });
          }
        } catch (error) {
          if (!responseReceived) {
            testResults.push({
              name: test.name,
              success: false,
              message: `Parse error: ${error.message}`
            });
          }
        }
        
        server.stdout.removeListener('data', responseHandler);
        resolve();
      };

      server.stdout.on('data', responseHandler);

      timeout = setTimeout(() => {
        if (!responseReceived) {
          testResults.push({
            name: test.name,
            success: false,
            message: 'Timeout'
          });
          server.stdout.removeListener('data', responseHandler);
          resolve();
        }
      }, 8000);

      server.stdin.write(JSON.stringify(requestWithId) + '\n');
    });
  }

  server.on('error', (error) => {
    console.error('❌ Server error:', error.message);
  });
}

testAdvancedMCPFeatures().catch(console.error);