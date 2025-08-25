#!/usr/bin/env node

import { spawn } from 'child_process';

// Test error handling and edge cases
async function testErrorHandling() {
  console.log('⚠️  Testing error handling and edge cases...\n');

  const server = spawn('node', ['dist/index.js', 'server'], {
    stdio: ['pipe', 'pipe', 'pipe'],
    cwd: process.cwd()
  });

  let testResults = [];

  server.stderr.on('data', (data) => {
    if (data.toString().includes('In Memoria MCP Server started')) {
      runErrorTests();
    }
  });

  async function runErrorTests() {
    console.log('✅ Server ready for error testing...\n');

    const errorTests = [
      {
        name: 'Invalid Tool Name',
        request: {
          method: 'tools/call',
          params: {
            name: 'invalid_tool_name',
            arguments: {}
          }
        },
        expectError: true
      },
      {
        name: 'Missing Required Parameter',
        request: {
          method: 'tools/call',
          params: {
            name: 'analyze_codebase',
            arguments: {} // Missing required 'path'
          }
        },
        expectError: true
      },
      {
        name: 'Invalid Path',
        request: {
          method: 'tools/call',
          params: {
            name: 'get_file_content',
            arguments: { path: '/nonexistent/path/file.js' }
          }
        },
        expectError: true
      },
      {
        name: 'Invalid JSON RPC',
        request: {
          // Missing required fields
          method: 'tools/call'
        },
        expectError: true
      },
      {
        name: 'Invalid Search Type',
        request: {
          method: 'tools/call',
          params: {
            name: 'search_codebase',
            arguments: { 
              query: 'test',
              type: 'invalid_type' // Invalid enum value
            }
          }
        },
        expectError: true
      },
      {
        name: 'Invalid Limit (Too High)',
        request: {
          method: 'tools/call',
          params: {
            name: 'search_codebase',
            arguments: { 
              query: 'test',
              limit: 500 // Exceeds maximum of 100
            }
          }
        },
        expectError: true
      },
      {
        name: 'Invalid Confidence Score',
        request: {
          method: 'tools/call',
          params: {
            name: 'contribute_insights',
            arguments: {
              type: 'optimization',
              content: { test: 'data' },
              confidence: 1.5, // Exceeds maximum of 1.0
              sourceAgent: 'test-agent'
            }
          }
        },
        expectError: true
      }
    ];

    for (const test of errorTests) {
      await runSingleErrorTest(test);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Results
    console.log('\n📊 Error Handling Test Results:');
    testResults.forEach(result => {
      const status = result.success ? '✅' : '❌';
      console.log(`${status} ${result.name}: ${result.message}`);
    });

    const successCount = testResults.filter(r => r.success).length;
    console.log(`\n🎯 Error Handling: ${successCount}/${testResults.length} tests passed`);

    server.kill('SIGTERM');
    console.log('\n🧹 Error testing completed');
  }

  function runSingleErrorTest(test) {
    return new Promise((resolve) => {
      console.log(`🚫 Error test: ${test.name}`);
      
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
          
          if (test.expectError) {
            if (response.error) {
              testResults.push({
                name: test.name,
                success: true,
                message: `Correctly handled error: ${response.error.message}`
              });
            } else {
              testResults.push({
                name: test.name,
                success: false,
                message: 'Expected error but got success response'
              });
            }
          } else {
            if (response.error) {
              testResults.push({
                name: test.name,
                success: false,
                message: `Unexpected error: ${response.error.message}`
              });
            } else {
              testResults.push({
                name: test.name,
                success: true,
                message: 'Success'
              });
            }
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
            message: 'Timeout - no response'
          });
          server.stdout.removeListener('data', responseHandler);
          resolve();
        }
      }, 5000);

      server.stdin.write(JSON.stringify(requestWithId) + '\n');
    });
  }

  server.on('error', (error) => {
    console.error('❌ Server error:', error.message);
  });
}

testErrorHandling().catch(console.error);