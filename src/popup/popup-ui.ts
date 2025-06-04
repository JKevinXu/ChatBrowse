import { Message, ChatSession } from '../types';
import { createMessage } from '../utils';
import { marked } from 'marked';

export class PopupUI {
  private chatMessages: HTMLElement | null = null;
  private userInput: HTMLInputElement | null = null;
  private sendButton: HTMLElement | null = null;
  private settingsButton: HTMLElement | null = null;
  private newConversationButton: HTMLElement | null = null;
  private onMessageSend?: (text: string) => void;
  private onNewConversation?: () => void;

  constructor(onMessageSend?: (text: string) => void, onNewConversation?: () => void) {
    this.onMessageSend = onMessageSend;
    this.onNewConversation = onNewConversation;
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
    this.newConversationButton = document.getElementById('newConversationButton');
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

    this.newConversationButton?.addEventListener('click', () => {
      if (this.onNewConversation) {
        this.onNewConversation();
      }
    });
  }

  private handleSendMessage(): void {
    console.log('🔧 PopupUI: handleSendMessage called');
    if (!this.userInput) return;
    
    const text = this.userInput.value.trim();
    if (!text) return;
    
    console.log('🔧 PopupUI: User input text:', text);
    
    // Clear input
    this.userInput.value = '';
    console.log('🔧 PopupUI: Input cleared');
    
    // Notify parent (PopupApp will handle adding the message to chat)
    if (this.onMessageSend) {
      console.log('🔧 PopupUI: Calling onMessageSend callback');
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
    console.log('🔧 PopupUI: addMessageToChat called with:', {
      id: message.id,
      sender: message.sender,
      text: message.text.substring(0, 50) + (message.text.length > 50 ? '...' : ''),
      timestamp: message.timestamp
    });
    
    if (!this.chatMessages) {
      console.error('❌ PopupUI: chatMessages element not found');
      return;
    }
    
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
    console.log('✅ PopupUI: Message added to chat DOM');
    
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
        // Cancel any existing hide timeouts
        if ((window as any).popupHideTimeout) {
          clearTimeout((window as any).popupHideTimeout);
          (window as any).popupHideTimeout = null;
        }
        this.showPostPreview(e.target as HTMLElement);
      });
      
      linkElement.addEventListener('mouseleave', (e) => {
        // Don't hide immediately, give time to move to tooltip
        const relatedTarget = e.relatedTarget as HTMLElement;
        const tooltip = document.querySelector('.popup-post-tooltip');
        
        // If moving to the tooltip, don't hide
        if (tooltip && tooltip.contains(relatedTarget)) {
          return;
        }
        
        // Set a timeout to hide the tooltip
        (window as any).popupHideTimeout = setTimeout(() => {
          this.hidePostPreview();
          (window as any).popupHideTimeout = null;
        }, 200);
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
    const postUrl = (linkElement as HTMLAnchorElement).href;
    
    if (!postUrl) return;
    
    // Process content - convert \\n back to actual line breaks for fallback
    const processedContent = fullContent ? fullContent.replace(/\\n/g, '\n').replace(/\\r/g, '\r') : '';
    
    // Create tooltip with iframe for full post preview
    const tooltip = document.createElement('div');
    tooltip.className = 'popup-post-tooltip';
    
    // Create header
    const headerHTML = `
      <div class="tooltip-header">
        <strong>${title}</strong>
        ${author ? `<span class="tooltip-author">by ${author}</span>` : ''}
      </div>
    `;
    
    // Create iframe content with fallback
    const iframeHTML = `
      <div class="tooltip-iframe-container">
        <div class="iframe-loading">Loading full post...</div>
        <iframe src="${postUrl}" 
                frameborder="0" 
                scrolling="yes"
                allowfullscreen
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-top-navigation"
                style="opacity:0; background: white;"
                onload="this.previousElementSibling.style.display='none'; this.style.opacity='1'; console.log('Popup iframe loaded successfully');"
                onerror="console.log('Popup iframe error'); this.style.display='none'; this.nextElementSibling.style.display='block';">
        </iframe>
        <div class="iframe-fallback" style="display: none;">
          <div class="fallback-header">
            <span class="fallback-notice">Preview unavailable - site blocks embedding</span>
            <button class="view-full-post-btn" onclick="window.open('${postUrl}', '_blank'); event.stopPropagation();">
              📖 View Full Post
            </button>
          </div>
          ${imageUrl && imageUrl !== 'undefined' && imageUrl !== 'null' ? 
            `<div class="tooltip-image">
              <img src="${imageUrl}" alt="Post image" 
                   onload="this.style.opacity='1'" 
                   onerror="this.parentElement.style.display='none'" 
                   style="opacity:0" />
            </div>` : ''}
          <div class="tooltip-content">${processedContent || 'Unable to load post content'}</div>
        </div>
      </div>
    `;
    
    tooltip.innerHTML = headerHTML + iframeHTML;
    
    // Position tooltip relative to popup
    const rect = linkElement.getBoundingClientRect();
    const popupRect = document.body.getBoundingClientRect();
    
    tooltip.style.position = 'fixed';
    tooltip.style.left = `${Math.max(10, rect.left)}px`;
    tooltip.style.top = `${Math.max(10, rect.bottom + 5)}px`;
    tooltip.style.zIndex = '1000';
    
    // Add to popup body
    document.body.appendChild(tooltip);
    
    // Improved hover handling for tooltip
    tooltip.addEventListener('mouseenter', () => {
      // Cancel any pending hide timeouts when entering tooltip
      if ((window as any).popupHideTimeout) {
        clearTimeout((window as any).popupHideTimeout);
        (window as any).popupHideTimeout = null;
      }
    });
    
    tooltip.addEventListener('mouseleave', (e) => {
      // Only hide if mouse is not going back to the original link
      const relatedTarget = e.relatedTarget as HTMLElement;
      const originalLink = document.querySelector(`a.post-reference[href="${postUrl}"]`);
      
      if (!relatedTarget || (!tooltip.contains(relatedTarget) && relatedTarget !== originalLink)) {
        (window as any).popupHideTimeout = setTimeout(() => {
          this.hidePostPreview();
          (window as any).popupHideTimeout = null;
        }, 200);
      }
    });
    
    // Set up iframe error handling after adding to DOM
    const iframe = tooltip.querySelector('iframe') as HTMLIFrameElement;
    const loadingDiv = tooltip.querySelector('.iframe-loading') as HTMLElement;
    const fallbackDiv = tooltip.querySelector('.iframe-fallback') as HTMLElement;
    
    if (iframe && loadingDiv && fallbackDiv) {
      let hasLoaded = false;
      
      // Give iframe more time to load (5 seconds)
      const loadingTimeout = setTimeout(() => {
        if (!hasLoaded) {
          console.log('🔍 Popup iframe timeout - showing fallback content');
          loadingDiv.style.display = 'none';
          iframe.style.display = 'none';
          fallbackDiv.style.display = 'block';
        }
      }, 5000);
      
      // Handle successful iframe load
      iframe.addEventListener('load', () => {
        console.log('🔍 Popup iframe loaded successfully');
        hasLoaded = true;
        clearTimeout(loadingTimeout);
        loadingDiv.style.display = 'none';
        iframe.style.opacity = '1';
      });
      
      // Handle iframe errors (e.g., X-Frame-Options blocking)
      iframe.addEventListener('error', () => {
        console.log('🔍 Popup iframe error - showing fallback content');
        hasLoaded = true;
        clearTimeout(loadingTimeout);
        loadingDiv.style.display = 'none';
        iframe.style.display = 'none';
        fallbackDiv.style.display = 'block';
      });
    }
    
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
      this.chatMessages.innerHTML = '';
      
      // Clean up any lingering tooltips
      this.hidePostPreview();
    }
  }

