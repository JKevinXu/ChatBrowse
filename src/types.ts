export interface Message {
  id: string;
  text: string;
  sender: 'user' | 'system';
  timestamp: number;
  latency?: number; // Response time in milliseconds
  startTime?: number; // When request was sent (for system messages)
}

export interface ChatSession {
  id: string;
  messages: Message[];
  url: string;
  title: string;
  createdAt: number;
  updatedAt: number;
}

export interface ChatCommand {
  type: 'SEND_MESSAGE' | 'CLEAR_CHAT' | 'NAVIGATE' | 'EXTRACT_INFO' | 'SET_CONTEXT' | 'CONTENT_SCRIPT_READY' | 'SUMMARIZE_XIAOHONGSHU_POSTS';
  payload: any;
}

export interface ChatResponse {
  type: 'MESSAGE' | 'NAVIGATION' | 'EXTRACTION_RESULT' | 'ERROR';
  payload: any;
}

export interface PageInfo {
  url: string;
  title: string;
  content?: string;
  useAsContext?: boolean;
}

export type LLMProvider = 'openai' | 'bedrock';

export interface OpenAIConfig {
  apiKey: string;
  model?: string;
}

export interface BedrockConfig {
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  model?: string;
}

export interface LLMSettings {
  provider: LLMProvider;
  openai?: OpenAIConfig;
  bedrock?: BedrockConfig;
}

export interface StorageData {
  sessions: Record<string, ChatSession>;
  settings: {
    openaiApiKey?: string; // Kept for backward compatibility
    showNotifications: boolean;
    llm?: LLMSettings;
  };
}

export interface BackgroundMessage {
  type: 'SEND_MESSAGE' | 'CLEAR_CHAT' | 'START_NEW_CONVERSATION' | 'NAVIGATE' | 'EXTRACT_INFO' | 'SET_CONTEXT' | 'CONTENT_SCRIPT_READY' | 'SUMMARIZE_XIAOHONGSHU_POSTS';
  payload?: any;
} 