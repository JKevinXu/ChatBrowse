import { createMessage } from './utils';
import { PopupUI } from './popup/popup-ui';
import { SessionManager } from './popup/session-manager';
import { MessageHandler } from './popup/message-handler';
import { loadFromStorage } from './utils';

class PopupApp {
  private ui: PopupUI;
  private sessionManager: SessionManager;
  private messageHandler: MessageHandler;

  constructor() {
    console.log('🔧 PopupApp: Constructor starting...');
    this.sessionManager = new SessionManager();
    this.messageHandler = new MessageHandler((message) => {
      console.log('📨 PopupApp: Received message from handler:', message);
      this.handleIncomingMessage(message);
    });
    this.ui = new PopupUI(
      (text: string) => this.handleUserMessage(text),
      () => this.handleSettings(),
      () => this.handleNewConversation(),
      () => this.handleSummarizePage()
    );
    
    // Connect the message handler to the UI for processing indicators
    this.messageHandler.setUI(this.ui);
    
    // Listen for storage changes to detect when API key is configured
    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (namespace === 'local' && changes.settings) {
        this.handleSettingsChange(changes.settings.newValue);
      }
    });
    
    console.log('🔧 PopupApp: Constructor completed');
  }

  async initialize(): Promise<void> {
    console.log('🚀 PopupApp: Initializing...');
    
    try {
      // Check if API key or credentials are configured before showing chat interface
      const settings = await loadFromStorage<any>('settings');
      const hasOpenAIKey = settings && (settings.openaiApiKey || (settings.llm && settings.llm.openai && settings.llm.openai.apiKey));
      const hasBedrockCredentials = settings && settings.llm && settings.llm.bedrock && 
        settings.llm.bedrock.accessKeyId && settings.llm.bedrock.secretAccessKey;
      const hasInceptionKey = settings && settings.llm && settings.llm.inception && 
        settings.llm.inception.apiKey && settings.llm.inception.apiKey.trim() !== '';
      
      if (!hasOpenAIKey && !hasBedrockCredentials && !hasInceptionKey) {
        console.log('ChatBrowse: No API credentials configured, showing settings prompt');
        this.showApiKeyPrompt();
        return;
      }
      
      // Load or create session for the current tab
      const tabs = await this.sessionManager.getCurrentTab();
      if (tabs.length > 0) {
        const tab = tabs[0];
        const session = await this.sessionManager.loadOrCreateSession(tab.url || '', tab.title || '');
        console.log('✅ PopupApp: Session loaded:', {
          id: session.id,
          url: session.url,
          messagesCount: session.messages.length
        });
        
        // Render existing messages
        this.renderMessages(session.messages);
        
        // Check if we should auto-summarize
        await this.checkAutoSummarize();
      } else {
        console.error('❌ PopupApp: No active tab found');
      }
    } catch (error) {
      console.error('❌ PopupApp: Initialization error:', error);
    }
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

  private async handleSummarizePage(): Promise<void> {
    console.log('📄 PopupApp: Auto-filling summarize command...');
    
    // Auto-fill the input with the summarize command and send it
    this.ui.setInputValue('Summarize the page');
    this.ui.triggerSendMessage();
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

  private handleSettings(): void {
    chrome.runtime.openOptionsPage();
  }

  private showApiKeyPrompt(): void {
    // Hide the chat interface and show API key configuration prompt
    const chatContainer = document.querySelector('.chat-container');
    if (chatContainer) {
      chatContainer.innerHTML = `
        <div style="padding: 20px; text-align: center;">
          <h2>🔑 API Credentials Required</h2>
          <p style="margin: 16px 0; color: #666;">
            Please configure your AI provider credentials to use ChatBrowse.
          </p>
          <button id="openSettingsBtn" style="
            background: #007cba; 
            color: white; 
            border: none; 
            padding: 10px 20px; 
            border-radius: 5px; 
            cursor: pointer;
            font-size: 14px;
          ">
            Open Settings
          </button>
          <p style="margin-top: 16px; font-size: 12px; color: #888;">
            Configure <a href="https://platform.openai.com/api-keys" target="_blank" style="color: #007cba;">OpenAI</a>, <a href="https://docs.aws.amazon.com/bedrock/" target="_blank" style="color: #007cba;">AWS Bedrock</a>, or <a href="https://inceptionlabs.ai" target="_blank" style="color: #007cba;">Inception Labs</a> credentials
          </p>
        </div>
      `;
      
      // Add click handler for settings button
      const settingsBtn = document.getElementById('openSettingsBtn');
      if (settingsBtn) {
        settingsBtn.addEventListener('click', () => {
          chrome.runtime.openOptionsPage();
          window.close(); // Close popup after opening settings
        });
      }
    }
  }

  private async handleSettingsChange(newSettings: any): Promise<void> {
    const hasOpenAIKey = newSettings && (newSettings.openaiApiKey || (newSettings.llm && newSettings.llm.openai && newSettings.llm.openai.apiKey));
    const hasBedrockCredentials = newSettings && newSettings.llm && newSettings.llm.bedrock && 
      newSettings.llm.bedrock.accessKeyId && newSettings.llm.bedrock.secretAccessKey;
    const hasInceptionKey = newSettings && newSettings.llm && newSettings.llm.inception && 
      newSettings.llm.inception.apiKey && newSettings.llm.inception.apiKey.trim() !== '';
    
    // Reinitialize the popup interface when settings change
    console.log('ChatBrowse: Settings changed, reinitializing popup interface');
    await this.initialize();
  }

  private async checkAutoSummarize(): Promise<void> {
    try {
      const result = await chrome.storage.local.get(['autoSummarize', 'autoSummarizeUrl', 'autoSummarizeTitle']);
      
      if (result.autoSummarize) {
        console.log('🔧 PopupApp: Auto-summarize flag detected, triggering summarization');
        
        // Clear the auto-summarize flag
        await chrome.storage.local.remove(['autoSummarize', 'autoSummarizeUrl', 'autoSummarizeTitle']);
        
        // Wait a bit for the popup to finish loading, then trigger summarization
        setTimeout(() => {
          this.handleSummarizePage();
        }, 100);
      }
    } catch (error) {
      console.error('❌ PopupApp: Error checking auto-summarize flag:', error);
    }
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
  console.log('🌟 PopupApp: DOM loaded, starting app initialization...');
  const app = new PopupApp();
  await app.initialize();
}); 