  showTypingIndicator(): void {
    // Remove any existing typing indicator
    this.hideTypingIndicator();
    
    const typingElement = document.createElement('div');
    typingElement.className = 'message system typing';
    typingElement.id = 'typing-indicator';
    
    // Create animated typing indicator with dots
    typingElement.innerHTML = `
      <div class="typing-content">
        <span class="typing-text">ChatBrowse is thinking</span>
        <div class="typing-dots">
          <span class="dot"></span>
          <span class="dot"></span>
          <span class="dot"></span>
        </div>
      </div>
    `;
    
    this.chatMessages?.appendChild(typingElement);
    this.chatMessages!.scrollTop = this.chatMessages!.scrollHeight;
  }

  hideTypingIndicator(): void {
    const existingIndicator = document.getElementById('typing-indicator');
    if (existingIndicator) {
      existingIndicator.remove();
    }
  }

  showProcessingIndicator(message: string = 'Processing your request'): void {
    // Remove any existing typing indicator
    this.hideTypingIndicator();
    
    const processingElement = document.createElement('div');
    processingElement.className = 'message system processing';
    processingElement.id = 'processing-indicator';
    
    processingElement.innerHTML = `
      <div class="processing-content">
        <div class="processing-spinner"></div>
        <span class="processing-text">${message}</span>
      </div>
    `;
    
    this.chatMessages?.appendChild(processingElement);
    this.chatMessages!.scrollTop = this.chatMessages!.scrollHeight;
  }

  hideProcessingIndicator(): void {
    const existingIndicator = document.getElementById('processing-indicator');
    if (existingIndicator) {
      existingIndicator.remove();
    }
  }

  updateProcessingMessage(message: string): void {
    const indicator = document.getElementById('processing-indicator');
    if (indicator) {
      const textElement = indicator.querySelector('.processing-text');
      if (textElement) {
        textElement.textContent = message;
      }
    }
  }

  setSendButtonLoading(loading: boolean): void {
    if (!this.sendButton) return;
    
    const buttonElement = this.sendButton as HTMLButtonElement;
    
    if (loading) {
      buttonElement.disabled = true;
      buttonElement.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px;">
          <div class="button-spinner"></div>
          <span>Sending...</span>
        </div>
      `;
    } else {
      buttonElement.disabled = false;
      buttonElement.innerHTML = 'Send';
    }
  }

  setInputDisabled(disabled: boolean): void {
    if (!this.userInput) return;
    (this.userInput as HTMLInputElement).disabled = disabled;
  }
}