console.log('BACKGROUND SCRIPT STARTING');

import { saveToStorage } from './utils';
import { MessageRouter } from './services/message-router';
import { OpenAIService } from './services/openai-service';
import { mcpClient } from './mcp-client';

// Create service instances
const messageRouter = new MessageRouter();
const openaiService = new OpenAIService();

// Initialize the extension when installed
chrome.runtime.onInstalled.addListener(() => {
  const defaultSettings = {
    showNotifications: true,
    openaiApiKey: ''
  };
  
  saveToStorage('settings', defaultSettings);
  openaiService.initialize();
});

// Listen for settings changes
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local' && changes.settings) {
    openaiService.initialize();
  }
});

// Main message listener - route all messages through the message router
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('BACKGROUND: Received message:', request.type, 'from tab:', sender.tab?.id);

  // Handle MCP navigation separately (legacy support)
  if (request.type === 'NAVIGATE' && request.payload?.url) {
    const url = request.payload.url;
    console.log(`BACKGROUND: MCP Navigation to: ${url}`);
    
    chrome.runtime.sendMessage({ 
      command: 'UPDATE_POPUP_UI', 
      data: { answer: `Navigating to ${url}...` } 
    });
    
    mcpClient.browseWebpage(url)
      .then((data) => {
        console.log('BACKGROUND: MCP browse success');
        sendResponse({ type: 'NAVIGATE_SUCCESS', payload: data });
      })
      .catch((error) => {
        console.error('BACKGROUND: MCP browse error:', error);
        sendResponse({ 
          type: 'NAVIGATE_ERROR', 
          payload: { message: error.message || String(error) } 
        });
      });
    return false;
  }

  // Route all other messages through the message router
  const result = messageRouter.route(request, sender, sendResponse);
  return result instanceof Promise ? true : result;
});

console.log('BACKGROUND SCRIPT INITIALIZED');