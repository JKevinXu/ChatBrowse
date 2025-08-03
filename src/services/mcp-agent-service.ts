/**
 * MCP Agent Service - Intelligent tool selection and execution
 * Integrates with ChatBrowse's existing LLM and intent systems
 */

import { MCPClient, MCPTool } from './mcp-client';
import { LLMService } from './llm-service';

export interface AgentTask {
  userIntent: string;
  selectedTool?: MCPTool;
  parameters?: Record<string, any>;
  executionResult?: any;
  status: 'pending' | 'tool_selected' | 'executing' | 'completed' | 'failed';
}

export class MCPAgentService {
  private static instance: MCPAgentService;
  private mcpClient: MCPClient;
  private llmService: LLMService;

  private constructor() {
    this.mcpClient = MCPClient.getInstance();
    this.llmService = LLMService.getInstance();
  }

  public static getInstance(): MCPAgentService {
    if (!MCPAgentService.instance) {
      MCPAgentService.instance = new MCPAgentService();
    }
    return MCPAgentService.instance;
  }

  /**
   * Main agent workflow: analyze intent → select tool → execute
   */
  public async processUserRequest(userInput: string): Promise<AgentTask> {
    console.log('🤖 MCP Agent: Processing user request:', userInput);

    const task: AgentTask = {
      userIntent: userInput,
      status: 'pending'
    };

    try {
      // Step 1: Get available tools
      const availableTools = await this.mcpClient.listTools();
      console.log('🤖 MCP Agent: Found', availableTools.length, 'available tools');

      // Step 2: Use LLM to select appropriate tool
      const selectedTool = await this.selectTool(userInput, availableTools);
      if (!selectedTool) {
        task.status = 'failed';
        return task;
      }

      task.selectedTool = selectedTool;
      task.status = 'tool_selected';
      console.log('🤖 MCP Agent: Selected tool:', selectedTool.name);

      // Step 3: Extract parameters using LLM
      const parameters = await this.extractParameters(userInput, selectedTool);
      task.parameters = parameters;

      // Step 4: Execute the tool
      task.status = 'executing';
      const result = await this.executeTool(selectedTool, parameters);
      task.executionResult = result;
      task.status = 'completed';

      console.log('🤖 MCP Agent: Task completed successfully');
      return task;

    } catch (error) {
      console.error('🤖 MCP Agent: Task failed:', error);
      task.status = 'failed';
      return task;
    }
  }

  /**
   * Use LLM to select the most appropriate tool for the user's intent
   */
  private async selectTool(userInput: string, availableTools: MCPTool[]): Promise<MCPTool | null> {
    const toolDescriptions = availableTools.map(tool => 
      `${tool.name}: ${tool.description}`
    ).join('\n');

    const prompt = `
You are an AI assistant that selects the best tool for a user's request.

User Request: "${userInput}"

Available Tools:
${toolDescriptions}

Rules:
1. Select the tool that best matches the user's intent
2. If no tool is appropriate, respond with "NONE"
3. Only respond with the exact tool name

Selected Tool:`;

    try {
      // Use your existing LLM service
      const response = await this.callLLM(prompt);
      const toolName = response.trim();

      if (toolName === 'NONE') {
        return null;
      }

      return availableTools.find(tool => tool.name === toolName) || null;
    } catch (error) {
      console.error('🤖 MCP Agent: Tool selection failed:', error);
      return null;
    }
  }

  /**
   * Extract parameters from user input for the selected tool
   */
  private async extractParameters(userInput: string, tool: MCPTool): Promise<Record<string, any>> {
    if (!tool.inputSchema?.properties) {
      return {};
    }

    const properties = Object.entries(tool.inputSchema.properties)
      .map(([key, value]: [string, any]) => 
        `${key} (${value.type}): ${value.description || 'No description'}`
      ).join('\n');

    const prompt = `
Extract parameters for the "${tool.name}" tool from the user's request.

User Request: "${userInput}"

Tool Parameters:
${properties}

Rules:
1. Extract only the parameters that can be inferred from the user's request
2. Use appropriate data types (boolean, string, number)
3. If a parameter can't be determined, omit it (use defaults)
4. Respond with valid JSON only

Parameters:`;

    try {
      const response = await this.callLLM(prompt);
      return JSON.parse(response.trim());
    } catch (error) {
      console.error('🤖 MCP Agent: Parameter extraction failed:', error);
      return {};
    }
  }

  /**
   * Execute the selected tool with parameters using MCP tools/call
   */
  private async executeTool(tool: MCPTool, parameters: Record<string, any>): Promise<any> {
    console.log('🤖 MCP Agent: Executing tool:', tool.name, 'with parameters:', parameters);

    try {
      // Use the MCP client's public method to call the tool
      const result = await this.mcpClient.callTool(tool.name, parameters);
      console.log('🤖 MCP Agent: Tool execution result:', result);
      return result;
    } catch (error) {
      console.error('🤖 MCP Agent: Tool execution failed:', error);
      throw new Error(`Tool execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Helper to call LLM service
   */
  private async callLLM(prompt: string): Promise<string> {
    return new Promise((resolve, reject) => {
      // Mock implementation - integrate with your actual LLM service
      // You'd call this.llmService.generateResponse() or similar
      setTimeout(() => {
        // For Shimen task automation, this would typically select "run_shimen_task"
        if (prompt.includes('shimen') || prompt.includes('师门') || prompt.includes('automation')) {
          if (prompt.includes('Selected Tool:')) {
            resolve('run_shimen_task');
          } else if (prompt.includes('Parameters:')) {
            resolve('{"verbose": true}');
          }
        } else {
          resolve('NONE');
        }
      }, 100);
    });
  }

  /**
   * Get a formatted response for the user
   */
  public formatAgentResponse(task: AgentTask): string {
    switch (task.status) {
      case 'pending':
        return '🤖 Analyzing your request...';
        
      case 'tool_selected':
        return `🤖 Selected tool: **${task.selectedTool?.name}**\n📝 ${task.selectedTool?.description}`;
        
      case 'executing':
        return `🤖 Executing **${task.selectedTool?.name}**...\n⏳ Please wait while the automation runs.`;
        
      case 'completed':
        return `✅ **Task Completed Successfully!**\n\n` +
               `🔧 Tool: ${task.selectedTool?.name}\n` +
               `📊 Result: ${JSON.stringify(task.executionResult, null, 2)}`;
        
      case 'failed':
        return '❌ Task failed. Please try again or be more specific with your request.';
        
      default:
        return '🤖 Processing...';
    }
  }
}

/**
 * Integration with existing message router
 */
export function isAgentRequest(message: string): boolean {
  const agentKeywords = [
    'run', 'execute', 'start', 'begin', 'do',
    'automation', 'task', 'shimen', '师门',
    'help me', 'can you', 'please'
  ];
  
  const lowerMessage = message.toLowerCase();
  return agentKeywords.some(keyword => lowerMessage.includes(keyword));
} 