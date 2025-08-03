import { ChatResponse } from '../types';
import { LLMService } from './llm-service';
import { NavigationService } from './navigation-service';
import { SearchService } from './search-service';
import { ActionService } from './action-service';
import { ContextService } from './context-service';
import { ExtractionService } from './extraction-service';
import { IntentService, IntentResult } from './intent-service';
import { IntentType, IntentConfig, XIAOHONGSHU_CONFIG } from '../config';
import { MCPClient } from './mcp-client';

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
  private llmService = LLMService.getInstance();
  private navigationService = new NavigationService();
  private searchService = new SearchService();
  private actionService = new ActionService();
  private contextService = new ContextService();
  private extractionService = new ExtractionService();
  private intentService = IntentService.getInstance();
  private mcpClient = MCPClient.getInstance();

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
        
        case 'START_NEW_CONVERSATION':
          console.log('🐛 DEBUG: Handling START_NEW_CONVERSATION');
          return this.handleStartNewConversation(sender, sendResponse);
        
        case 'SET_CONTEXT':
          console.log('🐛 DEBUG: Handling SET_CONTEXT');
          return this.handleSetContext(request.payload, sender, sendResponse);
        
        case 'ANALYZE_SEARCH_ELEMENTS':
          console.log('🐛 DEBUG: Handling ANALYZE_SEARCH_ELEMENTS');
          return this.handleSearchElementAnalysis(request.payload, sender, sendResponse);
        
        case 'SUMMARIZE_XIAOHONGSHU_POSTS':
          console.log('🐛 DEBUG: Handling SUMMARIZE_XIAOHONGSHU_POSTS');
          return this.handleXiaohongshuSummarization(request.payload, sender, sendResponse);
        
        case 'OPEN_POPUP_AND_SUMMARIZE':
          console.log('🐛 DEBUG: Handling OPEN_POPUP_AND_SUMMARIZE');
          return this.handleOpenPopupAndSummarize(request.payload, sender, sendResponse);
        
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
    console.log('🎯 [MessageRouter] ===== STARTING USER MESSAGE HANDLING =====');
    console.log('🐛 DEBUG: handleUserMessage ENTERED');
    console.log('🐛 DEBUG: Payload:', payload);
    console.log('🐛 DEBUG: Sender:', sender);
    
    const { text, sessionId } = payload;
    const tabId = sender.tab?.id || payload.tabId;
    
    console.log('🐛 DEBUG: Extracted text:', text);
    console.log('🐛 DEBUG: Extracted sessionId:', sessionId);
    console.log('🐛 DEBUG: TabId:', tabId);

    // Handle MCP requests first (simple one-click tool listing)
    if (text.startsWith('mcp:') || this.mcpClient.isListToolsRequest(text)) {
      console.log('🔌 [MessageRouter] Handling MCP request');
      return await this.handleMCPRequest(text, sessionId, sendResponse);
    }

    try {
      // Use LLM-based intent classification
      const context = {
        currentUrl: sender.tab?.url || payload.tabUrl,
        hasStoredActionPlan: tabId ? this.actionService.hasStoredPlan(tabId) : false,
        pageTitle: sender.tab?.title || payload.tabTitle
      };

      console.log('🌐 [MessageRouter] Built context for intent classification:');
      console.log('   Current URL:', context.currentUrl);
      console.log('   Has Stored Action Plan:', context.hasStoredActionPlan);
      console.log('   Page Title:', context.pageTitle);
      console.log('   Tab ID:', tabId);

      console.log('🎯 [MessageRouter] Calling IntentService.classifyIntent...');
      const intentResult: IntentResult = await this.intentService.classifyIntent(text, context);
      console.log('✅ [MessageRouter] Intent classification completed!');
      console.log('📊 [MessageRouter] Intent Classification Result:');
      console.log('   Intent:', intentResult.intent);
      console.log('   Confidence:', intentResult.confidence);
      console.log('   Parameters:', JSON.stringify(intentResult.parameters));
      console.log('   Reasoning:', intentResult.reasoning);

      // Route based on classified intent
      console.log('🚦 [MessageRouter] Starting intent-based routing...');
      console.log(`🎯 [MessageRouter] Routing to intent: ${intentResult.intent}`);

      // Validate intent before routing
      if (!IntentConfig.isValidIntent(intentResult.intent)) {
        console.log('❌ [MessageRouter] Invalid intent received:', intentResult.intent);
        console.log('🔄 [MessageRouter] Falling back to general chat');
        await this.llmService.handleChat(payload, sender, sendResponse);
        return true;
      }

      return await this.routeToIntentHandler(intentResult, payload, sender, sendResponse, tabId, text, sessionId, payload.requestId);

    } catch (error) {
      console.error('❌ [MessageRouter] Intent classification failed with error:', error);
      console.error('🔍 [MessageRouter] Error details:', {
        message: (error as Error).message,
        stack: (error as Error).stack,
        name: (error as Error).name
      });
      
      // If intent classification fails, fall back to general chat instead of erroring
      console.log('🔄 [MessageRouter] Intent classification failed - falling back to general chat');
      try {
        await this.llmService.handleChat(payload, sender, sendResponse);
        return true;
      } catch (fallbackError) {
        console.error('❌ [MessageRouter] Even fallback failed:', fallbackError);
        sendResponse({
          type: 'ERROR',
          payload: { 
            message: `Sorry, I'm having trouble processing your request right now. Please try again.` 
          }
        });
        return false;
      }
    } finally {
      console.log('🎯 [MessageRouter] ===== FINISHED USER MESSAGE HANDLING =====');
    }
  }

  /**
   * Handle MCP requests - simple tool listing
   */
  private async handleMCPRequest(
    text: string,
    sessionId: string,
    sendResponse: (response: ChatResponse) => void
  ): Promise<boolean> {
    console.log('🔌 [MessageRouter] Processing MCP request:', text);
    
    try {
      // For any MCP message, just list the tools (simple one-click behavior)
      const tools = await this.mcpClient.listTools();
      const formattedList = this.mcpClient.formatToolsList(tools);
      
      console.log('🔌 [MessageRouter] Successfully fetched', tools.length, 'MCP tools');
      
      sendResponse({
        type: 'MESSAGE',
        payload: {
          text: formattedList,
          sessionId: sessionId
        }
      });
      
      return true;
      
    } catch (error) {
      console.error('🔌 [MessageRouter] MCP request failed:', error);
      
      sendResponse({
        type: 'MESSAGE',
        payload: {
          text: '❌ Failed to connect to MCP server. Please try again later.',
          sessionId: sessionId
        }
      });
      
      return false;
    }
  }

  private async routeToIntentHandler(
    intentResult: IntentResult,
    payload: any,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: ChatResponse) => void,
    tabId: number | undefined,
    text: string,
    sessionId: string,
    requestId?: string
  ): Promise<boolean> {
    switch (intentResult.intent) {
      case 'action_execution':
        console.log('⚡ [MessageRouter] CASE: action_execution');
        if (tabId) {
          console.log('✅ [MessageRouter] Tab ID available, executing stored plan');
          console.log('🐛 DEBUG: Routing to action execution');
          await this.actionService.executeStoredPlan(tabId, sendResponse, sessionId);
          console.log('🎉 [MessageRouter] Action execution completed successfully');
          return true;
        } else {
          console.log('❌ [MessageRouter] No tab ID available for action execution');
          console.log('🔄 [MessageRouter] Falling through to general chat');
        }
        break;

      case 'navigation':
        console.log('🧭 [MessageRouter] CASE: navigation');
        console.log('🐛 DEBUG: Routing to navigation');
        console.log('🔧 [MessageRouter] Calling navigation service with text:', JSON.stringify(text));
        await this.navigationService.handleNavigation(text, tabId, sendResponse, sessionId);
        console.log('🎉 [MessageRouter] Navigation completed successfully');
        return true;

      case 'search':
        console.log('🔍 [MessageRouter] CASE: search');
        console.log('🐛 DEBUG: Routing to search');
        
        if (intentResult.parameters?.engine && intentResult.parameters?.query) {
          console.log('✅ [MessageRouter] Using LLM-extracted search parameters');
          const searchCommand = {
            query: intentResult.parameters.query,
            engine: intentResult.parameters.engine
          };
          console.log('🔧 [MessageRouter] Search command from LLM:', JSON.stringify(searchCommand));
          
          // 🚀 AUTO-ANALYSIS: If this is a xiaohongshu search, automatically trigger analysis
          if (searchCommand.engine === 'xiaohongshu') {
            console.log('📱 [MessageRouter] Xiaohongshu search detected - auto-triggering analysis');
            await this.handleXiaohongshuSummarization({ 
              query: searchCommand.query, 
              tabId, 
              sessionId 
            }, sender, sendResponse);
            console.log('🎉 [MessageRouter] Auto xiaohongshu analysis completed successfully');
            return true;
          }
          
          await this.searchService.handleSearch(searchCommand, tabId, sendResponse, sessionId, requestId);
          console.log('🎉 [MessageRouter] LLM-based search completed successfully');
          return true;
        }
        
        // Fallback to original parsing
        console.log('⚠️ [MessageRouter] LLM parameters incomplete, falling back to legacy parsing');
        const searchResult = this.searchService.parseSearchCommand(text);
        console.log('🔧 [MessageRouter] Legacy search result:', JSON.stringify(searchResult));
        
        if (searchResult) {
          console.log('✅ [MessageRouter] Legacy parsing successful, executing search');
          
          // 🚀 AUTO-ANALYSIS: If this is a xiaohongshu search, automatically trigger analysis
          if (searchResult.engine === 'xiaohongshu') {
            console.log('📱 [MessageRouter] Xiaohongshu search detected (legacy) - auto-triggering analysis');
            await this.handleXiaohongshuSummarization({ 
              query: searchResult.query, 
              tabId, 
              sessionId 
            }, sender, sendResponse);
            console.log('🎉 [MessageRouter] Auto xiaohongshu analysis (legacy) completed successfully');
            return true;
          }
          
          await this.searchService.handleSearch(searchResult, tabId, sendResponse, sessionId, requestId);
          console.log('🎉 [MessageRouter] Legacy search completed successfully');
          return true;
        } else {
          console.log('❌ [MessageRouter] Legacy parsing also failed');
          console.log('🔄 [MessageRouter] Falling through to general chat');
        }
        break;

      case 'xiaohongshu_summary':
        console.log('📱 [MessageRouter] CASE: xiaohongshu_summary');
        console.log('🐛 DEBUG: Routing to Xiaohongshu summary');
        
        const xiaohongshuSummaryQuery = intentResult.parameters?.query || 
          this.parseXiaohongshuSummaryCommand(text);
        console.log('🔍 [MessageRouter] Xiaohongshu summary query:', JSON.stringify(xiaohongshuSummaryQuery));
        
        if (xiaohongshuSummaryQuery) {
          console.log('✅ [MessageRouter] Query available, starting Xiaohongshu summarization');
          await this.handleXiaohongshuSummarization({ 
            query: xiaohongshuSummaryQuery, 
            tabId, 
            sessionId 
          }, sender, sendResponse);
          console.log('🎉 [MessageRouter] Xiaohongshu summarization completed successfully');
          return true;
        } else {
          console.log('❌ [MessageRouter] No query available for Xiaohongshu summarization');
          console.log('🔄 [MessageRouter] Falling through to general chat');
        }
        break;

      case 'xiaohongshu_extract':
        console.log('📤 [MessageRouter] CASE: xiaohongshu_extract');
        console.log('🐛 DEBUG: Routing to Xiaohongshu extraction');
        console.log('🔧 [MessageRouter] Calling extraction service...');
        await this.extractionService.extractXiaohongshuPosts(tabId, sendResponse, sessionId, true);
        console.log('🎉 [MessageRouter] Xiaohongshu extraction completed successfully');
        return true;

      case 'action_planning':
        console.log('⚡ [MessageRouter] CASE: action_planning');
        if (tabId) {
          console.log('✅ [MessageRouter] Tab ID available, starting action planning');
          console.log('🐛 DEBUG: Routing to action planning');
          console.log('🔧 [MessageRouter] Calling action service with text:', JSON.stringify(text));
          await this.actionService.planActions(text, tabId, sendResponse, sessionId);
          console.log('🎉 [MessageRouter] Action planning completed successfully');
          return true;
        } else {
          console.log('❌ [MessageRouter] No tab ID available for action planning');
          console.log('🔄 [MessageRouter] Falling through to general chat');
        }
        break;

      case 'general_chat':
      default:
        console.log('💬 [MessageRouter] CASE: general_chat (or default)');
        console.log('🐛 DEBUG: Routing to general chat');
        
        // Add intent confidence info to the response if it's low
        if (intentResult.confidence < 0.7) {
          console.log(`⚠️ [MessageRouter] Low confidence intent detected!`);
          console.log(`   Confidence: ${intentResult.confidence}`);
          console.log(`   Reasoning: ${intentResult.reasoning}`);
          console.log('🤔 [MessageRouter] This might indicate an ambiguous user request');
        } else {
          console.log('✅ [MessageRouter] High confidence general chat classification');
        }
        
        console.log('🔧 [MessageRouter] Calling LLM service for general chat...');
        await this.llmService.handleChat(payload, sender, sendResponse);
        console.log('🎉 [MessageRouter] General chat completed successfully');
        return true;
    }

    // If we reach here, something went wrong with routing
    console.log('⚠️ [MessageRouter] Reached fallback section - intent routing failed');
    console.log('🔄 [MessageRouter] This should not happen normally');
    console.log('💬 [MessageRouter] Falling back to general chat as safety net');
    await this.llmService.handleChat(payload, sender, sendResponse);
    console.log('🎉 [MessageRouter] Fallback general chat completed');
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
          maxPosts: XIAOHONGSHU_CONFIG.defaultMaxPosts, // Rate-limited posts
          fetchFullContent: payload?.fetchFullContent || XIAOHONGSHU_CONFIG.defaultFetchFullContent 
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

  private handleStartNewConversation(
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

    chrome.tabs.sendMessage(tabId, { type: 'START_NEW_CONVERSATION' }, (response) => {
      if (response && response.success) {
        sendResponse({
          type: 'MESSAGE',
          payload: { 
            text: 'New conversation started! How can I help you?', 
            success: true,
            sessionId: response.sessionId 
          }
        });
      } else {
        sendResponse({
          type: 'ERROR',
          payload: { message: response?.error || 'Failed to start new conversation' }
        });
      }
    });

    return true; // Keep message channel open for async response
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
    await this.llmService.analyzeSearchElements(payload, sendResponse);
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
        
        // Send completion message to chat history
        sendFollowUpToPopup({
          type: 'MESSAGE',
          payload: {
            text: `✅ Opened Xiaohongshu search for "${payload.query}". Starting analysis in ${XIAOHONGSHU_CONFIG.pageLoadWaitTime / 1000}s...`,
            sessionId: payload.sessionId || 'default'
          }
        });
        
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
        console.log(`🐛 DEBUG: Starting analysis after ${XIAOHONGSHU_CONFIG.pageLoadWaitTime / 1000} seconds`);
        try {
          sendFollowUpToPopup({
            type: 'MESSAGE',
            payload: {
              text: `🚦 Extracting top ${XIAOHONGSHU_CONFIG.defaultMaxPosts} posts with rate limiting (${XIAOHONGSHU_CONFIG.rateLimitDelay / 1000}-second delays) from Xiaohongshu page...`,
              sessionId: payload.sessionId || 'default'
            }
          });

          console.log('🐛 DEBUG: About to call extraction service');

          // Step 3: Extract the posts with error handling
          const extractionResult = await this.extractionService.extractXiaohongshuPosts(payload.tabId, (extractResponse) => {
            console.log('🐛 DEBUG: Extract progress response received:', extractResponse);
            // Don't forward progress responses since we already sent our own message above
          }, payload.sessionId || 'default', false); // Disable progress messages from extraction service

          console.log('🐛 DEBUG: extractXiaohongshuPosts completed, result:', extractionResult);

          // Step 4: Handle the extraction result
          if (extractionResult?.success && extractionResult.posts && extractionResult.posts.length > 0) {
            console.log('🐛 DEBUG: Extraction successful, sending to AI for summarization');
            
            // Send extraction completion message to chat history
            sendFollowUpToPopup({
              type: 'MESSAGE',
              payload: {
                text: `Extracted ${extractionResult.posts.length} posts from Xiaohongshu page with rate limiting`,
                sessionId: payload.sessionId || 'default'
              }
            });
            
            // Send progress message for AI analysis
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
            await this.llmService.handleChat({
              text: contentForAI,
              sessionId: payload.sessionId || 'default',
              tabId: undefined
            }, sender, (aiResponse) => {
              console.log('🐛 DEBUG: Received AI summary response:', aiResponse);
              
              if (aiResponse && aiResponse.type === 'MESSAGE' && aiResponse.payload?.text) {
                // Send AI analysis completion message to chat history
                sendFollowUpToPopup({
                  type: 'MESSAGE',
                  payload: {
                    text: `Analyzed extracted content with AI to create intelligent summary`,
                    sessionId: payload.sessionId || 'default'
                  }
                });
                
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
      }, XIAOHONGSHU_CONFIG.pageLoadWaitTime); // Wait for page to load

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
      // Tool dropdown format with colon
      /^(?:xiaohongshu:\s*(.+))$/i,
      // General xiaohongshu prefix format
      /^(?:xiaohongshu\s+(.+))$/i,
      // Specific command formats
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
        const query = match[1].trim();
        console.log('🐛 DEBUG: Pattern matched! Returning query:', query);
        // Filter out common extraction keywords to get pure search query
        const cleanQuery = query.replace(/^(extract\s+posts\s*:?\s*|posts\s*:?\s*)/i, '').trim();
        return cleanQuery || query;
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

  private handleOpenPopupAndSummarize(
    payload: any,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: any) => void
  ): boolean {
    console.log('🔧 MessageRouter: Opening popup and setting auto-summarize flag');
    
    try {
      // Set a flag in storage that the popup should auto-summarize when it opens
      chrome.storage.local.set({ 
        autoSummarize: true,
        autoSummarizeUrl: payload.url,
        autoSummarizeTitle: payload.title 
      }, () => {
        console.log('✅ MessageRouter: Auto-summarize flag set in storage');
        
        // Open the popup
        chrome.action.openPopup().then(() => {
          console.log('✅ MessageRouter: Popup opened successfully');
          sendResponse({ success: true });
        }).catch((error) => {
          console.error('❌ MessageRouter: Error opening popup:', error);
          sendResponse({ error: error.message });
        });
      });
      
      return true;
    } catch (error) {
      console.error('❌ MessageRouter: Error in handleOpenPopupAndSummarize:', error);
      sendResponse({ error: (error as Error).message });
      return false;
    }
  }
} 