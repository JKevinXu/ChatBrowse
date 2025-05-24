import { Message, ChatSession } from './types';

// Re-export from split utility modules
export { extractPageInfo } from './utils/content-extractor';
export { processCommand } from './utils/command-processor';
export { saveToStorage, loadFromStorage } from './utils/storage-utils';

/**
 * Generate a unique ID
 */
export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

/**
 * Create a new message
 */
export function createMessage(text: string, sender: 'user' | 'system'): Message {
  return {
    id: generateId(),
    text,
    sender,
    timestamp: Date.now(),
  };
}

/**
 * Create a new chat session
 */
export function createChatSession(url: string, title: string): ChatSession {
  const id = generateId();
  return {
    id,
    messages: [
      createMessage('Welcome to ChatBrowse! How can I help you navigate this website?', 'system'),
    ],
    url,
    title,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
} 