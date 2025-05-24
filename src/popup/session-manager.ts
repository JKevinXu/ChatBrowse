import { ChatSession, Message } from '../types';
import { createMessage, createChatSession, loadFromStorage, saveToStorage } from '../utils';

interface Tab {
  id?: number;
  url?: string;
  title?: string;
  active?: boolean;
}

export class SessionManager {
  private currentSession: ChatSession | null = null;

  async loadOrCreateSession(url: string, title: string): Promise<ChatSession> {
    // Generate a session key based on URL
    const sessionKey = `session_${this.generateUrlHash(url)}`;
    
    try {
      // Try to load existing session
      let session = await loadFromStorage<ChatSession>(sessionKey);
      
      if (session) {
        // Update the existing session's title if it has changed
        if (session.title !== title) {
          session.title = title;
          session.updatedAt = Date.now();
          await saveToStorage(sessionKey, session);
        }
        
        this.currentSession = session;
        return session;
      } else {
        // Create new session
        session = createChatSession(url, title);
        await saveToStorage(sessionKey, session);
        this.currentSession = session;
        return session;
      }
    } catch (error) {
      console.error('Error loading session:', error);
      // Create fallback session
      const fallbackSession = createChatSession(url, title);
      this.currentSession = fallbackSession;
      return fallbackSession;
    }
  }

  async getCurrentTab(): Promise<Tab[]> {
    return new Promise((resolve) => {
      chrome.tabs.query({ active: true, currentWindow: true }, resolve);
    });
  }

  async addMessageToSession(message: Message): Promise<void> {
    if (!this.currentSession) return;

    this.currentSession.messages.push(message);
    this.currentSession.updatedAt = Date.now();

    try {
      const sessionKey = `session_${this.generateUrlHash(this.currentSession.url)}`;
      await saveToStorage(sessionKey, this.currentSession);
    } catch (error) {
      console.error('Failed to save session:', error);
    }
  }

  getCurrentSession(): ChatSession | null {
    return this.currentSession;
  }

  private generateUrlHash(url: string): string {
    // Simple hash function for URL-based session keys
    let hash = 0;
    for (let i = 0; i < url.length; i++) {
      const char = url.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }
} 