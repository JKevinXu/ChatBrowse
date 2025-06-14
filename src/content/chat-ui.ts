import { Message, ChatSession } from '../types';
import { createMessage, extractPageInfo } from '../utils';
import { marked } from 'marked';

export class ChatUI {
  private chatContainer: HTMLElement | null = null;
  private currentSession: ChatSession | null = null;
  private onMessageSend?: (message: string) => void;
  private isXiaohongshuPage = false;

  constructor(onMessageSend?: (message: string) => void) {
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

  initialize(session: ChatSession): void {
    this.currentSession = session;
    this.checkPageType();
    this.createChatInterface();
    this.setupEventListeners();
    this.addWelcomeMessage();
  }

  private checkPageType(): void {
    this.isXiaohongshuPage = window.location.href.includes('xiaohongshu.com');
  }

  private addWelcomeMessage(): void {
    if (this.isXiaohongshuPage) {
      const welcomeMessage = createMessage(
        '🎉 **太好了！您现在在小红书上了。**\n\n我可以帮助您：\n\n' +
        '📱 **提取和分析帖子**\n' +
        '🔍 **搜索特定内容**\n' +
        '📊 **总结热门话题**\n\n' +
        '**试试这些命令：**\n' +
        '• `extract xiaohongshu posts`\n' +
        '• `summarize xiaohongshu travel tips`\n' +
        '• `analyze cooking recipes`',
        'system'
      );
      setTimeout(() => this.addMessageToChat(welcomeMessage), 1000);
    }
  }

  private createChatInterface(): void {
    console.log('🔧 ContentScript ChatUI: createChatInterface called');
    
    // Create container
    this.chatContainer = document.createElement('div');
    this.chatContainer.className = 'chatbrowse-container';
    console.log('🔧 ContentScript ChatUI: Created chat container');
    
    // Create toggle button with dynamic content
    const toggleButton = document.createElement('div');
    toggleButton.className = 'chatbrowse-toggle';
    if (this.isXiaohongshuPage) {
      toggleButton.classList.add('active'); // Add pulse animation
      toggleButton.innerHTML = '<span class="chatbrowse-icon">🔥</span>';
      toggleButton.title = 'ChatBrowse - Ready to analyze Xiaohongshu!';
      console.log('🔧 ContentScript ChatUI: Created Xiaohongshu toggle button');
    } else {
      toggleButton.innerHTML = '<span class="chatbrowse-icon">💬</span>';
      toggleButton.title = 'ChatBrowse - Your AI browsing assistant';
      console.log('🔧 ContentScript ChatUI: Created general toggle button');
    }
    toggleButton.addEventListener('click', () => this.toggleChat());
    
    // Create chat panel
    const chatPanel = document.createElement('div');
    chatPanel.className = 'chatbrowse-chat';
    console.log('🔧 ContentScript ChatUI: Created chat panel (hidden by default)');
    
    // Create header with dynamic title and controls
    const header = document.createElement('div');
    header.className = 'chatbrowse-header';
    const headerTitle = this.isXiaohongshuPage ? 'ChatBrowse - Xiaohongshu' : 'ChatBrowse';
    header.innerHTML = `
      <span>${headerTitle}</span>
      <div class="header-controls">
        <span class="chatbrowse-resize-btn" title="Resize window (⤢)">⤢</span>
        <span class="chatbrowse-close" title="Close chat">&times;</span>
      </div>
    `;
    
    // Add event listeners for header controls
    const resizeBtn = header.querySelector('.chatbrowse-resize-btn');
    const closeBtn = header.querySelector('.chatbrowse-close');
    
    if (resizeBtn) {
      resizeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.cycleChatSize(chatPanel);
      });
    }
    
