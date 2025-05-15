declare module 'openai' {
  export interface OpenAIOptions {
    apiKey: string;
    dangerouslyAllowBrowser?: boolean;
  }

  export interface ChatMessage {
    role: string;
    content: string;
  }

  export interface ChatCompletionRequest {
    model: string;
    messages: ChatMessage[];
    max_tokens?: number;
  }

  export interface Choice {
    message: {
      content: string;
    };
  }

  export interface ChatCompletionResponse {
    choices: Choice[];
  }

  export default class OpenAI {
    constructor(options: OpenAIOptions);
    
    chat: {
      completions: {
        create(request: ChatCompletionRequest): Promise<ChatCompletionResponse>;
      };
    };
  }
} 