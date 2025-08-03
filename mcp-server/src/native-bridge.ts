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

// MCP Server instances
let mcpServerInstance: ChildProcess | null = null; // ChatBrowse MCP server
let gameAutomationServer: ChildProcess | null = null; // Game automation MCP server

// Game automation server configuration
const GAME_AUTOMATION_SERVER = {
  command: "/Users/kx/game_automation_project/venv/bin/python3",
  args: ["/Users/kx/game_automation_project/mcp_game_automation_server/server.py"]
};

try {
  console.error('NATIVE_BRIDGE_LOG: Attempting to spawn MCP server process...'); // Log 5
  
  // Spawn ChatBrowse MCP server
  mcpServerInstance = spawn(NODE_EXEC_PATH, [mcpServerPath], {
    stdio: ['pipe', 'pipe', 'pipe']
  });
  console.error('NATIVE_BRIDGE_LOG: ChatBrowse MCP server spawn call completed.'); // Log 6

  // Spawn Game Automation MCP server
  gameAutomationServer = spawn(GAME_AUTOMATION_SERVER.command, GAME_AUTOMATION_SERVER.args, {
    stdio: ['pipe', 'pipe', 'pipe']
  });
  console.error('NATIVE_BRIDGE_LOG: Game Automation MCP server spawn call completed.');
  
  // Initialize the game automation server immediately after spawning
  setTimeout(() => {
    if (gameAutomationServer && gameAutomationServer.stdin && !gameAutomationServer.stdin.destroyed) {
      const initRequest = JSON.stringify({
        jsonrpc: "2.0",
        id: Date.now(),
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: {
            name: "ChatBrowse MCP Client",
            version: "1.0.0"
          }
        }
      }) + '\n';
      
      console.error('NATIVE_BRIDGE_LOG: Auto-initializing game automation server on startup:', initRequest.trim());
      gameAutomationServer.stdin.write(initRequest);
    }
  }, 1000); // Give server time to start

  // Explicitly check if both servers were created successfully
  if (!mcpServerInstance) {
    throw new Error('Failed to spawn ChatBrowse MCP server process, spawn returned null/undefined.');
  }
  
  if (!gameAutomationServer) {
    throw new Error('Failed to spawn Game Automation MCP server process, spawn returned null/undefined.');
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

  // Game Automation Server handlers
  gameAutomationServer.on('error', (err) => {
    const spawnErrorMsg = `NATIVE_BRIDGE_LOG: Game Automation process error: ${err.message}`;
    console.error(spawnErrorMsg);
    if (typeof sendMessageToChrome === 'function') {
      sendMessageToChrome({ success: false, error: spawnErrorMsg });
    }
  });

  gameAutomationServer.on('exit', (code, signal) => {
    const exitMsg = `NATIVE_BRIDGE_LOG: Game Automation process exited with code ${code}, signal ${signal}`;
    console.error(exitMsg);
  });

  if (gameAutomationServer.stdout) {
    gameAutomationServer.stdout.on('data', (data: Buffer) => {
      const output = data.toString().trim();
      console.error(`NATIVE_BRIDGE_LOG: Game Automation stdout: ${output}`);
      
      // Handle multiple JSON responses that might be on separate lines
      const lines = output.split('\n').filter(line => line.trim());
      
      for (const line of lines) {
        try {
          const response = JSON.parse(line);
          console.error('NATIVE_BRIDGE_LOG: Parsed response:', JSON.stringify(response));
          
          // Check if this is an initialize response
          if (response.result && response.result.protocolVersion) {
            console.error('NATIVE_BRIDGE_LOG: Received initialize response:', JSON.stringify(response.result));
            
            // Send initialized notification
            const initializedNotification = JSON.stringify({
              jsonrpc: "2.0",
              method: "notifications/initialized"
            }) + '\n';
            
            if (gameAutomationServer && gameAutomationServer.stdin && !gameAutomationServer.stdin.destroyed) {
              gameAutomationServer.stdin.write(initializedNotification);
              console.error('NATIVE_BRIDGE_LOG: Sent initialized notification');
              
              // Mark as initialized only after sending the notification
              setTimeout(() => {
                (gameAutomationServer as any)._initialized = true;
                (gameAutomationServer as any)._initializing = false;
                console.error('NATIVE_BRIDGE_LOG: Server fully initialized and ready for tools/list');
                
                // Process any pending requests after initialization
                const pendingRequests = (gameAutomationServer as any)._pendingRequests || [];
                (gameAutomationServer as any)._pendingRequests = [];
                
                pendingRequests.forEach((request: any) => {
                  console.error('NATIVE_BRIDGE_LOG: Processing pending request after initialization:', request);
                  handleMessage(request);
                });
              }, 500); // Give time for initialized notification to be processed
            }
          }
          
                                // Log all responses for debugging
          if (response.error) {
            console.error('NATIVE_BRIDGE_LOG: Received error response:', JSON.stringify(response));
            console.error('NATIVE_BRIDGE_LOG: Error details - code:', response.error.code, 'message:', response.error.message);
          } else if (response.result) {
            console.error('NATIVE_BRIDGE_LOG: Received success response with result');
            if (response.result.tools) {
              console.error('NATIVE_BRIDGE_LOG: Tools list response received with', response.result.tools.length, 'tools');
            } else if (response.result.content || response.result.isError !== undefined) {
              console.error('NATIVE_BRIDGE_LOG: Tools call response received');
            } else {
              console.error('NATIVE_BRIDGE_LOG: Other response type:', Object.keys(response.result));
            }
          }
          
          sendMessageToChrome({ success: true, data: response });
        } catch (e) {
          console.error('NATIVE_BRIDGE_LOG: Failed to parse Game Automation response as JSON:', line);
          // If it's not JSON, it might be a log message or initialization output
          console.error('NATIVE_BRIDGE_LOG: Raw output (not JSON):', line);
        }
      }
    });
  } else {
    console.error('NATIVE_BRIDGE_LOG: Game Automation server stdout is not available.');
  }

  if (gameAutomationServer.stderr) {
    gameAutomationServer.stderr.on('data', (data: Buffer) => {
      const error = data.toString().trim();
      console.error(`NATIVE_BRIDGE_LOG: Game Automation stderr: ${error}`);
    });
  }

  // Handle process exit
  process.on('exit', (code) => {
    console.error(`NATIVE_BRIDGE_LOG: Exiting with code ${code}.`);
    if (mcpServerInstance && !mcpServerInstance.killed) {
      mcpServerInstance.kill();
    }
    if (gameAutomationServer && !gameAutomationServer.killed) {
      gameAutomationServer.kill();
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
  console.error('NATIVE_BRIDGE_LOG: Message type is:', typeof message.type, 'value:', message.type);
  console.error('NATIVE_BRIDGE_LOG: Checking call_tool condition:', message.type === 'call_tool');
  
  // Handle call_tool request for game automation server
  if (message.type === 'call_tool') {
    console.error('NATIVE_BRIDGE_LOG: Handling call_tool request');
    if (!gameAutomationServer || !gameAutomationServer.stdin || gameAutomationServer.stdin.destroyed) {
      sendMessageToChrome({ 
        success: false, 
        error: 'Game automation server not available' 
      });
      return;
    }
    
    const { tool_name, parameters, request_id } = message;
    console.error('NATIVE_BRIDGE_LOG: Tool call - name:', tool_name, 'parameters:', parameters);
    
    // Send tools/call request to MCP server
    const callToolRequest = JSON.stringify({
      jsonrpc: "2.0",
      id: request_id || Date.now(),
      method: "tools/call",
      params: {
        name: tool_name,
        arguments: parameters || {}
      }
    }) + '\n';
    
    console.error('NATIVE_BRIDGE_LOG: Sending tools/call to game automation server:', callToolRequest.trim());
    if (gameAutomationServer.stdin && !gameAutomationServer.stdin.destroyed) {
      gameAutomationServer.stdin.write(callToolRequest);
    } else {
      sendMessageToChrome({ 
        success: false, 
        error: 'Game automation server stdin not available for tool call' 
      });
    }
    return;
  }

  // Handle list_tools request for game automation server
  if (message.method === 'list_tools' || message.type === 'list_tools') {
    console.error('NATIVE_BRIDGE_LOG: Handling list_tools request');
    if (!gameAutomationServer || !gameAutomationServer.stdin || gameAutomationServer.stdin.destroyed) {
      sendMessageToChrome({ 
        success: false, 
        error: 'Game automation server not available' 
      });
      return;
    }
    
    // Function to send the tools/list request
    const sendToolsList = () => {
      if (!gameAutomationServer || !gameAutomationServer.stdin || gameAutomationServer.stdin.destroyed) {
        console.error('NATIVE_BRIDGE_LOG: Cannot send tools/list - server stdin not available');
        sendMessageToChrome({ 
          success: false, 
          error: 'Game automation server stdin not available' 
        });
        return;
      }
      
      const requestId = Date.now();
      
      // Your server accepts tools/list with empty params
      const listToolsRequest = JSON.stringify({
        jsonrpc: "2.0",
        id: requestId,
        method: "tools/list",
        params: {}
      }) + '\n';
      
      console.error('NATIVE_BRIDGE_LOG: Sending tools/list request:', listToolsRequest.trim());
      console.error('NATIVE_BRIDGE_LOG: Request details - id:', requestId, 'method: tools/list, params: {}');
      gameAutomationServer.stdin.write(listToolsRequest);
    };
    
    // If we're sure it's initialized, send immediately
    if ((gameAutomationServer as any)._initialized) {
      console.error('NATIVE_BRIDGE_LOG: Server already initialized, sending tools/list immediately');
      sendToolsList();
    } else {
      // Otherwise wait a bit for auto-initialization to complete
      console.error('NATIVE_BRIDGE_LOG: Server not yet initialized, waiting 3 seconds for auto-initialization...');
      setTimeout(() => {
        console.error('NATIVE_BRIDGE_LOG: Sending tools/list after wait period');
        sendToolsList();
      }, 3000); // Wait 3 seconds for full initialization sequence
    }
    return;
  }
  
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
    } else if (toolName === 'bilibili_search') {
      if (!parameters.query) {
        sendMessageToChrome({
          success: false,
          error: 'NATIVE_BRIDGE_LOG: bilibili_search tool call missing query parameter.'
        });
        return;
      }
      mcpMessage = {
        method: 'tool',
        params: {
          name: 'bilibili_search',
          parameters: {
            query: parameters.query
          }
        }
      };
    } else if (toolName === 'xiaohongshu_search') {
      if (!parameters.query) {
        sendMessageToChrome({
          success: false,
          error: 'NATIVE_BRIDGE_LOG: xiaohongshu_search tool call missing query parameter.'
        });
        return;
      }
      mcpMessage = {
        method: 'tool',
        params: {
          name: 'xiaohongshu_search',
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