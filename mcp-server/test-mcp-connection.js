#!/usr/bin/env node

/**
 * Test script to debug MCP server communication
 * Run this directly to test what the MCP server expects
 */

import { spawn } from 'child_process';
import readline from 'readline';

// Configuration for your MCP server
const MCP_SERVER = {
  command: "/Users/kx/game_automation_project/venv/bin/python3",
  args: ["/Users/kx/game_automation_project/mcp_game_automation_server/server.py"]
};

console.log('Starting MCP server test...');

// Spawn the MCP server
const mcpServer = spawn(MCP_SERVER.command, MCP_SERVER.args, {
  stdio: ['pipe', 'pipe', 'pipe']
});

// Create readline interface for interactive testing
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Handle server output
mcpServer.stdout.on('data', (data) => {
  const output = data.toString();
  console.log('\n📥 Server Response:', output);
  
  // Try to parse as JSON
  const lines = output.split('\n').filter(line => line.trim());
  lines.forEach(line => {
    try {
      const json = JSON.parse(line);
      console.log('📋 Parsed JSON:', JSON.stringify(json, null, 2));
    } catch (e) {
      // Not JSON, just log as is
      console.log('📄 Raw output:', line);
    }
  });
});

mcpServer.stderr.on('data', (data) => {
  console.error('❌ Server Error:', data.toString());
});

mcpServer.on('error', (err) => {
  console.error('❌ Failed to start server:', err);
  process.exit(1);
});

mcpServer.on('exit', (code, signal) => {
  console.log(`Server exited with code ${code}, signal ${signal}`);
  process.exit(0);
});

// Test sequence
async function runTests() {
  console.log('\n🧪 Running MCP Protocol Tests...\n');
  
  const tests = [
    // Test 1: Initialize with protocol version
    {
      name: "Initialize (MCP standard)",
      request: {
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: {
            name: "TestClient",
            version: "1.0.0"
          }
        }
      }
    },
    
    // Test 2: Send initialized notification
    {
      name: "Initialized notification",
      request: {
        jsonrpc: "2.0",
        method: "notifications/initialized"
      },
      delay: 500
    },
    
    // Test 3: List tools without params
    {
      name: "List tools (no params)",
      request: {
        jsonrpc: "2.0",
        id: 2,
        method: "tools/list"
      },
      delay: 500
    },
    
    // Test 4: List tools with empty params
    {
      name: "List tools (empty params)",
      request: {
        jsonrpc: "2.0",
        id: 3,
        method: "tools/list",
        params: {}
      },
      delay: 500
    },
    
    // Test 5: Try alternative method names
    {
      name: "Alternative: list_tools",
      request: {
        jsonrpc: "2.0",
        id: 4,
        method: "list_tools"
      },
      delay: 500
    },
    
    // Test 6: Try getting capabilities
    {
      name: "Get server info",
      request: {
        jsonrpc: "2.0",
        id: 5,
        method: "server/info"
      },
      delay: 500
    }
  ];
  
  for (const test of tests) {
    if (test.delay) {
      await new Promise(resolve => setTimeout(resolve, test.delay));
    }
    
    console.log(`\n🚀 Test: ${test.name}`);
    const requestStr = JSON.stringify(test.request);
    console.log(`📤 Sending: ${requestStr}`);
    
    mcpServer.stdin.write(requestStr + '\n');
    
    // Wait for response
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('\n✅ Tests completed. Server is still running for manual testing.');
  console.log('Type JSON-RPC requests or "exit" to quit:\n');
}

// Run tests after server starts
setTimeout(runTests, 1000);

// Handle manual input
rl.on('line', (input) => {
  if (input.toLowerCase() === 'exit') {
    console.log('Exiting...');
    mcpServer.kill();
    rl.close();
    process.exit(0);
  }
  
  try {
    // Try to parse as JSON
    const json = JSON.parse(input);
    const request = JSON.stringify(json) + '\n';
    console.log(`📤 Sending: ${request.trim()}`);
    mcpServer.stdin.write(request);
  } catch (e) {
    console.log('❌ Invalid JSON. Please enter valid JSON-RPC request.');
  }
});

// Handle process termination
process.on('SIGINT', () => {
  console.log('\nShutting down...');
  mcpServer.kill();
  rl.close();
  process.exit(0);
}); 