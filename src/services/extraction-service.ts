import { ChatResponse } from '../types';

export class ExtractionService {
  async extractXiaohongshuPosts(
    tabId: number | undefined,
    sendResponse: (response: ChatResponse) => void,
    sessionId: string
  ): Promise<void> {
    try {
      console.log('🐛 DEBUG: extractXiaohongshuPosts STARTED');
      
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

      console.log('🐛 DEBUG: About to send EXTRACT_POSTS message to tab:', xiaohongshuTab.id);
      
      // Use content script to extract posts with the proper extractor classes
      chrome.tabs.sendMessage(
        xiaohongshuTab.id!, 
        { type: 'EXTRACT_POSTS', payload: { maxPosts: 5 } }, 
        (result) => {
          console.log('🐛 DEBUG: Extract posts response:', result);
          
          if (chrome.runtime.lastError) {
            console.error('🐛 DEBUG: Chrome runtime error:', chrome.runtime.lastError);
            sendResponse({
              type: 'MESSAGE',
              payload: {
                text: `❌ Failed to extract posts: ${chrome.runtime.lastError.message}`,
                sessionId
              }
            });
            return;
          }
          
          if (result?.success && result.posts && result.posts.length > 0) {
            console.log('🐛 DEBUG: Posts found, creating summary');
            // Create summary
            let summary = `📱 **${result.platform.charAt(0).toUpperCase() + result.platform.slice(1)} Posts Extracted**\n\n`;
            summary += `🔍 **Page**: ${result.pageTitle}\n`;
            summary += `📊 **Found**: ${result.totalFound} total posts, extracted top ${result.posts.length}\n\n`;
            summary += `📋 **Top Posts**:\n\n`;

            result.posts.forEach((post: any, index: number) => {
              summary += `**${index + 1}. ${post.title}**\n`;
              summary += `${post.content.slice(0, 200)}${post.content.length > 200 ? '...' : ''}\n`;
              if (post.link) {
                summary += `🔗 Link: ${post.link}\n`;
              }
              if (post.metadata?.author) {
                summary += `👤 Author: ${post.metadata.author}\n`;
              }
              if (post.metadata?.viewCount) {
                summary += `👀 Views: ${post.metadata.viewCount}\n`;
              }
              summary += `\n`;
            });

            summary += `💡 **Usage**: These are the top posts from the current ${result.platform} page. You can click the links to view full posts.`;

            console.log('🐛 DEBUG: Sending success response with summary');
            sendResponse({
              type: 'MESSAGE',
              payload: {
                text: summary,
                sessionId
              }
            });
          } else {
            console.log('🐛 DEBUG: No posts found or extraction failed');
            const errorMessage = result?.error || 'No posts found on this page or extraction failed';
            sendResponse({
              type: 'MESSAGE',
              payload: {
                text: `❌ ${errorMessage}`,
                sessionId
              }
            });
          }
        }
      );

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

  async extractPostsByPlatform(
    platform: string,
    tabId: number | undefined,
    sendResponse: (response: ChatResponse) => void,
    sessionId: string
  ): Promise<void> {
    switch (platform.toLowerCase()) {
      case 'xiaohongshu':
        await this.extractXiaohongshuPosts(tabId, sendResponse, sessionId);
        break;
      default:
        sendResponse({
          type: 'MESSAGE',
          payload: {
            text: `❌ Platform "${platform}" is not supported for post extraction. Currently supported: xiaohongshu`,
            sessionId
          }
        });
    }
  }
} 