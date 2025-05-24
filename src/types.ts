export interface Message {
  id: string;
  text: string;
  sender: 'user' | 'system';
  timestamp: number;
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

export interface StorageData {
  sessions: Record<string, ChatSession>;
  settings: {
    openaiApiKey?: string;
    showNotifications: boolean;
  };
} 