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
      
      // Send success message back to chat
      if (result?.success) {
        let successMessage = `✅ Successfully navigated to ${engine} search results for "${query}".`;
        
        if (engine === 'xiaohongshu') {
          if (result.newTab && result.background) {
            successMessage = `✅ Opened Xiaohongshu search results for "${query}" in a background tab.`;
            successMessage += `\n\n🔄 **Switch to the new tab** to view results (Ctrl/Cmd + Tab).`;
          } else if (result.newTab) {
            successMessage = `✅ Opened Xiaohongshu search results for "${query}" in a new tab.`;
          }
          successMessage += `\n\n📱 Browse the results or ask me to "summarize xiaohongshu posts about ${query}" to extract and analyze them.`;
        } else {
          successMessage += `\n\n📱 Browse the results manually or ask me to help extract information.`;
        }
        
        sendResponse({
          type: 'MESSAGE',
          payload: {
            text: successMessage,
            sessionId
          }
        });
      } else {
        sendResponse({
          type: 'MESSAGE',
          payload: {
            text: `❌ Failed to search ${engine}: ${result.error || 'Unknown error'}`,
            sessionId
          }
        });
      }
    } catch (error) {
      console.error(`Search error for ${engine}:`, error);
      sendResponse({
        type: 'MESSAGE',
        payload: {
          text: `❌ Search failed: ${(error as Error).message}`,
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
        
        // Find the most recent Xiaohongshu tab with search results
        const xiaohongshuTabs = tabs.filter(tab => 
          tab.url && 
          tab.url.includes('xiaohongshu.com') && 
          (tab.url.includes('search') || tab.url.includes('keyword'))
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

  private async performSearch(url: string, tabId?: number): Promise<any> {
    return new Promise((resolve) => {
      if (!tabId) {
        resolve({ success: false, error: 'No tab ID provided' });
        return;
      }
      
      // For Xiaohongshu, open in new tab to preserve chat session
      if (url.includes('xiaohongshu.com')) {
        chrome.tabs.create({ 
          url, 
          active: false  // Open in background to keep popup open
        }, (newTab) => {
          if (chrome.runtime.lastError) {
            resolve({ success: false, error: chrome.runtime.lastError.message });
          } else {
            resolve({ success: true, url, newTab: true, background: true });
          }
        });
      } else {
        // For other search engines, navigate current tab
        chrome.tabs.update(tabId, { url }, () => {
          if (chrome.runtime.lastError) {
            resolve({ success: false, error: chrome.runtime.lastError.message });
          } else {
            resolve({ success: true, url });
          }
        });
      }
    });
  }
} 