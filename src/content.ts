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

  // Listen for messages from the background script
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('CONTENT: Received message:', request);
    
    if (request.type === 'EXTRACT_PAGE_INFO') {
      const pageInfo = extractPageInfo();
      sendResponse(pageInfo);
      return true;
    }
    
    if (request.type === 'GET_PAGE_ANALYSIS') {
      try {
        const analysis = generatePageSummaryForAI();
        sendResponse({ analysis });
      } catch (error) {
        console.error('CONTENT: Error generating page analysis:', error);
        sendResponse({ analysis: '' });
      }
      return true;
    }
    
    if (request.type === 'PERFORM_ACTION') {
      performBrowserAction(request.action).then((result: any) => {
        sendResponse(result);
      }).catch((error: any) => {
        sendResponse({ success: false, error: error.message });
      });
      return true; // Will respond asynchronously
    }
    
    if (request.type === 'TAKE_SCREENSHOT') {
      sendResponse({ success: true, message: 'Screenshot request forwarded to background' });
      return true;
    }
    
    // Add enhanced action execution - INTELLIGENT ACTION SYSTEM
    if (request.type === 'EXECUTE_ACTION') {
      executeEnhancedAction(request.action).then(result => {
        sendResponse(result);
      }).catch(error => {
        sendResponse({ success: false, error: error.message });
      });
      return true;
    }
    
    // For other action types, return a default response
    sendResponse({ success: false, error: 'Unknown action type' });
    return true;
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

// Enhanced browser actions for content script
interface BrowserAction {
  type: 'click' | 'type' | 'scroll' | 'screenshot' | 'select' | 'submit' | 'wait' | 'hover';
  selector?: string;
  text?: string;
  value?: string;
  x?: number;
  y?: number;
  direction?: 'up' | 'down' | 'left' | 'right';
  amount?: number;
  timeout?: number;
}

interface BrowserActionResult {
  success: boolean;
  error?: string;
  data?: any;
}

