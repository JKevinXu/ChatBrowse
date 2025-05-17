/**
 * This is a simplified native messaging client for Chrome extensions to connect to the MCP server.
 */

// Add Chrome types reference
/// <reference types="chrome"/>

interface MessageRequest {
  type: 'browse';
  url: string;
  selector?: string;
}

interface MessageResponse {
  success: boolean;
  data?: any;
  error?: string;
}

// Connection to native messaging host
class McpNativeClient {
  private port: chrome.runtime.Port | null = null;
  private messageQueue: { 
    request: MessageRequest; 
    resolve: (value: any) => void; 
    reject: (reason: any) => void 
  }[] = [];
  private isConnected = false;
  
  constructor() {
    this.connectToNativeHost();
  }
  
  private connectToNativeHost(): void {
    try {
      this.port = chrome.runtime.connectNative('com.chatbrowse.mcp');
      
      this.port.onMessage.addListener((response: any) => {
        this.handleResponse(response);
      });
      
      this.port.onDisconnect.addListener(() => {
        const error = chrome.runtime.lastError 
          ? chrome.runtime.lastError.message 
          : 'Native messaging host disconnected';
        
        console.error('Native host disconnected:', error);
        this.isConnected = false;
        this.port = null;
        
        // Reject any pending messages
        this.messageQueue.forEach(({ reject }) => {
          reject(new Error('Native messaging host disconnected'));
        });
        this.messageQueue = [];
        
        // Try to reconnect after a delay
        setTimeout(() => this.connectToNativeHost(), 5000);
      });
      
      this.isConnected = true;
      console.log('Connected to MCP native host');
    } catch (error) {
      console.error('Failed to connect to native host:', error);
      this.isConnected = false;
      setTimeout(() => this.connectToNativeHost(), 5000);
    }
  }
  
  private handleResponse(response: any): void {
    if (this.messageQueue.length === 0) {
      console.warn('Received response with no pending request');
      return;
    }
    
    const { resolve, reject } = this.messageQueue.shift()!;
    
    if (response.error) {
      reject(new Error(response.error));
    } else {
      resolve(response.data);
    }
  }
  
  public async browseWebpage(url: string, selector?: string): Promise<any> {
    return this.sendMessage({
      type: 'browse',
      url,
      selector
    });
  }
  
  private sendMessage(request: MessageRequest): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.isConnected || !this.port) {
        reject(new Error('Not connected to native messaging host'));
        return;
      }
      
      // Add to message queue
      this.messageQueue.push({ request, resolve, reject });
      
      // Send the message
      try {
        this.port.postMessage(request);
      } catch (error) {
        this.messageQueue.pop(); // Remove the message from the queue
        reject(error);
      }
    });
  }
}

// Export the client for use in the extension
export const mcpClient = new McpNativeClient(); 