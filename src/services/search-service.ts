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
    
    console.log(`🔍 [SearchService] Starting ${engine} search for: "${query}"`);
    console.log(`🔍 [SearchService] Original chat tab ID: ${tabId}`);
    console.log(`🔍 [SearchService] Session ID: ${sessionId}`);
    
    // Store the original chat tab ID
    const originalChatTabId = tabId;
    
    // Send immediate feedback - this is the ONLY time we can use sendResponse
    const initialResponse = {
      type: 'MESSAGE' as const,
      payload: {
        text: `Searching ${engine} for "${query}"...`,
        sessionId
      }
    };
    
    console.log(`📤 [SearchService] Sending initial response:`, initialResponse);
    sendResponse(initialResponse);

    // Create a follow-up message sender that doesn't rely on the callback
    const sendFollowUpMessage = (message: string) => {
      const followUpResponse = {
        type: 'MESSAGE' as const,
        payload: {
          text: message,
          sessionId
        }
      };
      
      console.log(`📤 [SearchService] Broadcasting follow-up message:`, followUpResponse);
      
      // Send to original chat tab if available
      if (originalChatTabId) {
        chrome.tabs.sendMessage(originalChatTabId, followUpResponse).catch(() => {
          console.log('💡 Could not send to original chat tab (this is normal if using popup)');
        });
      }
      
      // Send to all tabs with ChatBrowse content script
      chrome.tabs.query({}, (tabs) => {
        tabs.forEach(tab => {
          if (tab.id && tab.id !== originalChatTabId) {
            chrome.tabs.sendMessage(tab.id, followUpResponse).catch(() => {
              // Silently fail - not all tabs have content script
            });
          }
        });
      });
      
      // Send to popup if open
      chrome.runtime.sendMessage(followUpResponse).catch(() => {
        console.log('💡 Could not send to popup (this is normal if popup is closed)');
      });
    };

    try {
      const url = this.searchUrls[engine](query);
      console.log(`🌐 [SearchService] Search URL: ${url}`);
      
      const result = await this.performSearch(url, tabId);
      console.log(`📊 [SearchService] Search result:`, result);
      
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
          
          sendFollowUpMessage(successMessage);
        } else if (engine === 'google') {
          if (result.newTab && result.background) {
            successMessage = `✅ Opened Google search for "${query}" in a background tab.`;
            successMessage += `\n\n📤 Now extracting and summarizing search results...`;
          } else if (result.newTab) {
            successMessage = `✅ Opened Google search for "${query}" in a new tab.`;
            successMessage += `\n\n📤 Now extracting and summarizing search results...`;
          } else {
            successMessage += `\n\n📤 Now extracting and summarizing search results...`;
          }
          
          // Send navigation success message
          sendFollowUpMessage(successMessage);
          
          // Start the extraction and summarization process for Google
          // IMPORTANT: Use the new tab ID for extraction, but keep original tab ID for responses
          const extractionTabId = result.tabId || tabId;
          console.log(`🔍 [SearchService] Starting extraction - Extraction tab: ${extractionTabId}, Original tab: ${originalChatTabId}`);
          
          await this.handleGoogleSearchExtraction(query, extractionTabId, sendFollowUpMessage, sessionId, originalChatTabId);
          return;
        } else {
          successMessage += `\n\n📱 Browse the results manually or ask me to help extract information.`;
          sendFollowUpMessage(successMessage);
        }
      } else {
        sendFollowUpMessage(`❌ Failed to search ${engine}: ${result.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error(`❌ [SearchService] Search error for ${engine}:`, error);
      sendFollowUpMessage(`❌ Search failed: ${(error as Error).message}`);
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
      
      // For both Xiaohongshu and Google, open in new tab to preserve chat session
      if (url.includes('xiaohongshu.com') || url.includes('google.com')) {
        const isGoogle = url.includes('google.com');
        chrome.tabs.create({ 
          url, 
          active: !isGoogle  // Google: background tab, Xiaohongshu: background tab
        }, (newTab) => {
          if (chrome.runtime.lastError) {
            resolve({ success: false, error: chrome.runtime.lastError.message });
          } else {
            resolve({ 
              success: true, 
              url, 
              newTab: true, 
              background: !isGoogle,  // Google opens in background for extraction
              tabId: newTab.id
            });
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

  private async handleGoogleSearchExtraction(
    query: string,
    tabId: number | undefined,
    sendMessage: (response: string) => void,
    sessionId: string,
    originalChatTabId?: number
  ): Promise<void> {
    try {
      console.log('🔍 Starting Google search result extraction for:', query);
      console.log('🔍 Extraction tab ID:', tabId);
      console.log('🔍 Original chat tab ID:', originalChatTabId);
      
      if (!tabId) {
        console.error('❌ No tab ID provided for Google extraction');
        sendMessage(`⚠️ Cannot extract Google results: No tab ID available`);
        return;
      }
      
      // Wait a bit for the page to load
      console.log('⏳ Waiting for Google page to load...');
      await new Promise(resolve => setTimeout(resolve, 5000)); // Increased wait time to 5 seconds
      
      sendMessage(`📤 Extracting search results from Google...`);
      
      console.log('🚀 Starting Google results extraction with tab ID:', tabId);
      
      // Extract Google search results using content script injection
      const extractionResult = await this.extractGoogleResults(tabId);
      
      console.log('📊 Extraction result received:', extractionResult);
      
      // Fix: Handle Chrome scripting API result structure correctly
      let actualResult;
      let isSuccess = false;
      
      if (extractionResult && extractionResult.result) {
        // Chrome scripting API returns: { documentId, frameId, result: actualData }
        actualResult = extractionResult.result;
        isSuccess = actualResult && actualResult.posts && actualResult.posts.length > 0;
        console.log('✅ Using Chrome scripting API result structure');
      } else if (extractionResult && extractionResult.posts) {
        // Direct result structure
        actualResult = extractionResult;
        isSuccess = actualResult.posts && actualResult.posts.length > 0;
        console.log('✅ Using direct result structure');
      } else {
        console.log('❌ Unexpected result structure:', extractionResult);
        actualResult = null;
        isSuccess = false;
      }
      
      console.log('📊 Parsed result - Success:', isSuccess, 'Posts count:', actualResult?.posts?.length || 0);
      
      if (isSuccess) {
        console.log('✅ Google extraction successful, posts found:', actualResult.posts.length);
        console.log('📝 Sample post:', actualResult.posts[0]);
        
        // Format the results for display in chat
        const formattedResults = this.formatGoogleResults(actualResult, query);
        console.log('📋 Formatted results length:', formattedResults.length);
        
        // Send formatted results
        sendMessage(formattedResults);
        console.log('📤 Formatted results sent to chat interface');
        
        // Optional: Also provide AI summary
        setTimeout(async () => {
          try {
            console.log('🤖 Starting AI summary generation...');
            sendMessage(`🤖 Generating AI analysis of the search results...`);
            
            await this.generateGoogleResultsSummary(actualResult, query, sendMessage, sessionId, originalChatTabId);
          } catch (summaryError) {
            console.error('❌ Google summary error:', summaryError);
            sendMessage(`⚠️ Results extracted successfully, but AI summary failed: ${(summaryError as Error).message}`);
          }
        }, 1000);
        
      } else {
        console.error('❌ Google extraction failed or no results found');
        console.error('❌ Extraction result structure:', extractionResult);
        console.error('❌ Parsed actual result:', actualResult);
        sendMessage(`⚠️ Could not extract search results from Google. This may be due to anti-bot protections or page structure changes. You can browse the results manually.`);
      }
      
    } catch (error) {
      console.error('❌ Google search extraction error:', error);
      sendMessage(`❌ Failed to extract Google results: ${(error as Error).message}`);
    }
  }

  private async extractGoogleResults(tabId: number): Promise<any> {
    return new Promise((resolve) => {
      console.log('🎯 extractGoogleResults called with tabId:', tabId);
      
      // Inject the Google extractor into the page using modern scripting API
      chrome.scripting.executeScript({
        target: { tabId: tabId },
        func: () => {
          console.log('🔍 Google extractor function started in page context');
          console.log('🌐 Current URL:', window.location.href);
          console.log('📄 Page title:', document.title);
          
          // Google extractor logic injected into the page
          class GoogleExtractor {
            platform = 'google';
            
            canHandle() {
              const canHandle = window.location.hostname.includes('google.com') && 
                               window.location.pathname.includes('/search');
              console.log('🤔 Can handle this page:', canHandle);
              return canHandle;
            }
            
            extractPosts(maxPosts = 5) {
              console.log('🔍 Starting Google search results extraction');
              const posts: any[] = [];
              
              // Updated Google search result selectors for current layout
              const resultSelectors = [
                'div[data-sokoban-container] div[data-sokoban-grid] > div', // Current Google layout
                'div.g', // Classic organic results
                'div.tF2Cxc', // Another modern layout
                'div.MjjYud', // Yet another layout variant
                '[jscontroller="SC7lYd"]', // Specific Google controller
                'div[data-hveid] div.g', // Results with hover IDs
                'div.srg div.g', // Search results group
                '.g .rc', // Classic result container
                'div[data-async-context]', // Async loaded results
              ];
              
              let resultElements: Element[] = [];
              
              for (const selector of resultSelectors) {
                try {
                  console.log('🔎 Trying selector:', selector);
                  const elements = Array.from(document.querySelectorAll(selector));
                  console.log('📊 Found elements with selector:', elements.length);
                  
                  if (elements.length > 0) {
                    resultElements = elements.filter(el => {
                      const text = el.textContent || '';
                      const hasTitle = el.querySelector('h3, h2, h1, [role="heading"]');
                      const hasLink = el.querySelector('a[href]:not([href^="#"]):not([href^="javascript"])');
                      const isAd = text.includes('Ad') || text.includes('Sponsored') || 
                                  text.includes('广告') || el.getAttribute('data-text-ad') || 
                                  el.closest('[data-text-ad]');
                      const isValid = hasTitle && hasLink && !isAd && text.length > 30;
                      
                      if (isValid) {
                        console.log('✅ Valid result found:', el);
                      }
                      return isValid;
                    });
                    console.log('✅ Filtered to valid elements:', resultElements.length);
                    if (resultElements.length > 0) break;
                  }
                } catch (e) { 
                  console.log('❌ Selector failed:', selector, e); 
                }
              }
              
              // If no results found with specific selectors, try a more general approach
              if (resultElements.length === 0) {
                console.log('🔄 No results with specific selectors, trying general approach');
                
                // Look for any div that contains both a heading and a link
                const allDivs = Array.from(document.querySelectorAll('div'));
                console.log('📊 Total divs on page:', allDivs.length);
                
                resultElements = allDivs.filter(div => {
                  const hasHeading = div.querySelector('h3, h2, h1, [role="heading"]');
                  const hasLink = div.querySelector('a[href]');
                  const text = div.textContent || '';
                  const isAd = text.includes('Ad') || text.includes('Sponsored') || text.includes('广告');
                  
                  // Must have heading, link, reasonable text length, and not be an ad
                  const isValid = hasHeading && hasLink && text.length > 50 && text.length < 2000 && !isAd;
                  
                  if (isValid) {
                    console.log('✅ General approach found result:', hasHeading.textContent?.substring(0, 50));
                  }
                  
                  return isValid;
                });
                
                console.log('✅ General approach found:', resultElements.length, 'results');
              }
              
              console.log('📋 Final resultElements count:', resultElements.length);
              
              // Extract results
              resultElements.slice(0, maxPosts).forEach((result, index) => {
                try {
                  console.log('🔍 Processing result', index + 1);
                  
                  // Updated title extraction for modern Google layout
                  const titleSelectors = [
                    'h3', // Most common
                    'h2', 
                    'h1',
                    '[role="heading"]',
                    'a h3',
                    'div[role="heading"]',
                    'span[role="heading"]',
                    '.LC20lb', // Google specific title class
                    '.DKV0Md', // Another Google title class
                  ];
                  
                  let title = '';
                  for (const sel of titleSelectors) {
                    const titleEl = result.querySelector(sel);
                    if (titleEl?.textContent?.trim()) {
                      title = titleEl.textContent.trim();
                      break;
                    }
                  }
                  
                  // Updated link extraction
                  const linkSelectors = [
                    'h3 a[href]',
                    'h2 a[href]', 
                    'h1 a[href]',
                    '[role="heading"] a[href]',
                    'a[href]:not([href^="#"]):not([href^="javascript"])',
                    '.yuRUbf a[href]', // Google specific link container
                  ];
                  
                  let link = '';
                  for (const sel of linkSelectors) {
                    const linkEl = result.querySelector(sel) as HTMLAnchorElement;
                    if (linkEl?.href && !linkEl.href.includes('google.com/search') && !linkEl.href.includes('google.com/url')) {
                      link = linkEl.href;
                      break;
                    }
                  }
                  
                  console.log('📝 Title:', title.substring(0, 50) + '...');
                  console.log('🔗 Link:', link);
                  
                  if (title && link) {
                    // Updated snippet extraction for modern Google
                    let content = '';
                    const snippetSelectors = [
                      '.VwiC3b', // Classic snippet
                      '.s3v9rd', // Alternative snippet
                      '.st', // Older layout
                      '.IsZvec', // Modern Google snippet
                      '.aCOpRe', // Featured snippet content
                      '.hgKElc', // Another snippet class
                      'span:not([class]):not([id])', // Generic spans
                      'div:not([class]):not([id]) span', // Nested spans
                    ];
                    
                    for (const sel of snippetSelectors) {
                      const snippetEl = result.querySelector(sel);
                      if (snippetEl?.textContent?.trim()) {
                        const text = snippetEl.textContent.trim();
                        if (text.length > 20 && text.length < 1000 && text !== title) {
                          content = text;
                          break;
                        }
                      }
                    }
                    
                    // If no snippet found, try to extract from general text
                    if (!content) {
                      const fullText = result.textContent || '';
                      let cleanedText = fullText.replace(title, '').trim();
                      
                      // Remove common Google UI elements
                      cleanedText = cleanedText.replace(/^https?:\/\/[^\s]+/g, '');
                      cleanedText = cleanedText.replace(/\d{4}年\d{1,2}月\d{1,2}日/g, '');
                      cleanedText = cleanedText.replace(/\d{1,2}\/\d{1,2}\/\d{4}/g, '');
                      cleanedText = cleanedText.replace(/Cached/g, '');
                      cleanedText = cleanedText.replace(/Similar/g, '');
                      
                      if (cleanedText.length > 30) {
                        content = cleanedText.substring(0, 300);
                      }
                    }
                    
                    console.log('📄 Content snippet:', content.substring(0, 100) + '...');
                    
                    posts.push({
                      index: index + 1,
                      title: title,
                      content: content,
                      link: link,
                      metadata: {
                        source: new URL(link).hostname.replace('www.', '')
                      }
                    });
                    console.log('✅ Added post', index + 1, 'to results');
                  } else {
                    console.log('❌ Skipped result', index + 1, '- missing title or link');
                  }
                } catch (e) {
                  console.log('❌ Error extracting result:', e);
                }
              });
              
              const result = {
                posts,
                totalFound: resultElements.length,
                pageUrl: window.location.href,
                pageTitle: document.title,
                platform: 'google'
              };
              
              console.log('🎉 Extraction complete, returning:', result);
              return result;
            }
          }
          
          const extractor = new GoogleExtractor();
          if (extractor.canHandle()) {
            return extractor.extractPosts(5);
          } else {
            console.log('❌ Cannot handle this page');
            return { success: false, error: 'Not a Google search page' };
          }
        }
      }, (results) => {
        console.log('📤 chrome.scripting.executeScript callback called');
        console.log('📊 Results:', results);
        console.log('❌ Chrome runtime error:', chrome.runtime.lastError);
        
        if (chrome.runtime.lastError) {
          console.error('❌ Chrome scripting error:', chrome.runtime.lastError.message);
          resolve({ success: false, error: chrome.runtime.lastError.message });
        } else if (results && results[0]) {
          console.log('✅ Extraction successful, result:', results[0]);
          
          // Handle Chrome scripting API result structure
          const scriptResult = results[0] as any;
          
          // Check if we have a valid result structure
          if (scriptResult && scriptResult.result) {
            const extractedData = scriptResult.result;
            console.log('🔍 Checking extracted data structure:', extractedData);
            
            if (extractedData && extractedData.posts && extractedData.posts.length > 0) {
              console.log('✅ Posts found in extraction result:', extractedData.posts.length);
              // Return the Chrome scripting API structure (will be parsed later)
              resolve(scriptResult);
            } else {
              console.error('❌ No posts found in extraction result');
              console.error('❌ Extracted data:', extractedData);
              resolve({ success: false, error: 'No posts found in extraction result' });
            }
          } else {
            console.error('❌ Invalid Chrome scripting result structure');
            console.error('❌ Script result:', scriptResult);
            resolve({ success: false, error: 'Invalid result structure from script' });
          }
        } else {
          console.error('❌ No results returned or invalid format');
          console.error('❌ Full results object:', results);
          resolve({ success: false, error: 'No results returned' });
        }
      });
    });
  }

  private formatGoogleResults(extractionResult: any, query: string): string {
    const { posts, totalFound } = extractionResult;
    
    let formatted = `📊 **Google Search Results for "${query}"**\n\n`;
    formatted += `Found ${totalFound} results, showing top ${posts.length}:\n\n`;
    
    posts.forEach((post: any, index: number) => {
      formatted += `**${index + 1}. ${post.title}**\n`;
      if (post.content) {
        formatted += `${post.content}\n`;
      }
      formatted += `🔗 ${post.metadata?.source || 'Unknown source'}: ${post.link}\n\n`;
    });
    
    return formatted;
  }

  private async generateGoogleResultsSummary(
    extractionResult: any,
    query: string,
    sendMessage: (response: string) => void,
    sessionId: string,
    originalChatTabId?: number
  ): Promise<void> {
    try {
      console.log('🤖 generateGoogleResultsSummary: Starting AI summary generation');
      
      // Import LLM service dynamically
      const { LLMService } = await import('./llm-service');
      const llmService = LLMService.getInstance();
      
      // Create a prompt for summarizing Google results
      const promptContent = this.createGoogleSummaryPrompt(extractionResult, query);
      console.log('📝 generateGoogleResultsSummary: Created prompt, length:', promptContent.length);
      
      // Get AI summary
      console.log('📤 generateGoogleResultsSummary: Calling llmService.handleChat...');
      await llmService.handleChat({
        text: promptContent,
        sessionId,
        tabId: undefined
      }, { tab: undefined }, (aiResponse) => {
        console.log('🎯 generateGoogleResultsSummary: AI response callback triggered');
        console.log('📊 generateGoogleResultsSummary: AI response:', aiResponse);
        
        if (aiResponse && aiResponse.type === 'MESSAGE' && aiResponse.payload?.text) {
          console.log('✅ generateGoogleResultsSummary: Valid AI response received, sending summary');
          const summaryText = `🤖 **AI Analysis of Google Search Results:**\n\n${aiResponse.payload.text}`;
          sendMessage(summaryText);
          console.log('📤 generateGoogleResultsSummary: Summary sent');
        } else {
          console.log('❌ generateGoogleResultsSummary: Invalid AI response, sending fallback');
          sendMessage(`⚠️ AI analysis unavailable for these Google search results.`);
        }
      });
      console.log('✅ generateGoogleResultsSummary: llmService.handleChat call completed');
    } catch (error) {
      console.error('❌ generateGoogleResultsSummary: Error occurred:', error);
      console.error('Google summary generation error:', error);
      throw error;
    }
  }

  private createGoogleSummaryPrompt(extractionResult: any, query: string): string {
    const { posts } = extractionResult;
    
    let prompt = `Please analyze and summarize these Google search results for the query "${query}":\n\n`;
    
    posts.forEach((post: any, index: number) => {
      prompt += `Result ${index + 1}:\n`;
      prompt += `Title: ${post.title}\n`;
      prompt += `Source: ${post.metadata?.source || 'Unknown'}\n`;
      if (post.content) {
        prompt += `Snippet: ${post.content}\n`;
      }
      prompt += `URL: ${post.link}\n\n`;
    });
    
    prompt += `Please provide a comprehensive summary that includes:
1. Overview of what these results show about "${query}"
2. Key themes and main points from the results
3. Most relevant and useful sources
4. Any patterns or insights you notice
5. Recommendation on which results might be most helpful

Make the summary clear and actionable for someone researching "${query}".`;
    
    return prompt;
  }
} 