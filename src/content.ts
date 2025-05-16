import { Message, ChatSession } from './types';
import { createChatSession, createMessage, extractPageInfo, processCommand } from './utils';

let currentSession: ChatSession | null = null;
let chatContainer: HTMLElement | null = null;
let lastExtractedPageInfo: ReturnType<typeof extractPageInfo> | null = null;

// Initialize when the content script is loaded
function initialize() {
  console.log('ChatBrowse content script initializing...');
  
  try {
    // Create the chat interface
    createChatInterface();
    
    // Initialize a new chat session for this page
    const pageInfo = extractPageInfo();
    lastExtractedPageInfo = pageInfo;
    const { title, url } = pageInfo;
    
    // Debug log the page info that will be used for the session
    console.log('DEBUG: Initial page info extraction results:');
    console.log('DEBUG: - Title:', title);
    console.log('DEBUG: - URL:', url);
    console.log('DEBUG: - Content length:', pageInfo.content.length);
    
    currentSession = createChatSession(url, title);
    
    // Set up message listeners
    setupMessageListeners();
    
    // Indicate the content script is ready by sending a message to the background script
    // Include full page info with content to ensure background script has it cached
    console.log('CONTENT: Sending CONTENT_SCRIPT_READY message to background');
    chrome.runtime.sendMessage({ 
      type: 'CONTENT_SCRIPT_READY', 
      payload: pageInfo 
    }, response => {
      console.log('CONTENT: Received response from background for CONTENT_SCRIPT_READY:', response);
    });
    
    console.log('ChatBrowse content script initialized successfully');
  } catch (error) {
    console.error('Error initializing ChatBrowse content script:', error);
  }
}

// Create and inject the chat interface
function createChatInterface() {
  // Create container
  chatContainer = document.createElement('div');
  chatContainer.className = 'chatbrowse-container';
  
  // Create toggle button
  const toggleButton = document.createElement('div');
  toggleButton.className = 'chatbrowse-toggle';
  toggleButton.innerHTML = '<span class="chatbrowse-icon">💬</span>';
  toggleButton.addEventListener('click', toggleChat);
  
  // Create chat panel
  const chatPanel = document.createElement('div');
  chatPanel.className = 'chatbrowse-chat';
  
  // Create header
  const header = document.createElement('div');
  header.className = 'chatbrowse-header';
  header.innerHTML = `
    <span>ChatBrowse</span>
    <span class="chatbrowse-close">&times;</span>
  `;
  header.querySelector('.chatbrowse-close')?.addEventListener('click', toggleChat);
  
  // Create messages container
  const messagesContainer = document.createElement('div');
  messagesContainer.className = 'chatbrowse-messages';
  messagesContainer.id = 'chatbrowse-messages';
  
  // Create input area
  const inputArea = document.createElement('div');
  inputArea.className = 'chatbrowse-input';
  inputArea.innerHTML = `
    <input type="text" placeholder="Type your question or command...">
    <button>Send</button>
  `;
  
  // Add event listeners for input
  const inputElement = inputArea.querySelector('input');
  const sendButton = inputArea.querySelector('button');
  
  if (inputElement && sendButton) {
    sendButton.addEventListener('click', () => handleUserInput(inputElement));
    
    inputElement.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        handleUserInput(inputElement);
      }
    });
  }
  
  // Assemble the chat panel
  chatPanel.appendChild(header);
  chatPanel.appendChild(messagesContainer);
  chatPanel.appendChild(inputArea);
  
  // Add elements to container
  chatContainer.appendChild(toggleButton);
  chatContainer.appendChild(chatPanel);
  
  // Add to the document
  document.body.appendChild(chatContainer);
}

// Toggle chat visibility
function toggleChat() {
  const chatPanel = document.querySelector('.chatbrowse-chat');
  if (chatPanel) {
    chatPanel.classList.toggle('active');
  }
}

