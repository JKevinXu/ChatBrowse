import { Message, ChatSession } from '../types';
import { createMessage } from '../utils';
import { marked } from 'marked';

export class PopupUI {
  private chatMessages: HTMLElement | null = null;
  private userInput: HTMLInputElement | null = null;
  private sendButton: HTMLElement | null = null;
  private settingsButton: HTMLElement | null = null;
  private onMessageSend?: (text: string) => void;

  constructor(onMessageSend?: (text: string) => void) {
    this.onMessageSend = onMessageSend;
    this.setupMarked();
  }

  private setupMarked(): void {
    // Configure marked for safe rendering
    marked.setOptions({
      breaks: true, // Convert \n to <br>
      gfm: true // GitHub Flavored Markdown
    });
  }

  initialize(): void {
    this.setupDOMElements();
    this.setupEventListeners();
  }

  private setupDOMElements(): void {
    this.chatMessages = document.getElementById('chatMessages');
    this.userInput = document.getElementById('userInput') as HTMLInputElement;
    this.sendButton = document.getElementById('sendButton');
    this.settingsButton = document.getElementById('settingsButton');
  }

  private setupEventListeners(): void {
    this.sendButton?.addEventListener('click', () => this.handleSendMessage());
    
    this.userInput?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.handleSendMessage();
      }
    });

    this.settingsButton?.addEventListener('click', () => {
      chrome.runtime.openOptionsPage();
    });
  }

  private handleSendMessage(): void {
    if (!this.userInput) return;
    
    const text = this.userInput.value.trim();
    if (!text) return;
    
    // Clear input
    this.userInput.value = '';
    
    // Add user message to chat
    this.addMessageToChat(createMessage(text, 'user'));
    
    // Notify parent
    if (this.onMessageSend) {
      this.onMessageSend(text);
    }
  }

  // Sanitize HTML to prevent XSS attacks
  private sanitizeHTML(html: string): string {
    const div = document.createElement('div');
    div.innerHTML = html;
    
    // Remove script tags and event handlers
    const scripts = div.querySelectorAll('script');
    scripts.forEach(script => script.remove());
    
    // Remove dangerous attributes
    const allElements = div.querySelectorAll('*');
    allElements.forEach(element => {
      const attributes = Array.from(element.attributes);
      attributes.forEach(attr => {
        if (attr.name.startsWith('on') || attr.name === 'javascript:') {
          element.removeAttribute(attr.name);
        }
      });
    });
    
    return div.innerHTML;
  }

  addMessageToChat(message: Message): void {
    if (!this.chatMessages) return;
    
    const messageElement = document.createElement('div');
    messageElement.className = `message ${message.sender}`;
    
    try {
      // Parse markdown using marked library
      const markdownHTML = marked.parse(message.text) as string;
      // Sanitize the HTML for security
      const safeHTML = this.sanitizeHTML(markdownHTML);
      messageElement.innerHTML = safeHTML;
    } catch (error) {
      console.error('Error parsing markdown:', error);
      // Fallback to plain text
      messageElement.textContent = message.text;
    }
    
    messageElement.dataset.id = message.id;
    
    this.chatMessages.appendChild(messageElement);
    
    // Scroll to the bottom
    this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
  }

  clearChat(): void {
    if (this.chatMessages) {
      this.chatMessages.innerHTML = `
        <div class="message system">
          Welcome to ChatBrowse! How can I help you navigate this website?
        </div>
      `;
    }
  }

  showTypingIndicator(): void {
    const typingElement = document.createElement('div');
    typingElement.className = 'message system typing';
    typingElement.innerHTML = '<em>ChatBrowse is thinking...</em>';
    typingElement.id = 'typing-indicator';
    
    this.chatMessages?.appendChild(typingElement);
    this.chatMessages!.scrollTop = this.chatMessages!.scrollHeight;
  }

  hideTypingIndicator(): void {
    const typingElement = document.getElementById('typing-indicator');
    if (typingElement) {
      typingElement.remove();
    }
  }
} 