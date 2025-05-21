#!/usr/bin/env node

console.error('NATIVE_BRIDGE_LOG: Script started.'); // Log 1

/**
 * Simple native messaging bridge between Chrome and the MCP server.
 * This script handles the communication protocol between Chrome\'s native messaging
 * and our MCP server.
 */

import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import { fileURLToPath } from 'url';

console.error('NATIVE_BRIDGE_LOG: Imports loaded.'); // Log 2

// Get the directory name of the current module
const __dirname = path.dirname(fileURLToPath(import.meta.url));
console.error(`NATIVE_BRIDGE_LOG: __dirname is ${__dirname}`); // Log 3

// Path to the MCP server
const mcpServerPath = path.join(__dirname, 'index.js');
console.error(`NATIVE_BRIDGE_LOG: mcpServerPath is ${mcpServerPath}`); // Log 4

const NODE_EXEC_PATH = "/opt/homebrew/bin/node"; // Hardcoded path to node

let mcpServerInstance: ChildProcess | null = null; // Renamed for clarity, initialized to null

try {
  console.error('NATIVE_BRIDGE_LOG: Attempting to spawn MCP server process...'); // Log 5
  mcpServerInstance = spawn(NODE_EXEC_PATH, [mcpServerPath], {
    stdio: ['pipe', 'pipe', 'pipe']
  });
  console.error('NATIVE_BRIDGE_LOG: Spawn call completed.'); // Log 6

  // Explicitly check if mcpServerInstance was created successfully
  if (!mcpServerInstance) {
    throw new Error('Failed to spawn MCP server process, spawn returned null/undefined.');
  }

  // These handlers are only attached if mcpServerInstance was successfully created by spawn.
  mcpServerInstance.on('error', (err) => {
    const spawnErrorMsg = `NATIVE_BRIDGE_LOG: MCP process error: ${err.message}`;
    console.error(spawnErrorMsg); // Log this to native bridge's own stdout/stderr
    if (typeof sendMessageToChrome === 'function') {
      sendMessageToChrome({ success: false, error: spawnErrorMsg });
    }
    process.exit(1); // Exit native bridge if spawn fails
  });

  mcpServerInstance.on('exit', (code, signal) => {
    const exitMsg = `NATIVE_BRIDGE_LOG: MCP process exited with code ${code}, signal ${signal}`;
    console.error(exitMsg); // Log this to native bridge's own stdout/stderr
    // Optionally, send a message to Chrome indicating the server stopped.
    // if (typeof sendMessageToChrome === 'function') {
    //   sendMessageToChrome({ success: false, error: exitMsg, event: 'mcp_server_exit' });
    // }
  });

  if (mcpServerInstance.stdout) { // Guard for stdout
    mcpServerInstance.stdout.on('data', (data: Buffer) => {
      const output = data.toString().trim();
      // console.error(`NATIVE_BRIDGE_LOG: MCP stdout: ${output}`);
      sendMessageToChrome({ success: true, data: output });
    });
  } else {
    throw new Error('NATIVE_BRIDGE_LOG: MCP server stdout is not available.');
  }

  if (mcpServerInstance.stderr) { // Guard for stderr
    mcpServerInstance.stderr.on('data', (data: Buffer) => {
      const error = data.toString().trim();
      // console.error(`NATIVE_BRIDGE_LOG: MCP stderr: ${error}`);
      sendMessageToChrome({ success: false, error });
    });
  } else {
    throw new Error('NATIVE_BRIDGE_LOG: MCP server stderr is not available.');
  }

  // Handle process exit
  process.on('exit', (code) => {
    console.error(`NATIVE_BRIDGE_LOG: Exiting with code ${code}.`);
    if (mcpServerInstance && !mcpServerInstance.killed) {
      mcpServerInstance.kill();
    }
  });

  // Read message from Chrome's native messaging
  process.stdin.on('readable', () => {
    try {
      console.error('NATIVE_BRIDGE_LOG: stdin readable event triggered.');
      const header = process.stdin.read(4);
      if (!header) {
        console.error('NATIVE_BRIDGE_LOG: stdin read(4) returned null (no header).');
        return;
      }
      console.error(`NATIVE_BRIDGE_LOG: Read header, length ${header.length}`);
      
      const messageLength = header.readUInt32LE(0);
      console.error(`NATIVE_BRIDGE_LOG: Message length from header: ${messageLength}`);
      
      const messageBuffer = process.stdin.read(messageLength);
      if (!messageBuffer) {
        console.error('NATIVE_BRIDGE_LOG: stdin read(messageLength) returned null (no messageBuffer).');
        return;
      }
      console.error(`NATIVE_BRIDGE_LOG: Read messageBuffer, length ${messageBuffer.length}`);
      
      const messageStr = messageBuffer.toString();
      console.error(`NATIVE_BRIDGE_LOG: Received message string: ${messageStr}`);
      const message = JSON.parse(messageStr);
      console.error('NATIVE_BRIDGE_LOG: Parsed message JSON:', message);
      handleMessage(message);
    } catch (e: any) {
      const readableErrorMsg = `NATIVE_BRIDGE_LOG: CRITICAL ERROR in stdin readable handler: ${e.message}`;
      console.error(readableErrorMsg);
      try {
        sendMessageToChrome({ success: false, error: readableErrorMsg });
      } catch (sendError: any) {
        console.error(`NATIVE_BRIDGE_LOG: Failed to send critical readable error to Chrome: ${sendError.message}`);
      }
    }
  });

} catch (spawnCatchError: any) {
  const criticalSpawnErrorMsg = `NATIVE_BRIDGE_LOG: CRITICAL - Exception during spawn call or stdio setup: ${spawnCatchError.message}`;
  console.error(criticalSpawnErrorMsg); // Log to native bridge's own stdout/stderr
  // Attempt to send this critical error back to the extension
  if (typeof sendMessageToChrome === 'function') { 
    sendMessageToChrome({ success: false, error: criticalSpawnErrorMsg });
  }
  process.exit(1); // Exit native bridge if spawn itself throws
}

