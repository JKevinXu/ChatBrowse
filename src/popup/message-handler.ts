import { Message } from '../types';
import { createMessage } from '../utils';

export class MessageHandler {
  private onMessageReceived?: (message: Message) => void;
  private activeRequestId: string | null = null;
  private ui?: any; // Reference to UI for showing loading states
  private requestStartTimes: Map<string, number> = new Map(); // Track request start times

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

      // Handle multi-part responses (like Google search results and AI summaries)
      if (request.type === 'MESSAGE' && request.payload && request.payload.sessionId) {
        console.log('🐛 POPUP DEBUG: Received multi-part response:', request);
        
        // Calculate latency if we have a start time
        const responseTime = Date.now();
        let latency: number | undefined;
        
        if (request.payload.requestId && this.requestStartTimes.has(request.payload.requestId)) {
          const startTime = this.requestStartTimes.get(request.payload.requestId)!;
          latency = responseTime - startTime;
          // Clean up the stored start time
          this.requestStartTimes.delete(request.payload.requestId);
          console.log(`⏱️ POPUP DEBUG: Response latency: ${latency}ms`);
        }
        
        // Hide typing indicator for any incoming message
        if (this.ui) {
          this.ui.hideTypingIndicator();
          
          // Improved progress message detection - only filter out very specific progress messages
          const text = request.payload.text;
          const isProgressMessage = (
            // Initial search messages
            (text.includes('Searching') && text.includes('for') && text.length < 100) ||
            // Extraction progress messages (but not results)
            (text.includes('Extracting') && !text.includes('Result') && !text.includes('📊') && text.length < 100) ||
            // AI generation progress (but not actual AI responses)
            (text.includes('Generating AI analysis') && !text.includes('**AI Analysis**') && text.length < 100) ||
            // Navigation messages
            (text.includes('Successfully navigated') && text.length < 200)
          );
          
          if (isProgressMessage) {
            console.log('🔄 POPUP DEBUG: Showing as processing indicator:', text.substring(0, 50));
            this.ui.showProcessingIndicator(text);
            // Don't add progress messages to chat history - they're shown as processing indicators
            sendResponse({ received: true });
            return;
          } else {
            console.log('✅ POPUP DEBUG: Adding as chat message:', text.substring(0, 50));
            this.ui.hideProcessingIndicator();
          }
        }
        
        const responseMessage = createMessage(request.payload.text, 'system');
        // Add latency information to the message
        if (latency !== undefined) {
          responseMessage.latency = latency;
        }
        
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
        
        // Store the start time for latency calculation
        const startTime = Date.now();
        if (this.activeRequestId) {
          this.requestStartTimes.set(this.activeRequestId, startTime);
        }
        
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
              // Calculate latency for immediate response
              const responseTime = Date.now();
              const latency = responseTime - startTime;
              
              const systemMessage = createMessage(response.payload.text, 'system');
              systemMessage.latency = latency;
              
              // Clean up the stored start time since we got an immediate response
              if (this.activeRequestId) {
                this.requestStartTimes.delete(this.activeRequestId);
              }
              
              console.log(`⏱️ POPUP DEBUG: Immediate response latency: ${latency}ms`);
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