import { Message } from '../types';
import { createMessage } from '../utils';

export class MessageHandler {
  private onMessageReceived?: (message: Message) => void;

  constructor(onMessageReceived?: (message: Message) => void) {
    this.onMessageReceived = onMessageReceived;
    this.setupMessageListeners();
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
      return true;
    });
  }

  async sendMessage(text: string, sessionId: string): Promise<Message | null> {
    return new Promise((resolve) => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const activeTab = tabs[0];
        
        chrome.runtime.sendMessage(
          {
            type: 'SEND_MESSAGE',
            payload: {
              text,
              sessionId,
              tabId: activeTab.id,
              tabUrl: activeTab.url,
              tabTitle: activeTab.title
            }
          },
          (response) => {
            if (response && response.type === 'MESSAGE') {
              const systemMessage = createMessage(response.payload.text, 'system');
              resolve(systemMessage);
            } else {
              resolve(null);
            }
          }
        );
      });
    });
  }
} 