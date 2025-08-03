/**
 * Real MCP Client using native messaging to communicate with MCP servers
 * Specifically designed for the Shimen Task Design MCP Server
 */

export interface MCPTool {
  name: string;
  description: string;
  category?: string;
  parameters?: Record<string, any>;
  inputSchema?: any;
}

export interface MCPServerInfo {
  name: string;
  url: string;
  status: 'connected' | 'disconnected' | 'connecting';
  tools: MCPTool[];
}

export class MCPClient {
  private static instance: MCPClient;
  private serverInfo: MCPServerInfo;
  private nativePort: chrome.runtime.Port | null = null;

  private constructor() {
    this.serverInfo = {
      name: 'Shimen Task Automation',
      url: 'https://github.com/JKevinXu/GameAutomation',
      status: 'disconnected',
      tools: []
    };
    this.initializeNativeMessaging();
  }

  public static getInstance(): MCPClient {
    if (!MCPClient.instance) {
      MCPClient.instance = new MCPClient();
    }
    return MCPClient.instance;
  }

  /**
   * Initialize native messaging connection
   */
  private initializeNativeMessaging(): void {
    try {
      this.nativePort = chrome.runtime.connectNative('com.chatbrowse.mcp');
      
      this.nativePort.onMessage.addListener((response: any) => {
        console.log('🔌 MCP: Received response from native host:', response);
        this.handleNativeResponse(response);
      });
      
      this.nativePort.onDisconnect.addListener(() => {
        const error = chrome.runtime.lastError?.message || 'Native messaging disconnected';
        console.error('🔌 MCP: Native messaging disconnected:', error);
        this.serverInfo.status = 'disconnected';
        this.nativePort = null;
      });
      
      this.serverInfo.status = 'connected';
    } catch (error) {
      console.error('🔌 MCP: Failed to initialize native messaging:', error);
      this.serverInfo.status = 'disconnected';
    }
  }

  /**
   * Handle responses from native messaging host
   */
  private handleNativeResponse(response: any): void {
    console.log('🔌 MCP: Processing response:', response);
    
    if (response.success && response.data) {
      // Check if this is a JSON-RPC error response
      if (response.data.error) {
        console.error('🔌 MCP: Server returned error:', response.data.error);
        const pendingRequest = (this as any)._pendingToolsRequest;
        if (pendingRequest) {
          clearTimeout(pendingRequest.timeout);
          pendingRequest.reject(new Error(`MCP Server Error: ${response.data.error.message || 'Unknown error'}`));
          delete (this as any)._pendingToolsRequest;
        }
        return;
      }
      
      // Check if this is an initialization response (ignore it for tools list)
      if (response.data.result && response.data.result.protocolVersion) {
        console.log('🔌 MCP: Received initialization response, ignoring for tools list');
        return;
      }
      
      // Check for successful tools/list response
      if (response.data.result && response.data.result.tools) {
        // This is a tools/list response
        this.processToolsListResponse(response.data.result.tools);
        
        // Resolve pending tools request if any
        const pendingRequest = (this as any)._pendingToolsRequest;
        if (pendingRequest) {
          clearTimeout(pendingRequest.timeout);
          pendingRequest.resolve([...this.serverInfo.tools]);
          delete (this as any)._pendingToolsRequest;
        }
      } else if (response.data.result && Array.isArray(response.data.result)) {
        // Check if tools are directly in result (different MCP server format)
        console.log('🔌 MCP: Tools directly in result array');
        this.processToolsListResponse(response.data.result);
        
        const pendingRequest = (this as any)._pendingToolsRequest;
        if (pendingRequest) {
          clearTimeout(pendingRequest.timeout);
          pendingRequest.resolve([...this.serverInfo.tools]);
          delete (this as any)._pendingToolsRequest;
        }
      }
    } else if (!response.success) {
      // Handle error response
      const pendingRequest = (this as any)._pendingToolsRequest;
      if (pendingRequest) {
        clearTimeout(pendingRequest.timeout);
        pendingRequest.reject(new Error(response.error || 'MCP server error'));
        delete (this as any)._pendingToolsRequest;
      }
    }
  }

  /**
   * Process tools list response from MCP server
   */
  private processToolsListResponse(tools: any[]): void {
    const processedTools: MCPTool[] = tools.map(tool => {
      const toolName = tool.name || 'unknown_tool';
      const toolDescription = tool.description || 'No description available';
      
      return {
        name: toolName,
        description: toolDescription,
        category: this.categorizetool(toolName),
        parameters: tool.inputSchema?.properties || {},
        inputSchema: tool.inputSchema
      };
    });

    this.serverInfo.tools = processedTools;
    this.serverInfo.status = 'connected';
    console.log('🔌 MCP: Updated tools list:', processedTools);
  }

  /**
   * Categorize tools based on their names
   */
  private categorizetool(toolName: string | undefined): string {
    if (!toolName) return 'General';
    
    if (toolName.includes('capture') || toolName.includes('screenshot')) {
      return 'Screen Capture';
    } else if (toolName.includes('execute') || toolName.includes('run')) {
      return 'Task Automation';
    } else if (toolName.includes('status') || toolName.includes('list')) {
      return 'Task Management';
    } else if (toolName.includes('analyze') || toolName.includes('detect')) {
      return 'Screen Analysis';
    } else if (toolName.includes('click') || toolName.includes('action')) {
      return 'Action Execution';
    } else {
      return 'General';
    }
  }