    if (closeBtn) {
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleChat();
      });
    }
    
    // Make header draggable
    this.makeDraggable(chatPanel, header);
    
    // Create messages container
    const messagesContainer = document.createElement('div');
    messagesContainer.className = 'chatbrowse-messages';
    messagesContainer.id = 'chatbrowse-messages';
    
    // Create input area with smart placeholder
    const inputArea = document.createElement('div');
    inputArea.className = 'chatbrowse-input';
    const placeholder = this.isXiaohongshuPage 
      ? "试试：'extract posts' 或 'summarize cooking recipes'"
      : "Type your question or command...";
    inputArea.innerHTML = `
      <input type="text" placeholder="${placeholder}">
      <button>Send</button>
    `;
    console.log('🔧 ContentScript ChatUI: Created input area with placeholder:', placeholder);
    
    // Assemble the chat panel
    chatPanel.appendChild(header);
    chatPanel.appendChild(messagesContainer);
    chatPanel.appendChild(inputArea);
    
    // Add elements to container
    this.chatContainer.appendChild(toggleButton);
    this.chatContainer.appendChild(chatPanel);
    
    // Add to the document
    document.body.appendChild(this.chatContainer);
    console.log('🔧 ContentScript ChatUI: Chat interface added to document body');
    console.log('🔧 ContentScript ChatUI: Toggle button visible, chat panel hidden by default');
    
    // Store size settings
    this.loadChatSize(chatPanel);
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

    // Listen for navigation changes
    this.setupNavigationListeners();
  }

  private setupNavigationListeners(): void {
    // Listen for URL changes (for SPAs)
    let lastUrl = window.location.href;
    new MutationObserver(() => {
      const currentUrl = window.location.href;
      if (currentUrl !== lastUrl) {
        lastUrl = currentUrl;
        this.handleNavigationChange();
      }
    }).observe(document, { subtree: true, childList: true });

    // Listen for popstate events (back/forward navigation)
    window.addEventListener('popstate', () => {
      setTimeout(() => this.handleNavigationChange(), 100);
    });
  }

  private handleNavigationChange(): void {
    const wasXiaohongshuPage = this.isXiaohongshuPage;
    this.checkPageType();
    
    if (this.isXiaohongshuPage && !wasXiaohongshuPage) {
      // Just navigated to Xiaohongshu
      this.updateForXiaohongshu();
      this.addMessageToChat(createMessage(
        '🎉 **完美！** 现在在小红书上。准备帮您分析内容！',
        'system'
      ));
    } else if (!this.isXiaohongshuPage && wasXiaohongshuPage) {
      // Left Xiaohongshu
      this.updateForGeneral();
    }
  }

  private updateForXiaohongshu(): void {
    if (!this.chatContainer) return;
    
    const toggleButton = this.chatContainer.querySelector('.chatbrowse-toggle');
    const header = this.chatContainer.querySelector('.chatbrowse-header span');
    const input = this.chatContainer.querySelector('input') as HTMLInputElement;
    
    if (toggleButton) {
      toggleButton.classList.add('active');
      toggleButton.innerHTML = '<span class="chatbrowse-icon">🔥</span>';
      toggleButton.setAttribute('title', 'ChatBrowse - Ready to analyze Xiaohongshu!');
    }
    
    if (header) {
      header.textContent = 'ChatBrowse - Xiaohongshu';
    }
    
    if (input) {
      input.placeholder = "试试：'extract posts' 或 'summarize cooking recipes'";
    }
  }

  private updateForGeneral(): void {
    if (!this.chatContainer) return;
    
    const toggleButton = this.chatContainer.querySelector('.chatbrowse-toggle');
    const header = this.chatContainer.querySelector('.chatbrowse-header span');
    const input = this.chatContainer.querySelector('input') as HTMLInputElement;
    
    if (toggleButton) {
      toggleButton.classList.remove('active');
      toggleButton.innerHTML = '<span class="chatbrowse-icon">💬</span>';
      toggleButton.setAttribute('title', 'ChatBrowse - Your AI browsing assistant');
    }
    
    if (header) {
      header.textContent = 'ChatBrowse';
    }
    
    if (input) {
      input.placeholder = 'Type your question or command...';
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
    const messagesContainer = document.getElementById('chatbrowse-messages');
    if (!messagesContainer) return;
    
    const messageElement = document.createElement('div');
    messageElement.className = `chatbrowse-message ${message.sender}`;
    
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
    
    messageElement.dataset.timestamp = message.timestamp.toString();
    
    messagesContainer.appendChild(messageElement);
    
    // Add hover functionality for post reference links
    this.setupPostReferenceHovers(messageElement);
    
    // Scroll to bottom
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  private setupPostReferenceHovers(messageElement: HTMLElement): void {
    const postLinks = messageElement.querySelectorAll('a.post-reference');
    
    postLinks.forEach(link => {
      const linkElement = link as HTMLElement;
      
      linkElement.addEventListener('mouseenter', (e) => {
        // Cancel any existing hide timeouts
        if ((window as any).chatBrowseHideTimeout) {
          clearTimeout((window as any).chatBrowseHideTimeout);
          (window as any).chatBrowseHideTimeout = null;
        }
        this.showPostPreview(e.target as HTMLElement);
      });
      
      linkElement.addEventListener('mouseleave', (e) => {
        // Don't hide immediately, give time to move to tooltip
        const relatedTarget = e.relatedTarget as HTMLElement;
        const tooltip = document.querySelector('.chatbrowse-post-tooltip');
        
        // If moving to the tooltip, don't hide
        if (tooltip && tooltip.contains(relatedTarget)) {
          return;
        }
        
        // Set a timeout to hide the tooltip
        (window as any).chatBrowseHideTimeout = setTimeout(() => {
          this.hidePostPreview();
          (window as any).chatBrowseHideTimeout = null;
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
    tooltip.className = 'chatbrowse-post-tooltip';
    
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
                onload="this.previousElementSibling.style.display='none'; this.style.opacity='1'; console.log('Iframe loaded successfully');"
                onerror="console.log('Iframe error'); this.style.display='none'; this.nextElementSibling.style.display='block';">
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
    
    // Position tooltip
    const rect = linkElement.getBoundingClientRect();
    tooltip.style.position = 'fixed';
    tooltip.style.left = `${Math.max(10, rect.left - 200)}px`; // Center better and ensure it fits
    tooltip.style.top = `${Math.max(10, rect.bottom + 5)}px`;
    tooltip.style.zIndex = '10000';
    
    // Add to document
    document.body.appendChild(tooltip);
    
    // Make tooltip draggable by the header
    this.makeDraggable(tooltip, tooltip.querySelector('.tooltip-header') as HTMLElement);
    
    // Improved hover handling for tooltip
    tooltip.addEventListener('mouseenter', () => {
      // Cancel any pending hide timeouts when entering tooltip
      if ((window as any).chatBrowseHideTimeout) {
        clearTimeout((window as any).chatBrowseHideTimeout);
        (window as any).chatBrowseHideTimeout = null;
      }
    });
    
    tooltip.addEventListener('mouseleave', (e) => {
      // Only hide if mouse is not going back to the original link
      const relatedTarget = e.relatedTarget as HTMLElement;
      const originalLink = document.querySelector(`a.post-reference[href="${postUrl}"]`);
      
      if (!relatedTarget || (!tooltip.contains(relatedTarget) && relatedTarget !== originalLink)) {
        (window as any).chatBrowseHideTimeout = setTimeout(() => {
          this.hidePostPreview();
          (window as any).chatBrowseHideTimeout = null;
        }, 200);
      }
    });
    
    // Set up iframe error handling after adding to DOM
    const iframe = tooltip.querySelector('iframe') as HTMLIFrameElement;
    const loadingDiv = tooltip.querySelector('.iframe-loading') as HTMLElement;
    const fallbackDiv = tooltip.querySelector('.iframe-fallback') as HTMLElement;
    
    if (iframe && loadingDiv && fallbackDiv) {
      let hasLoaded = false;
      
      // More aggressive timeout - show fallback after 5 seconds (give iframe more time)
      const loadingTimeout = setTimeout(() => {
        if (!hasLoaded) {
          console.log('🔍 Iframe timeout - showing fallback content');
          loadingDiv.style.display = 'none';
          iframe.style.display = 'none';
          fallbackDiv.style.display = 'block';
        }
      }, 5000);
      
      // Handle successful iframe load
      iframe.addEventListener('load', () => {
        console.log('🔍 Iframe loaded successfully');
        hasLoaded = true;
        clearTimeout(loadingTimeout);
        loadingDiv.style.display = 'none';
        iframe.style.opacity = '1';
      });
      
      // Handle iframe errors (e.g., X-Frame-Options blocking)
      iframe.addEventListener('error', () => {
        console.log('🔍 Iframe error - showing fallback content');
        hasLoaded = true;
        clearTimeout(loadingTimeout);
        loadingDiv.style.display = 'none';
        iframe.style.display = 'none';
        fallbackDiv.style.display = 'block';
      });
    }
    
    // Adjust position if tooltip goes off screen
    setTimeout(() => {
      const tooltipRect = tooltip.getBoundingClientRect();
      if (tooltipRect.right > window.innerWidth) {
        tooltip.style.left = `${window.innerWidth - tooltipRect.width - 10}px`;
      }
      if (tooltipRect.bottom > window.innerHeight) {
        tooltip.style.top = `${Math.max(10, window.innerHeight - tooltipRect.height - 10)}px`;
      }
    }, 100);
  }

  private hidePostPreview(): void {
    const existingTooltip = document.querySelector('.chatbrowse-post-tooltip');
    if (existingTooltip) {
      existingTooltip.remove();
    }
  }

  toggleChat(): void {
    console.log('🔧 ContentScript ChatUI: toggleChat called');
    const chatPanel = this.chatContainer?.querySelector('.chatbrowse-chat');
    if (chatPanel) {
      const wasActive = chatPanel.classList.contains('active');
      chatPanel.classList.toggle('active');
      console.log('🔧 ContentScript ChatUI: Chat panel toggled from', wasActive ? 'active' : 'inactive', 'to', !wasActive ? 'active' : 'inactive');
      
      // If opening chat on Xiaohongshu, show helpful tips
      if (chatPanel.classList.contains('active') && this.isXiaohongshuPage) {
        const messages = document.getElementById('chatbrowse-messages');
        if (messages && messages.children.length <= 1) {
          this.addWelcomeMessage();
        }
      }
    }
  }

  // Method to hide the chat interface (useful when popup is open)
  hideChat(): void {
    console.log('🔧 ContentScript ChatUI: hideChat called');
    const chatPanel = this.chatContainer?.querySelector('.chatbrowse-chat');
    if (chatPanel) {
      chatPanel.classList.remove('active');
      console.log('🔧 ContentScript ChatUI: Chat panel hidden');
    }
  }

  // Method to check if chat is currently visible
  isChatVisible(): boolean {
    const chatPanel = this.chatContainer?.querySelector('.chatbrowse-chat');
    const isVisible = chatPanel?.classList.contains('active') || false;
    console.log('🔧 ContentScript ChatUI: isChatVisible =', isVisible);
    return isVisible;
  }

  clearChat(): void {
    const messagesContainer = document.getElementById('chatbrowse-messages');
    if (messagesContainer) {
      messagesContainer.innerHTML = '';
      
      // Clean up any lingering tooltips
      this.hidePostPreview();
      
      // Add a fresh welcome message
      if (this.isXiaohongshuPage) {
        this.addWelcomeMessage();
      }
    }
  }

  updateSession(session: ChatSession): void {
    this.currentSession = session;
    this.renderMessages();
    
    // Clean up any lingering tooltips when updating session
    this.hidePostPreview();
  }

  private renderMessages(): void {
    if (!this.currentSession) return;

    this.clearChat();
    
    this.currentSession.messages.forEach(message => {
      this.addMessageToChat(message);
    });
  }

  private makeDraggable(element: HTMLElement, header: HTMLElement): void {
    let isDragging = false;
    let offsetX = 0;
    let offsetY = 0;

    header.addEventListener('mousedown', (e) => {
      // Don't drag if clicking on control buttons
      if ((e.target as HTMLElement).classList.contains('chatbrowse-resize-btn') || 
          (e.target as HTMLElement).classList.contains('chatbrowse-close')) {
        return;
      }
      
      isDragging = true;
      offsetX = e.clientX - element.getBoundingClientRect().left;
      offsetY = e.clientY - element.getBoundingClientRect().top;
      element.style.cursor = 'move';
      document.body.style.userSelect = 'none';
    });

    document.addEventListener('mousemove', (e) => {
      if (isDragging) {
        const x = e.clientX - offsetX;
        const y = e.clientY - offsetY;
        
        // Keep window within viewport bounds
        const maxX = window.innerWidth - element.offsetWidth;
        const maxY = window.innerHeight - element.offsetHeight;
        
        const finalX = Math.max(0, Math.min(maxX, x));
        const finalY = Math.max(0, Math.min(maxY, y));
        
        element.style.left = `${finalX}px`;
        element.style.top = `${finalY}px`;
        element.style.right = 'auto';
        element.style.bottom = 'auto';
      }
    });

    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        element.style.cursor = 'default';
        document.body.style.userSelect = 'auto';
        
        // Save the final position
        const rect = element.getBoundingClientRect();
        this.saveChatPosition(rect.left, rect.top);
      }
    });
  }

  private cycleChatSize(chatPanel: HTMLElement): void {
    const currentWidth = chatPanel.offsetWidth;
    const currentHeight = chatPanel.offsetHeight;
    
    // Define size presets: [width, height]
    const sizePresets = [
      [400, 500],   // Small
      [450, 600],   // Default
      [550, 700],   // Large
      [650, 750]    // Extra Large
    ];
    
    // Find current preset or closest match
    let currentPresetIndex = 1; // Default to medium
    for (let i = 0; i < sizePresets.length; i++) {
      const [width, height] = sizePresets[i];
      if (Math.abs(currentWidth - width) < 50 && Math.abs(currentHeight - height) < 50) {
        currentPresetIndex = i;
        break;
      }
    }
    
    // Cycle to next preset
    const nextPresetIndex = (currentPresetIndex + 1) % sizePresets.length;
    const [newWidth, newHeight] = sizePresets[nextPresetIndex];
    
    // Apply new size
    chatPanel.style.width = `${newWidth}px`;
    chatPanel.style.height = `${newHeight}px`;
    
    // Save the size
    this.saveChatSize(newWidth, newHeight);
  }

  private loadChatSize(chatPanel: HTMLElement): void {
    const savedSize = localStorage.getItem('chatbrowse-size');
    if (savedSize) {
      try {
        const { width, height } = JSON.parse(savedSize);
        chatPanel.style.width = `${width}px`;
        chatPanel.style.height = `${height}px`;
      } catch (error) {
        console.log('Failed to load saved chat size:', error);
      }
    }
    
    // Also load saved position
    const savedPosition = localStorage.getItem('chatbrowse-position');
    if (savedPosition) {
      try {
        const { left, top } = JSON.parse(savedPosition);
        chatPanel.style.left = `${left}px`;
        chatPanel.style.top = `${top}px`;
        chatPanel.style.right = 'auto';
        chatPanel.style.bottom = 'auto';
      } catch (error) {
        console.log('Failed to load saved chat position:', error);
      }
    }
  }

  private saveChatSize(width: number, height: number): void {
    try {
      localStorage.setItem('chatbrowse-size', JSON.stringify({ width, height }));
    } catch (error) {
      console.log('Failed to save chat size:', error);
    }
  }

  private saveChatPosition(left: number, top: number): void {
    try {
      localStorage.setItem('chatbrowse-position', JSON.stringify({ left, top }));
    } catch (error) {
      console.log('Failed to save chat position:', error);
    }
  }

  showTypingIndicator(): void {
    // Remove any existing typing indicator
    this.hideTypingIndicator();
    
    const messagesContainer = document.getElementById('chatbrowse-messages');
    if (!messagesContainer) return;
    
    const typingElement = document.createElement('div');
    typingElement.className = 'chatbrowse-message system typing';
    typingElement.id = 'chatbrowse-typing-indicator';
    
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
    
    messagesContainer.appendChild(typingElement);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  hideTypingIndicator(): void {
    const existingIndicator = document.getElementById('chatbrowse-typing-indicator');
    if (existingIndicator) {
      existingIndicator.remove();
    }
  }

  showProcessingIndicator(message: string = 'Processing your request'): void {
    // Remove any existing typing indicator
    this.hideTypingIndicator();
    
    const messagesContainer = document.getElementById('chatbrowse-messages');
    if (!messagesContainer) return;
    
    const processingElement = document.createElement('div');
    processingElement.className = 'chatbrowse-message system processing';
    processingElement.id = 'chatbrowse-processing-indicator';
    
    processingElement.innerHTML = `
      <div class="processing-content">
        <div class="processing-spinner"></div>
        <span class="processing-text">${message}</span>
      </div>
    `;
    
    messagesContainer.appendChild(processingElement);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  hideProcessingIndicator(): void {
    const existingIndicator = document.getElementById('chatbrowse-processing-indicator');
    if (existingIndicator) {
      existingIndicator.remove();
    }
  }

  updateProcessingMessage(message: string): void {
    const indicator = document.getElementById('chatbrowse-processing-indicator');
    if (indicator) {
      const textElement = indicator.querySelector('.processing-text');
      if (textElement) {
        textElement.textContent = message;
      }
    }
  }
}