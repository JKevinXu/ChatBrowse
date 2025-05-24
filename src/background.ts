console.log('BACKGROUND SCRIPT STARTING');

import { MessageRouter } from './services/message-router';
import { OpenAIService } from './services/openai-service';
import { ConfigService } from './services/config-service';

// Create service instances
const messageRouter = new MessageRouter();
const openaiService = new OpenAIService();
const configService = ConfigService.getInstance();

// Initialize the extension when installed
chrome.runtime.onInstalled.addListener(async () => {
  // Initialize default settings
  await configService.loadSettings();
  await openaiService.initialize();
});

// Listen for settings changes
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local' && changes.settings) {
    openaiService.initialize();
  }
});

// Main message listener - route all messages through the message router
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.error('🚨🚨🚨 BACKGROUND RECEIVED MESSAGE - THIS SHOULD BE VISIBLE 🚨🚨🚨');
  console.error('Message type:', request.type);
  console.log('🐛 DEBUG: BACKGROUND RECEIVED ANY MESSAGE');
  console.log('🐛 DEBUG: Message type:', request.type);
  console.log('🐛 DEBUG: Full request:', request);
  console.log('🐛 DEBUG: Sender tab ID:', sender.tab?.id);
  console.log('🐛 DEBUG: Sender info:', sender);
  console.log('BACKGROUND: Received message:', request.type, 'from tab:', sender.tab?.id);

  // Route all messages through the message router
  const result = messageRouter.route(request, sender, sendResponse);
  return result instanceof Promise ? true : result;
});

console.log('BACKGROUND SCRIPT INITIALIZED');