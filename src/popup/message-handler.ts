import { Message } from '../types';
import { createMessage } from '../utils';

export class MessageHandler {
  private onMessageReceived?: (message: Message) => void;
  private activeRequestId: string | null = null;
  private ui?: any; // Reference to UI for showing loading states

  constructor(onMessageReceived?: (message: Message) => void) {
    this.onMessageReceived = onMessageReceived;
    this.setupMessageListeners();
  }

  setUI(ui: any): void {
    this.ui = ui;
  }

  private setupMessageListeners(): void {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.type === 'MCP_BROWSE_RESULT' && request.payload) {
        const { title, url, snippet } = request.payload;
        let resultText = `Navigated to: "${title}" (${url}).`;
        if (snippet) {
          resultText += `\nPreview: ${snippet}`;
        }
        const browseResultMessage = createMessage(resultText, 'system');
        
        if (this.onMessageReceived) {
          this.onMessageReceived(browseResultMessage);
        }
        
        sendResponse({ received: true });
      }

      // Handle multi-part responses (like Xiaohongshu summarization)
      if (request.type === 'MESSAGE' && request.payload && request.payload.sessionId) {
        console.log('🐛 POPUP DEBUG: Received multi-part response:', request);
        
        // Hide typing indicator and show processing for long operations
        if (this.ui) {
          this.ui.hideTypingIndicator();
          
          // If this looks like a progress message, show it as processing
          const text = request.payload.text;
          const isProgressMessage = text.includes('Searching') || text.includes('Extracting') || text.includes('Analyzing');
          
          if (isProgressMessage) {
            this.ui.showProcessingIndicator(text);
            // Don't add progress messages to chat history - they're shown as processing indicators
            sendResponse({ received: true });
            return;
          } else {
            this.ui.hideProcessingIndicator();
          }
        }
        
        const responseMessage = createMessage(request.payload.text, 'system');
        
        if (this.onMessageReceived) {
          this.onMessageReceived(responseMessage);
        }
        
        sendResponse({ received: true });
      }
      
      return true;
    });
  }

  async sendMessage(text: string, sessionId: string): Promise<Message | null> {
    return new Promise((resolve) => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const activeTab = tabs[0];
        
        // Generate a unique request ID for tracking multiple responses
        this.activeRequestId = sessionId + '_' + Date.now();
        
        console.log('🐛 POPUP DEBUG: Sending message:', text, 'SessionId:', sessionId);
        
        chrome.runtime.sendMessage(
          {
            type: 'SEND_MESSAGE',
            payload: {
              text,
              sessionId,
              tabId: activeTab.id,
              tabUrl: activeTab.url,
              tabTitle: activeTab.title,
              requestId: this.activeRequestId
            }
          },
          (response) => {
            console.log('🐛 POPUP DEBUG: Initial response received:', response);
            
            if (response && response.type === 'MESSAGE') {
              const systemMessage = createMessage(response.payload.text, 'system');
              resolve(systemMessage);
            } else {
              // For commands like Xiaohongshu summarization, the initial response might be null
              // but we'll get additional responses via the message listener
              const initialMessage = createMessage('Processing...', 'system');
              resolve(initialMessage);
            }
          }
        );
      });
    });
  }
} 