// Handle incoming message
function handleMessage(message: any): void {
  console.error('NATIVE_BRIDGE_LOG: handleMessage called with:', message); 
  if (!mcpServerInstance || !mcpServerInstance.stdin || mcpServerInstance.stdin.destroyed) { 
    console.error('NATIVE_BRIDGE_LOG: mcpServerInstance or mcpServerInstance.stdin not available in handleMessage');
    sendMessageToChrome({ success: false, error: 'NATIVE_BRIDGE_LOG: MCP server stdin not available.' });
    return;
  }

  if (message.method === 'tool' && message.params && message.params.name) {
    const toolName = message.params.name;
    const parameters = message.params.parameters || {};
    let mcpMessage: any = null;

    if (toolName === 'browse_webpage') {
      if (!parameters.url) {
        sendMessageToChrome({
          success: false,
          error: 'NATIVE_BRIDGE_LOG: browse_webpage tool call missing URL parameter.'
        });
        return;
      }
      mcpMessage = {
        method: 'tool',
        params: {
          name: 'browse_webpage',
          parameters: {
            url: parameters.url,
            selector: parameters.selector
          }
        }
      };
    } else if (toolName === 'google_search') {
      if (!parameters.query) {
        sendMessageToChrome({
          success: false,
          error: 'NATIVE_BRIDGE_LOG: google_search tool call missing query parameter.'
        });
        return;
      }
      mcpMessage = {
        method: 'tool',
        params: {
          name: 'google_search',
          parameters: {
            query: parameters.query
          }
        }
      };
    } else {
      sendMessageToChrome({ 
        success: false, 
        error: `NATIVE_BRIDGE_LOG: Unknown tool name received: ${toolName}` 
      });
      return; // Important to return if tool name is unknown
    }
    
    // If mcpMessage was constructed, send it
    if (mcpMessage) {
      try {
        const mcpMessageString = JSON.stringify(mcpMessage) + '\n'; 
        console.error(`NATIVE_BRIDGE_LOG: Writing to MCP server stdin: ${mcpMessageString.trim()}`); 
        mcpServerInstance.stdin.write(mcpMessageString);
        console.error('NATIVE_BRIDGE_LOG: Successfully wrote to MCP server stdin.'); 
      } catch (e:any) {
        console.error(`NATIVE_BRIDGE_LOG: Error writing to mcpServerInstance.stdin: ${e.message}`);
        sendMessageToChrome({ success: false, error: `NATIVE_BRIDGE_LOG: Error writing to MCP server: ${e.message}` });
      }
    }
  } else {
    let receivedType = message.type !== undefined ? message.type : (message.method !== undefined ? message.method : 'unknown_structure');
    sendMessageToChrome({ 
      success: false, 
      error: `NATIVE_BRIDGE_LOG: Unknown message structure or type received. Type/Method: ${receivedType}` 
    });
  }
}

// Send message to Chrome
function sendMessageToChrome(message: any): void {
  try {
    const messageJson = JSON.stringify(message);
    const messageBuffer = Buffer.from(messageJson);
    
    // Write message length (4 bytes) + message
    const headerBuffer = Buffer.alloc(4);
    headerBuffer.writeUInt32LE(messageBuffer.length, 0);
    
    process.stdout.write(headerBuffer);
    process.stdout.write(messageBuffer);
  } catch (e:any) {
    console.error(`NATIVE_BRIDGE_LOG: Error in sendMessageToChrome: ${e.message}`);
    // Cannot send error to Chrome if this function itself fails, so just log to native bridge console.
  }
} 