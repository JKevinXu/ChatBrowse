import { ChatCommand, ChatResponse, PageInfo } from './types';
import { saveToStorage, loadFromStorage } from './utils';

// Initialize the extension when installed
chrome.runtime.onInstalled.addListener(() => {
  console.log('ChatBrowse extension installed');
  
  // Initialize default settings
  const defaultSettings = {
    theme: 'light',
    fontSize: 'medium',
    showNotifications: true
  };
  
  saveToStorage('settings', defaultSettings).catch(err => {
    console.error('Failed to save default settings:', err);
  });
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
function handleUserMessage(
  { text, sessionId }: { text: string; sessionId: string },
  sender: chrome.MessageSender,
  sendResponse: (response: ChatResponse) => void
) {
  // Here we'd typically use an AI or NLP service to process the message
  // For now, just echo back a simple response
  
  // Simple command processing
  if (text.toLowerCase().includes('hello') || text.toLowerCase().includes('hi')) {
    sendResponse({
      type: 'MESSAGE',
      payload: {
        text: 'Hello! How can I help you navigate this website?',
        sessionId
      }
    });
    return;
  }
  
  if (text.toLowerCase().includes('help')) {
    sendResponse({
      type: 'MESSAGE',
      payload: {
        text: 'I can help you navigate this website. Try commands like "go to contact page", "find pricing", or "extract info about this page".',
        sessionId
      }
    });
    return;
  }
  
  if (text.toLowerCase().includes('search') || text.toLowerCase().includes('find')) {
    const query = text.replace(/search for|find|search/gi, '').trim();
    sendResponse({
      type: 'MESSAGE',
      payload: {
        text: `Searching for "${query}" on this page...`,
        sessionId
      }
    });
    return;
  }
  
  // Default response - avoiding setTimeout which can cause issues in service workers
  sendResponse({
    type: 'MESSAGE',
    payload: {
      text: `I received your message: "${text}". How else can I help?`,
      sessionId
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