import { ChatSession } from './types';
import { createChatSession, extractPageInfo, processCommand } from './utils';
import { ChatUI } from './content/chat-ui';
import { PageAnalyzer } from './content/page-analyzer';
import { ActionExecutor } from './content/action-executor';

class ContentScript {
  private chatUI: ChatUI;
  private pageAnalyzer: PageAnalyzer;
  private actionExecutor: ActionExecutor;
  private currentSession: ChatSession | null = null;

  constructor() {
    this.pageAnalyzer = new PageAnalyzer();
    this.actionExecutor = new ActionExecutor();
    this.chatUI = new ChatUI((message) => this.handleUserMessage(message));
  }

  initialize(): void {
    console.log('ChatBrowse content script initializing...');
    
    try {
      // Extract page info and create session
      const pageInfo = extractPageInfo();
      const { title, url } = pageInfo;
      
      console.log('DEBUG: Initial page info extraction results:');
      console.log('DEBUG: - Title:', title);
      console.log('DEBUG: - URL:', url);
      console.log('DEBUG: - Content length:', pageInfo.content.length);
      
      this.currentSession = createChatSession(url, title);
      
      // Initialize chat UI
      this.chatUI.initialize(this.currentSession);
      
      // Set up message listeners
      this.setupMessageListeners();
      
      // Notify background script
      console.log('CONTENT: Sending CONTENT_SCRIPT_READY message to background');
      chrome.runtime.sendMessage({ 
        type: 'CONTENT_SCRIPT_READY', 
        payload: pageInfo 
      }, response => {
        console.log('CONTENT: Received response from background for CONTENT_SCRIPT_READY:', response);
      });
      
      console.log('ChatBrowse content script initialized successfully');
    } catch (error) {
      console.error('Error initializing ChatBrowse content script:', error);
    }
  }

