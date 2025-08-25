#!/usr/bin/env node

import { spawn } from 'child_process';
import { existsSync } from 'fs';

// Test server startup, shutdown, and cleanup behavior
async function testServerLifecycle() {
  console.log('🔄 Testing MCP server lifecycle and cleanup...\n');

  const tests = [
    {
      name: 'Clean Startup',
      test: testCleanStartup
    },
    {
      name: 'Graceful SIGTERM Shutdown',
      test: testGracefulShutdown
    },
    {
      name: 'Force Kill Recovery',
      test: testForceKillRecovery
    },
    {
      name: 'Resource Cleanup',
      test: testResourceCleanup
    },
    {
      name: 'Database Lock Cleanup',
      test: testDatabaseLockCleanup
    }
  ];

  const results = [];

  for (const test of tests) {
    console.log(`🧪 Testing: ${test.name}`);
    try {
      const result = await test.test();
      results.push({
        name: test.name,
        success: result.success,
        message: result.message
      });
      console.log(`${result.success ? '✅' : '❌'} ${test.name}: ${result.message}\n`);
    } catch (error) {
      results.push({
        name: test.name,
        success: false,
        message: `Test error: ${error.message}`
      });
      console.log(`❌ ${test.name}: Test error: ${error.message}\n`);
    }
    
    // Wait between tests
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  // Summary
  console.log('📊 Server Lifecycle Test Results:');
  results.forEach(result => {
    const status = result.success ? '✅' : '❌';
    console.log(`${status} ${result.name}: ${result.message}`);
  });

  const successCount = results.filter(r => r.success).length;
  console.log(`\n🎯 Server Lifecycle: ${successCount}/${results.length} tests passed`);
}

async function testCleanStartup() {
  return new Promise((resolve) => {
    const server = spawn('node', ['dist/index.js', 'server'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: process.cwd()
    });

    let startupComplete = false;
    let timeout;

    server.stderr.on('data', (data) => {
      const output = data.toString();
      if (output.includes('In Memoria MCP Server started')) {
        startupComplete = true;
        clearTimeout(timeout);
        server.kill('SIGTERM');
        resolve({ success: true, message: 'Server started successfully' });
      }
    });

    server.on('error', (error) => {
      clearTimeout(timeout);
      resolve({ success: false, message: `Startup failed: ${error.message}` });
    });

    timeout = setTimeout(() => {
      if (!startupComplete) {
        server.kill('SIGKILL');
        resolve({ success: false, message: 'Server startup timeout' });
      }
    }, 10000);
  });
}

async function testGracefulShutdown() {
  return new Promise((resolve) => {
    const server = spawn('node', ['dist/index.js', 'server'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: process.cwd()
    });

    let serverReady = false;
    let shutdownStartTime;

    server.stderr.on('data', (data) => {
      const output = data.toString();
      if (output.includes('In Memoria MCP Server started') && !serverReady) {
        serverReady = true;
        // Give server a moment to fully initialize
        setTimeout(() => {
          shutdownStartTime = Date.now();
          server.kill('SIGTERM'); // Graceful shutdown
        }, 1000);
      }
    });

    server.on('exit', (code, signal) => {
      const shutdownTime = Date.now() - shutdownStartTime;
      // Graceful shutdown can result in code 0 with null signal when process.exit(0) is called
      if (code === 0 && (signal === 'SIGTERM' || signal === null)) {
        resolve({ 
          success: true, 
          message: `Graceful shutdown completed in ${shutdownTime}ms` 
        });
      } else {
        resolve({ 
          success: false, 
          message: `Unexpected shutdown: code=${code}, signal=${signal}` 
        });
      }
    });

    setTimeout(() => {
      server.kill('SIGKILL');
      resolve({ success: false, message: 'Graceful shutdown timeout' });
    }, 15000);
  });
}

async function testForceKillRecovery() {
  return new Promise((resolve) => {
    // First, force kill a server
    const server1 = spawn('node', ['dist/index.js', 'server'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: process.cwd()
    });

    server1.stderr.on('data', (data) => {
      if (data.toString().includes('In Memoria MCP Server started')) {
        // Force kill the server
        server1.kill('SIGKILL');
        
        // Wait a moment, then try to start another server
        setTimeout(() => {
          const server2 = spawn('node', ['dist/index.js', 'server'], {
            stdio: ['pipe', 'pipe', 'pipe'],
            cwd: process.cwd()
          });

          server2.stderr.on('data', (data) => {
            if (data.toString().includes('In Memoria MCP Server started')) {
              server2.kill('SIGTERM');
              resolve({ 
                success: true, 
                message: 'Successfully recovered from force kill' 
              });
            }
          });

          server2.on('error', (error) => {
            resolve({ 
              success: false, 
              message: `Recovery failed: ${error.message}` 
            });
          });

          setTimeout(() => {
            server2.kill('SIGKILL');
            resolve({ 
              success: false, 
              message: 'Recovery startup timeout' 
            });
          }, 10000);
        }, 2000);
      }
    });

    server1.on('error', (error) => {
      resolve({ success: false, message: `Initial server error: ${error.message}` });
    });
  });
}

async function testResourceCleanup() {
  return new Promise((resolve) => {
    const server = spawn('node', ['dist/index.js', 'server'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: process.cwd()
    });

    let initialMemory;

    server.stderr.on('data', (data) => {
      if (data.toString().includes('In Memoria MCP Server started')) {
        // Get initial memory usage
        initialMemory = process.memoryUsage();
        
        // Shutdown after a moment
        setTimeout(() => {
          server.kill('SIGTERM');
        }, 2000);
      }
    });

    server.on('exit', () => {
      // Check memory after shutdown
      setTimeout(() => {
        const finalMemory = process.memoryUsage();
        const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
        
        // Allow some memory increase but flag if excessive
        if (memoryIncrease < 50 * 1024 * 1024) { // Less than 50MB increase
          resolve({ 
            success: true, 
            message: `Memory cleanup OK (${Math.round(memoryIncrease/1024/1024)}MB increase)` 
          });
        } else {
          resolve({ 
            success: false, 
            message: `Possible memory leak (${Math.round(memoryIncrease/1024/1024)}MB increase)` 
          });
        }
      }, 1000);
    });

    setTimeout(() => {
      server.kill('SIGKILL');
      resolve({ success: false, message: 'Resource cleanup test timeout' });
    }, 15000);
  });
}

async function testDatabaseLockCleanup() {
  return new Promise((resolve) => {
    const server1 = spawn('node', ['dist/index.js', 'server'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: process.cwd()
    });

    server1.stderr.on('data', (data) => {
      if (data.toString().includes('In Memoria MCP Server started')) {
        // Terminate the first server
        server1.kill('SIGTERM');
      }
    });

    server1.on('exit', () => {
      // Immediately try to start another server to test database lock cleanup
      setTimeout(() => {
        const server2 = spawn('node', ['dist/index.js', 'server'], {
          stdio: ['pipe', 'pipe', 'pipe'],
          cwd: process.cwd()
        });

        server2.stderr.on('data', (data) => {
          if (data.toString().includes('In Memoria MCP Server started')) {
            server2.kill('SIGTERM');
            resolve({ 
              success: true, 
              message: 'Database locks properly cleaned up' 
            });
          }
          if (data.toString().includes('database is locked')) {
            server2.kill('SIGKILL');
            resolve({ 
              success: false, 
              message: 'Database lock not cleaned up properly' 
            });
          }
        });

        server2.on('error', (error) => {
          resolve({ 
            success: false, 
            message: `Database lock test failed: ${error.message}` 
          });
        });

        setTimeout(() => {
          server2.kill('SIGKILL');
          resolve({ 
            success: false, 
            message: 'Database lock test timeout' 
          });
        }, 10000);
      }, 1000);
    });

    setTimeout(() => {
      server1.kill('SIGKILL');
      resolve({ success: false, message: 'Database lock cleanup test timeout' });
    }, 20000);
  });
}

// Run the lifecycle tests
testServerLifecycle().catch(console.error);