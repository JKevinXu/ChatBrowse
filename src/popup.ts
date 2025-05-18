import { ChatSession, Message } from './types';
import { createMessage, loadFromStorage, saveToStorage } from './utils';

// DOM Elements
let chatMessages: HTMLElement | null = null;
let userInput: HTMLInputElement | null = null;
let sendButton: HTMLElement | null = null;
let settingsButton: HTMLElement | null = null;

// Current chat session
let currentSession: ChatSession | null = null;

// Define the Tab interface
interface Tab {
  id?: number;
  url?: string;
  title?: string;
  active?: boolean;
}

// Initialize when the DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
  // Get DOM elements
  chatMessages = document.getElementById('chatMessages');
  userInput = document.getElementById('userInput') as HTMLInputElement;
  sendButton = document.getElementById('sendButton');
  settingsButton = document.getElementById('settingsButton');
  
  // Set up event listeners
  if (userInput && sendButton) {
    sendButton.addEventListener('click', handleSendMessage);
    userInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        handleSendMessage();
      }
    });
  }

  // Set up settings button
  if (settingsButton) {
    settingsButton.addEventListener('click', () => {
      chrome.runtime.openOptionsPage ? 
        chrome.runtime.openOptionsPage() : 
        window.open(chrome.runtime.getURL('settings.html'));
    });
  }
  
  // Get the current tab to associate with this session
  try {
    const tabs = await getCurrentTab();
    if (tabs && tabs.length > 0) {
      const currentTab = tabs[0];
      const tabUrl = currentTab.url || '';
      const tabTitle = currentTab.title || 'Untitled Page';
      
      // Try to load an existing session for this URL
      await loadOrCreateSession(tabUrl, tabTitle);
    }
  } catch (error) {
    console.error('Error getting current tab:', error);
    
    // Create a default session if we can't get the tab
    currentSession = {
      id: Date.now().toString(),
      messages: [
        createMessage('Welcome to ChatBrowse! I couldn\'t determine what page you\'re on.', 'system')
      ],
      url: '',
      title: 'ChatBrowse',
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
  }
  
  // Render the current session
  renderMessages();
  
  // Focus the input field
  if (userInput) {
    userInput.focus();
  }

  // Listen for messages from the background script (e.g., MCP results)
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'MCP_BROWSE_RESULT' && request.payload) {
      const { title, url, snippet } = request.payload;
      let resultText = `Navigated to: "${title}" (${url}).`;
      if (snippet) {
        resultText += `\nPreview: ${snippet}`;
      }
      const browseResultMessage = createMessage(resultText, 'system');
      addMessageToChat(browseResultMessage);
      
      // Update session with this system message if a session is active
      if (currentSession) {
        currentSession.messages.push(browseResultMessage);
        currentSession.updatedAt = Date.now();
        saveToStorage(`session_${currentSession.id}`, currentSession).catch(err => {
          console.error('Failed to save session after MCP_BROWSE_RESULT:', err);
        });
      } else {
        // If there's no current session, we might want to log this or handle it.
        // For now, the message is displayed in the chat, but not saved to a session.
        console.warn('MCP_BROWSE_RESULT received, but no currentSession to save it to.');
      }
      // It's good practice to send a response, though not strictly necessary here unless background expects it.
      sendResponse({received: true}); 
    }
    // Return true to indicate you wish to send a response asynchronously (if needed in other handlers)
    return true; 
  });
});

// Handle send message button click
function handleSendMessage() {
  if (!userInput || !currentSession) return;
  
  const text = userInput.value.trim();
  if (!text) return;
  
  // Clear input
  userInput.value = '';
  
  // Create and add message
  const message = createMessage(text, 'user');
  addMessageToChat(message);
  
  // Update session
  currentSession.messages.push(message);
  currentSession.updatedAt = Date.now();
  
  // Save session
  saveToStorage(`session_${currentSession.id}`, currentSession).catch(err => {
    console.error('Failed to save session:', err);
  });
  
  // Get current active tab and then send message
  chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
    const activeTab = tabs[0];
    
    // Send to background script for processing
    chrome.runtime.sendMessage(
      {
        type: 'SEND_MESSAGE',
        payload: {
          text,
          sessionId: currentSession.id,
          tabId: activeTab.id, // Include the active tab ID
          tabUrl: activeTab.url,
          tabTitle: activeTab.title
        }
      },
      (response) => {
        if (response && response.type === 'MESSAGE') {
          const systemMessage = createMessage(response.payload.text, 'system');
          addMessageToChat(systemMessage);
          
          // Update session with system response
          if (currentSession) {
            currentSession.messages.push(systemMessage);
            currentSession.updatedAt = Date.now();
            
            // Save updated session
            saveToStorage(`session_${currentSession.id}`, currentSession).catch(err => {
              console.error('Failed to save session after system response:', err);
            });
          }
        }
      }
    );
  });
}

// Add a message to the chat UI
function addMessageToChat(message: Message) {
  if (!chatMessages) return;
  
  const messageElement = document.createElement('div');
  messageElement.className = `message ${message.sender}`;
  messageElement.textContent = message.text;
  messageElement.dataset.id = message.id;
  
  chatMessages.appendChild(messageElement);
  
  // Scroll to the bottom
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Render all messages from the current session
function renderMessages() {
  if (!chatMessages || !currentSession) return;
  
  // Clear existing messages
  chatMessages.innerHTML = '';
  
  // Add each message to the UI
  currentSession.messages.forEach(message => {
    const messageElement = document.createElement('div');
    messageElement.className = `message ${message.sender}`;
    messageElement.textContent = message.text;
    messageElement.dataset.id = message.id;
    
    if (chatMessages) {
      chatMessages.appendChild(messageElement);
    }
  });
  
  // Scroll to the bottom
  if (chatMessages) {
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }
}

// Load or create a chat session for the current URL
async function loadOrCreateSession(url: string, title: string): Promise<void> {
  try {
    // Try to find an existing session for this URL
    const sessions = await loadFromStorage<Record<string, ChatSession>>('sessions') || {};
    
    // Find a session that matches this URL
    const sessionMatch = Object.values(sessions).find(session => session.url === url);
    
    if (sessionMatch) {
      currentSession = sessionMatch;
    } else {
      // Create a new session
      currentSession = {
        id: Date.now().toString(),
        messages: [
          createMessage(`Welcome to ChatBrowse! How can I help you navigate ${title}?`, 'system')
        ],
        url,
        title,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      
      // Add to sessions
      sessions[currentSession.id] = currentSession;
      
      // Save sessions
      await saveToStorage('sessions', sessions);
    }
  } catch (error) {
    console.error('Error loading/creating session:', error);
    
    // Create a default session
    currentSession = {
      id: Date.now().toString(),
      messages: [
        createMessage(`Welcome to ChatBrowse! How can I help you navigate ${title}?`, 'system')
      ],
      url,
      title,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
  }
}

// Get the current tab
function getCurrentTab(): Promise<Tab[]> {
  return new Promise((resolve, reject) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(tabs);
      }
    });
  });
} 