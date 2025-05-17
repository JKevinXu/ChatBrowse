#!/usr/bin/env node

// This script acts as a bridge between Chrome's native messaging protocol
// and the MCP server, translating between them

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory name of the current module
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Path to the MCP server
const mcpServerPath = path.join(__dirname, 'index.js');

// Function to read messages from Chrome
function readMessageFromChrome() {
  return new Promise((resolve) => {
    // Chrome sends the message length as a 4-byte integer
    const stdin = process.stdin;
    const buffer = Buffer.alloc(4);
    
    stdin.on('readable', () => {
      const bytesRead = stdin.read(buffer);
      if (bytesRead !== 4) {
        process.exit(0); // Exit if we can't read the message length
      }
      
      const messageLength = buffer.readUInt32LE(0);
      const messageBuffer = Buffer.alloc(messageLength);
      
      const messageBytesRead = stdin.read(messageBuffer);
      if (messageBytesRead !== messageLength) {
        process.exit(0); // Exit if we can't read the message
      }
      
      const message = JSON.parse(messageBuffer.toString());
      resolve(message);
    });
  });
}

// Function to send messages to Chrome
function sendMessageToChrome(message) {
  const messageBuffer = Buffer.from(JSON.stringify(message));
  const headerBuffer = Buffer.alloc(4);
  
  headerBuffer.writeUInt32LE(messageBuffer.length, 0);
  process.stdout.write(headerBuffer);
  process.stdout.write(messageBuffer);
}

// Start the MCP server as a child process
const mcpServer = spawn('node', [mcpServerPath], {
  stdio: ['pipe', 'pipe', 'pipe']
});

// Handle output from the MCP server
mcpServer.stdout.on('data', (data) => {
  // Process and forward the MCP server's response to Chrome
  const response = {
    type: 'response',
    data: data.toString()
  };
  sendMessageToChrome(response);
});

// Handle errors from the MCP server
mcpServer.stderr.on('data', (data) => {
  const error = {
    type: 'error',
    message: data.toString()
  };
  sendMessageToChrome(error);
});

// Main process
async function main() {
  try {
    // Read the message from Chrome
    const message = await readMessageFromChrome();
    
    // Forward the message to the MCP server
    mcpServer.stdin.write(JSON.stringify(message) + '\n');
  } catch (error) {
    sendMessageToChrome({
      type: 'error',
      message: error.message
    });
  }
}

// Start the main process
main(); 