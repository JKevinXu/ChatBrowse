import { ChatResponse } from '../types';

export class ExtractionService {
  async extractXiaohongshuPosts(
    tabId: number | undefined,
    sendResponse: (response: ChatResponse) => void,
    sessionId: string
  ): Promise<void> {
    try {
      console.log('🐛 DEBUG: extractXiaohongshuPosts STARTED, extracting full content by default');
      
      // Send immediate feedback
      sendResponse({
        type: 'MESSAGE',
        payload: {
          text: `🔍 Extracting top 5 posts (full content) from Xiaohongshu page...`,
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
        { type: 'EXTRACT_POSTS', payload: { maxPosts: 5, fetchFullContent: true } }, // Always fetch full content
        async (result) => {
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
            console.log('🐛 DEBUG: Posts found, checking for full content extraction');
            
            // Check if any posts need full content extraction
            const needsFullContent = result.posts.some((post: any) => 
              post.content.startsWith('[FETCH_FULL_CONTENT]')
            );
            
            if (needsFullContent) {
              console.log('🐛 DEBUG: Full content extraction needed, processing posts individually');
              await this.extractFullContentForPosts(result.posts, sendResponse, sessionId);
            } else {
              console.log('🐛 DEBUG: Creating summary with preview content');
              this.createAndSendSummary(result, sendResponse, sessionId);
            }
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

  private async extractFullContentForPosts(
    posts: any[],
    sendResponse: (response: ChatResponse) => void,
    sessionId: string
  ): Promise<void> {
    console.log('🐛 DEBUG: Starting full content extraction for', posts.length, 'posts');
    
    const updatedPosts = [];
    
    for (let i = 0; i < posts.length; i++) {
      const post = posts[i];
      console.log(`🐛 DEBUG: Processing post ${i + 1}/${posts.length}: ${post.title}`);
      
      if (post.content.startsWith('[FETCH_FULL_CONTENT]')) {
        const postUrl = post.content.replace('[FETCH_FULL_CONTENT]', '');
        console.log('🐛 DEBUG: Fetching full content from:', postUrl);
        
        try {
          const fullContent = await this.fetchFullContentFromUrl(postUrl);
          updatedPosts.push({
            ...post,
            content: fullContent || post.content
          });
        } catch (error) {
          console.error(`🐛 DEBUG: Failed to fetch full content for post ${i + 1}:`, error);
          updatedPosts.push({
            ...post,
            content: `[Could not fetch full content: ${(error as Error).message}]`
          });
        }
      } else {
        updatedPosts.push(post);
      }
    }
    
    // Create and send summary with full content
    this.createAndSendSummary({
      posts: updatedPosts,
      totalFound: posts.length,
      pageTitle: 'Xiaohongshu Search Results',
      platform: 'xiaohongshu'
    }, sendResponse, sessionId);
  }

  private async fetchFullContentFromUrl(postUrl: string): Promise<string> {
    return new Promise((resolve) => {
      console.log('🐛 DEBUG: Opening tab for full content extraction:', postUrl);
      
      // Create a new tab for the post
      chrome.tabs.create({
        url: postUrl,
        active: false // Open in background
      }, (tab) => {
        if (!tab.id) {
          resolve('[Could not open post tab]');
          return;
        }
        
        // Wait for the tab to load, then extract content
        const tabId = tab.id;
        
        // Listen for tab completion
        const onUpdated = (updatedTabId: number, changeInfo: chrome.tabs.TabChangeInfo) => {
          if (updatedTabId === tabId && changeInfo.status === 'complete') {
            chrome.tabs.onUpdated.removeListener(onUpdated);
            
            // Wait a bit more for content to load
            setTimeout(() => {
              console.log('🐛 DEBUG: Tab loaded, extracting full content from tab:', tabId);
              
              // Inject extractor and get full content
              chrome.scripting.executeScript({
                target: { tabId },
                func: () => {
                  // Inline extraction for full content
                  const selectors = [
                    '#detail-desc .note-text',
                    '.note-text',
                    '.content',
                    '[class*="content"]',
                    '.desc',
                    'main',
                    'article'
                  ];
                  
                  let fullContent = '';
                  
                  for (const selector of selectors) {
                    const element = document.querySelector(selector);
                    if (element) {
                      const text = element.textContent?.trim() || '';
                      if (text.length > fullContent.length) {
                        fullContent = text;
                      }
                    }
                  }
                  
                  // Clean up content
                  if (fullContent) {
                    fullContent = fullContent.replace(/\s+/g, ' ').trim();
                    fullContent = fullContent.replace(/^(点赞|收藏|评论|分享|关注|取消关注)\s*/g, '');
                    fullContent = fullContent.replace(/\s*(点赞|收藏|评论|分享|关注|取消关注)\s*$/g, '');
                  }
                  
                  return fullContent || '[No content found on this page]';
                }
              }, (results) => {
                // Close the tab
                chrome.tabs.remove(tabId);
                
                if (chrome.runtime.lastError || !results || !results[0]) {
                  console.error('🐛 DEBUG: Error extracting content:', chrome.runtime.lastError);
                  resolve('[Could not extract content from post page]');
                } else {
                  const content = results[0].result as string;
                  console.log('🐛 DEBUG: Extracted full content, length:', content.length);
                  resolve(content);
                }
              });
            }, 2000); // Wait 2 seconds for content to load
          }
        };
        
        chrome.tabs.onUpdated.addListener(onUpdated);
        
        // Timeout fallback
        setTimeout(() => {
          chrome.tabs.onUpdated.removeListener(onUpdated);
          chrome.tabs.remove(tabId).catch(() => {}); // Clean up
          resolve('[Timeout waiting for post to load]');
        }, 10000); // 10 second timeout
      });
    });
  }

  private createAndSendSummary(
    result: any,
    sendResponse: (response: ChatResponse) => void,
    sessionId: string
  ): void {
    console.log('🐛 DEBUG: Creating summary for', result.posts.length, 'posts');
    
    let summary = `📱 **${result.platform.charAt(0).toUpperCase() + result.platform.slice(1)} Posts Extracted (Full Content)**\n\n`;
    summary += `🔍 **Page**: ${result.pageTitle}\n`;
    summary += `📊 **Found**: ${result.totalFound} total posts, extracted top ${result.posts.length}\n\n`;
    summary += `📋 **Top Posts**:\n\n`;

    result.posts.forEach((post: any, index: number) => {
      summary += `**${index + 1}. ${post.title}**\n`;
      
      // Show more content for full extraction
      const content = post.content.slice(0, 500);
      summary += `${content}${post.content.length > 500 ? '...' : ''}\n`;
      
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

    summary += `💡 **Usage**: These posts were extracted with full content from individual Xiaohongshu pages.`;

    console.log('🐛 DEBUG: Sending summary response');
    sendResponse({
      type: 'MESSAGE',
      payload: {
        text: summary,
        sessionId
      }
    });
  }
} 