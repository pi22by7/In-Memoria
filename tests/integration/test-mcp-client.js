#!/usr/bin/env node

import { spawn } from 'child_process';
import { writeFileSync, mkdirSync } from 'fs';

// Test client to verify MCP server functionality
async function testMCPServer() {
  console.log('🧪 Starting real MCP server test...\n');

  // Create a test project
  const testDir = '/tmp/mcp-test-project';
  try {
    mkdirSync(testDir, { recursive: true });
    writeFileSync(`${testDir}/test.js`, `
      function calculateTotal(items) {
        return items.reduce((sum, item) => sum + item.price, 0);
      }
      
      class ShoppingCart {
        constructor() {
          this.items = [];
        }
        
        addItem(item) {
          this.items.push(item);
        }
        
        getTotal() {
          return calculateTotal(this.items);
        }
      }
    `);
    writeFileSync(`${testDir}/package.json`, JSON.stringify({
      name: "test-project",
      version: "1.0.0",
      description: "Test project for MCP server"
    }, null, 2));
  } catch (error) {
    console.error('❌ Failed to create test project:', error.message);
    return false;
  }

  // Spawn the MCP server
  const server = spawn('node', ['dist/index.js', 'server'], {
    stdio: ['pipe', 'pipe', 'pipe'],
    cwd: process.cwd()
  });

  let serverReady = false;
  let testResults = [];

  // Wait for server to be ready
  server.stderr.on('data', (data) => {
    const output = data.toString();
    if (output.includes('In Memoria MCP Server started')) {
      serverReady = true;
      runTests();
    }
  });

  // Handle server output
  server.stdout.on('data', (data) => {
    console.log('📤 Server response:', data.toString().trim());
  });

  async function runTests() {
    console.log('✅ Server is ready! Running tests...\n');

    const tests = [
      {
        name: 'List Tools',
        request: { method: 'tools/list' }
      },
      {
        name: 'Get System Status',
        request: {
          method: 'tools/call',
          params: {
            name: 'get_system_status',
            arguments: {}
          }
        }
      },
      {
        name: 'Get Project Structure',
        request: {
          method: 'tools/call',
          params: {
            name: 'get_project_structure',
            arguments: { path: testDir }
          }
        }
      },
      {
        name: 'Analyze Codebase',
        request: {
          method: 'tools/call',
          params: {
            name: 'analyze_codebase',
            arguments: { path: testDir }
          }
        }
      },
      {
        name: 'Get Learning Status',
        request: {
          method: 'tools/call',
          params: {
            name: 'get_learning_status',
            arguments: { path: testDir }
          }
        }
      },
      {
        name: 'Invalid Tool (Error Test)',
        request: {
          method: 'tools/call',
          params: {
            name: 'nonexistent_tool',
            arguments: {}
          }
        }
      }
    ];

    for (const test of tests) {
      await runSingleTest(test);
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait between tests
    }

    // Summary
    console.log('\n📊 Test Results Summary:');
    testResults.forEach(result => {
      const status = result.success ? '✅' : '❌';
      console.log(`${status} ${result.name}: ${result.message}`);
    });

    const successCount = testResults.filter(r => r.success).length;
    console.log(`\n🎯 Overall: ${successCount}/${testResults.length} tests passed`);

    // Cleanup
    server.kill('SIGTERM');
    console.log('\n🧹 Server stopped and cleanup completed');
  }

  function runSingleTest(test) {
    return new Promise((resolve) => {
      console.log(`🔍 Testing: ${test.name}`);
      
      const requestWithId = {
        jsonrpc: '2.0',
        id: Date.now(),
        ...test.request
      };

      let responseReceived = false;
      let timeout;

      // Set up response handler
      const responseHandler = (data) => {
        if (responseReceived) return;
        
        try {
          const response = JSON.parse(data.toString());
          responseReceived = true;
          clearTimeout(timeout);
          
          if (response.error) {
            if (test.name.includes('Error Test')) {
              // Expected error
              testResults.push({
                name: test.name,
                success: true,
                message: `Expected error received: ${response.error.message}`
              });
            } else {
              // Unexpected error
              testResults.push({
                name: test.name,
                success: false,
                message: `Error: ${response.error.message}`
              });
            }
          } else {
            // Success response
            testResults.push({
              name: test.name,
              success: true,
              message: response.result ? 'Success with result' : 'Success'
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

      // Set timeout
      timeout = setTimeout(() => {
        if (!responseReceived) {
          testResults.push({
            name: test.name,
            success: false,
            message: 'Timeout - no response received'
          });
          server.stdout.removeListener('data', responseHandler);
          resolve();
        }
      }, 5000);

      // Send request
      server.stdin.write(JSON.stringify(requestWithId) + '\n');
    });
  }

  // Handle server errors
  server.on('error', (error) => {
    console.error('❌ Server error:', error.message);
  });

  server.on('exit', (code) => {
    console.log(`🏁 Server exited with code ${code}`);
  });
}

// Run the test
testMCPServer().catch(console.error);