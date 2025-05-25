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
    
    // Add hover functionality for post reference links
    this.setupPostReferenceHovers(messageElement);
    
    // Scroll to the bottom
    this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
  }

  private setupPostReferenceHovers(messageElement: HTMLElement): void {
    const postLinks = messageElement.querySelectorAll('a.post-reference');
    
    postLinks.forEach(link => {
      const linkElement = link as HTMLElement;
      
      linkElement.addEventListener('mouseenter', (e) => {
        this.showPostPreview(e.target as HTMLElement);
      });
      
      linkElement.addEventListener('mouseleave', () => {
        this.hidePostPreview();
      });
    });
  }

  private showPostPreview(linkElement: HTMLElement): void {
    // Remove any existing tooltip
    this.hidePostPreview();
    
    const fullContent = linkElement.dataset.fullContent;
    const author = linkElement.dataset.author;
    const title = linkElement.dataset.title;
    const imageUrl = linkElement.dataset.image;
    
    if (!fullContent) return;
    
    // Process content - convert \\n back to actual line breaks
    const processedContent = fullContent.replace(/\\n/g, '\n').replace(/\\r/g, '\r');
    
    // Create tooltip with full content and image
    const tooltip = document.createElement('div');
    tooltip.className = 'popup-post-tooltip';
    
    let imageHTML = '';
    if (imageUrl && imageUrl.trim()) {
      imageHTML = `<div class="tooltip-image"><img src="${imageUrl}" alt="Post image" /></div>`;
    }
    
    tooltip.innerHTML = `
      <div class="tooltip-header">
        <strong>${title}</strong>
        ${author ? `<span class="tooltip-author">by ${author}</span>` : ''}
      </div>
      ${imageHTML}
      <div class="tooltip-content">${processedContent}</div>
    `;
    
    // Position tooltip relative to popup
    const rect = linkElement.getBoundingClientRect();
    const popupRect = document.body.getBoundingClientRect();
    
    tooltip.style.position = 'absolute';
    tooltip.style.left = `${rect.left - popupRect.left}px`;
    tooltip.style.top = `${rect.bottom - popupRect.top + 5}px`;
    tooltip.style.zIndex = '1000';
    
    // Add to popup body
    document.body.appendChild(tooltip);
    
    // Adjust position if tooltip goes off screen within popup bounds
    const tooltipRect = tooltip.getBoundingClientRect();
    const popupWidth = document.body.offsetWidth;
    const popupHeight = document.body.offsetHeight;
    
    if (tooltipRect.right > popupWidth) {
      tooltip.style.left = `${popupWidth - tooltipRect.width - 10}px`;
    }
    if (tooltipRect.bottom > popupHeight) {
      tooltip.style.top = `${rect.top - popupRect.top - tooltipRect.height - 5}px`;
    }
    
    // If still off screen (tooltip too tall), add scrolling
    const finalRect = tooltip.getBoundingClientRect();
    if (finalRect.top < 0 || finalRect.height > popupHeight - 20) {
      tooltip.style.top = '10px';
      tooltip.style.maxHeight = `${popupHeight - 20}px`;
      tooltip.style.overflowY = 'auto';
    }
  }

  private hidePostPreview(): void {
    const existingTooltip = document.querySelector('.popup-post-tooltip');
    if (existingTooltip) {
      existingTooltip.remove();
    }
  }

  clearChat(): void {
    if (this.chatMessages) {
      this.chatMessages.innerHTML = `
        <div class="message system">
          Welcome to ChatBrowse! How can I help you navigate this website?
        </div>
      `;
      
      // Clean up any lingering tooltips
      this.hidePostPreview();
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