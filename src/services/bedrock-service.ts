import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { ConfigService } from './config-service';

export interface BedrockResponse {
  content: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
}

export class BedrockService {
  private client: BedrockRuntimeClient | null = null;
  private configService = ConfigService.getInstance();

  async initialize(): Promise<boolean> {
    try {
      const llmSettings = await this.configService.getLLMSettings();
      
      if (llmSettings.provider !== 'bedrock' || !llmSettings.bedrock) {
        return false;
      }

      const { region, accessKeyId, secretAccessKey } = llmSettings.bedrock;
      
      if (!region || !accessKeyId || !secretAccessKey) {
        return false;
      }

      this.client = new BedrockRuntimeClient({
        region,
        credentials: {
          accessKeyId,
          secretAccessKey
        }
      });
      
      return true;
    } catch (error) {
      console.error('Bedrock initialization failed:', error);
      return false;
    }
  }

  async isInitialized(): Promise<boolean> {
    if (this.client) {
      return true;
    }
    return await this.initialize();
  }

  private async invokeClaude(prompt: string, maxTokens: number = 1000): Promise<string> {
    if (!this.client) {
      throw new Error('Bedrock client not initialized');
    }

    // Clear config cache to ensure we get fresh settings
    this.configService.clearCache();
    
    const llmSettings = await this.configService.getLLMSettings();
    const selectedModel = llmSettings.bedrock?.model || 'us.anthropic.claude-3-5-sonnet-20241022-v2:0';
    
    console.log(`[Bedrock] Selected model from config: ${selectedModel}`);
    
    // Map model selections to proper inference profile ARNs or cross-region IDs
    let modelId = selectedModel;
    
    // Use cross-region inference profiles for better availability
    switch (selectedModel) {
      case 'claude-4-opus':
        modelId = 'us.anthropic.claude-opus-4-20250514-v1:0';
        console.log(`[Bedrock] Mapped '${selectedModel}' to '${modelId}'`);
        break;
      case 'claude-4-sonnet':
        modelId = 'us.anthropic.claude-sonnet-4-20250514-v1:0';
        console.log(`[Bedrock] Mapped '${selectedModel}' to '${modelId}'`);
        break;
      case 'claude-3-5-sonnet':
        modelId = 'us.anthropic.claude-3-5-sonnet-20241022-v2:0';
        console.log(`[Bedrock] Mapped '${selectedModel}' to '${modelId}'`);
        break;
      case 'claude-3-sonnet':
        modelId = 'us.anthropic.claude-3-sonnet-20240229-v1:0';
        console.log(`[Bedrock] Mapped '${selectedModel}' to '${modelId}'`);
        break;
      case 'claude-3-haiku':
        modelId = 'us.anthropic.claude-3-haiku-20240307-v1:0';
        console.log(`[Bedrock] Mapped '${selectedModel}' to '${modelId}'`);
        break;
      default:
        // If it's already a proper ID, use it as-is
        console.log(`[Bedrock] Using model ID as-is: ${modelId}`);
        break;
    }

    console.log(`[Bedrock] Making API call with model: ${modelId}`);

    const body = JSON.stringify({
      anthropic_version: "bedrock-2023-05-31",
      max_tokens: maxTokens,
      messages: [
        {
          role: "user",
          content: prompt
        }
      ]
    });

    const command = new InvokeModelCommand({
      modelId,
      body,
      contentType: 'application/json',
      accept: 'application/json'
    });

    try {
      const response = await this.client!.send(command);
      const responseBody = JSON.parse(new TextDecoder().decode(response.body));
      
      return responseBody.content[0]?.text || '';
    } catch (error) {
      console.error('Bedrock API call failed:', error);
      throw new Error(`Bedrock API error: ${(error as Error).message}`);
    }
  }

  async generateText(prompt: string, maxTokens: number = 1000): Promise<BedrockResponse> {
    if (!this.client) {
      const initialized = await this.initialize();
      if (!initialized) {
        throw new Error('Bedrock client not initialized. Please check your AWS credentials.');
      }
    }

    try {
      const content = await this.invokeClaude(prompt, maxTokens);
      return {
        content,
        usage: undefined // We'll add usage tracking later if needed
      };
    } catch (error) {
      console.error('Bedrock generateText failed:', error);
      throw error;
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.generateText("Hello", 10);
      return true;
    } catch (error) {
      console.error('Bedrock connection test failed:', error);
      return false;
    }
  }

  getAvailableModels(): string[] {
    return [
      'claude-4-opus',
      'claude-4-sonnet',
      'claude-3-5-sonnet',
      'claude-3-sonnet', 
      'claude-3-haiku'
    ];
  }
} 