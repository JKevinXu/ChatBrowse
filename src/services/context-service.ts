import { ChatResponse, PageInfo } from '../types';

interface PageContext {
  tabId: number;
  pageInfo: {
    title: string;
    url: string;
    content: string;
    useAsContext: boolean;
  };
}

export class ContextService {
  private currentPageContext: PageContext | null = null;
  private contentScriptReadyTabs = new Set<number>();

  markTabReady(tabId: number): void {
    this.contentScriptReadyTabs.add(tabId);
  }

  isTabReady(tabId: number): boolean {
    return this.contentScriptReadyTabs.has(tabId);
  }

  async autoSetContext(tabId: number): Promise<void> {
    try {
      const pageInfo = await this.getPageInfo(tabId);
      if (pageInfo && pageInfo.title && pageInfo.url && pageInfo.content) {
        this.currentPageContext = {
          tabId,
          pageInfo: {
            title: pageInfo.title,
            url: pageInfo.url,
            content: pageInfo.content,
            useAsContext: true
          }
        };
      }
    } catch (error) {
      console.error('Auto-set context failed:', error);
    }
  }

  setContext(
    pageInfo: { title: string; url: string; content: string; useAsContext: boolean },
    tabId: number | undefined,
    sendResponse: (response: ChatResponse) => void
  ): void {
    if (!tabId) {
      sendResponse({
        type: 'ERROR',
        payload: { message: 'Could not determine tab ID' }
      });
      return;
    }

    if (pageInfo.useAsContext) {
      // Store the page context
      this.currentPageContext = {
        tabId,
        pageInfo: {
          title: pageInfo.title,
          url: pageInfo.url,
          content: pageInfo.content,
          useAsContext: true
        }
      };

      sendResponse({
        type: 'MESSAGE',
        payload: {
          text: 'Current page content will now be used as context for chat messages.',
          success: true
        }
      });
    } else {
      // Clear page context if it exists for this tab
      if (this.currentPageContext && this.currentPageContext.tabId === tabId) {
        this.currentPageContext = null;
      }

      sendResponse({
        type: 'MESSAGE',
        payload: {
          text: 'Page content context has been disabled.',
          success: true
        }
      });
    }
  }

  getContext(tabId: number): PageContext | null {
    if (this.currentPageContext && this.currentPageContext.tabId === tabId) {
      return this.currentPageContext;
    }
    return null;
  }

  hasContext(tabId: number): boolean {
    return this.currentPageContext !== null && this.currentPageContext.tabId === tabId;
  }

  async getPageInfo(tabId: number): Promise<PageInfo | null> {
    if (!this.contentScriptReadyTabs.has(tabId)) {
      console.warn(`Content script not ready in tab ${tabId}`);
    }

    console.log('🔧 CONTEXT: Sending EXTRACT_PAGE_INFO message to tab:', tabId);
    return new Promise((resolve) => {
      try {
        chrome.tabs.sendMessage(tabId, { type: 'EXTRACT_PAGE_INFO' }, (pageInfo: PageInfo) => {
          console.log('🔧 CONTEXT: Received response from content script:', pageInfo);
          
          if (chrome.runtime.lastError) {
            console.error(`🔧 CONTEXT: Error getting page info: ${chrome.runtime.lastError.message}`);
            resolve(null);
            return;
          }

          if (!pageInfo) {
            console.error('🔧 CONTEXT: Page info response is null or undefined');
            resolve(null);
            return;
          }

          console.log('🔧 CONTEXT: Page info received successfully:', {
            title: pageInfo.title,
            url: pageInfo.url,
            contentLength: pageInfo.content?.length || 0
          });
          console.log('🔧 CONTEXT: Full content preview (first 500 chars):', pageInfo.content?.substring(0, 500));
          console.log('🔧 CONTEXT: Full content received:', pageInfo.content);

          // Mark this tab as having a working content script
          this.contentScriptReadyTabs.add(tabId);
          resolve(pageInfo);
        });
      } catch (error) {
        console.error('🔧 CONTEXT: Exception in getPageInfo:', error);
        resolve(null);
      }
    });
  }

  clearContext(tabId?: number): void {
    if (tabId) {
      if (this.currentPageContext && this.currentPageContext.tabId === tabId) {
        this.currentPageContext = null;
      }
    } else {
      this.currentPageContext = null;
    }
  }
} 