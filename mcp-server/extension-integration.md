# Integrating the MCP Server with ChatBrowse Extension

This guide explains how to integrate the MCP server with the ChatBrowse Chrome extension.

## 1. Update the extension's manifest.json

Add the native messaging permission to the extension's manifest.json file:

```json
{
  "permissions": [
    "nativeMessaging",
    // ... other existing permissions
  ]
}
```

## 2. Create a MCP client module in the extension

Create a new file in your extension's source directory (e.g., `src/mcp-client.ts`):

```typescript
/**
 * MCP Client for ChatBrowse
 * Handles communication with the MCP native host
 */

interface BrowseRequest {
  url: string;
  selector?: string;
}

interface BrowseResponse {
  success: boolean;
  content?: any;
  title?: string;
  url?: string;
  error?: string;
}

class McpClient {
  private port: chrome.runtime.Port | null = null;
  private connected = false;
  
  constructor() {
    this.connect();
  }
  
  private connect(): void {
    try {
      this.port = chrome.runtime.connectNative('com.chatbrowse.mcp');
      
      this.port.onDisconnect.addListener(() => {
        console.error('Disconnected from MCP server:', chrome.runtime.lastError?.message);
        this.connected = false;
        this.port = null;
        
        // Try to reconnect after a delay
        setTimeout(() => this.connect(), 5000);
      });
      
      this.connected = true;
      console.log('Connected to MCP server');
    } catch (error) {
      console.error('Failed to connect to MCP server:', error);
      this.connected = false;
      
      // Try to reconnect after a delay
      setTimeout(() => this.connect(), 5000);
    }
  }
  
  public async browseWebpage(url: string, selector?: string): Promise<BrowseResponse> {
    return new Promise((resolve, reject) => {
      if (!this.connected || !this.port) {
        reject(new Error('Not connected to MCP server'));
        return;
      }
      
      // Set up response handler
      const responseHandler = (response: any) => {
        this.port?.onMessage.removeListener(responseHandler);
        
        if (response.error) {
          resolve({ 
            success: false, 
            error: response.error 
          });
        } else {
          resolve({
            success: true,
            content: response.data?.content,
            title: response.data?.title,
            url: response.data?.url
          });
        }
      };
      
      // Listen for response
      this.port.onMessage.addListener(responseHandler);
      
      // Send the request
      try {
        this.port.postMessage({
          type: 'browse',
          url,
          selector
        });
      } catch (error) {
        this.port?.onMessage.removeListener(responseHandler);
        reject(error);
      }
    });
  }
}

// Export singleton instance
export const mcpClient = new McpClient();
```

## 3. Integrate with background.js

Update your background.js to use the MCP client:

```typescript
import { mcpClient } from './mcp-client';

// ... existing background.js code

// Example: Add a message handler for web browsing requests
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'BROWSE_WEBPAGE') {
    (async () => {
      try {
        const result = await mcpClient.browseWebpage(message.url, message.selector);
        sendResponse({ success: true, data: result });
      } catch (error) {
        sendResponse({ 
          success: false, 
          error: error instanceof Error ? error.message : String(error) 
        });
      }
    })();
    return true; // Indicate async response
  }
  
  // ... handle other message types
});
```

## 4. Use from content scripts or popup

Example of using the MCP client from a content script or popup:

```typescript
// Request web browsing
chrome.runtime.sendMessage({
  type: 'BROWSE_WEBPAGE',
  url: 'https://example.com',
  selector: 'h1' // Optional - extract only h1 elements
}, (response) => {
  if (response.success) {
    console.log('Page title:', response.data.title);
    console.log('Page content:', response.data.content);
  } else {
    console.error('Error browsing webpage:', response.error);
  }
});
```

## 5. Check for MCP server in extension

Add a function to check if the MCP server is installed:

```typescript
export async function checkMcpServerInstalled(): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const port = chrome.runtime.connectNative('com.chatbrowse.mcp');
      
      port.onDisconnect.addListener(() => {
        const error = chrome.runtime.lastError;
        resolve(error?.message?.includes('not installed') !== true);
      });
      
      // Send a ping and close immediately
      port.postMessage({ type: 'ping' });
      setTimeout(() => port.disconnect(), 500);
      
    } catch (error) {
      resolve(false);
    }
  });
}

// Usage example
checkMcpServerInstalled().then((installed) => {
  if (!installed) {
    console.warn('MCP server is not installed. Some features may be unavailable.');
    // Show a notification to the user
  }
});
```

## 6. Add server installation instructions

When the MCP server isn't installed, provide instructions to the user:

```typescript
function showMcpServerInstallInstructions() {
  // Show a popup or notification with installation instructions
  const instructionsHtml = `
    <h3>ChatBrowse MCP Server Required</h3>
    <p>To enable AI web browsing features, please install the ChatBrowse MCP Server:</p>
    <ol>
      <li>Download the server from <a href="https://github.com/yourusername/chatbrowse-mcp/releases">GitHub</a></li>
      <li>Run the installer for your platform</li>
      <li>Restart your browser</li>
    </ol>
  `;
  
  // Display this in your UI
}
```

## 7. Build and deploy

After integrating, rebuild your extension with these changes and test the integration. 