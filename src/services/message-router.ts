import { ChatResponse } from '../types';
import { OpenAIService } from './openai-service';
import { NavigationService } from './navigation-service';
import { SearchService } from './search-service';
import { ActionService } from './action-service';
import { ContextService } from './context-service';

// Add Chrome types
/// <reference types="chrome"/>

export class MessageRouter {
  private openaiService = new OpenAIService();
  private navigationService = new NavigationService();
  private searchService = new SearchService();
  private actionService = new ActionService();
  private contextService = new ContextService();

  async route(
    request: any,
    sender: chrome.MessageSender,
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
    sender: chrome.MessageSender,
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
    sender: chrome.MessageSender,
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
      await this.handleXiaohongshuExtraction(tabId, sendResponse, sessionId);
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
    sender: chrome.MessageSender,
    sendResponse: (response: ChatResponse) => void
  ): Promise<boolean> {
    await this.navigationService.navigate(payload.url, sender.tab?.id, sendResponse);
    return false;
  }

  private handleExtraction(
    sender: chrome.MessageSender,
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

  private handleClearChat(
    sender: chrome.MessageSender,
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
    sender: chrome.MessageSender,
    sendResponse: (response: ChatResponse) => void
  ): boolean {
    this.contextService.setContext(payload, sender.tab?.id, sendResponse);
    return false;
  }

  private async handleSearchElementAnalysis(
    payload: any,
    sender: chrome.MessageSender,
    sendResponse: (response: any) => void
  ): Promise<boolean> {
    await this.openaiService.analyzeSearchElements(payload, sendResponse);
    return true;
  }

  private async handleXiaohongshuSummarization(
    payload: any,
    sender: chrome.MessageSender,
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
        console.log('🐛 DEBUG: Starting analysis after 3 seconds');
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
          await this.handleXiaohongshuExtraction(payload.tabId, (extractResponse) => {
            console.log('🐛 DEBUG: Extract response received:', extractResponse);
            sendFollowUpToPopup(extractResponse);
          }, payload.sessionId || 'default');

          console.log('🐛 DEBUG: handleXiaohongshuExtraction completed');

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
      }, 3000); // Wait 3 seconds for page to load

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