  private setupMessageListeners(): void {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      console.log('CONTENT: Received message:', request);

      switch (request.type) {
        case 'EXTRACT_PAGE_INFO':
          this.handleExtractPageInfo(sendResponse);
          return true;

        case 'CLEAR_CHAT':
          this.handleClearChat(sendResponse);
          return false;

        case 'EXECUTE_ACTION':
          this.handleExecuteAction(request.action, sendResponse);
          return true;

        case 'GET_PAGE_ANALYSIS':
          this.handleGetPageAnalysis(sendResponse);
          return false;

        case 'ANALYZE_SEARCH_ELEMENTS':
          this.handleAnalyzeSearchElements(sendResponse);
          return true;

        default:
          console.warn('CONTENT: Unknown message type:', request.type);
          return false;
      }
    });
  }

  private handleUserMessage(text: string): void {
    if (!this.currentSession) return;

    // Process command
    const { command, args } = processCommand(text);
    
    switch (command) {
      case 'navigate':
        this.handleNavigateCommand(args);
        break;
        
      case 'extract':
        this.handleExtractCommand();
        break;
        
      case 'setcontext':
        this.handleSetContextCommand(args);
        break;
        
      default:
        this.handleChatCommand(text);
        break;
    }
  }

  private handleNavigateCommand(url: string): void {
    chrome.runtime.sendMessage(
      { type: 'NAVIGATE', payload: { url } },
      (response) => {
        if (response && response.type === 'ERROR') {
          this.chatUI.addMessageToChat({
            id: Date.now().toString(),
            text: `Error: ${response.payload.message || 'Navigation failed'}`,
            sender: 'system',
            timestamp: Date.now()
          });
        }
      }
    );
    
    this.chatUI.addMessageToChat({
      id: Date.now().toString(),
      text: 'Navigating...',
      sender: 'system',
      timestamp: Date.now()
    });
  }

  private handleExtractCommand(): void {
    chrome.runtime.sendMessage(
      { type: 'EXTRACT_INFO' },
      (response) => {
        if (response && response.type === 'EXTRACTION_RESULT') {
          const { title, url, content } = response.payload;
          this.chatUI.addMessageToChat({
            id: Date.now().toString(),
            text: `Page Info:\nTitle: ${title}\nURL: ${url}\n${content ? 'Content preview: ' + content.substring(0, 150) + '...' : ''}`,
            sender: 'system',
            timestamp: Date.now()
          });
        } else if (response && response.type === 'ERROR') {
          this.chatUI.addMessageToChat({
            id: Date.now().toString(),
            text: `Error: ${response.payload.message || 'Failed to extract page info'}`,
            sender: 'system',
            timestamp: Date.now()
          });
        }
      }
    );
  }

  private handleSetContextCommand(args: string): void {
    const pageInfo = extractPageInfo();
    const useAsContext = args === 'on';
    
    chrome.runtime.sendMessage({
      type: 'SET_CONTEXT',
      payload: { ...pageInfo, useAsContext }
    }, (response) => {
      if (response && response.payload) {
        this.chatUI.addMessageToChat({
          id: Date.now().toString(),
          text: response.payload.text,
          sender: 'system',
          timestamp: Date.now()
        });
      }
    });
  }

  private handleChatCommand(text: string): void {
    chrome.runtime.sendMessage({
      type: 'SEND_MESSAGE',
      payload: {
        text,
        sessionId: this.currentSession?.id || '',
        tabId: undefined, // Will be filled by background
        tabUrl: window.location.href,
        tabTitle: document.title
      }
    }, (response) => {
      if (response && response.type === 'MESSAGE') {
        this.chatUI.addMessageToChat({
          id: Date.now().toString(),
          text: response.payload.text,
          sender: 'system',
          timestamp: Date.now()
        });
      }
    });
  }

  // Message handlers for background script requests
  private handleExtractPageInfo(sendResponse: (response: any) => void): void {
    const pageInfo = extractPageInfo();
    sendResponse(pageInfo);
  }

  private handleClearChat(sendResponse: (response: any) => void): void {
    this.chatUI.clearChat();
    sendResponse({ success: true });
  }

  private async handleExecuteAction(action: any, sendResponse: (response: any) => void): Promise<void> {
    try {
      const result = await this.actionExecutor.executeEnhancedAction(action);
      sendResponse(result);
    } catch (error) {
      sendResponse({ 
        success: false, 
        error: (error as Error).message 
      });
    }
  }

  private handleGetPageAnalysis(sendResponse: (response: any) => void): void {
    const analysis = this.pageAnalyzer.generateSummaryForAI();
    sendResponse({ analysis });
  }

  private async handleAnalyzeSearchElements(sendResponse: (response: any) => void): Promise<void> {
    try {
      // Extract search-relevant HTML for AI analysis
      const searchHTML = this.extractSearchRelevantHTML();
      
      // Send to background for AI analysis
      chrome.runtime.sendMessage({
        type: 'ANALYZE_SEARCH_ELEMENTS',
        payload: {
          html: searchHTML,
          url: window.location.href,
          title: document.title
        }
      }, (response) => {
        sendResponse(response);
      });
    } catch (error) {
      sendResponse({ 
        error: (error as Error).message 
      });
    }
  }

  private extractSearchRelevantHTML(): string {
    // Find potential search elements
    const searchSelectors = [
      'input[type="search"]',
      'input[name*="search" i]',
      'input[placeholder*="search" i]',
      'input[id*="search" i]',
      'input[class*="search" i]',
      'form',
      'header',
      'nav',
      '.search',
      '.navbar',
      '.header'
    ];
    
    let html = '';
    
    searchSelectors.forEach(selector => {
      document.querySelectorAll(selector).forEach(element => {
        // Get the outer HTML but limit length
        const elementHTML = element.outerHTML;
        if (elementHTML.length < 1000) { // Avoid huge elements
          html += elementHTML + '\n';
        }
      });
    });
    
    // Limit total HTML size
    return html.length > 5000 ? html.substring(0, 5000) + '...' : html;
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    const contentScript = new ContentScript();
    contentScript.initialize();
  });
} else {
  const contentScript = new ContentScript();
  contentScript.initialize();
} 