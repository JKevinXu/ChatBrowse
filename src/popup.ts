import { createMessage } from './utils';
import { PopupUI } from './popup/popup-ui';
import { SessionManager } from './popup/session-manager';
import { MessageHandler } from './popup/message-handler';

class PopupApp {
  private ui: PopupUI;
  private sessionManager: SessionManager;
  private messageHandler: MessageHandler;

  constructor() {
    console.log('🔧 PopupApp: Constructor starting...');
    this.sessionManager = new SessionManager();
    this.ui = new PopupUI(
      (text) => this.handleUserMessage(text),
      () => this.handleNewConversation()
    );
    this.messageHandler = new MessageHandler((message) => this.handleIncomingMessage(message));
    console.log('🔧 PopupApp: Constructor completed');
  }

  async initialize(): Promise<void> {
    console.log('🚀 PopupApp: Initialize starting...');
    
    try {
      console.log('🔧 PopupApp: Initializing UI...');
      this.ui.initialize();
      console.log('✅ PopupApp: UI initialized successfully');

      // Connect UI to message handler for loading indicators
      this.messageHandler.setUI(this.ui);

      console.log('🔧 PopupApp: Getting current tab...');
      // Get current tab and load session
      const tabs = await this.sessionManager.getCurrentTab();
      console.log('🔧 PopupApp: Tabs received:', tabs);
      
      if (tabs && tabs.length > 0) {
        const currentTab = tabs[0];
        const tabUrl = currentTab.url || '';
        const tabTitle = currentTab.title || 'Untitled Page';
        
        console.log('🔧 PopupApp: Current tab info:', { url: tabUrl, title: tabTitle, id: currentTab.id });
        
        console.log('🔧 PopupApp: Loading or creating session...');
        const session = await this.sessionManager.loadOrCreateSession(tabUrl, tabTitle);
        console.log('✅ PopupApp: Session loaded/created:', { id: session.id, messagesCount: session.messages.length });
        
        console.log('🔧 PopupApp: Rendering messages...');
        this.renderMessages(session.messages);
        console.log('✅ PopupApp: Messages rendered successfully');
      } else {
        console.log('⚠️ PopupApp: No active tabs found, using fallback session');
        // Fallback session
        const fallbackSession = await this.sessionManager.loadOrCreateSession('', 'ChatBrowse');
        console.log('✅ PopupApp: Fallback session created:', { id: fallbackSession.id, messagesCount: fallbackSession.messages.length });
        this.renderMessages(fallbackSession.messages);
      }
    } catch (error) {
      console.error('❌ PopupApp: Initialization failed:', error);
    }

    console.log('🔧 PopupApp: Focusing input...');
    this.focusInput();
    console.log('✅ PopupApp: Initialize completed');
  }

  private renderMessages(messages: any[]): void {
    console.log('🔧 PopupApp: Rendering', messages.length, 'messages');
    
    // Clear existing messages first
    this.ui.clearChat();
    console.log('🔧 PopupApp: Chat cleared');
    
    // Add each message to the chat
    messages.forEach((message, index) => {
      console.log(`🔧 PopupApp: Adding message ${index + 1}/${messages.length}:`, {
        id: message.id,
        sender: message.sender,
        text: message.text.substring(0, 100) + (message.text.length > 100 ? '...' : ''),
        timestamp: message.timestamp
      });
      this.ui.addMessageToChat(message);
    });
    
    console.log('✅ PopupApp: All messages rendered successfully');
  }

  private focusInput(): void {
    console.log('🔧 PopupApp: Attempting to focus input');
    const userInput = document.getElementById('userInput') as HTMLInputElement;
    if (userInput) {
      userInput.focus();
      console.log('✅ PopupApp: Input focused successfully');
    } else {
      console.error('❌ PopupApp: Could not find userInput element');
    }
  }

