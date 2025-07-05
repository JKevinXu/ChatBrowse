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
    
    // Create summarize button with dynamic content
    const summarizeButton = document.createElement('div');
    summarizeButton.className = 'chatbrowse-toggle';
    if (this.isXiaohongshuPage) {
      summarizeButton.classList.add('active'); // Add pulse animation
      summarizeButton.innerHTML = '<span class="chatbrowse-icon">🔥</span>';
      summarizeButton.title = 'ChatBrowse - Summarize Xiaohongshu page!';
      console.log('🔧 ContentScript ChatUI: Created Xiaohongshu summarize button');
    } else {
      summarizeButton.innerHTML = '<span class="chatbrowse-icon">📄</span>';
      summarizeButton.title = 'ChatBrowse - Summarize this page';
      console.log('🔧 ContentScript ChatUI: Created general summarize button');
    }
    summarizeButton.addEventListener('click', () => this.openPopupAndSummarize());
    
    // Add button to container
    this.chatContainer.appendChild(summarizeButton);
    
    // Add to the document
    document.body.appendChild(this.chatContainer);
    console.log('🔧 ContentScript ChatUI: Summarize button added to document body');
  }

  private setupEventListeners(): void {
    // No longer needed since we're not using in-page chat interface
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
      this.revertFromXiaohongshu();
    }
  }

  private updateForXiaohongshu(): void {
    if (!this.chatContainer) return;
    
    const summarizeButton = this.chatContainer.querySelector('.chatbrowse-toggle');
    
    if (summarizeButton) {
      summarizeButton.classList.add('active');
      summarizeButton.innerHTML = '<span class="chatbrowse-icon">🔥</span>';
      summarizeButton.setAttribute('title', 'ChatBrowse - Summarize Xiaohongshu page!');
    }
  }

  private revertFromXiaohongshu(): void {
    if (!this.chatContainer) return;
    
    const summarizeButton = this.chatContainer.querySelector('.chatbrowse-toggle');
    
    if (summarizeButton) {
      summarizeButton.classList.remove('active');
      summarizeButton.innerHTML = '<span class="chatbrowse-icon">📄</span>';
      summarizeButton.setAttribute('title', 'ChatBrowse - Summarize this page');
    }
  }

  addMessageToChat(message: Message): void {
    // No longer needed since we're not using in-page chat interface
    // This is a no-op to prevent errors from existing code
  }

  private setupPostReferenceHovers(messageElement: HTMLElement): void {
    // No longer needed since we're not using in-page chat interface
  }

  private showPostPreview(linkElement: HTMLElement): void {
    // No longer needed since we're not using in-page chat interface
  }

  private hidePostPreview(): void {
    // No longer needed since we're not using in-page chat interface
  }

  updateSession(session: ChatSession): void {
    this.currentSession = session;
  }

  showTypingIndicator(): void {
    // No longer needed since we're not using in-page chat interface
    // This is a no-op to prevent errors from existing code
  }

  hideTypingIndicator(): void {
    // No longer needed since we're not using in-page chat interface
    // This is a no-op to prevent errors from existing code
  }

  showProcessingIndicator(message: string = 'Processing your request'): void {
    // No longer needed since we're not using in-page chat interface
    // This is a no-op to prevent errors from existing code
  }

  hideProcessingIndicator(): void {
    // No longer needed since we're not using in-page chat interface
    // This is a no-op to prevent errors from existing code
  }

  private renderMessages(): void {
    // No longer needed since we're not using in-page chat interface
  }

  // No longer needed - removing makeDraggable method
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

  // No longer needed - removing chat size and position methods
  private cycleChatSize(chatPanel: HTMLElement): void {
    const sizeClasses = ['size-default', 'size-medium', 'size-large'];
    const currentClass = sizeClasses.find(cls => chatPanel.classList.contains(cls));
    
    if (currentClass) {
      chatPanel.classList.remove(currentClass);
    }
    
    const currentIndex = currentClass ? sizeClasses.indexOf(currentClass) : 0;
    const nextIndex = (currentIndex + 1) % sizeClasses.length;
    const nextClass = sizeClasses[nextIndex];
    
    chatPanel.classList.add(nextClass);
    
    // Get actual dimensions after class change
    const rect = chatPanel.getBoundingClientRect();
    this.saveChatSize(rect.width, rect.height);
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

  updateProcessingMessage(message: string): void {
    const indicator = document.getElementById('chatbrowse-processing-indicator');
    if (indicator) {
      const textElement = indicator.querySelector('.processing-text');
      if (textElement) {
        textElement.textContent = message;
      }
    }
  }

  openPopupAndSummarize(): void {
    console.log('🔧 ContentScript ChatUI: openPopupAndSummarize called');
    
    // Send message to background script to open popup and trigger auto-summarization
    chrome.runtime.sendMessage({
      type: 'OPEN_POPUP_AND_SUMMARIZE',
      payload: {
        url: window.location.href,
        title: document.title
      }
    }, (response) => {
      if (response && response.error) {
        console.error('❌ ContentScript ChatUI: Error opening popup:', response.error);
      } else {
        console.log('✅ ContentScript ChatUI: Popup open request sent successfully');
      }
    });
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
}