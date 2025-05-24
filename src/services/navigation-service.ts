import { ChatResponse } from '../types';

export class NavigationService {
  private navigationPatterns = [
    /^go to (.+)$/i,
    /^navigate to (.+)$/i,
    /^login to xiaohongshu$/i,
    /^xiaohongshu login$/i,
    /^login xiaohongshu$/i
  ];

  isNavigationCommand(text: string): boolean {
    const lowerText = text.toLowerCase().trim();
    return this.navigationPatterns.some(pattern => pattern.test(lowerText));
  }

  async handleNavigation(
    text: string,
    tabId: number | undefined,
    sendResponse: (response: ChatResponse) => void,
    sessionId: string
  ): Promise<void> {
    const lowerText = text.toLowerCase().trim();
    
    // Check for Xiaohongshu login commands
    if (lowerText.includes('xiaohongshu') && lowerText.includes('login')) {
      console.log('Navigating to Xiaohongshu login page');
      
      // Send immediate feedback
      sendResponse({
        type: 'MESSAGE',
        payload: {
          text: 'Navigating to Xiaohongshu login page...',
          sessionId
        }
      });

      try {
        const result = await this.navigate('https://www.xiaohongshu.com/signin', tabId);
        this.sendNavigationResult(result, 'https://www.xiaohongshu.com/signin');
      } catch (error) {
        console.error('Xiaohongshu login navigation error:', error);
        this.sendNavigationError('https://www.xiaohongshu.com/signin', error as Error);
      }
      return;
    }

    // Extract URL from general navigation commands
    for (const pattern of this.navigationPatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        let url = match[1].trim();
        
        // Add protocol if missing
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
          url = `https://${url}`;
        }
        
        console.log(`Navigating to: ${url}`);
        
        // Send immediate feedback
        sendResponse({
          type: 'MESSAGE',
          payload: {
            text: `Navigating to ${url}...`,
            sessionId
          }
        });

        try {
          const result = await this.navigate(url, tabId);
          this.sendNavigationResult(result, url);
        } catch (error) {
          console.error('Navigation error:', error);
          this.sendNavigationError(url, error as Error);
        }
        return;
      }
    }

    // If no pattern matched
    sendResponse({
      type: 'MESSAGE',
      payload: {
        text: 'Could not extract URL from navigation command.',
        sessionId
      }
    });
  }

  async navigate(url: string, tabId?: number, sendResponse?: (response: ChatResponse) => void): Promise<any> {
    return new Promise((resolve) => {
      if (!tabId) {
        resolve({ success: false, error: 'No tab ID provided' });
        return;
      }
      
      const normalizedUrl = this.normalizeUrl(url);
      
      chrome.tabs.update(tabId, { url: normalizedUrl }, () => {
        if (chrome.runtime.lastError) {
          resolve({ success: false, error: chrome.runtime.lastError.message });
        } else {
          resolve({ success: true, url: normalizedUrl });
        }
      });
    });
  }

  private extractUrl(text: string): string | null {
    for (const pattern of this.navigationPatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }
    return null;
  }

  private normalizeUrl(url: string): string {
    // Add protocol if missing
    if (!url.match(/^\w+:\/\//)) {
      return 'http://' + url;
    }
    return url;
  }

  private sendNavigationResult(result: any, url: string): void {
    if (result?.success) {
      const title = result.title || 'Untitled Page';
      const content = result.content || 'No content preview available.';
      
      chrome.runtime.sendMessage({
        type: 'MCP_BROWSE_RESULT',
        payload: {
          title,
          url: result.url || url,
          snippet: this.truncateContent(content, 200)
        }
      });
    } else {
      this.sendNavigationError(url, new Error(result.error || 'Unknown error'));
    }
  }

  private sendNavigationError(url: string, error: Error): void {
    chrome.runtime.sendMessage({
      type: 'MCP_BROWSE_RESULT',
      payload: {
        title: 'Navigation Failed',
        url,
        snippet: error.message || 'Failed to navigate to the URL'
      }
    });
  }

  private truncateContent(content: string, maxLength: number): string {
    return content.length > maxLength 
      ? content.substring(0, maxLength) + '...' 
      : content;
  }
} 