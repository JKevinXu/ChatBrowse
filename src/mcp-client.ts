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

interface NativeHostMessage {
  success: boolean;
  data?: any; // Data from MCP server (e.g., startup messages, or actual browse content)
  error?: string; // Error messages from native host or MCP server
  id?: string; // Optional request ID if the message is a response to a specific request
}

class McpClient {
  private port: chrome.runtime.Port | null = null;
  private connected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  
  constructor() {
    this.connect();
  }
  
  private connect(): void {
    try {
      // @ts-ignore - Chrome extension APIs aren't properly typed for connectNative
      this.port = chrome.runtime.connectNative('com.chatbrowse.mcp');
      
      // Add a general listener for any messages from the native host
      this.port.onMessage.addListener((message: NativeHostMessage) => {
        console.log('MCP CLIENT: Received general message from native host:', message);
        // Further handling for general messages can be added here if needed,
        // e.g., if the native host sends unsolicited status updates.
        // For now, we just log them.
      });
      
      this.port.onDisconnect.addListener(() => {
        console.log('MCP CLIENT: Disconnected from native host. Last error:', chrome.runtime.lastError?.message);
        this.connected = false;
        this.port = null;
        
        // Try to reconnect with a limited number of attempts
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++;
          setTimeout(() => this.connect(), 2000);
        } else {
          console.error('Failed to connect to MCP server after multiple attempts');
        }
      });
      
      this.connected = true;
      this.reconnectAttempts = 0;
      console.log('Connected to MCP server');
    } catch (error) {
      console.error('Failed to connect to MCP server:', error);
      this.connected = false;
      
      // Try to reconnect with a limited number of attempts
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        setTimeout(() => this.connect(), 2000);
      }
    }
  }
  
  public async browseWebpage(url: string, selector?: string): Promise<BrowseResponse> {
    return new Promise((resolve, reject) => {
      if (!this.connected || !this.port) {
        reject(new Error('Not connected to MCP server'));
        return;
      }
      
      // Set up response handler for this specific request
      const responseHandler = (response: NativeHostMessage) => { // Use NativeHostMessage type
        this.port?.onMessage.removeListener(responseHandler); // Remove this specific listener
        
        console.log('MCP CLIENT: Received response for browseWebpage:', response); // Log specific response

        if (!response.success) {
          resolve({ 
            success: false, 
            error: response.error || 'Unknown error from MCP server'
          });
        } else {
          if (typeof response.data === 'string') {
            try {
              const parsedData = JSON.parse(response.data);
              if (parsedData.success) {
                resolve({
                  success: true,
                  content: parsedData.content, // content is often an object {title, text, url} from index.js
                  title: parsedData.title || parsedData.content?.title, // Get top-level title or nested one
                  url: parsedData.url || parsedData.content?.url // Get top-level url or nested one
                });
              } else {
                // The inner response indicates failure
                resolve({
                  success: false,
                  error: parsedData.error || 'MCP Server returned success:false in data payload'
                });
              }
            } catch (e: any) {
              resolve({
                success: false,
                error: `MCP_CLIENT_ERROR: Failed to parse JSON response data: ${e.message}`
              });
            }
          } else {
            // This case should ideally not happen if native-bridge always sends a stringified JSON
            resolve({
              success: false,
              error: 'MCP_CLIENT_ERROR: Unexpected response.data format (expected stringified JSON).'
            });
          }
        }
      };
      
      // Listen for the specific response to this request
      this.port.onMessage.addListener(responseHandler);
      
      // Send the request
      try {
        this.port.postMessage({
          method: 'tool',
          params: {
            name: 'browse_webpage',
            parameters: {
              url,
              selector
            }
          }
        });
      } catch (error) {
        this.port?.onMessage.removeListener(responseHandler);
        reject(error);
      }
    });
  }
  
  /**
   * Check if the MCP server is installed and available
   */
  public async isServerAvailable(): Promise<boolean> {
    if (this.connected) return true;
    
    return new Promise((resolve) => {
      try {
        // @ts-ignore - Chrome extension APIs aren't properly typed for connectNative
        const port = chrome.runtime.connectNative('com.chatbrowse.mcp');
        
        port.onDisconnect.addListener(() => {
          const error = chrome.runtime.lastError;
          resolve(error?.message?.includes('not installed') !== true);
        });
        
        // Send a ping and close immediately
        port.postMessage({ 
          method: 'tool',
          params: {
            name: 'ping'
          }
        });
        setTimeout(() => port.disconnect(), 500);
        
      } catch (error) {
        resolve(false);
      }
    });
  }
}

// Export singleton instance
export const mcpClient = new McpClient(); 