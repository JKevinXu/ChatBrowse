console.log('BACKGROUND SCRIPT STARTING');
console.log('chrome.runtime object:', JSON.stringify(Object.keys(chrome.runtime || {})));

import { ChatCommand, ChatResponse, PageInfo, StorageData } from './types';
import { saveToStorage, loadFromStorage } from './utils';
import OpenAI from 'openai';
import { mcpClient } from './mcp-client';

let openai: OpenAI | null = null;

// Track page context for LLM
let currentPageContext: { 
  tabId: number; 
  pageInfo: { title: string; url: string; content: string; useAsContext: boolean } 
} | null = null;

// Track which tabs have content scripts ready
const contentScriptReadyTabs = new Set<number>();

// Initialize OpenAI with API key
async function initializeOpenAI(): Promise<boolean> {
  try {
    const settings = await loadFromStorage<StorageData['settings']>('settings');
    if (settings && settings.openaiApiKey) {
      openai = new OpenAI({
        apiKey: settings.openaiApiKey,
        dangerouslyAllowBrowser: true
      });
      return true;
    }
    return false;
  } catch (error) {
    return false;
  }
}

// Initialize the extension when installed
chrome.runtime.onInstalled.addListener((details) => {
  const defaultSettings = {
    showNotifications: true,
    openaiApiKey: ''
  };
  
  saveToStorage('settings', defaultSettings);
  initializeOpenAI();
});

// Listen for settings changes
chrome.storage.onChanged.addListener((changes: { [key: string]: chrome.StorageChange }, namespace: string) => {
  if (namespace === 'local' && changes.settings) {
    initializeOpenAI();
  }
});

// Create a variable to track if we're receiving messages
let receivedMessages = 0;

// Track which tabs have content scripts ready and automatically set context
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('BACKGROUND: Received message:', request, 'from sender:', sender);

  if (request.type === 'CONTENT_SCRIPT_READY' && sender.tab?.id) {
    const tabId = sender.tab.id;
    contentScriptReadyTabs.add(tabId);
    
    // Automatically request page info and set as context
    getPageInfo(tabId).then(pageInfo => {
      if (pageInfo && pageInfo.title && pageInfo.url && pageInfo.content) {
        currentPageContext = {
          tabId,
          pageInfo: {
            title: pageInfo.title,
            url: pageInfo.url,
            content: pageInfo.content,
            useAsContext: true
          }
        };
      }
    });
    
    sendResponse({ received: true, status: 'acknowledged' });
    return true;
  }
  
  // Process different command types
  switch (request.type) {
    case 'SEND_MESSAGE':
      handleUserMessage(request.payload, sender, sendResponse);
      return true;
      
    case 'NAVIGATE':
      const url = request.payload?.url;
      if (url) {
        console.log(`BACKGROUND: NAVIGATE command received for URL: ${url}`);
        // Update UI immediately
        chrome.runtime.sendMessage({ command: 'UPDATE_POPUP_UI', data: { anwser: `Navigating to ${url}...` } });
        
        // Call MCP client to browse the webpage
        console.log(`BACKGROUND: Calling mcpClient.browseWebpage with URL: ${url}`);
        mcpClient.browseWebpage(url)
          .then((data: any) => {
            console.log('BACKGROUND: MCP browse success:', JSON.stringify(data));
            if (sendResponse) sendResponse({ type: 'NAVIGATE_SUCCESS', payload: data });
          })
          .catch((error: any) => {
            console.error('BACKGROUND: MCP browse error:', error);
            if (sendResponse) sendResponse({ type: 'NAVIGATE_ERROR', payload: { message: error.message || String(error) } });
          });
      } else {
        console.error('BACKGROUND: NAVIGATE message received without URL in payload.');
        if (sendResponse) sendResponse({ type: 'NAVIGATE_ERROR', payload: { message: 'Navigate command missing URL.' }});
      }
      return false;
      
    case 'EXTRACT_INFO':
      handleExtraction(sender, sendResponse);
      return true;
      
    case 'CLEAR_CHAT':
      handleClearChat(sender.tab?.id, sendResponse);
      return false;
      
    case 'SET_CONTEXT':
      handleSetContext(request.payload, sender, sendResponse);
      return false;
      
    default:
      sendResponse({
        type: 'ERROR',
        payload: { message: 'Unknown command type' }
      });
      return false;
  }
});

