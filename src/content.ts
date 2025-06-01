import { ChatSession } from './types';
import { createChatSession, extractPageInfo, processCommand, createMessage } from './utils';
import { ChatUI } from './content/chat-ui';
import { PageAnalyzer } from './content/page-analyzer';
import { ActionExecutor } from './content/action-executor';
import { ExtractorFactory } from './extractors';

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

        case 'EXTRACT_POSTS':
          console.log('🔍 CONTENT: Received EXTRACT_POSTS request');
          this.handleExtractPosts(request.payload, sendResponse);
          return true;

        case 'EXTRACT_POSTS_ASYNC':
          console.log('🔍 CONTENT: Received EXTRACT_POSTS_ASYNC request (rate-limited)');
          this.handleExtractPostsAsync(request.payload, sendResponse);
          return true;

        case 'TEST_IMAGE_EXTRACTION':
          console.log('🔍 CONTENT: Received TEST_IMAGE_EXTRACTION request');
          this.handleTestImageExtraction(sendResponse);
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
    // Add user message to UI
    const userMessage = createMessage(text, 'user');
    this.chatUI.addMessageToChat(userMessage);
    
    // Show typing indicator
    this.chatUI.showTypingIndicator();
    
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
      // Hide typing indicator
      this.chatUI.hideTypingIndicator();
      
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

  private handleExtractPosts(payload: any, sendResponse: (response: any) => void): void {
    try {
      console.log('🔍 CONTENT: Starting post extraction with payload:', payload);
      
      // Get the appropriate extractor for this page
      const extractor = ExtractorFactory.getExtractor();
      
      if (!extractor) {
        console.log('🔍 CONTENT: No suitable extractor found for this page');
        sendResponse({
          success: false,
          error: 'No suitable extractor found for this page. Currently only Xiaohongshu is supported.',
          posts: [],
          totalFound: 0,
          pageUrl: window.location.href,
          pageTitle: document.title,
          platform: 'unknown'
        });
        return;
      }
      
      console.log(`🔍 CONTENT: Using ${extractor.platform} extractor`);
      
      // Extract posts
      const maxPosts = payload?.maxPosts || 5;
      const fetchFullContent = payload?.fetchFullContent || false;
      console.log('🔍 CONTENT: Extraction options - maxPosts:', maxPosts, 'fetchFullContent:', fetchFullContent);
      
      const result = extractor.extractPosts(maxPosts, fetchFullContent);
      
      console.log('🔍 CONTENT: Extraction completed:', result);
      
      sendResponse({
        success: true,
        ...result
      });
      
    } catch (error) {
      console.error('🔍 CONTENT: Extraction error:', error);
      sendResponse({
        success: false,
        error: (error as Error).message,
        posts: [],
        totalFound: 0,
        pageUrl: window.location.href,
        pageTitle: document.title,
        platform: 'unknown'
      });
    }
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

  private handleTestImageExtraction(sendResponse: (response: any) => void): void {
    try {
      console.log('🔍 CONTENT: Testing image extraction');
      
      // Get all images on the page
      const allImages = Array.from(document.querySelectorAll('img[src]')) as HTMLImageElement[];
      console.log('🔍 CONTENT: Found', allImages.length, 'total images');
      
      const imageData = allImages.map((img, index) => {
        // Find the selector path for this image
        let selector = 'img';
        if (img.id) {
          selector = `#${img.id}`;
        } else if (img.className) {
          selector = `img.${img.className.split(' ')[0]}`;
        } else {
          // Try to find a parent with class or ID
          let parent = img.parentElement;
          let depth = 0;
          while (parent && depth < 3) {
            if (parent.id) {
              selector = `#${parent.id} img`;
              break;
            } else if (parent.className) {
              selector = `.${parent.className.split(' ')[0]} img`;
              break;
            }
            parent = parent.parentElement;
            depth++;
          }
        }
        
        return {
          index: index + 1,
          url: img.src,
          selector: selector,
          width: img.width || img.naturalWidth || 0,
          height: img.height || img.naturalHeight || 0,
          alt: img.alt || '',
          isVisible: img.offsetWidth > 0 && img.offsetHeight > 0
        };
      });
      
      // Filter out very small images (likely icons)
      const meaningfulImages = imageData.filter(img => 
        img.width > 50 && 
        img.height > 50 && 
        img.isVisible &&
        !img.url.includes('avatar') && 
        !img.url.includes('icon') && 
        !img.url.includes('logo')
      );
      
      console.log('🔍 CONTENT: Found', meaningfulImages.length, 'meaningful images');
      
      sendResponse({
        success: true,
        totalImages: allImages.length,
        meaningfulImages: meaningfulImages.length,
        images: meaningfulImages.slice(0, 10) // Return top 10 for debugging
      });
      
    } catch (error) {
      console.error('🔍 CONTENT: Image extraction test error:', error);
      sendResponse({
        success: false,
        error: (error as Error).message,
        images: []
      });
    }
  }

  private async handleExtractPostsAsync(payload: any, sendResponse: (response: any) => void): Promise<void> {
    try {
      console.log('🔍 CONTENT: Starting async post extraction with rate limiting, payload:', payload);
      
      // Get the appropriate extractor for this page
      const extractor = ExtractorFactory.getExtractor();
      
      if (!extractor) {
        console.log('🔍 CONTENT: No suitable extractor found for this page');
        sendResponse({
          success: false,
          error: 'No suitable extractor found for this page. Currently only Xiaohongshu is supported.',
          posts: [],
          totalFound: 0,
          pageUrl: window.location.href,
          pageTitle: document.title,
          platform: 'unknown'
        });
        return;
      }
      
      console.log(`🔍 CONTENT: Using ${extractor.platform} extractor with rate limiting`);
      
      // Check if this extractor supports async extraction
      if (!extractor.extractPostsAsync || typeof extractor.extractPostsAsync !== 'function') {
        console.log('🔍 CONTENT: Extractor does not support async extraction, falling back to sync');
        this.handleExtractPosts(payload, sendResponse);
        return;
      }
      
      // Extract posts with rate limiting
      const maxPosts = payload?.maxPosts || 2;
      const fetchFullContent = payload?.fetchFullContent || false;
      console.log('🔍 CONTENT: Async extraction options - maxPosts:', maxPosts, 'fetchFullContent:', fetchFullContent);
      
      const result = await extractor.extractPostsAsync(maxPosts, fetchFullContent);
      
      console.log('🔍 CONTENT: Async extraction completed:', result);
      
      sendResponse({
        success: true,
        ...result
      });
      
    } catch (error) {
      console.error('🔍 CONTENT: Async extraction error:', error);
      sendResponse({
        success: false,
        error: (error as Error).message,
        posts: [],
        totalFound: 0,
        pageUrl: window.location.href,
        pageTitle: document.title,
        platform: 'unknown'
      });
    }
  }
}

// Initialize when DOM is ready
// Skip initialization on extension pages
if (window.location.protocol === 'chrome-extension:') {
  console.log('ChatBrowse: Skipping initialization on extension page');
} else if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    const contentScript = new ContentScript();
    contentScript.initialize();
  });
} else {
  const contentScript = new ContentScript();
  contentScript.initialize();
} 