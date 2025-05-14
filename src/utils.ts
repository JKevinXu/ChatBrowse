import { Message, ChatSession } from './types';

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

/**
 * Extract key information from the current webpage
 */
export function extractPageInfo(): { title: string; url: string; content: string } {
  const title = document.title;
  const url = window.location.href;
  
  // Get the main content of the page (this is a simple implementation)
  const mainContent = document.body.textContent || '';
  const content = mainContent.substring(0, 1000); // Limit content length
  
  return { title, url, content };
}

/**
 * Process user command
 * This is a simple implementation that can be extended with NLP capabilities
 */
export function processCommand(text: string): { command: string; args: string } {
  const lowerText = text.toLowerCase().trim();
  
  // Simple command detection
  if (lowerText.startsWith('go to ') || lowerText.startsWith('navigate to ')) {
    const url = lowerText.replace(/^(go to|navigate to)\s+/i, '').trim();
    return { command: 'navigate', args: url };
  }
  
  if (lowerText.startsWith('find ') || lowerText.includes('search for ')) {
    const query = lowerText.replace(/^find\s+/i, '')
      .replace(/search for\s+/i, '').trim();
    return { command: 'search', args: query };
  }
  
  if (lowerText.includes('extract') || lowerText.includes('get info')) {
    return { command: 'extract', args: '' };
  }
  
  // Default to general chat
  return { command: 'chat', args: text };
}

/**
 * Save data to Chrome storage
 */
export function saveToStorage<T>(key: string, data: T): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!chrome?.storage?.local) {
      reject(new Error('Chrome storage API not available'));
      return;
    }
    
    chrome.storage.local.set({ [key]: data }, () => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
}

/**
 * Load data from Chrome storage
 */
export function loadFromStorage<T>(key: string): Promise<T | null> {
  return new Promise((resolve, reject) => {
    if (!chrome?.storage?.local) {
      reject(new Error('Chrome storage API not available'));
      return;
    }
    
    chrome.storage.local.get([key], (result: {[key: string]: any}) => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(error);
      } else {
        resolve(result[key] || null);
      }
    });
  });
} 