  /**
   * List all available tools from the MCP server
   */
  public async listTools(): Promise<MCPTool[]> {
    console.log('🔌 MCP: Fetching tools from server...');
    
    try {
      this.serverInfo.status = 'connecting';
      
      if (!this.nativePort) {
        this.initializeNativeMessaging();
        if (!this.nativePort) {
          throw new Error('Failed to connect to native messaging host');
        }
      }
      
      // Send list_tools request to native messaging host
      this.nativePort.postMessage({
        type: 'list_tools'
      });
      
      // Wait for response with timeout
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          this.serverInfo.status = 'disconnected';
          reject(new Error('Timeout waiting for tools list response'));
        }, 10000); // 10 second timeout
        
        // Store the resolve/reject for when response comes back
        (this as any)._pendingToolsRequest = { resolve, reject, timeout };
        
        // If we already have tools from a previous response, return them immediately
        if (this.serverInfo.tools.length > 0) {
          clearTimeout(timeout);
          delete (this as any)._pendingToolsRequest;
          this.serverInfo.status = 'connected';
          resolve([...this.serverInfo.tools]);
        }
      });
      
    } catch (error) {
      console.error('🔌 MCP: Failed to fetch tools:', error);
      this.serverInfo.status = 'disconnected';
      throw new Error('Failed to connect to MCP server');
    }
  }

  /**
   * Get server information
   */
  public getServerInfo(): MCPServerInfo {
    return { ...this.serverInfo };
  }

  /**
   * Format tools list for display in chat
   */
  public formatToolsList(tools: MCPTool[]): string {
    if (tools.length === 0) {
      return '❌ No tools available from MCP server';
    }

    let formatted = `🔌 **MCP Server Tools** (${tools.length} available)\n\n`;
    
    // Group tools by category
    const categories = new Map<string, MCPTool[]>();
    tools.forEach(tool => {
      const category = tool.category || 'General';
      if (!categories.has(category)) {
        categories.set(category, []);
      }
      categories.get(category)!.push(tool);
    });

    // Format by category
    categories.forEach((categoryTools, category) => {
      formatted += `**${category}:**\n`;
      categoryTools.forEach(tool => {
        formatted += `• **${tool.name}** - ${tool.description}\n`;
        if (tool.parameters && Object.keys(tool.parameters).length > 0) {
          formatted += `  *Parameters: ${Object.keys(tool.parameters).join(', ')}*\n`;
        }
      });
      formatted += '\n';
    });

    formatted += `💡 **Usage:** Select MCP tool and type commands like:\n`;
    formatted += `• "capture_screen region=game_area"\n`;
    formatted += `• "execute_task task_name=daily_login"\n`;
    formatted += `• "list_available_tasks"`;

    return formatted;
  }

  /**
   * Simple delay utility
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Check if message is requesting tool list
   */
  public isListToolsRequest(message: string): boolean {
    const cleanMessage = message.replace(/^mcp:\s*/i, '').trim().toLowerCase();
    return cleanMessage === 'list tools' || 
           cleanMessage === 'list' || 
           cleanMessage === 'tools' ||
           cleanMessage === 'help' ||
           cleanMessage === '';
  }

  /**
   * Execute an MCP tool with parameters
   */
  public async callTool(toolName: string, parameters: Record<string, any>): Promise<any> {
    console.log('🔌 MCP: Calling tool:', toolName, 'with parameters:', parameters);
    
    if (!this.nativePort) {
      throw new Error('No native messaging connection available');
    }

    return new Promise((resolve, reject) => {
      const requestId = Date.now();
      const callRequest = {
        type: 'call_tool',
        tool_name: toolName,
        parameters: parameters,
        request_id: requestId
      };

      console.log('🔌 MCP: Sending tool call request:', callRequest);

      // Set up response handler for this specific request
      const responseHandler = (response: any) => {
        console.log('🔌 MCP: Received tool call response:', response);
        
        if (response.success && response.data) {
          if (response.data.error) {
            this.nativePort?.onMessage.removeListener(responseHandler);
            reject(new Error(`MCP Tool Error: ${response.data.error.message || 'Unknown error'}`));
          } else if (response.data.result) {
            this.nativePort?.onMessage.removeListener(responseHandler);
            resolve(response.data.result);
          }
        } else if (!response.success) {
          this.nativePort?.onMessage.removeListener(responseHandler);
          reject(new Error(response.error || 'Tool call failed'));
        }
      };

      // Add temporary response handler
      if (this.nativePort) {
        this.nativePort.onMessage.addListener(responseHandler);
        // Send the request
        this.nativePort.postMessage(callRequest);
      } else {
        reject(new Error('Native messaging connection lost'));
      }

      // Timeout after 90 seconds (Shimen automation can take time)
      setTimeout(() => {
        this.nativePort?.onMessage.removeListener(responseHandler);
        reject(new Error('Tool call timeout - the automation might still be running'));
      }, 90000);
    });
  }
} 