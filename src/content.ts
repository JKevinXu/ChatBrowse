import { Message, ChatSession } from './types';
import { createChatSession, createMessage, extractPageInfo, processCommand } from './utils';

let currentSession: ChatSession | null = null;
let chatContainer: HTMLElement | null = null;

// Initialize when the content script is loaded
function initialize() {
  console.log('ChatBrowse content script initialized');
  
  // Create the chat interface
  createChatInterface();
  
  // Initialize a new chat session for this page
  const { title, url } = extractPageInfo();
  currentSession = createChatSession(url, title);
  
  // Set up message listeners
  setupMessageListeners();
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
  
  // Standard chat message
  chrome.runtime.sendMessage(
    {
      type: 'SEND_MESSAGE',
      payload: {
        text,
        sessionId: currentSession.id
      }
    },
    (response) => {
      if (response && response.type === 'MESSAGE') {
        const systemMessage = createMessage(response.payload.text, 'system');
        addMessageToChat(systemMessage);
        
        // Update session
        if (currentSession) {
          currentSession.messages.push(systemMessage);
          currentSession.updatedAt = Date.now();
        }
      }
    }
  );
}

// Add a message to the chat UI
function addMessageToChat(message: Message) {
  const messagesContainer = document.getElementById('chatbrowse-messages');
  if (!messagesContainer) return;
  
  const messageElement = document.createElement('div');
  messageElement.className = `chatbrowse-message ${message.sender}`;
  messageElement.textContent = message.text;
  messageElement.dataset.id = message.id;
  
  messagesContainer.appendChild(messageElement);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Set up listeners for messages from background script
function setupMessageListeners() {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'EXTRACT_PAGE_INFO') {
      sendResponse(extractPageInfo());
      return true;
    }
    
    if (message.type === 'CLEAR_CHAT') {
      clearChat();
      sendResponse({ success: true });
      return false;
    }
    
    return false;
  });
}

// Clear the chat
function clearChat() {
  const messagesContainer = document.getElementById('chatbrowse-messages');
  if (messagesContainer) {
    messagesContainer.innerHTML = '';
  }
  
  if (currentSession) {
    // Keep only the welcome message
    const welcomeMessage = currentSession.messages.find(m => 
      m.sender === 'system' && m.text.includes('Welcome to ChatBrowse'));
    
    currentSession.messages = welcomeMessage ? [welcomeMessage] : [];
    currentSession.updatedAt = Date.now();
  }
}

// Initialize the content script
initialize(); 