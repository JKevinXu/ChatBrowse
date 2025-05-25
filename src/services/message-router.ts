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

    // Check if this is a Xiaohongshu page and use rate-limited extraction
    if (sender.tab?.url?.includes('xiaohongshu.com')) {
      chrome.tabs.sendMessage(tabId, { 
        type: 'EXTRACT_POSTS_ASYNC', 
        payload: { 
          maxPosts: 2, // Rate-limited to 2 posts
          fetchFullContent: payload?.fetchFullContent || false 
        } 
      }, (result) => {
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
    } else {
      // Use regular extraction for non-Xiaohongshu sites
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
    }

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
                // Create reference section programmatically
                const referenceSection = this.createReferenceSection(extractionResult);
                
                // Send the AI-generated summary with programmatic reference section
                sendFollowUpToPopup({
                  type: 'MESSAGE',
                  payload: {
                    text: `📊 **${extractionResult.posts.length} 条小红书帖子 AI 总结**\n\n${aiResponse.payload.text}${referenceSection}`,
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
    
    let contentForAI = `请分析并总结这 ${extractionResult.posts.length} 条小红书帖子的内容：\n\n`;
    
    extractionResult.posts.forEach((post: any, index: number) => {
      contentForAI += `**帖子 ${index + 1}: ${post.title}**\n`;
      contentForAI += `内容: ${post.content}\n`;
      if (post.metadata?.author) {
        contentForAI += `作者: ${post.metadata.author}\n`;
      }
      if (post.link) {
        contentForAI += `链接: ${post.link}\n`;
      }
      contentForAI += `\n---\n\n`;
    });
    
    contentForAI += `请用中文提供：\n`;
    contentForAI += `1. **主要话题总结**: 所有帖子的主要主题和话题\n`;
    contentForAI += `2. **关键见解**: 帖子中提到的重要见解和建议\n`;
    contentForAI += `3. **共同趋势**: 你注意到的共同模式或趋势\n`;
    contentForAI += `4. **不同观点**: 不同的视角或方法的显著差异\n`;
    contentForAI += `5. **实用建议**: 对于对这个话题感兴趣的人的实用建议\n\n`;
    contentForAI += `请用清晰的中文回答，使用合适的标题和格式。**注意：不要添加参考链接，我会在后面单独添加。**`;
    
    return contentForAI;
  }

  private createReferenceSection(extractionResult: any): string {
    console.log('🐛 DEBUG: Creating programmatic reference section');
    
    const postsWithLinks = extractionResult.posts.filter((post: any) => post.link);
    if (postsWithLinks.length === 0) {
      return '\n\n## 📚 参考帖子\n\n暂无可用的帖子链接。';
    }
    
    let referenceHTML = '\n\n## 📚 参考帖子\n\n';
    
    postsWithLinks.forEach((post: any, index: number) => {
      // Properly escape content for HTML attributes
      const fullContent = this.escapeHtmlAttribute(post.content);
      const safeTitle = this.escapeHtmlAttribute(post.title);
      const safeAuthor = this.escapeHtmlAttribute(post.metadata?.author || '');
      const imageUrl = post.image || '';
      
      referenceHTML += `${index + 1}. <a href="${post.link}" class="post-reference" data-full-content="${fullContent}" data-author="${safeAuthor}" data-title="${safeTitle}" data-image="${imageUrl}">${post.title}</a>`;
      
      if (post.metadata?.author) {
        referenceHTML += ` - ${post.metadata.author}`;
      }
      referenceHTML += '\n\n';
    });
    
    return referenceHTML;
  }

  private escapeHtmlAttribute(text: string): string {
    if (!text) return '';
    return text
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r');
  }

  private createManualSummary(extractionResult: any): string {
    console.log('🐛 DEBUG: Creating manual summary fallback');
    
    let summary = `📱 **${extractionResult.posts.length} 条小红书帖子手动总结**\n\n`;
    
    // Extract key themes and topics
    const allContent = extractionResult.posts.map((post: any) => post.content).join(' ');
    const contentLength = allContent.length;
    
    summary += `📊 **概览**: 分析了 ${extractionResult.posts.length} 条帖子，共 ${contentLength} 个字符的内容\n\n`;
    
    summary += `📋 **涵盖的帖子**:\n`;
    extractionResult.posts.forEach((post: any, index: number) => {
      summary += `${index + 1}. **${post.title}**\n`;
      summary += `   → ${post.content.slice(0, 150)}${post.content.length > 150 ? '...' : ''}\n`;
      if (post.metadata?.author) {
        summary += `   → 作者: ${post.metadata.author}\n`;
      }
      summary += `\n`;
    });

    // Add programmatically created reference section
    const referenceSection = this.createReferenceSection(extractionResult);
    summary += referenceSection;

    summary += `\n\n💡 **注意**: 这是手动总结。AI 总结功能暂时不可用。`;
    
    return summary;
  }
} 