// Handle browser actions
async function performBrowserAction(action: BrowserAction): Promise<BrowserActionResult> {
  try {
    switch (action.type) {
      case 'click':
        return await clickElement(action.selector, action.x, action.y);
      
      case 'type':
        return await typeText(action.selector, action.text || '');
      
      case 'scroll':
        return await scrollPage(action.direction || 'down', action.amount || 500);
      
      case 'screenshot':
        return await takeScreenshot();
      
      case 'select':
        return await selectOption(action.selector, action.value || '');
      
      case 'submit':
        return await submitForm(action.selector);
      
      case 'wait':
        return await waitForElement(action.selector, action.timeout || 5000);
      
      case 'hover':
        return await hoverElement(action.selector);
      
      default:
        return { success: false, error: `Unknown action type: ${action.type}` };
    }
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

// Click on an element
async function clickElement(selector?: string, x?: number, y?: number): Promise<BrowserActionResult> {
  if (selector) {
    const element = document.querySelector(selector) as HTMLElement;
    if (!element) {
      return { success: false, error: `Element not found: ${selector}` };
    }
    element.click();
    return { success: true, data: { clicked: selector } };
  } else if (x !== undefined && y !== undefined) {
    // Click at coordinates
    const element = document.elementFromPoint(x, y) as HTMLElement;
    if (!element) {
      return { success: false, error: `No element at coordinates (${x}, ${y})` };
    }
    element.click();
    return { success: true, data: { clicked: `coordinates (${x}, ${y})` } };
  }
  return { success: false, error: 'No selector or coordinates provided' };
}

// Type text into an element
async function typeText(selector?: string, text?: string): Promise<BrowserActionResult> {
  if (!selector || !text) {
    return { success: false, error: 'Selector and text are required' };
  }
  
  const element = document.querySelector(selector) as HTMLInputElement | HTMLTextAreaElement;
  if (!element) {
    return { success: false, error: `Element not found: ${selector}` };
  }
  
  // Focus the element
  element.focus();
  
  // Clear existing content
  element.value = '';
  
  // Type the text
  element.value = text;
  
  // Trigger events to simulate real typing
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
  
  return { success: true, data: { typed: text, into: selector } };
}

// Scroll the page
async function scrollPage(direction: string, amount: number): Promise<BrowserActionResult> {
  let x = 0, y = 0;
  
  switch (direction) {
    case 'down':
      y = amount;
      break;
    case 'up':
      y = -amount;
      break;
    case 'right':
      x = amount;
      break;
    case 'left':
      x = -amount;
      break;
  }
  
  window.scrollBy(x, y);
  return { success: true, data: { scrolled: direction, amount } };
}

// Take a screenshot (limited in content scripts, but we can capture viewport)
async function takeScreenshot(): Promise<BrowserActionResult> {
  // Content scripts can't take screenshots directly
  // We'll need to use the background script for this
  return { success: false, error: 'Screenshot functionality requires background script integration' };
}

// Select an option from a dropdown
async function selectOption(selector?: string, value?: string): Promise<BrowserActionResult> {
  if (!selector || !value) {
    return { success: false, error: 'Selector and value are required' };
  }
  
  const element = document.querySelector(selector) as HTMLSelectElement;
  if (!element) {
    return { success: false, error: `Element not found: ${selector}` };
  }
  
  element.value = value;
  element.dispatchEvent(new Event('change', { bubbles: true }));
  
  return { success: true, data: { selected: value, in: selector } };
}

// Submit a form
async function submitForm(selector?: string): Promise<BrowserActionResult> {
  if (!selector) {
    return { success: false, error: 'Form selector is required' };
  }
  
  const form = document.querySelector(selector) as HTMLFormElement;
  if (!form) {
    return { success: false, error: `Form not found: ${selector}` };
  }
  
  form.submit();
  return { success: true, data: { submitted: selector } };
}

// Wait for an element to appear
async function waitForElement(selector?: string, timeout: number = 5000): Promise<BrowserActionResult> {
  if (!selector) {
    return { success: false, error: 'Selector is required' };
  }
  
  return new Promise((resolve) => {
    const startTime = Date.now();
    
    const checkElement = () => {
      const element = document.querySelector(selector);
      if (element) {
        resolve({ success: true, data: { found: selector } });
      } else if (Date.now() - startTime > timeout) {
        resolve({ success: false, error: `Element not found within ${timeout}ms: ${selector}` });
      } else {
        setTimeout(checkElement, 100);
      }
    };
    
    checkElement();
  });
}

// Hover over an element
async function hoverElement(selector?: string): Promise<BrowserActionResult> {
  if (!selector) {
    return { success: false, error: 'Selector is required' };
  }
  
  const element = document.querySelector(selector) as HTMLElement;
  if (!element) {
    return { success: false, error: `Element not found: ${selector}` };
  }
  
  // Create and dispatch mouseover event
  const event = new MouseEvent('mouseover', {
    view: window,
    bubbles: true,
    cancelable: true
  });
  
  element.dispatchEvent(event);
  return { success: true, data: { hovered: selector } };
}

// Enhanced page analysis and intelligence
interface PageStructure {
  forms: Array<{
    selector: string;
    fields: Array<{ name: string; type: string; selector: string; placeholder?: string }>;
    submitButton?: string;
  }>;
  buttons: Array<{ text: string; selector: string; type: string }>;
  links: Array<{ text: string; href: string; selector: string }>;
  searchBoxes: Array<{ placeholder: string; selector: string }>;
  navigation: Array<{ text: string; selector: string }>;
  content: {
    headings: Array<{ level: number; text: string; selector: string }>;
    paragraphs: Array<{ text: string; selector: string }>;
    lists: Array<{ type: string; items: string[]; selector: string }>;
  };
  interactive: Array<{ type: string; text: string; selector: string }>;
}

// Analyze page structure and find actionable elements
function analyzePageStructure(): PageStructure {
  const structure: PageStructure = {
    forms: [],
    buttons: [],
    links: [],
    searchBoxes: [],
    navigation: [],
    content: { headings: [], paragraphs: [], lists: [] },
    interactive: []
  };

  // Find forms and their fields
  document.querySelectorAll('form').forEach((form, index) => {
    const formSelector = `form:nth-of-type(${index + 1})`;
    const fields: any[] = [];
    
    form.querySelectorAll('input, textarea, select').forEach((field) => {
      const input = field as HTMLInputElement;
      fields.push({
        name: input.name || input.id || `field-${fields.length}`,
        type: input.type || input.tagName.toLowerCase(),
        selector: getElementSelector(field),
        placeholder: input.placeholder || input.title
      });
    });
    
    const submitButton = form.querySelector('button[type="submit"], input[type="submit"]');
    
    structure.forms.push({
      selector: formSelector,
      fields,
      submitButton: submitButton ? getElementSelector(submitButton) : undefined
    });
  });

  // Find all clickable buttons
  document.querySelectorAll('button, input[type="button"], input[type="submit"], .btn, [role="button"]').forEach((btn) => {
    const button = btn as HTMLElement;
    const text = button.textContent?.trim() || button.getAttribute('value') || button.getAttribute('aria-label') || '';
    if (text) {
      structure.buttons.push({
        text,
        selector: getElementSelector(button),
        type: button.tagName.toLowerCase()
      });
    }
  });

  // Find navigation links
  document.querySelectorAll('nav a, .nav a, .menu a, .navigation a').forEach((link) => {
    const anchor = link as HTMLAnchorElement;
    structure.navigation.push({
      text: anchor.textContent?.trim() || '',
      selector: getElementSelector(anchor)
    });
  });

  // Find search boxes
  document.querySelectorAll('input[type="search"], input[placeholder*="search" i], input[name*="search" i], .search input').forEach((search) => {
    const input = search as HTMLInputElement;
    structure.searchBoxes.push({
      placeholder: input.placeholder || 'Search',
      selector: getElementSelector(input)
    });
  });

  // Find all links
  document.querySelectorAll('a[href]').forEach((link) => {
    const anchor = link as HTMLAnchorElement;
    const text = anchor.textContent?.trim();
    if (text && text.length > 0 && text.length < 100) {
      structure.links.push({
        text,
        href: anchor.href,
        selector: getElementSelector(anchor)
      });
    }
  });

  // Analyze content structure
  document.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach((heading) => {
    structure.content.headings.push({
      level: parseInt(heading.tagName.substring(1)),
      text: heading.textContent?.trim() || '',
      selector: getElementSelector(heading)
    });
  });

  // Find important interactive elements
  document.querySelectorAll('[onclick], [data-action], .clickable, .interactive').forEach((elem) => {
    const element = elem as HTMLElement;
    structure.interactive.push({
      type: element.tagName.toLowerCase(),
      text: element.textContent?.trim()?.substring(0, 50) || '',
      selector: getElementSelector(element)
    });
  });

  return structure;
}

// Generate a reliable CSS selector for an element
function getElementSelector(element: Element): string {
  if (element.id) {
    return `#${element.id}`;
  }
  
  if (element.className && typeof element.className === 'string') {
    const classes = element.className.split(' ').filter(c => c && !c.includes(' '));
    if (classes.length > 0) {
      return `.${classes[0]}`;
    }
  }
  
  // Fallback to nth-child selector
  const parent = element.parentElement;
  if (parent) {
    const siblings = Array.from(parent.children);
    const index = siblings.indexOf(element) + 1;
    const parentSelector = parent.tagName.toLowerCase();
    return `${parentSelector} > ${element.tagName.toLowerCase()}:nth-child(${index})`;
  }
  
  return element.tagName.toLowerCase();
}

// Smart action finder - suggests actions based on page content
function findRelevantActions(intent: string): Array<{ action: string; description: string; confidence: number }> {
  const structure = analyzePageStructure();
  const suggestions: Array<{ action: string; description: string; confidence: number }> = [];
  const lowerIntent = intent.toLowerCase();

  // Search-related actions
  if (lowerIntent.includes('search') || lowerIntent.includes('find')) {
    structure.searchBoxes.forEach((searchBox, index) => {
      suggestions.push({
        action: `performActionInCurrentBrowser({type: 'type', selector: '${searchBox.selector}', text: 'your-search-term'})`,
        description: `Type in search box: "${searchBox.placeholder}"`,
        confidence: 0.9
      });
    });
  }

  // Form-related actions
  if (lowerIntent.includes('form') || lowerIntent.includes('fill') || lowerIntent.includes('submit')) {
    structure.forms.forEach((form, index) => {
      suggestions.push({
        action: `fillForm({${form.fields.map(f => `'${f.selector}': 'value'`).join(', ')}})`,
        description: `Fill form with ${form.fields.length} fields`,
        confidence: 0.8
      });
      
      if (form.submitButton) {
        suggestions.push({
          action: `performActionInCurrentBrowser({type: 'click', selector: '${form.submitButton}'})`,
          description: `Submit form`,
          confidence: 0.9
        });
      }
    });
  }

  // Navigation actions
  if (lowerIntent.includes('go to') || lowerIntent.includes('navigate') || lowerIntent.includes('click')) {
    structure.buttons.forEach((button) => {
      if (button.text.toLowerCase().includes(lowerIntent.replace(/.*?(go to|navigate|click)\s*/i, ''))) {
        suggestions.push({
          action: `performActionInCurrentBrowser({type: 'click', selector: '${button.selector}'})`,
          description: `Click "${button.text}" button`,
          confidence: 0.85
        });
      }
    });
  }

  // Shopping/e-commerce actions
  if (lowerIntent.includes('buy') || lowerIntent.includes('cart') || lowerIntent.includes('purchase')) {
    structure.buttons.forEach((button) => {
      if (button.text.toLowerCase().includes('cart') || 
          button.text.toLowerCase().includes('buy') ||
          button.text.toLowerCase().includes('purchase') ||
          button.text.toLowerCase().includes('checkout')) {
        suggestions.push({
          action: `performActionInCurrentBrowser({type: 'click', selector: '${button.selector}'})`,
          description: `Click "${button.text}" button`,
          confidence: 0.95
        });
      }
    });
  }

  return suggestions.sort((a, b) => b.confidence - a.confidence);
}

// Intelligent action executor - reads page and decides what to do
async function executeIntelligentAction(userRequest: string): Promise<{ success: boolean; actions: string[]; results: any[] }> {
  const structure = analyzePageStructure();
  const suggestions = findRelevantActions(userRequest);
  const executedActions: string[] = [];
  const results: any[] = [];

  // Create context for AI decision making
  const pageContext = {
    url: window.location.href,
    title: document.title,
    structure: structure,
    userRequest: userRequest,
    suggestions: suggestions
  };

  // For now, execute the highest confidence suggestion
  if (suggestions.length > 0 && suggestions[0].confidence > 0.7) {
    try {
      // Parse and execute the suggested action
      const suggestion = suggestions[0];
      executedActions.push(suggestion.description);
      
      // This would need to be enhanced to actually execute the parsed action
      console.log('Would execute:', suggestion.action);
      results.push({ success: true, description: suggestion.description });
      
      return { success: true, actions: executedActions, results };
    } catch (error) {
      return { success: false, actions: executedActions, results: [{ error: (error as Error).message }] };
    }
  }

  return { success: false, actions: [], results: [{ error: 'No suitable action found' }] };
}

// Page understanding for AI context
function generatePageSummaryForAI(): string {
  const structure = analyzePageStructure();
  
  let summary = `Page Analysis:\n`;
  summary += `URL: ${window.location.href}\n`;
  summary += `Title: ${document.title}\n\n`;
  
  if (structure.forms.length > 0) {
    summary += `Forms available (${structure.forms.length}):\n`;
    structure.forms.forEach((form, i) => {
      summary += `  Form ${i + 1}: ${form.fields.length} fields - ${form.fields.map(f => f.name).join(', ')}\n`;
    });
    summary += '\n';
  }
  
  if (structure.buttons.length > 0) {
    summary += `Clickable buttons: ${structure.buttons.slice(0, 10).map(b => `"${b.text}"`).join(', ')}\n\n`;
  }
  
  if (structure.searchBoxes.length > 0) {
    summary += `Search boxes: ${structure.searchBoxes.map(s => s.placeholder).join(', ')}\n\n`;
  }
  
  if (structure.navigation.length > 0) {
    summary += `Navigation: ${structure.navigation.slice(0, 5).map(n => n.text).join(', ')}\n\n`;
  }
  
  summary += `Content structure: ${structure.content.headings.length} headings\n`;
  summary += `Interactive elements: ${structure.interactive.length} available\n`;
  
  return summary;
}

// Add enhanced action execution - INTELLIGENT ACTION SYSTEM
interface ActionPlan {
  type: string;
  selector: string;
  value?: string;
  description: string;
  confidence: number;
}

interface ActionResult {
  success: boolean;
  error?: string;
  data?: any;
}

async function executeEnhancedAction(action: ActionPlan): Promise<ActionResult> {
  console.log('🤖 EXECUTING ACTION:', action);
  
  try {
    switch (action.type) {
      case 'search':
        return await executeSmartSearch(action);
      case 'type':
        return await executeTypeAction(action);
      case 'click':
        return await executeClickAction(action);
      default:
        throw new Error(`Unknown action type: ${action.type}`);
    }
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

// AI-powered search element detection using LLM
async function findSearchElementsWithAI(): Promise<Array<{ element: HTMLElement; selector: string; confidence: number; reason: string }>> {
  try {
    // Extract relevant HTML structure for AI analysis
    const pageStructure = extractSearchRelevantHTML();
    
    // Send to background script for AI analysis
    const aiAnalysis = await new Promise<any>((resolve) => {
      chrome.runtime.sendMessage({
        type: 'ANALYZE_SEARCH_ELEMENTS',
        payload: {
          html: pageStructure,
          url: window.location.href,
          title: document.title
        }
      }, (response) => {
        resolve(response || null);
      });
    });
    
    if (!aiAnalysis || !aiAnalysis.searchElements) {
      console.log('🤖 AI analysis failed, falling back to rule-based detection');
      return findSearchElementsFallback();
    }
    
    console.log('🤖 AI DETECTED SEARCH ELEMENTS:', aiAnalysis.searchElements);
    
    // Convert AI suggestions to actual elements
    const searchElements: Array<{ element: HTMLElement; selector: string; confidence: number; reason: string }> = [];
    
    for (const suggestion of aiAnalysis.searchElements) {
      try {
        const element = document.querySelector(suggestion.selector) as HTMLInputElement;
        if (element) {
          searchElements.push({
            element,
            selector: suggestion.selector,
            confidence: suggestion.confidence,
            reason: `AI detected: ${suggestion.reason}`
          });
        }
      } catch (error) {
        console.log(`🤖 Invalid AI selector: ${suggestion.selector}`);
      }
    }
    
    return searchElements.sort((a, b) => b.confidence - a.confidence);
    
  } catch (error) {
    console.error('🤖 AI search detection failed:', error);
    return findSearchElementsFallback();
  }
}

// Extract HTML structure relevant for search detection
function extractSearchRelevantHTML(): string {
  const relevantElements: string[] = [];
  
  // Get all input elements with their context
  document.querySelectorAll('input').forEach((input, index) => {
    const parent = input.closest('form, div, header, nav') || input.parentElement;
    if (parent) {
      // Create a simplified representation
      const inputInfo = {
        tag: input.tagName.toLowerCase(),
        type: input.type || 'text',
        name: input.name || '',
        id: input.id || '',
        className: input.className || '',
        placeholder: input.placeholder || '',
        parentTag: parent.tagName.toLowerCase(),
        parentClass: parent.className || '',
        parentId: parent.id || '',
        siblings: Array.from(parent.children).map(child => child.tagName.toLowerCase()).join(',')
      };
      
      relevantElements.push(`Input${index}: ${JSON.stringify(inputInfo)}`);
    }
  });
  
  // Get form structures
  document.querySelectorAll('form').forEach((form, index) => {
    const formInfo = {
      tag: 'form',
      action: form.action || '',
      method: form.method || '',
      className: form.className || '',
      id: form.id || '',
      inputs: Array.from(form.querySelectorAll('input')).length,
      buttons: Array.from(form.querySelectorAll('button')).length
    };
    
    relevantElements.push(`Form${index}: ${JSON.stringify(formInfo)}`);
  });
  
  return relevantElements.join('\n');
}

// Fallback rule-based detection (original method)
function findSearchElementsFallback(): Array<{ element: HTMLElement; selector: string; confidence: number; reason: string }> {
  const searchElements: Array<{ element: HTMLElement; selector: string; confidence: number; reason: string }> = [];
  
  // Strategy 1: Look for inputs with search-related attributes
  document.querySelectorAll('input').forEach((input, index) => {
    const element = input as HTMLInputElement;
    let confidence = 0;
    let reasons: string[] = [];
    
    // Check various search indicators
    if (element.type === 'search') {
      confidence += 0.4;
      reasons.push('type=search');
    }
    
    if (element.placeholder && /search/i.test(element.placeholder)) {
      confidence += 0.3;
      reasons.push('search in placeholder');
    }
    
    if (element.name && /search/i.test(element.name)) {
      confidence += 0.2;
      reasons.push('search in name');
    }
    
    if (element.id && /search/i.test(element.id)) {
      confidence += 0.2;
      reasons.push('search in id');
    }
    
    if (element.className && /search/i.test(element.className)) {
      confidence += 0.1;
      reasons.push('search in class');
    }
    
    if (confidence > 0.1) {
      searchElements.push({
        element,
        selector: getElementSelector(element),
        confidence,
        reason: reasons.join(', ')
      });
    }
  });
  
  // Platform-specific fallbacks
  const url = window.location.href;
  
  if (url.includes('youtube.com')) {
    const youtubeSelectors = [
      'input[name="search_query"]',
      'input[placeholder*="Search" i]',
      '#search input',
      '.ytd-searchbox input',
      'form[role="search"] input'
    ];
    
    youtubeSelectors.forEach(selector => {
      const element = document.querySelector(selector) as HTMLInputElement;
      if (element && !searchElements.find(se => se.element === element)) {
        searchElements.push({
          element,
          selector,
          confidence: 0.8,
          reason: 'YouTube fallback selector'
        });
      }
    });
  }
  
  return searchElements.sort((a, b) => b.confidence - a.confidence);
}

async function executeSmartSearch(action: ActionPlan): Promise<ActionResult> {
  console.log('🔍 SMART SEARCH: Starting AI-powered search detection...');
  
  // Use AI to find search elements
  const searchElements = await findSearchElementsWithAI();
  
  console.log('🔍 FOUND SEARCH ELEMENTS:', searchElements.map(se => ({
    selector: se.selector,
    confidence: se.confidence,
    reason: se.reason
  })));
  
  if (searchElements.length === 0) {
    return { success: false, error: 'No search elements found on this page' };
  }
  
  // Try search elements in order of confidence
  for (const searchElement of searchElements) {
    try {
      console.log(`🔍 TRYING: ${searchElement.selector} (${searchElement.confidence} confidence - ${searchElement.reason})`);
      
      const element = searchElement.element as HTMLInputElement;
      
      // Focus and clear the search box
      element.focus();
      element.value = '';
      
      // Type the search query
      element.value = action.value || '';
      
      // Trigger input events
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
      
      // Try to submit the search
      let submitted = false;
      
      // Method 1: Look for submit button near the search box
      const form = element.closest('form');
      if (form) {
        const submitButton = form.querySelector('button[type="submit"], input[type="submit"], button:not([type])') as HTMLElement;
        if (submitButton) {
          console.log('🔍 SUBMITTING: Using form submit button');
          submitButton.click();
          submitted = true;
        }
      }
      
      // Method 2: Look for search icon/button next to input
      if (!submitted) {
        const parent = element.parentElement;
        if (parent) {
          const searchButton = parent.querySelector('button, [role="button"]') as HTMLElement;
          if (searchButton) {
            console.log('🔍 SUBMITTING: Using nearby search button');
            searchButton.click();
            submitted = true;
          }
        }
      }
      
      // Method 3: Press Enter key
      if (!submitted) {
        console.log('🔍 SUBMITTING: Using Enter key');
        element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        element.dispatchEvent(new KeyboardEvent('keypress', { key: 'Enter', bubbles: true }));
        element.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true }));
        submitted = true;
      }
      
      // Return success for the first working element
      return {
        success: true,
        data: {
          selector: searchElement.selector,
          confidence: searchElement.confidence,
          reason: searchElement.reason,
          query: action.value,
          method: submitted ? 'completed' : 'attempted'
        }
      };
      
    } catch (error) {
      console.log(`🔍 FAILED: ${searchElement.selector} - ${error}`);
      continue; // Try next element
    }
  }
  
  return { 
    success: false, 
    error: `Tried ${searchElements.length} search elements but none worked: ${searchElements.map(se => se.selector).join(', ')}` 
  };
}

async function executeTypeAction(action: ActionPlan): Promise<ActionResult> {
  const element = document.querySelector(action.selector) as HTMLInputElement;
  if (!element) {
    throw new Error(`Element not found: ${action.selector}`);
  }
  
  element.focus();
  element.value = action.value || '';
  element.dispatchEvent(new Event('input', { bubbles: true }));
  
  return { success: true, data: { typed: action.value } };
}

async function executeClickAction(action: ActionPlan): Promise<ActionResult> {
  const element = document.querySelector(action.selector) as HTMLElement;
  if (!element) {
    throw new Error(`Element not found: ${action.selector}`);
  }
  
  element.scrollIntoView({ behavior: 'smooth', block: 'center' });
  await new Promise(resolve => setTimeout(resolve, 300));
  element.click();
  
  return { success: true, data: { clicked: action.selector } };
}

function detectCurrentPlatform(): string {
  const url = window.location.href;
  if (url.includes('youtube.com')) return 'youtube';
  if (url.includes('google.com')) return 'google';
  if (url.includes('amazon.com')) return 'amazon';
  return 'generic';
}

// Initialize when the content script is loaded
initialize(); 