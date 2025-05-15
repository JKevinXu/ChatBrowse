import { ChatCommand, ChatResponse, PageInfo, StorageData } from './types';
import { saveToStorage, loadFromStorage } from './utils';
import OpenAI from 'openai';

// Store OpenAI instance
let openai: OpenAI | null = null;

// Initialize OpenAI with API key
async function initializeOpenAI(): Promise<boolean> {
  try {
    const settings = await loadFromStorage<StorageData['settings']>('settings');
    if (settings && settings.openaiApiKey) {
      openai = new OpenAI({
        apiKey: settings.openaiApiKey,
        dangerouslyAllowBrowser: true // Required for Chrome extension
      });
      console.log('OpenAI initialized successfully');
      return true;
    } else {
      console.log('OpenAI API key not found in settings');
      return false;
    }
  } catch (error) {
    console.error('Failed to initialize OpenAI:', error);
    return false;
  }
}

// Initialize the extension when installed
chrome.runtime.onInstalled.addListener(() => {
  console.log('ChatBrowse extension installed');
  
  // Initialize default settings
  const defaultSettings = {
    theme: 'light',
    fontSize: 'medium',
    showNotifications: true,
    openaiApiKey: ''
  };
  
  saveToStorage('settings', defaultSettings).catch(err => {
    console.error('Failed to save default settings:', err);
  });

  // Initialize OpenAI
  initializeOpenAI();
});

// Listen for settings changes
chrome.storage.onChanged.addListener((changes: { [key: string]: chrome.StorageChange }, namespace: string) => {
  if (namespace === 'local' && changes.settings) {
    // Re-initialize OpenAI with new settings
    initializeOpenAI();
  }
});

// Handle messages from content script and popup
chrome.runtime.onMessage.addListener((message: ChatCommand, sender, sendResponse) => {
  console.log('Background received message:', message);
  
  // Process different command types
  switch (message.type) {
    case 'SEND_MESSAGE':
      handleUserMessage(message.payload, sender, sendResponse);
      return true; // Keep the message channel open for async response
      
    case 'NAVIGATE':
      handleNavigation(message.payload, sender, sendResponse);
      return false; // No async response needed
      
    case 'EXTRACT_INFO':
      handleExtraction(sender, sendResponse);
      return true; // Keep the message channel open for async response
      
    case 'CLEAR_CHAT':
      handleClearChat(sender.tab?.id, sendResponse);
      return false; // No async response needed
      
    default:
      sendResponse({
        type: 'ERROR',
        payload: { message: 'Unknown command type' }
      });
      return false;
  }
});

// Process user messages and generate responses
async function handleUserMessage(
  { text, sessionId }: { text: string; sessionId: string },
  sender: chrome.MessageSender,
  sendResponse: (response: ChatResponse) => void
) {
  // Process commands for navigation, extraction, etc.
  const lowerText = text.toLowerCase().trim();
  
  // Handle simple navigation commands directly
  if (lowerText.startsWith('go to ') || lowerText.startsWith('navigate to ')) {
    const url = lowerText.replace(/^(go to|navigate to)\s+/i, '').trim();
    sendResponse({
      type: 'MESSAGE',
      payload: {
        text: `Navigating to ${url}...`,
        sessionId
      }
    });
    return;
  }
  
  // Handle help command directly
  if (lowerText === 'help') {
    sendResponse({
      type: 'MESSAGE',
      payload: {
        text: 'I can help you navigate this website. Try commands like "go to contact page", "find pricing", or "extract info about this page".',
        sessionId
      }
    });
    return;
  }
  
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
    
    // Get page information to provide context to OpenAI
    const pageInfo = await getPageInfo(sender.tab?.id);
    
    // Prepare message for OpenAI
    const messages = [
      {
        role: 'system',
        content: `You are ChatBrowse, an AI assistant that helps users browse the web. You are currently on a webpage with title: "${pageInfo?.title || 'Unknown'}" and URL: "${pageInfo?.url || 'Unknown'}". Keep responses concise and helpful for web browsing.`
      },
      {
        role: 'user',
        content: text
      }
    ];
    
    // Send to OpenAI
    if (openai) {
      const completion = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: messages,
        max_tokens: 500
      });
      
      // Get response
      const aiResponse = completion.choices[0].message.content;
      
      // Send response back to the user
      sendResponse({
        type: 'MESSAGE',
        payload: {
          text: aiResponse,
          sessionId
        }
      });
    } else {
      sendResponse({
        type: 'MESSAGE',
        payload: {
          text: 'Unable to initialize OpenAI. Please check your API key in settings.',
          sessionId
        }
      });
    }
  } catch (error) {
    console.error('Error calling OpenAI:', error);
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
  if (!tabId) return null;
  
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, { type: 'EXTRACT_PAGE_INFO' }, (pageInfo: PageInfo) => {
      if (chrome.runtime.lastError) {
        resolve(null);
        return;
      }
      resolve(pageInfo);
    });
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