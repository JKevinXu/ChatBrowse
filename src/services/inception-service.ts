import { ConfigService } from './config-service';

export interface InceptionResponse {
  content: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
}

export class InceptionService {
  private configService = ConfigService.getInstance();

  async initialize(): Promise<boolean> {
    try {
      const llmSettings = await this.configService.getLLMSettings();
      
      if (llmSettings.provider !== 'inception' || !llmSettings.inception) {
        return false;
      }

      const { apiKey } = llmSettings.inception;
      
      if (!apiKey) {
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Inception initialization failed:', error);
      return false;
    }
  }

  async isInitialized(): Promise<boolean> {
    return await this.initialize();
  }

  async generateText(prompt: string, maxTokens: number = 1000): Promise<InceptionResponse> {
    const llmSettings = await this.configService.getLLMSettings();
    
    if (!llmSettings.inception?.apiKey) {
      throw new Error('Inception API key not configured. Please check your settings.');
    }

    const { apiKey, model = 'mercury-coder', baseUrl = 'https://api.inceptionlabs.ai/v1' } = llmSettings.inception;

    try {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: maxTokens
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Inception API error (${response.status}): ${errorText}`);
      }

      const data = await response.json();
      
      return {
        content: data.choices?.[0]?.message?.content?.trim() || '',
        usage: data.usage ? {
          inputTokens: data.usage.prompt_tokens || 0,
          outputTokens: data.usage.completion_tokens || 0
        } : undefined
      };
    } catch (error) {
      console.error('Inception API call failed:', error);
      throw new Error(`Inception API error: ${(error as Error).message}`);
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.generateText("Hello", 10);
      return true;
    } catch (error) {
      console.error('Inception connection test failed:', error);
      return false;
    }
  }

  getAvailableModels(): string[] {
    return [
      'mercury-coder',
      'mercury-chat',
      'mercury-base'
    ];
  }
} 