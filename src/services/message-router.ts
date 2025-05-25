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

          console.log('🐛 DEBUG: About to call extraction service');

          // Step 3: Extract the posts with error handling
          const extractionResult = await this.extractionService.extractXiaohongshuPosts(payload.tabId, (extractResponse) => {
            console.log('🐛 DEBUG: Extract progress response received:', extractResponse);
            sendFollowUpToPopup(extractResponse);
          }, payload.sessionId || 'default');

          console.log('🐛 DEBUG: extractXiaohongshuPosts completed, result:', extractionResult);

          // Step 4: Handle the extraction result
          if (extractionResult?.success && extractionResult.posts && extractionResult.posts.length > 0) {
            console.log('🐛 DEBUG: Extraction successful, sending to AI for summarization');
            
            // Send progress message
            sendFollowUpToPopup({
              type: 'MESSAGE',
              payload: {
                text: '🤖 Analyzing extracted content with AI to create intelligent summary...',
                sessionId: payload.sessionId || 'default'
              }
            });

            // Prepare content for AI summarization
            const contentForAI = this.prepareContentForAI(extractionResult);
            console.log('🐛 DEBUG: Prepared content for AI, length:', contentForAI.length);

            // Call OpenAI service for summarization
            await this.openaiService.handleChat({
              text: contentForAI,
              sessionId: payload.sessionId || 'default',
              tabId: undefined
            }, sender, (aiResponse) => {
              console.log('🐛 DEBUG: Received AI summary response:', aiResponse);
              
              if (aiResponse && aiResponse.type === 'MESSAGE' && aiResponse.payload?.text) {
                // Send the AI-generated summary
                sendFollowUpToPopup({
                  type: 'MESSAGE',
                  payload: {
                    text: `📊 **AI Summary of ${extractionResult.posts.length} Xiaohongshu Posts**\n\n${aiResponse.payload.text}`,
                    sessionId: payload.sessionId || 'default'
                  }
                });
              } else {
                console.log('🐛 DEBUG: AI summarization failed, sending manual summary');
                const manualSummary = this.createManualSummary(extractionResult);
                sendFollowUpToPopup({
                  type: 'MESSAGE',
                  payload: {
                    text: manualSummary,
                    sessionId: payload.sessionId || 'default'
                  }
                });
              }
            });
          } else {
            console.log('🐛 DEBUG: Extraction failed or no posts found');
            const errorMessage = extractionResult?.error || 'Failed to extract posts from Xiaohongshu';
            sendFollowUpToPopup({
              type: 'MESSAGE',
              payload: {
                text: `❌ ${errorMessage}`,
                sessionId: payload.sessionId || 'default'
              }
            });
          }

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

  private prepareContentForAI(extractionResult: any): string {
    console.log('🐛 DEBUG: Preparing content for AI summarization');
    
    let contentForAI = `Please analyze and summarize these ${extractionResult.posts.length} Xiaohongshu posts about the topic:\n\n`;
    
    extractionResult.posts.forEach((post: any, index: number) => {
      contentForAI += `**Post ${index + 1}: ${post.title}**\n`;
      contentForAI += `Content: ${post.content}\n`;
      if (post.metadata?.author) {
        contentForAI += `Author: ${post.metadata.author}\n`;
      }
      if (post.link) {
        contentForAI += `Link: ${post.link}\n`;
      }
      contentForAI += `\n---\n\n`;
    });
    
    contentForAI += `Please provide:\n`;
    contentForAI += `1. A comprehensive summary of the main topics and themes\n`;
    contentForAI += `2. Key insights and recommendations mentioned across the posts\n`;
    contentForAI += `3. Common patterns or trends you notice\n`;
    contentForAI += `4. Any notable differences in perspectives or approaches\n`;
    contentForAI += `5. Practical takeaways for someone interested in this topic`;
    
    return contentForAI;
  }

  private createManualSummary(extractionResult: any): string {
    console.log('🐛 DEBUG: Creating manual summary fallback');
    
    let summary = `📱 **Manual Summary of ${extractionResult.posts.length} Xiaohongshu Posts**\n\n`;
    
    // Extract key themes and topics
    const allContent = extractionResult.posts.map((post: any) => post.content).join(' ');
    const contentLength = allContent.length;
    
    summary += `📊 **Overview**: Analyzed ${extractionResult.posts.length} posts with ${contentLength} characters of content\n\n`;
    
    summary += `📋 **Posts Covered**:\n`;
    extractionResult.posts.forEach((post: any, index: number) => {
      summary += `${index + 1}. **${post.title}**\n`;
      summary += `   → ${post.content.slice(0, 150)}${post.content.length > 150 ? '...' : ''}\n`;
      if (post.metadata?.author) {
        summary += `   → Author: ${post.metadata.author}\n`;
      }
      summary += `\n`;
    });

    summary += `💡 **Note**: This is a manual summary. AI summarization was not available.`;
    
    return summary;
  }
} 