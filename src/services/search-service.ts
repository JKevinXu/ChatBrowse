import { ChatResponse } from '../types';

interface SearchCommand {
  query: string;
  engine: 'google' | 'bilibili' | 'xiaohongshu';
}

export class SearchService {
  private searchUrls = {
    google: (query: string) => `https://www.google.com/search?q=${encodeURIComponent(query)}`,
    bilibili: (query: string) => `https://search.bilibili.com/all?keyword=${encodeURIComponent(query)}`,
    xiaohongshu: (query: string) => `https://www.xiaohongshu.com/search_result?keyword=${encodeURIComponent(query)}`
  };

  private searchPatterns = [
    {
      engine: 'google' as const,
      regex: /^(?:google\s+(?:search\s+for\s+|search\s+|find\s+)?|search\s+(?:google\s+for\s+|google\s+|for\s+)?)(.+)$/i
    },
    {
      engine: 'bilibili' as const,
      regex: /^(?:search\s+(?:for\s+)?(.+?)\s+on\s+bilibili|bilibili\s+(?:search\s+for\s+|search\s+|find\s+)?(.+))$/i
    },
    {
      engine: 'xiaohongshu' as const,
      regex: /^(?:search\s+(?:for\s+)?(.+?)\s+on\s+xiaohongshu|xiaohongshu\s+(?:search\s+for\s+|search\s+|find\s+)?(.+))$/i
    }
  ];

  parseSearchCommand(text: string): SearchCommand | null {
    const lowerText = text.toLowerCase().trim();
    
    for (const pattern of this.searchPatterns) {
      const match = lowerText.match(pattern.regex);
      if (match) {
        const query = (match[1] || match[2] || '').trim();
        if (query) {
          return {
            query,
            engine: pattern.engine
          };
        }
      }
    }
    
    return null;
  }

  async handleSearch(
    searchCommand: SearchCommand,
    tabId: number | undefined,
    sendResponse: (response: ChatResponse) => void,
    sessionId: string
  ): Promise<void> {
    const { query, engine } = searchCommand;
    
    console.log(`Searching ${engine} for: "${query}"`);
    
    // Send immediate feedback
    sendResponse({
      type: 'MESSAGE',
      payload: {
        text: `Searching ${engine} for "${query}"...`,
        sessionId
      }
    });

    try {
      const url = this.searchUrls[engine](query);
      const result = await this.performSearch(url, tabId);
      
      this.sendSearchResult(result, engine, query);
    } catch (error) {
      console.error(`${engine} search error:`, error);
      this.sendSearchError(engine, error as Error);
    }
  }

  private async performSearch(url: string, tabId?: number): Promise<any> {
    return new Promise((resolve) => {
      if (!tabId) {
        resolve({ success: false, error: 'No tab ID provided' });
        return;
      }
      
      chrome.tabs.update(tabId, { url }, () => {
        if (chrome.runtime.lastError) {
          resolve({ success: false, error: chrome.runtime.lastError.message });
        } else {
          resolve({ success: true, url });
        }
      });
    });
  }

  private sendSearchResult(result: any, engine: string, query: string): void {
    if (result?.success) {
      const title = result.title || `${engine} Search Results`;
      const url = result.url || this.getDefaultUrl(engine);
      const content = result.content || `Search results for "${query}"`;
      
      chrome.runtime.sendMessage({
        type: 'MCP_BROWSE_RESULT',
        payload: {
          title,
          url,
          snippet: this.truncateContent(content, 200)
        }
      });
    } else {
      this.sendSearchError(engine, new Error(result.error || 'Unknown error'));
    }
  }

  private sendSearchError(engine: string, error: Error): void {
    chrome.runtime.sendMessage({
      type: 'MCP_BROWSE_RESULT',
      payload: {
        title: `${engine} Search Error`,
        url: this.getDefaultUrl(engine),
        snippet: error.message || `Failed to search ${engine}`
      }
    });
  }

  private getDefaultUrl(engine: string): string {
    const defaults = {
      google: 'https://www.google.com/',
      bilibili: 'https://www.bilibili.com/',
      xiaohongshu: 'https://www.xiaohongshu.com/explore'
    };
    return defaults[engine as keyof typeof defaults] || 'https://www.google.com/';
  }

  private truncateContent(content: string, maxLength: number): string {
    return content.length > maxLength 
      ? content.substring(0, maxLength) + '...' 
      : content;
  }
} 