  private async handleXiaohongshuExtraction(
    tabId: number | undefined,
    sendResponse: (response: ChatResponse) => void,
    sessionId: string
  ): Promise<void> {
    try {
      console.log('🐛 DEBUG: handleXiaohongshuExtraction STARTED');
      
      // Send immediate feedback
      sendResponse({
        type: 'MESSAGE',
        payload: {
          text: '🔍 Extracting top 5 posts from Xiaohongshu page...',
          sessionId
        }
      });

      // Find the Xiaohongshu tab instead of using the sender tab
      console.log('🐛 DEBUG: Looking for Xiaohongshu tab...');
      const xiaohongshuTab = await this.findXiaohongshuTab();
      console.log('🐛 DEBUG: Xiaohongshu tab found:', xiaohongshuTab);
      
      if (!xiaohongshuTab) {
        console.log('🐛 DEBUG: No Xiaohongshu tab found');
        sendResponse({
          type: 'MESSAGE',
          payload: {
            text: '❌ No Xiaohongshu tab found. Please search for content on Xiaohongshu first.',
            sessionId
          }
        });
        return;
      }

      console.log('🐛 DEBUG: About to inject script into tab:', xiaohongshuTab.id);
      
      // Inject extraction script into the Xiaohongshu page
      const results = await chrome.scripting.executeScript({
        target: { tabId: xiaohongshuTab.id! },
        func: () => {
          console.log('🐛 SCRIPT DEBUG: Extraction script started');
          console.log('🐛 SCRIPT DEBUG: Current URL:', window.location.href);
          console.log('🐛 SCRIPT DEBUG: Page title:', document.title);
          
          // Extract posts from Xiaohongshu page
          const posts: any[] = [];
          
          // Common selectors for Xiaohongshu posts
          const postSelectors = [
            'section[class*="note"]',
            'article[class*="note"]', 
            'div[class*="note-item"]',
            'div[class*="feed-item"]',
            'a[class*="note"]',
            '.note-item',
            '.feed-item'
          ];

          let postElements: Element[] = [];
          
          // Try different selectors to find posts
          for (const selector of postSelectors) {
            console.log('🐛 SCRIPT DEBUG: Trying selector:', selector);
            const elements = Array.from(document.querySelectorAll(selector));
            console.log('🐛 SCRIPT DEBUG: Found elements:', elements.length);
            if (elements.length > 0) {
              postElements = elements;
              console.log('🐛 SCRIPT DEBUG: Using selector:', selector, 'Found:', elements.length);
              break;
            }
          }

          // If no specific selectors work, try generic approaches
          if (postElements.length === 0) {
            console.log('🐛 SCRIPT DEBUG: No specific selectors worked, trying generic approach');
            postElements = Array.from(document.querySelectorAll('article, section, [class*="card"], [class*="item"]'))
              .filter(el => {
                const text = el.textContent || '';
                return text.length > 50;
              });
            console.log('🐛 SCRIPT DEBUG: Generic approach found:', postElements.length);
          }

          console.log('🐛 SCRIPT DEBUG: Final postElements count:', postElements.length);

          // Extract top 5 posts
          postElements.slice(0, 5).forEach((post, index) => {
            console.log('🐛 SCRIPT DEBUG: Processing post', index + 1);
            
            const titleElement = post.querySelector('h1, h2, h3, [class*="title"], [class*="header"]');
            const title = titleElement?.textContent?.trim() || `Post ${index + 1}`;
            
            let content = post.textContent?.trim() || '';
            content = content.replace(/\s+/g, ' ').slice(0, 300);
            
            const linkElement = post.querySelector('a[href]');
            const link = linkElement?.getAttribute('href') || '';
            
            console.log('🐛 SCRIPT DEBUG: Post', index + 1, 'title:', title.slice(0, 50));
            console.log('🐛 SCRIPT DEBUG: Post', index + 1, 'content length:', content.length);
            
            if (content.length > 10) {
              posts.push({
                index: index + 1,
                title: title.slice(0, 100),
                content: content,
                link: link
              });
              console.log('🐛 SCRIPT DEBUG: Post', index + 1, 'added to results');
            } else {
              console.log('🐛 SCRIPT DEBUG: Post', index + 1, 'skipped (content too short)');
            }
          });

          const result = {
            posts,
            totalFound: postElements.length,
            pageUrl: window.location.href,
            pageTitle: document.title
          };
          
          console.log('🐛 SCRIPT DEBUG: Final result:', result);
          return result;
        }
      });

      console.log('🐛 DEBUG: Script execution completed, results:', results);
      console.log('🐛 DEBUG: Results[0]:', results[0]);
      console.log('🐛 DEBUG: Results[0].result:', results[0]?.result);

      const extractedData = results[0]?.result;
      console.log('🐛 DEBUG: ExtractedData:', extractedData);
      
      if (extractedData && extractedData.posts && extractedData.posts.length > 0) {
        console.log('🐛 DEBUG: Posts found, creating summary');
        // Create summary
        let summary = `📱 **Xiaohongshu Posts Extracted**\n\n`;
        summary += `🔍 **Page**: ${extractedData.pageTitle}\n`;
        summary += `📊 **Found**: ${extractedData.totalFound} total posts, extracted top ${extractedData.posts.length}\n\n`;
        summary += `📋 **Top Posts**:\n\n`;

        extractedData.posts.forEach((post: any, index: number) => {
          summary += `**${index + 1}. ${post.title}**\n`;
          summary += `${post.content.slice(0, 150)}${post.content.length > 150 ? '...' : ''}\n`;
          if (post.link) {
            summary += `🔗 Link: ${post.link}\n`;
          }
          summary += `\n`;
        });

        summary += `💡 **Usage**: These are the top posts from the current Xiaohongshu page. You can click the links to view full posts.`;

        console.log('🐛 DEBUG: Sending success response with summary');
        sendResponse({
          type: 'MESSAGE',
          payload: {
            text: summary,
            sessionId
          }
        });
      } else {
        console.log('🐛 DEBUG: No posts found or invalid data');
        sendResponse({
          type: 'MESSAGE',
          payload: {
            text: '❌ No posts found on this page. Make sure you\'re on a Xiaohongshu search results or feed page.',
            sessionId
          }
        });
      }

    } catch (error) {
      console.error('🐛 DEBUG: Xiaohongshu extraction error:', error);
      sendResponse({
        type: 'MESSAGE',
        payload: {
          text: `❌ Failed to extract posts: ${(error as Error).message}`,
          sessionId
        }
      });
    }
  }

  private async findXiaohongshuTab(): Promise<chrome.tabs.Tab | null> {
    return new Promise((resolve) => {
      chrome.tabs.query({}, (tabs) => {
        if (chrome.runtime.lastError) {
          console.error('Error querying tabs:', chrome.runtime.lastError);
          resolve(null);
          return;
        }
        
        // Find the most recent Xiaohongshu tab
        const xiaohongshuTabs = tabs.filter(tab => 
          tab.url && tab.url.includes('xiaohongshu.com')
        );
        
        if (xiaohongshuTabs.length > 0) {
          // Return the most recently accessed tab
          const mostRecent = xiaohongshuTabs.sort((a, b) => 
            (b.lastAccessed || 0) - (a.lastAccessed || 0)
          )[0];
          resolve(mostRecent);
        } else {
          resolve(null);
        }
      });
    });
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