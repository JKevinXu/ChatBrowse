import { ChatResponse } from '../types';
import { XIAOHONGSHU_CONFIG } from '../config';

export class ExtractionService {
  async extractXiaohongshuPosts(
    tabId: number | undefined,
    sendResponse: (response: ChatResponse) => void,
    sessionId: string,
    sendProgressMessages: boolean = true // Add parameter to control progress messages
  ): Promise<any> { // Return the extraction result instead of handling summarization
    try {
      console.log('🐛 DEBUG: extractXiaohongshuPosts STARTED, extracting full content by default');
      
      // Send immediate feedback only if requested
      if (sendProgressMessages) {
        sendResponse({
          type: 'MESSAGE',
          payload: {
            text: `🚦 Extracting top ${XIAOHONGSHU_CONFIG.defaultMaxPosts} posts with rate limiting (${XIAOHONGSHU_CONFIG.rateLimitDelay / 1000}-second delays) from Xiaohongshu page...`,
            sessionId
          }
        });
      }

      // Find the Xiaohongshu tab instead of using the sender tab
      console.log('🐛 DEBUG: Looking for Xiaohongshu tab...');
      const xiaohongshuTab = await this.findXiaohongshuTab();
      console.log('🐛 DEBUG: Xiaohongshu tab found:', xiaohongshuTab);
      
      if (!xiaohongshuTab) {
        console.log('🐛 DEBUG: No Xiaohongshu tab found');
        const errorResult = {
          success: false,
          error: 'No Xiaohongshu tab found. Please search for content on Xiaohongshu first.',
          posts: [],
          totalFound: 0,
          pageUrl: '',
          pageTitle: '',
          platform: 'xiaohongshu'
        };
        return errorResult;
      }

      console.log('🐛 DEBUG: About to send EXTRACT_POSTS message to tab:', xiaohongshuTab.id);
      
      // Return a promise that resolves with extraction results
      return new Promise((resolve) => {
        // Use content script to extract posts with the proper extractor classes
        chrome.tabs.sendMessage(
          xiaohongshuTab.id!, 
          { type: 'EXTRACT_POSTS_ASYNC', payload: { maxPosts: XIAOHONGSHU_CONFIG.defaultMaxPosts, fetchFullContent: true } }, // Use async method with rate limiting
          async (result) => {
            console.log('🐛 DEBUG: Extract posts response:', result);
            
            if (chrome.runtime.lastError) {
              console.error('🐛 DEBUG: Chrome runtime error:', chrome.runtime.lastError);
              resolve({
                success: false,
                error: chrome.runtime.lastError.message,
                posts: [],
                totalFound: 0,
                pageUrl: '',
                pageTitle: '',
                platform: 'xiaohongshu'
              });
              return;
            }
            
            if (result?.success && result.posts && result.posts.length > 0) {
              console.log('🐛 DEBUG: Posts found, processing for full content extraction');
              
              // Check if any posts need full content extraction
              const needsFullContent = result.posts.some((post: any) => 
                post.content.startsWith('[FETCH_FULL_CONTENT]')
              );
              
              if (needsFullContent) {
                console.log('🐛 DEBUG: Full content extraction needed, processing posts individually');
                const extractionResult = await this.extractFullContentForPosts(result.posts);
                resolve({
                  success: true,
                  posts: extractionResult,
                  totalFound: result.totalFound,
                  pageUrl: result.pageUrl,
                  pageTitle: result.pageTitle,
                  platform: result.platform
                });
              } else {
                console.log('🐛 DEBUG: Returning posts with preview content');
                resolve(result);
              }
            } else {
              console.log('🐛 DEBUG: No posts found or extraction failed');
              const errorMessage = result?.error || 'No posts found on this page or extraction failed';
              resolve({
                success: false,
                error: errorMessage,
                posts: [],
                totalFound: 0,
                pageUrl: result?.pageUrl || '',
                pageTitle: result?.pageTitle || '',
                platform: 'xiaohongshu'
              });
            }
          }
        );
      });

    } catch (error) {
      console.error('🐛 DEBUG: Xiaohongshu extraction error:', error);
      return {
        success: false,
        error: (error as Error).message,
        posts: [],
        totalFound: 0,
        pageUrl: '',
        pageTitle: '',
        platform: 'xiaohongshu'
      };
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
        await this.extractXiaohongshuPosts(tabId, sendResponse, sessionId, true); // Enable progress messages for direct extraction
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
    posts: any[]
  ): Promise<any[]> {
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
    
    return updatedPosts;
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
} 