// Handle user input
function handleUserInput(inputElement: HTMLInputElement) {
  const text = inputElement.value.trim();
  
  if (!text || !currentSession) return;
  
  // Clear the input
  inputElement.value = '';
  
  // Add user message to chat
  const userMessage = createMessage(text, 'user');
  addMessageToChat(userMessage);
  
  // Save to current session
  if (currentSession) {
    currentSession.messages.push(userMessage);
    currentSession.updatedAt = Date.now();
  }
  
  // Process command and send to background script
  const { command, args } = processCommand(text);
  
  if (command === 'navigate') {
    // Send navigation request to background script
    chrome.runtime.sendMessage(
      {
        type: 'NAVIGATE',
        payload: { url: args }
      },
      (response) => {
        if (response && response.type === 'ERROR') {
          const errorMessage = createMessage(
            `Error: ${response.payload.message || 'Navigation failed'}`,
            'system'
          );
          addMessageToChat(errorMessage);
        }
      }
    );
    
    // Add a waiting message
    const waitingMessage = createMessage('Navigating...', 'system');
    addMessageToChat(waitingMessage);
    return;
  }
  
  if (command === 'extract') {
    // Send extraction request to background script
    chrome.runtime.sendMessage(
      { type: 'EXTRACT_INFO' },
      (response) => {
        if (response && response.type === 'EXTRACTION_RESULT') {
          const { title, url, content } = response.payload;
          const infoMessage = createMessage(
            `Page Info:\nTitle: ${title}\nURL: ${url}\n${content ? 'Content preview: ' + content.substring(0, 150) + '...' : ''}`,
            'system'
          );
          addMessageToChat(infoMessage);
        } else if (response && response.type === 'ERROR') {
          const errorMessage = createMessage(
            `Error: ${response.payload.message || 'Failed to extract page info'}`,
            'system'
          );
          addMessageToChat(errorMessage);
        }
      }
    );
    
    // Add a waiting message
    const waitingMessage = createMessage('Extracting page information...', 'system');
    addMessageToChat(waitingMessage);
    return;
  }
  
  // New: Handle set context command
  if (command === 'setcontext') {
    // Extract page info
    const pageInfo = extractPageInfo();
    lastExtractedPageInfo = pageInfo;
    
    // Set the context flag
    const useAsContext = args.toLowerCase() === 'on' || args.toLowerCase() === 'true' || args === '';
    pageInfo.useAsContext = useAsContext;
    
    // Send to background script
    chrome.runtime.sendMessage(
      {
        type: 'SET_CONTEXT',
        payload: pageInfo
      },
      (response) => {
        if (response && response.type === 'MESSAGE') {
          const statusMessage = createMessage(
            response.payload.text,
            'system'
          );
          addMessageToChat(statusMessage);
        } else if (response && response.type === 'ERROR') {
          const errorMessage = createMessage(
            `Error: ${response.payload.message || 'Failed to set context'}`,
            'system'
          );
          addMessageToChat(errorMessage);
        }
      }
    );
    
    // Add a waiting message
    const waitingMessage = createMessage(
      useAsContext ? 'Setting current page content as chat context...' : 'Removing page content from chat context...',
      'system'
    );
    addMessageToChat(waitingMessage);
    return;
  }
  
  // Standard chat message
  console.log('CONTENT: Sending SEND_MESSAGE to background with text:', text.substring(0, 50) + (text.length > 50 ? '...' : ''));
  
  chrome.runtime.sendMessage(
    {
      type: 'SEND_MESSAGE',
      payload: {
        text,
        sessionId: currentSession.id
      }
    },
    (response) => {
      console.log('CONTENT: Received response from background for SEND_MESSAGE:', response ? response.type : 'no response');
      
      if (response && response.type === 'MESSAGE') {
        const systemMessage = createMessage(response.payload.text, 'system');
        addMessageToChat(systemMessage);
        
        // Update session
        if (currentSession) {
          currentSession.messages.push(systemMessage);
          currentSession.updatedAt = Date.now();
        }
      } else {
        console.log('CONTENT: Unexpected or missing response:', response);
        // Add error message to chat
        const errorMessage = createMessage('Error: Failed to get a response from the assistant. Please try again.', 'system');
        addMessageToChat(errorMessage);
      }
    }
  );
}

// Add a message to the chat interface
function addMessageToChat(message: Message) {
  const messagesContainer = document.getElementById('chatbrowse-messages');
  if (!messagesContainer) return;
  
  const messageElement = document.createElement('div');
  messageElement.className = `chatbrowse-message ${message.sender}`;
  messageElement.textContent = message.text;
  messagesContainer.appendChild(messageElement);
  
  // Scroll to the new message
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Set up listeners for messages from background script
function setupMessageListeners() {
  // Debug all messaging activity
  console.log('DEBUG: Setting up content script message listeners');
  
  // Add a global message listener to debug all incoming messages
  chrome.runtime.onMessage.addListener((message, sender) => {
    console.log('DEBUG GLOBAL LISTENER: Content script received message:', 
      typeof message === 'object' ? message.type || 'unknown type' : typeof message);
    return false; // Allow other listeners to process
  });
  
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('DEBUG: Content script received message:', message.type);
    
    if (message.type === 'EXTRACT_PAGE_INFO') {
      console.log('Content script received EXTRACT_PAGE_INFO request');
      
      try {
        // Try to extract fresh info first
        const pageInfo = extractPageInfo();
        lastExtractedPageInfo = pageInfo;
        
        console.log('Extracted page info for background script:');
        console.log('- Title:', pageInfo.title);
        console.log('- URL:', pageInfo.url);
        console.log('- Content length:', pageInfo.content.length);
        
        // Ensure all fields are present before sending
        const response = {
          title: pageInfo.title || document.title || 'Unknown Title',
          url: pageInfo.url || window.location.href || 'Unknown URL',
          content: pageInfo.content || 'No content extracted'
        };
        
        console.log('DEBUG: Sending page info to background with title:', response.title);
        sendResponse(response);
      } catch (error) {
        console.error('Error extracting page info:', error);
        
        // Try to use last extracted info if available
        if (lastExtractedPageInfo) {
          console.log('Using last successfully extracted page info instead');
          sendResponse(lastExtractedPageInfo);
          return true;
        }
        
        // Even on error, send a response with basic info
        sendResponse({
          title: document.title || 'Unknown Title',
          url: window.location.href || 'Unknown URL',
          content: 'Error extracting content: ' + (error as Error).message
        });
      }
      
      return true;
    }
    
    if (message.type === 'CLEAR_CHAT') {
      clearChat();
      sendResponse({ success: true });
      return true;
    }
    
    return false;
  });
}

// Clear the chat messages
function clearChat() {
  const messagesContainer = document.getElementById('chatbrowse-messages');
  if (messagesContainer) {
    messagesContainer.innerHTML = '';
  }
  
  if (currentSession) {
    currentSession.messages = [];
    currentSession.updatedAt = Date.now();
  }
}

// Initialize when the content script is loaded
initialize(); 