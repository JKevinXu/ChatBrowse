import { ChatResponse } from '../types';
import { OpenAIService } from './openai-service';
import { NavigationService } from './navigation-service';
import { SearchService } from './search-service';
import { ActionService } from './action-service';
import { ContextService } from './context-service';
import { ExtractionService } from './extraction-service';

// Add Chrome types with proper interface
declare global {
  namespace chrome {
    namespace runtime {
      interface MessageSender {
        tab?: chrome.tabs.Tab;
        frameId?: number;
        id?: string;
        url?: string;
        tlsChannelId?: string;
      }
    }
  }
}

export class MessageRouter {
  private openaiService = new OpenAIService();
  private navigationService = new NavigationService();
  private searchService = new SearchService();
  private actionService = new ActionService();
  private contextService = new ContextService();
  private extractionService = new ExtractionService();

  async route(
    request: any,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: ChatResponse) => void
  ): Promise<boolean> {
    console.log('🐛 DEBUG: MessageRouter.route ENTERED');
    console.log('🐛 DEBUG: Request:', request);
    console.log('🐛 DEBUG: Request type:', request.type);
    
    try {
      switch (request.type) {
        case 'CONTENT_SCRIPT_READY':
          console.log('🐛 DEBUG: Handling CONTENT_SCRIPT_READY');
          return this.handleContentScriptReady(request, sender, sendResponse);
        
        case 'SEND_MESSAGE':
          console.log('🐛 DEBUG: Handling SEND_MESSAGE');
          return this.handleUserMessage(request.payload, sender, sendResponse);
        
        case 'NAVIGATE':
          console.log('🐛 DEBUG: Handling NAVIGATE');
          return this.handleNavigation(request.payload, sender, sendResponse);
        
        case 'EXTRACT_INFO':
          console.log('🐛 DEBUG: Handling EXTRACT_INFO');
          return this.handleExtraction(sender, sendResponse);
        
        case 'EXTRACT_POSTS':
          console.log('🐛 DEBUG: Handling EXTRACT_POSTS');
          return this.handlePostExtraction(request.payload, sender, sendResponse);
        
        case 'CLEAR_CHAT':
          console.log('🐛 DEBUG: Handling CLEAR_CHAT');
          return this.handleClearChat(sender, sendResponse);
        
        case 'SET_CONTEXT':
          console.log('🐛 DEBUG: Handling SET_CONTEXT');
          return this.handleSetContext(request.payload, sender, sendResponse);
        
        case 'ANALYZE_SEARCH_ELEMENTS':
          console.log('🐛 DEBUG: Handling ANALYZE_SEARCH_ELEMENTS');
          return this.handleSearchElementAnalysis(request.payload, sender, sendResponse);
        
        case 'SUMMARIZE_XIAOHONGSHU_POSTS':
          console.log('🐛 DEBUG: Handling SUMMARIZE_XIAOHONGSHU_POSTS');
          return this.handleXiaohongshuSummarization(request.payload, sender, sendResponse);
        
        default:
          console.log('🐛 DEBUG: Unknown command type:', request.type);
          sendResponse({
            type: 'ERROR',
            payload: { message: 'Unknown command type' }
          });
          return false;
      }
    } catch (error) {
      console.error('🐛 DEBUG: Message routing error:', error);
      sendResponse({
        type: 'ERROR',
        payload: { message: 'Internal error processing message' }
      });
      return false;
    }
  }

  private handleContentScriptReady(
    request: any,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: any) => void
  ): boolean {
    if (sender.tab?.id) {
      this.contextService.markTabReady(sender.tab.id);
      this.contextService.autoSetContext(sender.tab.id);
    }
    sendResponse({ received: true, status: 'acknowledged' });
    return true;
  }

  private async handleUserMessage(
    payload: any,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: ChatResponse) => void
  ): Promise<boolean> {
    console.log('🐛 DEBUG: handleUserMessage ENTERED');
    console.log('🐛 DEBUG: Payload:', payload);
    console.log('🐛 DEBUG: Sender:', sender);
    
    const { text, sessionId } = payload;
    const tabId = sender.tab?.id || payload.tabId;
    
    console.log('🐛 DEBUG: Extracted text:', text);
    console.log('🐛 DEBUG: Extracted sessionId:', sessionId);
    console.log('🐛 DEBUG: TabId:', tabId);

    // Check for action execution commands first (like "do it")
    if (this.actionService.isExecutionCommand(text) && tabId) {
      console.log('🐛 DEBUG: Action execution command detected');
      await this.actionService.executeStoredPlan(tabId, sendResponse, sessionId);
      return true;
    }

    // Check for navigation commands
    if (this.navigationService.isNavigationCommand(text)) {
      console.log('🐛 DEBUG: Navigation command detected');
      await this.navigationService.handleNavigation(text, tabId, sendResponse, sessionId);
      return true;
    }

    // Check for Xiaohongshu search and summarize commands
    console.log('🐛 DEBUG: About to check Xiaohongshu summary command');
    const xiaohongshuSummaryQuery = this.parseXiaohongshuSummaryCommand(text);
    console.log('🐛 DEBUG: Xiaohongshu summary query result:', xiaohongshuSummaryQuery);
    if (xiaohongshuSummaryQuery) {
      console.log('🐛 DEBUG: Xiaohongshu summary command matched, calling handler');
      await this.handleXiaohongshuSummarization({ 
        query: xiaohongshuSummaryQuery, 
        tabId, 
        sessionId 
      }, sender, sendResponse);
      return true;
    }

    // Check for search commands BEFORE general action requests
    const searchResult = this.searchService.parseSearchCommand(text);
    if (searchResult) {
      console.log('🐛 DEBUG: General search command detected');
      await this.searchService.handleSearch(searchResult, tabId, sendResponse, sessionId);
      return true;
    }

    // Check for Xiaohongshu post extraction
    if (text.toLowerCase().includes('extract') && text.toLowerCase().includes('xiaohongshu')) {
      console.log('🐛 DEBUG: Xiaohongshu extract command detected');
      await this.extractionService.extractXiaohongshuPosts(tabId, sendResponse, sessionId);
      return true;
    }

    // Check for action planning requests (after specific commands)
    if (this.actionService.isActionRequest(text) && tabId) {
      console.log('🐛 DEBUG: Action planning request detected');
      await this.actionService.planActions(text, tabId, sendResponse, sessionId);
      return true;
    }

    // Handle general AI chat
    console.log('🐛 DEBUG: Falling back to general AI chat');
    await this.openaiService.handleChat(payload, sender, sendResponse);
    return true;
  }

  private async handleNavigation(
    payload: any,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: ChatResponse) => void
  ): Promise<boolean> {
    await this.navigationService.navigate(payload.url, sender.tab?.id, sendResponse);
    return false;
  }

  private handleExtraction(
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: ChatResponse) => void
  ): boolean {
    const tabId = sender.tab?.id;
    if (!tabId) {
      sendResponse({
        type: 'ERROR',
        payload: { message: 'Could not determine tab ID' }
      });
      return true;
    }

    chrome.tabs.sendMessage(tabId, { type: 'EXTRACT_PAGE_INFO' }, (pageInfo) => {
      if (chrome.runtime.lastError) {
        sendResponse({
          type: 'ERROR',
          payload: { message: chrome.runtime.lastError.message || 'Failed to extract page info' }
        });
        return;
      }
      
      sendResponse({
        type: 'EXTRACTION_RESULT',
        payload: pageInfo
      });
    });

    return true;
  }

  private handlePostExtraction(
    payload: any,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: ChatResponse) => void
  ): boolean {
    const tabId = sender.tab?.id;
    if (!tabId) {
      sendResponse({
        type: 'ERROR',
        payload: { message: 'Could not determine tab ID' }
      });
      return true;
    }

    chrome.tabs.sendMessage(tabId, { type: 'EXTRACT_POSTS', payload }, (result) => {
      if (chrome.runtime.lastError) {
        sendResponse({
          type: 'ERROR',
          payload: { message: chrome.runtime.lastError.message || 'Failed to extract posts' }
        });
        return;
      }
      
      if (result?.success) {
        sendResponse({
          type: 'EXTRACTION_RESULT',
          payload: result
        });
      } else {
        sendResponse({
          type: 'ERROR',
          payload: { message: result?.error || 'Post extraction failed' }
        });
      }
    });

    return true;
  }

  private handleClearChat(
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: ChatResponse) => void
  ): boolean {
    const tabId = sender.tab?.id;
    if (!tabId) {
      sendResponse({
        type: 'ERROR',
        payload: { message: 'Could not determine tab ID' }
      });
      return false;
    }

    chrome.tabs.sendMessage(tabId, { type: 'CLEAR_CHAT' }, () => {
      sendResponse({
        type: 'MESSAGE',
        payload: { text: 'Chat cleared', success: true }
      });
    });

    return false;
  }

  private handleSetContext(
    payload: any,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: ChatResponse) => void
  ): boolean {
    this.contextService.setContext(payload, sender.tab?.id, sendResponse);
    return false;
  }

  private async handleSearchElementAnalysis(
    payload: any,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: any) => void
  ): Promise<boolean> {
    await this.openaiService.analyzeSearchElements(payload, sendResponse);
    return true;
  }

  private async handleXiaohongshuSummarization(
    payload: any,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: ChatResponse) => void
  ): Promise<boolean> {
    console.log('🐛 DEBUG: handleXiaohongshuSummarization ENTERED');
    console.log('🐛 DEBUG: Payload received:', payload);
    
    try {
      console.log('🐛 DEBUG: Starting Xiaohongshu summary for query:', payload.query);
      console.log('🐛 DEBUG: TabId:', payload.tabId, 'SessionId:', payload.sessionId);
      
      // Helper function to send follow-up responses only to popup (not initial response)
      const sendFollowUpToPopup = (responsePayload: any) => {
        // Only send to popup if this came from popup (avoid duplication with initial response)
        if (sender.url?.includes('chrome-extension://')) {
          chrome.runtime.sendMessage(responsePayload).catch(() => {
            // Ignore errors if popup is closed
          });
        }
      };
      
      // Step 1: Perform the search (use normal sendResponse for initial response)
      sendResponse({
        type: 'MESSAGE',
        payload: {
          text: `🔍 Searching Xiaohongshu for "${payload.query}" and will analyze top posts...`,
          sessionId: payload.sessionId || 'default'
        }
      });

      console.log('🐛 DEBUG: Initial response sent, about to call searchService.handleSearch');
      
      // Execute the search with error handling
      try {
        const searchCommand = { query: payload.query, engine: 'xiaohongshu' as const };
        console.log('🐛 DEBUG: Search command created:', searchCommand);
        
        await this.searchService.handleSearch(searchCommand, payload.tabId, (searchResponse) => {
          console.log('🐛 DEBUG: Search completed with response:', searchResponse);
        }, payload.sessionId || 'default');
        
        console.log('🐛 DEBUG: searchService.handleSearch completed without error');
      } catch (searchError) {
        console.error('🐛 DEBUG: Search service error:', searchError);
        sendFollowUpToPopup({
          type: 'MESSAGE',
          payload: {
            text: `❌ Search failed: ${(searchError as Error).message}`,
            sessionId: payload.sessionId || 'default'
          }
        });
        return true;
      }

      console.log('🐛 DEBUG: Search service call completed, setting up extraction with longer delay');

      // Step 2: Wait longer for page to load, then extract
      setTimeout(async () => {
        console.log('🐛 DEBUG: Starting analysis after 7 seconds');
        try {
          sendFollowUpToPopup({
            type: 'MESSAGE',
            payload: {
              text: '📱 Page should be loaded now. Extracting posts...',
              sessionId: payload.sessionId || 'default'
            }
          });

          console.log('🐛 DEBUG: About to call handleXiaohongshuExtraction');

          // Step 3: Extract the posts with error handling
          await this.extractionService.extractXiaohongshuPosts(payload.tabId, (extractResponse) => {
            console.log('🐛 DEBUG: Extract response received:', extractResponse);
            sendFollowUpToPopup(extractResponse);
          }, payload.sessionId || 'default');

          console.log('🐛 DEBUG: extractXiaohongshuPosts completed');

        } catch (extractError) {
          console.error('🐛 DEBUG: Analysis phase error:', extractError);
          sendFollowUpToPopup({
            type: 'MESSAGE',
            payload: {
              text: `❌ Analysis failed: ${(extractError as Error).message}. Try switching to the Xiaohongshu tab and running "extract xiaohongshu posts" manually.`,
              sessionId: payload.sessionId || 'default'
            }
          });
        }
      }, 7000); // Wait 7 seconds for page to load

      console.log('🐛 DEBUG: Timeout set, method ending normally');

    } catch (error) {
      console.error('🐛 DEBUG: Top-level Xiaohongshu summary error:', error);
      sendResponse({
        type: 'MESSAGE',
        payload: {
          text: `❌ Failed to search and analyze: ${(error as Error).message}`,
          sessionId: payload.sessionId || 'default'
        }
      });
    }
    
    console.log('🐛 DEBUG: handleXiaohongshuSummarization EXITING');
    return true;
  }

  private parseXiaohongshuSummaryCommand(text: string): string | null {
    console.log('🐛 DEBUG: parseXiaohongshuSummaryCommand called with text:', text);
    const lowerText = text.toLowerCase().trim();
    console.log('🐛 DEBUG: lowerText:', lowerText);
    
    // Patterns for search and summarize commands
    const summaryPatterns = [
      /^(?:summarize\s+xiaohongshu\s+(.+))$/i,
      /^(?:xiaohongshu\s+summarize\s+(.+))$/i,
      /^(?:xiaohongshu\s+(.+)\s+summary)$/i,
      /^(?:analyze\s+xiaohongshu\s+(.+))$/i,
      /^(?:xiaohongshu\s+analysis\s+(.+))$/i,
      /^(?:get\s+xiaohongshu\s+posts\s+about\s+(.+))$/i
    ];

    for (const pattern of summaryPatterns) {
      const match = lowerText.match(pattern);
      console.log('🐛 DEBUG: Testing pattern:', pattern, 'Match:', match);
      if (match && match[1]) {
        console.log('🐛 DEBUG: Pattern matched! Returning query:', match[1].trim());
        return match[1].trim();
      }
    }
    
    console.log('🐛 DEBUG: No patterns matched, returning null');
    return null;
  }
} 