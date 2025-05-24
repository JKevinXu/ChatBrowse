import { createMessage } from './utils';
import { PopupUI } from './popup/popup-ui';
import { SessionManager } from './popup/session-manager';
import { MessageHandler } from './popup/message-handler';

class PopupApp {
  private ui: PopupUI;
  private sessionManager: SessionManager;
  private messageHandler: MessageHandler;

  constructor() {
    this.sessionManager = new SessionManager();
    this.ui = new PopupUI((text) => this.handleUserMessage(text));
    this.messageHandler = new MessageHandler((message) => this.handleIncomingMessage(message));
  }

  async initialize(): Promise<void> {
    this.ui.initialize();

    try {
      // Get current tab and load session
      const tabs = await this.sessionManager.getCurrentTab();
      if (tabs && tabs.length > 0) {
        const currentTab = tabs[0];
        const tabUrl = currentTab.url || '';
        const tabTitle = currentTab.title || 'Untitled Page';
        
        const session = await this.sessionManager.loadOrCreateSession(tabUrl, tabTitle);
        this.ui.renderMessages(session.messages);
      } else {
        // Fallback session
        const fallbackSession = await this.sessionManager.loadOrCreateSession('', 'ChatBrowse');
        this.ui.renderMessages(fallbackSession.messages);
      }
    } catch (error) {
      console.error('Error initializing popup:', error);
      // Show error message in UI
      const errorMessage = createMessage('Error loading session. Please try again.', 'system');
      this.ui.addMessageToChat(errorMessage);
    }

    this.ui.focusInput();
  }

  private async handleUserMessage(text: string): Promise<void> {
    const session = this.sessionManager.getCurrentSession();
    if (!session) return;

    // Add user message to UI and session
    const userMessage = createMessage(text, 'user');
    this.ui.addMessageToChat(userMessage);
    await this.sessionManager.addMessageToSession(userMessage);

    // Send to background for processing
    try {
      const systemMessage = await this.messageHandler.sendMessage(text, session.id);
      if (systemMessage) {
        this.ui.addMessageToChat(systemMessage);
        await this.sessionManager.addMessageToSession(systemMessage);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage = createMessage('Error sending message. Please try again.', 'system');
      this.ui.addMessageToChat(errorMessage);
    }
  }

  private async handleIncomingMessage(message: any): Promise<void> {
    this.ui.addMessageToChat(message);
    await this.sessionManager.addMessageToSession(message);
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
  const app = new PopupApp();
  await app.initialize();
}); 