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
    console.log('🔧 SessionManager: loadOrCreateSession called with:', { url, title });
    
    // Generate a session key based on URL
    const sessionKey = `session_${this.generateUrlHash(url)}`;
    console.log('🔧 SessionManager: Generated session key:', sessionKey);
    
    try {
      console.log('🔧 SessionManager: Attempting to load existing session...');
      // Try to load existing session
      let session = await loadFromStorage<ChatSession>(sessionKey);
      console.log('🔧 SessionManager: Load result:', session ? 'Found existing session' : 'No existing session');
      
      if (session) {
        console.log('🔧 SessionManager: Existing session details:', { 
          id: session.id, 
          messagesCount: session.messages.length,
          currentTitle: session.title,
          newTitle: title 
        });
        
        // Update the existing session's title if it has changed
        if (session.title !== title) {
          console.log('🔧 SessionManager: Updating session title from', session.title, 'to', title);
          session.title = title;
          session.updatedAt = Date.now();
          await saveToStorage(sessionKey, session);
          console.log('✅ SessionManager: Session title updated and saved');
        }
        
        this.currentSession = session;
        console.log('✅ SessionManager: Existing session loaded successfully');
        return session;
      } else {
        console.log('🔧 SessionManager: Creating new session...');
        // Create new session
        session = createChatSession(url, title);
        console.log('🔧 SessionManager: New session created:', { 
          id: session.id, 
          messagesCount: session.messages.length 
        });
        
        console.log('🔧 SessionManager: Saving new session to storage...');
        await saveToStorage(sessionKey, session);
        console.log('✅ SessionManager: New session saved successfully');
        
        this.currentSession = session;
        return session;
      }
    } catch (error) {
      console.error('❌ SessionManager: Error in loadOrCreateSession:', error);
      console.error('❌ SessionManager: Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      
      // Create fallback session
      console.log('🔧 SessionManager: Creating fallback session...');
      const fallbackSession = createChatSession(url, title);
      console.log('✅ SessionManager: Fallback session created:', { 
        id: fallbackSession.id, 
        messagesCount: fallbackSession.messages.length 
      });
      
      this.currentSession = fallbackSession;
      return fallbackSession;
    }
  }

  async getCurrentTab(): Promise<Tab[]> {
    console.log('🔧 SessionManager: Getting current tab...');
    
    return new Promise((resolve, reject) => {
      try {
        if (!chrome?.tabs?.query) {
          console.error('❌ SessionManager: Chrome tabs API not available');
          reject(new Error('Chrome tabs API not available'));
          return;
        }
        
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          const error = chrome.runtime.lastError;
          if (error) {
            console.error('❌ SessionManager: Chrome tabs query error:', error);
            reject(error);
          } else {
            console.log('✅ SessionManager: Tabs query successful:', tabs);
            resolve(tabs);
          }
        });
      } catch (error) {
        console.error('❌ SessionManager: Exception in getCurrentTab:', error);
        reject(error);
      }
    });
  }

  async addMessageToSession(message: Message): Promise<void> {
    console.log('🔧 SessionManager: Adding message to session:', message.text.substring(0, 50) + '...');
    
    if (!this.currentSession) {
      console.error('❌ SessionManager: No current session available for adding message');
      return;
    }

    this.currentSession.messages.push(message);
    this.currentSession.updatedAt = Date.now();
    console.log('🔧 SessionManager: Message added, total messages:', this.currentSession.messages.length);

    try {
      const sessionKey = `session_${this.generateUrlHash(this.currentSession.url)}`;
      console.log('🔧 SessionManager: Saving updated session with key:', sessionKey);
      await saveToStorage(sessionKey, this.currentSession);
      console.log('✅ SessionManager: Session saved successfully');
    } catch (error) {
      console.error('❌ SessionManager: Failed to save session:', error);
    }
  }

  getCurrentSession(): ChatSession | null {
    console.log('🔧 SessionManager: getCurrentSession called, current session:', 
      this.currentSession ? `ID: ${this.currentSession.id}` : 'null');
    return this.currentSession;
  }

  async startNewConversation(url: string, title: string): Promise<ChatSession> {
    console.log('🔄 SessionManager: Starting new conversation for:', { url, title });
    
    try {
      // Generate session key for current URL
      const sessionKey = `session_${this.generateUrlHash(url)}`;
      console.log('🔧 SessionManager: Generated session key for clearing:', sessionKey);
      
      // Clear existing session from storage
      try {
        console.log('🗑️ SessionManager: Clearing existing session from storage...');
        await chrome.storage.local.remove(sessionKey);
        console.log('✅ SessionManager: Existing session cleared successfully');
      } catch (clearError) {
        console.warn('⚠️ SessionManager: Could not clear existing session:', clearError);
        // Continue anyway - not critical
      }
      
      // Create new session
      console.log('🔧 SessionManager: Creating new session...');
      const newSession = createChatSession(url, title);
      console.log('✅ SessionManager: New session created:', { 
        id: newSession.id, 
        messagesCount: newSession.messages.length 
      });
      
      // Save new session to storage
      console.log('💾 SessionManager: Saving new session to storage...');
      await saveToStorage(sessionKey, newSession);
      console.log('✅ SessionManager: New session saved successfully');
      
      // Update current session
      this.currentSession = newSession;
      console.log('🎉 SessionManager: New conversation started successfully');
      
      return newSession;
      
    } catch (error) {
      console.error('❌ SessionManager: Error starting new conversation:', error);
      
      // Create fallback session if something goes wrong
      console.log('🔧 SessionManager: Creating fallback session...');
      const fallbackSession = createChatSession(url, title);
      this.currentSession = fallbackSession;
      console.log('✅ SessionManager: Fallback session created');
      
      return fallbackSession;
    }
  }

  private generateUrlHash(url: string): string {
    console.log('🔧 SessionManager: Generating hash for URL:', url);
    // Simple hash function for URL-based session keys
    let hash = 0;
    for (let i = 0; i < url.length; i++) {
      const char = url.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    const hashString = Math.abs(hash).toString(36);
    console.log('🔧 SessionManager: Generated hash:', hashString);
    return hashString;
  }
} 