// Handle setting page content as context
function handleSetContext(
  pageInfo: { title: string; url: string; content: string; useAsContext: boolean },
  sender: chrome.MessageSender,
  sendResponse: (response: ChatResponse) => void
) {
  const tabId = sender.tab?.id;
  
  if (!tabId) {
    sendResponse({
      type: 'ERROR',
      payload: { message: 'Could not determine tab ID' }
    });
    return;
  }
  
  if (pageInfo.useAsContext) {
    // Store the page context
    currentPageContext = {
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
    if (currentPageContext && currentPageContext.tabId === tabId) {
      currentPageContext = null;
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

// Process user messages and generate responses
async function handleUserMessage(
  { text, sessionId, tabId: payloadTabId, tabUrl, tabTitle }: 
  { text: string; sessionId: string; tabId?: number; tabUrl?: string; tabTitle?: string },
  sender: chrome.MessageSender,
  sendResponse: (response: ChatResponse) => void
) {
  const lowerText = text.toLowerCase().trim();
  
  // Regex for Google search commands
  const googleSearchRegex = /^(?:google\s+(?:search\s+for\s+|search\s+|find\s+)?|search\s+(?:google\s+for\s+|google\s+|for\s+)?)(.+)$/i;
  const googleSearchMatch = lowerText.match(googleSearchRegex);

  if (lowerText.startsWith('go to ') || lowerText.startsWith('navigate to ')) {
    let url = lowerText.replace(/^(go to|navigate to)\s+/i, '').trim();
    // Basic URL validation and normalization
    if (!url.match(/^\w+:\/\//)) {
      url = 'http://' + url; // Default to http if no scheme
    }
    console.log(`BACKGROUND (handleUserMessage): Detected navigation command to URL: ${url}`);

    // Send immediate feedback to UI
    sendResponse({
      type: 'MESSAGE',
      payload: {
        text: `Navigating to ${url}...`,
        sessionId
      }
    });

    // Call MCP client to browse the webpage
    console.log(`BACKGROUND (handleUserMessage): Calling mcpClient.browseWebpage with URL: ${url}`);
    mcpClient.browseWebpage(url)
      .then(response => {
        console.log('BACKGROUND (handleUserMessage): mcpClient.browseWebpage response:', response);

        if (response && response.success) {
          // response.title, response.url, response.content are directly available
          // content might be an object like {title, text, url} or just text, 
          // mcp-client already tries to normalize title and url to top level of BrowseResponse
          const title = response.title || 'Untitled Page';
          const responseUrl = response.url || url;
          let textContent = '';

          if (typeof response.content === 'string') {
            textContent = response.content;
          } else if (response.content && typeof response.content.text === 'string') {
            textContent = response.content.text;
          } else {
            textContent = 'No content preview available.';
          }

          const maxLength = 200; // Max length for content snippet
          const snippet = textContent.length > maxLength ? textContent.substring(0, maxLength) + "..." : textContent;

          chrome.runtime.sendMessage({
            type: 'MCP_BROWSE_RESULT',
            payload: {
              title: title,
              url: responseUrl,
              snippet: snippet
            }
          });
        } else if (response && !response.success) {
          // Handle cases where browse was called but failed internally in MCP (error reported by mcp-client)
          chrome.runtime.sendMessage({
            type: 'MCP_BROWSE_RESULT',
            payload: {
              title: 'Navigation Failed',
              url: url,
              snippet: response.error || 'An unknown error occurred during navigation.'
            }
          });
        }
        // If response is undefined or null, the catch block below will handle it as a general error.
      })
      .catch(error => {
        console.error('BACKGROUND (handleUserMessage): mcpClient.browseWebpage error:', error);
        chrome.runtime.sendMessage({
          type: 'MCP_BROWSE_RESULT',
          payload: {
            title: 'Navigation Error',
            url: url,
            snippet: error.message || 'Failed to initiate navigation.'
          }
        });
      });
    return; // Still return, as sendResponse was called for initial feedback.
  }
  
  // Handle Google Search command
  if (googleSearchMatch && googleSearchMatch[1]) {
    const searchQuery = googleSearchMatch[1].trim();
    console.log(`BACKGROUND (handleUserMessage): Detected Google search command for query: "${searchQuery}"`);

    // Send immediate feedback to UI
    sendResponse({
      type: 'MESSAGE',
      payload: {
        text: `Searching Google for "${searchQuery}"...`,
        sessionId
      }
    });

    // Call MCP client to perform Google search
    console.log(`BACKGROUND (handleUserMessage): Calling mcpClient.googleSearch with query: "${searchQuery}"`);
    mcpClient.googleSearch(searchQuery)
      .then(response => {
        console.log('BACKGROUND (handleUserMessage): mcpClient.googleSearch response:', response);
        if (response && response.success) {
          const title = response.title || 'Google Search Results';
          const responseUrl = response.url || 'https://www.google.com/';
          let textContent = '';

          if (typeof response.content === 'string') {
            textContent = response.content;
          } else if (response.content && typeof response.content.text === 'string') {
            textContent = response.content.text;
          } else {
            textContent = 'No content preview available for search results.';
          }

          const maxLength = 200;
          const snippet = textContent.length > maxLength ? textContent.substring(0, maxLength) + "..." : textContent;

          chrome.runtime.sendMessage({
            type: 'MCP_BROWSE_RESULT', // Reusing the same message type for simplicity
            payload: {
              title: title,
              url: responseUrl,
              snippet: snippet
            }
          });
        } else if (response && !response.success) {
          chrome.runtime.sendMessage({
            type: 'MCP_BROWSE_RESULT',
            payload: {
              title: 'Google Search Failed',
              url: 'https://www.google.com/',
              snippet: response.error || 'An unknown error occurred during Google search.'
            }
          });
        }
      })
      .catch(error => {
        console.error('BACKGROUND (handleUserMessage): mcpClient.googleSearch error:', error);
        chrome.runtime.sendMessage({
          type: 'MCP_BROWSE_RESULT',
          payload: {
            title: 'Google Search Error',
            url: 'https://www.google.com/',
            snippet: error.message || 'Failed to initiate Google search.'
          }
        });
      });
    return; // Return after handling the search command
  }
  
  // Handle help command directly
  if (lowerText === 'help') {
    sendResponse({
      type: 'MESSAGE',
      payload: {
        text: 'I can help you navigate this website. Try commands like "go to contact page", "find pricing", "extract info about this page", or "set context" to use the page content as context for our conversation.',
        sessionId
      }
    });
    return;
  }
  
  // Check if this is a summarize request early so we can handle it specially
  const isSummarizeRequest = lowerText.includes('summarize') && 
    (lowerText.includes('page') || lowerText.includes('website') || lowerText.includes('content'));
  
  // For all other messages, try to use OpenAI
  try {
    // Check if OpenAI is initialized
    if (!openai) {
      const initialized = await initializeOpenAI();
      if (!initialized) {
        sendResponse({
          type: 'MESSAGE',
          payload: {
            text: 'Please set your OpenAI API key in the extension settings to enable AI responses.',
            sessionId
          }
        });
        return;
      }
    }
    
    // Get tab ID from sender or payload
    const tabId = sender.tab?.id || payloadTabId;
    console.log('BACKGROUND: Processing message for tab ID:', tabId);
    
    // Get page information from tab ID
    let pageInfo = tabId ? await getPageInfo(tabId) : null;
    
    // Create fallback page info if needed
    const fallbackUrl = sender.tab?.url || tabUrl || "the current page";
    
    // We need to get the tab title through chrome.tabs API since sender.tab doesn't have title
    let fallbackTitle = tabTitle || "Current Website";
    if (tabId) {
      try {
        // Using a promise wrapper around chrome.tabs.get to get tab info
        const getTabInfo = (): Promise<{title?: string, url?: string}> => {
          return new Promise((resolve) => {
            chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
              if (tabs && tabs.length > 0) {
                resolve({title: tabs[0].title, url: tabs[0].url});
              } else {
                resolve({title: fallbackTitle, url: fallbackUrl});
              }
            });
          });
        };
        
        // Only get tab info if we don't already have a title from the payload
        if (!tabTitle) {
          const tabInfo = await getTabInfo();
          fallbackTitle = tabInfo.title || fallbackTitle;
        }
      } catch (error) {
        console.error("BACKGROUND: Error getting tab title:", error);
      }
    }
    
    // If we still don't have page info, create a minimal fallback
    if (!pageInfo) {
      console.log("BACKGROUND: Creating final fallback page info");
      pageInfo = {
        title: fallbackTitle,
        url: fallbackUrl,
        content: isSummarizeRequest ? "No content could be extracted from this page." : ""
      };
    }
    
    // Always ensure we have valid values for title and URL
    const pageTitle = pageInfo.title || fallbackTitle;
    const pageUrl = pageInfo.url || fallbackUrl;
    const contentLength = pageInfo.content ? pageInfo.content.length : 0;
    
    // Log details about the pageInfo
    console.log("BACKGROUND: ===== PAGE INFO =====");
    console.log("BACKGROUND: Title:", pageTitle);
    console.log("BACKGROUND: URL:", pageUrl);
    console.log("BACKGROUND: Content length:", contentLength);
    console.log("BACKGROUND: Is summary request:", isSummarizeRequest);
    
    // Prepare message for OpenAI
    let systemPrompt = `You are ChatBrowse, an AI assistant that helps users browse the web. You are currently on a webpage with title: "${pageTitle}" and URL: "${pageUrl}". Keep responses concise and helpful for web browsing.`;
    
    // Include page content if context is enabled OR this is a summarize request
    const useContext = tabId && 
      ((currentPageContext && currentPageContext.tabId === tabId && currentPageContext.pageInfo.useAsContext) || 
       isSummarizeRequest);
    
    // Log content availability information
    console.log('BACKGROUND: ===== CONTENT AVAILABILITY =====');
    console.log('BACKGROUND: Page title:', pageTitle);
    console.log('BACKGROUND: Page URL:', pageUrl);
    console.log('BACKGROUND: Is summary request:', isSummarizeRequest);
    console.log('BACKGROUND: Context enabled:', useContext);
    console.log('BACKGROUND: Context source:', isSummarizeRequest ? 'Summary request' : 
        (currentPageContext && currentPageContext.tabId === tabId) ? 'Stored context' : 'N/A');
    console.log('BACKGROUND: Page content available:', pageInfo && !!pageInfo.content);
    if (pageInfo && pageInfo.content) {
      console.log('BACKGROUND: Content length:', pageInfo.content.length);
      console.log('BACKGROUND: Content preview:', pageInfo.content.substring(0, 150) + '...');
    }
    
    // Special handling for summarization requests
    if (isSummarizeRequest) {
      console.log('BACKGROUND: Handling summarization request specially');
      // Modify system prompt for summarization
      systemPrompt = `You are ChatBrowse, an AI assistant that helps users browse the web. The user is asking for a summary of a webpage with title: "${pageTitle}" and URL: "${pageUrl}". Always include the title and URL in your response.`;
      
      // Add content if available
      if (pageInfo && pageInfo.content && pageInfo.content.length > 0) {
        console.log('BACKGROUND: Including page content in summarization request');
        systemPrompt += `\n\nThe webpage content is: "${pageInfo.content}"\n\nPlease provide a concise summary of this webpage based on its content. Start your response with the title and URL of the page.`;
      } else {
        console.log('BACKGROUND: No content available for summarization');
        systemPrompt += `\n\nI don't have access to the content of this page. Please provide a response based on what you can tell from the title and URL. Start your response with the title and URL of the page, then explain that there is no content to summarize.`;
      }
    } else if (useContext && pageInfo && pageInfo.content) {
      // Standard context for non-summarization requests
      systemPrompt += `\n\nThe current page content is: "${pageInfo.content}"`;
    }
    
    const messages = [
      {
        role: 'system',
        content: systemPrompt
      },
      {
        role: 'user',
        content: text
      }
    ];
    
    // Send to OpenAI
    console.log("BACKGROUND: ===== SENDING TO OPENAI =====");
    console.log("BACKGROUND: System prompt:", systemPrompt);
    console.log("BACKGROUND: User message:", text);
    
    // Check openai again to satisfy TypeScript
    if (!openai) {
      sendResponse({
        type: 'MESSAGE',
        payload: {
          text: 'OpenAI client is not available. Please check your API key in settings.',
          sessionId
        }
      });
      return;
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: messages,
      max_tokens: 500
    });
    
    // Get response
    const aiResponse = completion.choices[0].message.content;
    console.log("BACKGROUND: ===== RECEIVED RESPONSE =====");
    console.log("BACKGROUND: Response:", aiResponse);
    
    // For summarization requests, ensure the response includes the page title and URL
    let finalResponse = aiResponse;
    if (isSummarizeRequest && !aiResponse.includes(pageUrl) && !aiResponse.includes("don't have")) {
      console.log("BACKGROUND: Adding title and URL to summarization response");
      finalResponse = `Summary of: ${pageTitle}\nURL: ${pageUrl}\n\n${aiResponse}`;
    }
    
    // Send response back to the user
    sendResponse({
      type: 'MESSAGE',
      payload: {
        text: finalResponse,
        sessionId
      }
    });
  } catch (error) {
    console.error('BACKGROUND: Error calling OpenAI:', error);
    sendResponse({
      type: 'MESSAGE',
      payload: {
        text: `I encountered an error while processing your request. ${(error as Error).message || 'Please try again or check your API key.'}`,
        sessionId
      }
    });
  }
}

// Helper function to get page information
async function getPageInfo(tabId?: number): Promise<PageInfo | null> {
  if (!tabId) {
    console.error('BACKGROUND: Unable to get page info: tabId is undefined');
    return null;
  }
  
  // Check if content script is ready in this tab
  if (!contentScriptReadyTabs.has(tabId)) {
    console.warn(`BACKGROUND: Content script not ready in tab ${tabId}`);
  }
  
  console.log(`BACKGROUND: ===== REQUESTING PAGE INFO: Tab ${tabId} =====`);
  
  return new Promise((resolve) => {
    console.log(`BACKGROUND: Sending EXTRACT_PAGE_INFO message to tab ${tabId}`);
    
    try {
      chrome.tabs.sendMessage(tabId, { type: 'EXTRACT_PAGE_INFO' }, (pageInfo: PageInfo) => {
        if (chrome.runtime.lastError) {
          console.error(`BACKGROUND: Error getting page info: ${chrome.runtime.lastError.message}`);
          
          // We can't auto-inject the content script due to manifest v3 limitations
          // Just return null and let the caller handle it
          resolve(null);
          return;
        }
        
        if (!pageInfo) {
          console.error('BACKGROUND: Page info response is null or undefined');
          resolve(null);
          return;
        }
        
        console.log('BACKGROUND: ===== RECEIVED PAGE INFO RESPONSE =====');
        console.log('BACKGROUND: Response object type:', typeof pageInfo);
        console.log('BACKGROUND: Response keys:', Object.keys(pageInfo).join(', '));
        console.log('BACKGROUND: Title present:', !!pageInfo.title);
        console.log('BACKGROUND: URL present:', !!pageInfo.url);
        console.log('BACKGROUND: Content present:', !!pageInfo.content);
        
        if (pageInfo.title) console.log('BACKGROUND: Title:', pageInfo.title);
        if (pageInfo.url) console.log('BACKGROUND: URL:', pageInfo.url);
        if (pageInfo.content) console.log('BACKGROUND: Content length:', pageInfo.content.length);
        
        // Add additional logging for debug purposes
        console.log('BACKGROUND: ===== PAGE INFO PROCESSED SUCCESSFULLY =====');
        console.log('BACKGROUND: Final page info - Title:', pageInfo.title);
        console.log('BACKGROUND: Final page info - URL:', pageInfo.url);
        console.log('BACKGROUND: Final page info - Content length:', pageInfo.content ? pageInfo.content.length : 0);
        
        // Mark this tab as having a working content script
        contentScriptReadyTabs.add(tabId);
        resolve(pageInfo);
      });
    } catch (error) {
      console.error('BACKGROUND: Exception in getPageInfo:', error);
      resolve(null);
    }
  });
}

// Handle navigation commands
function handleNavigation(
  { url }: { url: string },
  sender: chrome.MessageSender,
  sendResponse: (response: ChatResponse) => void
) {
  const tabId = sender.tab?.id;
  
  if (!tabId) {
    sendResponse({
      type: 'ERROR',
      payload: { message: 'Could not determine tab ID' }
    });
    return;
  }
  
  // Normalize URL (add https:// if not present)
  let targetUrl = url;
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    targetUrl = 'https://' + url;
  }
  
  // Navigate the tab
  chrome.tabs.update(tabId, { url: targetUrl }, () => {
    if (chrome.runtime.lastError) {
      sendResponse({
        type: 'ERROR',
        payload: { message: chrome.runtime.lastError.message || 'Navigation failed' }
      });
    } else {
      sendResponse({
        type: 'NAVIGATION',
        payload: { success: true, url: targetUrl }
      });
    }
  });
}

// Handle info extraction requests
function handleExtraction(
  sender: chrome.MessageSender,
  sendResponse: (response: ChatResponse) => void
) {
  const tabId = sender.tab?.id;
  
  if (!tabId) {
    sendResponse({
      type: 'ERROR',
      payload: { message: 'Could not determine tab ID' }
    });
    return;
  }
  
  // Send a message to the content script to extract page info
  chrome.tabs.sendMessage(tabId, { type: 'EXTRACT_PAGE_INFO' }, (pageInfo: PageInfo) => {
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
}

// Handle clearing chat history
function handleClearChat(
  tabId: number | undefined,
  sendResponse: (response: ChatResponse) => void
) {
  if (!tabId) {
    sendResponse({
      type: 'ERROR',
      payload: { message: 'Could not determine tab ID' }
    });
    return;
  }
  
  // Send message to content script to clear chat
  chrome.tabs.sendMessage(tabId, { type: 'CLEAR_CHAT' }, () => {
    sendResponse({
      type: 'MESSAGE',
      payload: { text: 'Chat cleared', success: true }
    });
  });
}