  private async handleUserMessage(text: string): Promise<void> {
    console.log('💬 PopupApp: Handling user message:', text);
    const session = this.sessionManager.getCurrentSession();
    if (!session) {
      console.error('❌ PopupApp: No current session available');
      return;
    }

    // Add user message to UI and session
    const userMessage = createMessage(text, 'user');
    this.ui.addMessageToChat(userMessage);
    await this.sessionManager.addMessageToSession(userMessage);

    // Show loading states
    this.ui.setSendButtonLoading(true);
    this.ui.setInputDisabled(true);
    this.ui.showTypingIndicator();

    // Send to background for processing
    try {
      console.log('🔧 PopupApp: Sending message to background...');
      const systemMessage = await this.messageHandler.sendMessage(text, session.id);
      
      // Hide loading states before showing response
      this.ui.hideTypingIndicator();
      this.ui.hideProcessingIndicator();
      this.ui.setSendButtonLoading(false);
      this.ui.setInputDisabled(false);
      
      if (systemMessage) {
        console.log('✅ PopupApp: Received system message');
        this.ui.addMessageToChat(systemMessage);
        await this.sessionManager.addMessageToSession(systemMessage);
      }
    } catch (error) {
      console.error('❌ PopupApp: Error sending message:', error);
      
      // Hide loading states on error
      this.ui.hideTypingIndicator();
      this.ui.hideProcessingIndicator();
      this.ui.setSendButtonLoading(false);
      this.ui.setInputDisabled(false);
      
      const errorMessage = createMessage('Error sending message. Please try again.', 'system');
      this.ui.addMessageToChat(errorMessage);
    }
  }

  private async handleIncomingMessage(message: any): Promise<void> {
    console.log('📨 PopupApp: Handling incoming message:', message);
    this.ui.addMessageToChat(message);
    await this.sessionManager.addMessageToSession(message);
  }

  private async handleNewConversation(): Promise<void> {
    console.log('🔄 PopupApp: Starting new conversation...');
    
    try {
      // Show loading state
      this.ui.showProcessingIndicator('Starting new conversation...');
      
      // Get current tab info
      const tabs = await this.sessionManager.getCurrentTab();
      let tabUrl = '';
      let tabTitle = 'ChatBrowse';
      
      if (tabs && tabs.length > 0) {
        const currentTab = tabs[0];
        tabUrl = currentTab.url || '';
        tabTitle = currentTab.title || 'Untitled Page';
      }
      
      console.log('🔧 PopupApp: Creating new session for:', { url: tabUrl, title: tabTitle });
      
      // Start new conversation using session manager
      const newSession = await this.sessionManager.startNewConversation(tabUrl, tabTitle);
      console.log('✅ PopupApp: New session created:', { id: newSession.id, messagesCount: newSession.messages.length });
      
      // Clear the UI and render the new session messages
      this.ui.clearChat();
      this.renderMessages(newSession.messages);
      
      // Also notify the content script if we're on a valid tab
      if (tabs && tabs.length > 0 && tabs[0].id) {
        console.log('🔧 PopupApp: Notifying content script of new conversation...');
        chrome.runtime.sendMessage({
          type: 'START_NEW_CONVERSATION'
        }, (response) => {
          if (response && response.type === 'MESSAGE') {
            console.log('✅ PopupApp: Content script notified successfully');
          } else if (response && response.type === 'ERROR') {
            console.warn('⚠️ PopupApp: Content script notification failed:', response.payload.message);
          }
        });
      }
      
      // Hide loading state
      this.ui.hideProcessingIndicator();
      
      console.log('🎉 PopupApp: New conversation started successfully');
      
    } catch (error) {
      console.error('❌ PopupApp: Error starting new conversation:', error);
      
      // Hide loading state and show error
      this.ui.hideProcessingIndicator();
      
      const errorMessage = createMessage('Failed to start new conversation. Please try again.', 'system');
      this.ui.addMessageToChat(errorMessage);
    }
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
  console.log('🌟 PopupApp: DOM loaded, starting app initialization...');
  const app = new PopupApp();
  await app.initialize();
}); 