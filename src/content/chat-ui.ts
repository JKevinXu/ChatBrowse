import { Message, ChatSession } from '../types';
import { createMessage, extractPageInfo } from '../utils';

export class ChatUI {
  private chatContainer: HTMLElement | null = null;
  private currentSession: ChatSession | null = null;
  private onMessageSend?: (message: string) => void;

  constructor(onMessageSend?: (message: string) => void) {
    this.onMessageSend = onMessageSend;
  }

  initialize(session: ChatSession): void {
    this.currentSession = session;
    this.createChatInterface();
    this.setupEventListeners();
  }

  private createChatInterface(): void {
    // Create container
    this.chatContainer = document.createElement('div');
    this.chatContainer.className = 'chatbrowse-container';
    
    // Create toggle button
    const toggleButton = document.createElement('div');
    toggleButton.className = 'chatbrowse-toggle';
    toggleButton.innerHTML = '<span class="chatbrowse-icon">💬</span>';
    toggleButton.addEventListener('click', () => this.toggleChat());
    
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
    header.querySelector('.chatbrowse-close')?.addEventListener('click', () => this.toggleChat());
    
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
    
    // Assemble the chat panel
    chatPanel.appendChild(header);
    chatPanel.appendChild(messagesContainer);
    chatPanel.appendChild(inputArea);
    
    // Add elements to container
    this.chatContainer.appendChild(toggleButton);
    this.chatContainer.appendChild(chatPanel);
    
    // Add to the document
    document.body.appendChild(this.chatContainer);
  }

  private setupEventListeners(): void {
    if (!this.chatContainer) return;

    const inputElement = this.chatContainer.querySelector('input') as HTMLInputElement;
    const sendButton = this.chatContainer.querySelector('button');
    
    if (inputElement && sendButton) {
      sendButton.addEventListener('click', () => this.handleUserInput(inputElement));
      
      inputElement.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          this.handleUserInput(inputElement);
        }
      });
    }
  }

  private handleUserInput(inputElement: HTMLInputElement): void {
    const text = inputElement.value.trim();
    
    if (!text || !this.currentSession) return;
    
    // Clear the input
    inputElement.value = '';
    
    // Add user message to chat
    const userMessage = createMessage(text, 'user');
    this.addMessageToChat(userMessage);
    
    // Save to current session
    if (this.currentSession) {
      this.currentSession.messages.push(userMessage);
      this.currentSession.updatedAt = Date.now();
    }
    
    // Notify parent component
    if (this.onMessageSend) {
      this.onMessageSend(text);
    }
  }

  addMessageToChat(message: Message): void {
    const messagesContainer = document.getElementById('chatbrowse-messages');
    if (!messagesContainer) return;
    
    const messageElement = document.createElement('div');
    messageElement.className = `chatbrowse-message ${message.sender}`;
    messageElement.textContent = message.text;
    messageElement.dataset.timestamp = message.timestamp.toString();
    
    messagesContainer.appendChild(messageElement);
    
    // Scroll to bottom
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  toggleChat(): void {
    const chatPanel = this.chatContainer?.querySelector('.chatbrowse-chat');
    if (chatPanel) {
      chatPanel.classList.toggle('active');
    }
  }

  clearChat(): void {
    const messagesContainer = document.getElementById('chatbrowse-messages');
    if (messagesContainer) {
      messagesContainer.innerHTML = '';
    }
    
    if (this.currentSession) {
      this.currentSession.messages = [];
      this.currentSession.updatedAt = Date.now();
    }
  }

  updateSession(session: ChatSession): void {
    this.currentSession = session;
    this.renderMessages();
  }

  private renderMessages(): void {
    if (!this.currentSession) return;

    this.clearChat();
    
    this.currentSession.messages.forEach(message => {
      this.addMessageToChat(message);
    });
  }
} 