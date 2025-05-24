import { ChatResponse } from '../types';
import { OpenAIService } from './openai-service';
import { NavigationService } from './navigation-service';
import { SearchService } from './search-service';
import { ActionService } from './action-service';
import { ContextService } from './context-service';

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
    try {
      switch (request.type) {
        case 'CONTENT_SCRIPT_READY':
          return this.handleContentScriptReady(request, sender, sendResponse);
        
        case 'SEND_MESSAGE':
          return this.handleUserMessage(request.payload, sender, sendResponse);
        
        case 'NAVIGATE':
          return this.handleNavigation(request.payload, sender, sendResponse);
        
        case 'EXTRACT_INFO':
          return this.handleExtraction(sender, sendResponse);
        
        case 'CLEAR_CHAT':
          return this.handleClearChat(sender, sendResponse);
        
        case 'SET_CONTEXT':
          return this.handleSetContext(request.payload, sender, sendResponse);
        
        case 'ANALYZE_SEARCH_ELEMENTS':
          return this.handleSearchElementAnalysis(request.payload, sender, sendResponse);
        
        default:
          sendResponse({
            type: 'ERROR',
            payload: { message: 'Unknown command type' }
          });
          return false;
      }
    } catch (error) {
      console.error('Message routing error:', error);
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
    const { text, sessionId } = payload;
    const tabId = sender.tab?.id || payload.tabId;

    // Check for action execution commands
    if (this.actionService.isExecutionCommand(text) && tabId) {
      await this.actionService.executeStoredPlan(tabId, sendResponse, sessionId);
      return true;
    }

    // Check for action planning requests
    if (this.actionService.isActionRequest(text) && tabId) {
      await this.actionService.planActions(text, tabId, sendResponse, sessionId);
      return true;
    }

    // Check for navigation commands
    if (this.navigationService.isNavigationCommand(text)) {
      await this.navigationService.handleNavigation(text, tabId, sendResponse, sessionId);
      return true;
    }

    // Check for search commands
    const searchResult = this.searchService.parseSearchCommand(text);
    if (searchResult) {
      await this.searchService.handleSearch(searchResult, tabId, sendResponse, sessionId);
      return true;
    }

    // Handle general AI chat
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
} 