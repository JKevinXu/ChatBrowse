import { Message, ChatSession } from '../types';
import { createMessage } from '../utils';
import { marked } from 'marked';

export class PopupUI {
  private chatMessages: HTMLElement | null = null;
  private userInput: HTMLInputElement | null = null;
  private sendButton: HTMLElement | null = null;
  private settingsButton: HTMLElement | null = null;
  private newConversationButton: HTMLElement | null = null;
  private resizeButton: HTMLElement | null = null;
  private summarizeButton: HTMLElement | null = null;
  private toolDropdownButton: HTMLElement | null = null;
  private toolDropdownMenu: HTMLElement | null = null;
  private selectedTool: string = 'none';
  private onMessageSend?: (text: string) => void;
  private onSettingsClick?: () => void;
  private onNewConversation?: () => void;
  private onSummarizePage?: () => void;

  constructor(
    onMessageSend?: (text: string) => void,
    onSettingsClick?: () => void,
    onNewConversation?: () => void,
    onSummarizePage?: () => void
  ) {
    this.onMessageSend = onMessageSend;
    this.onSettingsClick = onSettingsClick;
    this.onNewConversation = onNewConversation;
    this.onSummarizePage = onSummarizePage;
    this.setupMarked();
    this.initialize();
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
    this.loadWindowSize();
    this.loadSelectedTool();
  }

  private setupDOMElements(): void {
    this.chatMessages = document.getElementById('chatMessages');
    this.userInput = document.getElementById('userInput') as HTMLInputElement;
    this.sendButton = document.getElementById('sendButton');
    this.settingsButton = document.getElementById('settingsButton');
    this.newConversationButton = document.getElementById('newConversationButton');
    this.resizeButton = document.getElementById('resizeButton');
    this.summarizeButton = document.getElementById('summarizeButton');
    this.toolDropdownButton = document.getElementById('toolDropdownButton');
    this.toolDropdownMenu = document.getElementById('toolDropdownMenu');
  }

