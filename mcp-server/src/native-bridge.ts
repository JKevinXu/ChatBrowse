#!/usr/bin/env node

/**
 * Simple native messaging bridge between Chrome and the MCP server.
 * This script handles the communication protocol between Chrome's native messaging
 * and our MCP server.
 */

import { spawn } from 'child_process';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Get the directory name of the current module
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Path to the MCP server
const mcpServerPath = path.join(__dirname, 'index.js');

// Start the MCP server process
const mcpServer = spawn('node', [mcpServerPath], {
  stdio: ['pipe', 'pipe', 'pipe']
});

// Handle MCP server output
mcpServer.stdout.on('data', (data: Buffer) => {
  const output = data.toString().trim();
  sendMessageToChrome({ success: true, data: output });
});

// Handle MCP server errors
mcpServer.stderr.on('data', (data: Buffer) => {
  const error = data.toString().trim();
  sendMessageToChrome({ success: false, error });
});

// Read message from Chrome's native messaging
process.stdin.on('readable', () => {
  // Read 4 bytes (message length)
  const header = process.stdin.read(4);
  if (!header) return;
  
  // Determine message length
  const messageLength = header.readUInt32LE(0);
  
  // Read the message
  const messageBuffer = process.stdin.read(messageLength);
  if (!messageBuffer) return;
  
  // Parse the message
  try {
    const message = JSON.parse(messageBuffer.toString());
    handleMessage(message);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    sendMessageToChrome({ success: false, error: `Failed to parse message: ${errorMessage}` });
  }
});

// Handle incoming message
function handleMessage(message: any): void {
  // Convert the message to an MCP format
  if (message.type === 'browse') {
    // Format for the browse_webpage MCP call
    const mcpMessage = {
      method: 'tool',
      params: {
        name: 'browse_webpage',
        parameters: {
          url: message.url,
          selector: message.selector
        }
      }
    };
    
    // Send to MCP server
    mcpServer.stdin.write(JSON.stringify(mcpMessage) + '\n');
  } else {
    sendMessageToChrome({ 
      success: false, 
      error: `Unknown message type: ${message.type}` 
    });
  }
}

// Send message to Chrome
function sendMessageToChrome(message: any): void {
  const messageJson = JSON.stringify(message);
  const messageBuffer = Buffer.from(messageJson);
  
  // Write message length (4 bytes) + message
  const headerBuffer = Buffer.alloc(4);
  headerBuffer.writeUInt32LE(messageBuffer.length, 0);
  
  process.stdout.write(headerBuffer);
  process.stdout.write(messageBuffer);
}

// Handle process exit
process.on('exit', () => {
  mcpServer.kill();
}); 