  private setupEventListeners(): void {
    this.sendButton?.addEventListener('click', () => this.handleSendMessage());
    
    this.userInput?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.handleSendMessage();
      }
    });

    this.settingsButton?.addEventListener('click', () => {
      if (this.onSettingsClick) {
        this.onSettingsClick();
      }
    });

    this.newConversationButton?.addEventListener('click', () => {
      if (this.onNewConversation) {
        this.onNewConversation();
      }
    });

    this.summarizeButton?.addEventListener('click', () => {
      if (this.onSummarizePage) {
        this.onSummarizePage();
      }
    });

    this.resizeButton?.addEventListener('click', () => {
      this.cycleWindowSize();
    });

    // Tool dropdown event listeners
    this.setupToolDropdownListeners();

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (this.toolDropdownButton && this.toolDropdownMenu) {
        if (!this.toolDropdownButton.contains(e.target as Node) && 
            !this.toolDropdownMenu.contains(e.target as Node)) {
          this.closeToolDropdown();
        }
      }
    });
  }

  private setupToolDropdownListeners(): void {
    // Toggle dropdown menu
    this.toolDropdownButton?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleToolDropdown();
    });

    // Handle tool selection
    this.toolDropdownMenu?.addEventListener('click', (e) => {
      const toolOption = (e.target as HTMLElement).closest('.tool-option');
      if (toolOption) {
        const toolType = toolOption.getAttribute('data-tool');
        if (toolType) {
          this.selectTool(toolType);
          this.closeToolDropdown();
        }
      }
    });
  }

  private toggleToolDropdown(): void {
    if (!this.toolDropdownMenu || !this.toolDropdownButton) return;
    
    const isOpen = this.toolDropdownMenu.classList.contains('show');
    if (isOpen) {
      this.closeToolDropdown();
    } else {
      this.openToolDropdown();
    }
  }

  private openToolDropdown(): void {
    if (!this.toolDropdownMenu || !this.toolDropdownButton) return;
    
    this.toolDropdownMenu.classList.add('show');
    this.toolDropdownButton.classList.add('open');
  }

  private closeToolDropdown(): void {
    if (!this.toolDropdownMenu || !this.toolDropdownButton) return;
    
    this.toolDropdownMenu.classList.remove('show');
    this.toolDropdownButton.classList.remove('open');
  }

  private selectTool(toolType: string): void {
    console.log('🔧 PopupUI: Tool selected:', toolType);
    this.selectedTool = toolType;
    
    // Update button appearance and text
    this.updateToolButtonDisplay();
    
    // Update selected option in menu
    this.updateToolMenuSelection();
    
    // Save selection to localStorage
    this.saveSelectedTool();

    // Update input placeholder based on selected tool
    this.updateInputPlaceholder();
  }

  private updateToolButtonDisplay(): void {
    if (!this.toolDropdownButton) return;
    
    const toolIcon = this.toolDropdownButton.querySelector('.tool-icon') as HTMLElement;
    const toolIconImage = this.toolDropdownButton.querySelector('.tool-icon-image') as HTMLImageElement;
    const toolText = this.toolDropdownButton.querySelector('.tool-text');
    
    if (this.selectedTool === 'xiaohongshu') {
      // Hide emoji, show custom image
      if (toolIcon) toolIcon.style.display = 'none';
      if (toolIconImage) toolIconImage.style.display = 'inline-block';
      if (toolText) toolText.textContent = 'XHS';
      this.toolDropdownButton.classList.add('active');
      this.toolDropdownButton.title = 'Using Xiaohongshu tool';
    } else {
      // Show emoji, hide custom image
      if (toolIcon) {
        toolIcon.textContent = '🧰';
        toolIcon.style.display = 'inline-block';
      }
      if (toolIconImage) toolIconImage.style.display = 'none';
      if (toolText) toolText.textContent = 'Tool';
      this.toolDropdownButton.classList.remove('active');
      this.toolDropdownButton.title = 'Select tool';
    }
  }

  private updateToolMenuSelection(): void {
    if (!this.toolDropdownMenu) return;
    
    // Remove previous selection
    const previousSelected = this.toolDropdownMenu.querySelector('.tool-option.selected');
    if (previousSelected) {
      previousSelected.classList.remove('selected');
    }
    
    // Add selection to current tool
    const currentOption = this.toolDropdownMenu.querySelector(`[data-tool="${this.selectedTool}"]`);
    if (currentOption) {
      currentOption.classList.add('selected');
    }
  }

  private updateInputPlaceholder(): void {
    if (!this.userInput) return;
    
    if (this.selectedTool === 'xiaohongshu') {
      this.userInput.placeholder = 'Ask about Xiaohongshu content or search...';
    } else {
      this.userInput.placeholder = 'Type your question or command...';
    }
  }

  private saveSelectedTool(): void {
    try {
      localStorage.setItem('chatbrowse-selected-tool', this.selectedTool);
    } catch (error) {
      console.log('Failed to save selected tool:', error);
    }
  }

  private loadSelectedTool(): void {
    try {
      const savedTool = localStorage.getItem('chatbrowse-selected-tool');
      if (savedTool && (savedTool === 'none' || savedTool === 'xiaohongshu')) {
        this.selectTool(savedTool);
      }
    } catch (error) {
      console.log('Failed to load selected tool:', error);
    }
  }

  private handleSendMessage(): void {
    console.log('🔧 PopupUI: handleSendMessage called');
    if (!this.userInput) return;
    
    const text = this.userInput.value.trim();
    if (!text) return;
    
    console.log('🔧 PopupUI: User input text:', text);
    console.log('🔧 PopupUI: Selected tool:', this.selectedTool);
    
    // Modify the message based on selected tool
    let finalMessage = text;
    if (this.selectedTool === 'xiaohongshu') {
      // Check if the message already contains xiaohongshu context
      const hasXiaohongshuContext = /xiaohongshu|小红书|xhs/i.test(text);
      
      if (!hasXiaohongshuContext) {
        // Add xiaohongshu context to the message
        if (text.toLowerCase().includes('search')) {
          finalMessage = `xiaohongshu ${text}`;
        } else if (text.toLowerCase().includes('extract') || text.toLowerCase().includes('get posts')) {
          finalMessage = `extract xiaohongshu posts: ${text}`;
        } else {
          finalMessage = `xiaohongshu: ${text}`;
        }
      }
    }
    
    console.log('🔧 PopupUI: Final message:', finalMessage);
    
    // Clear input
    this.userInput.value = '';
    console.log('🔧 PopupUI: Input cleared');
    
    // Notify parent (PopupApp will handle adding the message to chat)
    if (this.onMessageSend) {
      console.log('🔧 PopupUI: Calling onMessageSend callback');
      this.onMessageSend(finalMessage);
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
      timestamp: message.timestamp,
      latency: message.latency
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
    
    // Add latency indicator for system messages
    if (message.sender === 'system' && message.latency !== undefined) {
      const latencyIndicator = document.createElement('div');
      latencyIndicator.className = 'message-latency';
      
      // Format latency nicely
      const formattedLatency = this.formatLatency(message.latency);
      latencyIndicator.textContent = `⏱️ ${formattedLatency}`;
      latencyIndicator.title = `Response time: ${message.latency}ms`;
      
      messageElement.appendChild(latencyIndicator);
    }
    
    messageElement.dataset.id = message.id;
    
    this.chatMessages.appendChild(messageElement);
    console.log('✅ PopupUI: Message added to chat DOM');
    
    // Add hover functionality for post reference links
    this.setupPostReferenceHovers(messageElement);
    
    // Scroll to the bottom
    this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
  }

  private formatLatency(latency: number): string {
    if (latency < 1000) {
      return `${latency}ms`;
    } else if (latency < 60000) {
      return `${(latency / 1000).toFixed(1)}s`;
    } else {
      const minutes = Math.floor(latency / 60000);
      const seconds = Math.floor((latency % 60000) / 1000);
      return `${minutes}m ${seconds}s`;
    }
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

  setInputValue(value: string): void {
    if (!this.userInput) return;
    (this.userInput as HTMLInputElement).value = value;
  }

  triggerSendMessage(): void {
    this.handleSendMessage();
  }

  private cycleWindowSize(): void {
    // Define size preset classes
    const sizeClasses = ['size-default', 'size-large'];
    
    // Get current size class
    const currentClass = sizeClasses.find(cls => document.body.classList.contains(cls));
    const currentIndex = currentClass ? sizeClasses.indexOf(currentClass) : 0;
    
    // Remove current size class
    if (currentClass) {
      document.body.classList.remove(currentClass);
    }
    
    // Cycle to next preset
    const nextIndex = (currentIndex + 1) % sizeClasses.length;
    const nextClass = sizeClasses[nextIndex];
    
    // Apply new size class
    document.body.classList.add(nextClass);
    
    // Save the size class preference
    this.saveSizeClass(nextClass);
  }

  private loadWindowSize(): void {
    const savedSizeClass = localStorage.getItem('chatbrowse-popup-size-class');
    if (savedSizeClass && ['size-default', 'size-large'].includes(savedSizeClass)) {
      // Remove any existing size classes
      document.body.classList.remove('size-default', 'size-large');
      // Apply saved size class
      document.body.classList.add(savedSizeClass);
    } else {
      // Default to size-default if no saved preference
      document.body.classList.add('size-default');
    }
  }

  private saveSizeClass(sizeClass: string): void {
    try {
      localStorage.setItem('chatbrowse-popup-size-class', sizeClass);
    } catch (error) {
      console.log('Failed to save popup size class:', error);
    }
  }

  private saveWindowSize(width: number, height: number): void {
    // This method is now deprecated in favor of saveSizeClass
    // Keeping for backward compatibility but not used
    try {
      localStorage.setItem('chatbrowse-popup-size', JSON.stringify({ width, height }));
    } catch (error) {
      console.log('Failed to save popup size:', error);
    }
  }
}