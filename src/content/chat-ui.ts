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
    // Create container
    this.chatContainer = document.createElement('div');
    this.chatContainer.className = 'chatbrowse-container';
    
    // Create toggle button with dynamic content
    const toggleButton = document.createElement('div');
    toggleButton.className = 'chatbrowse-toggle';
    if (this.isXiaohongshuPage) {
      toggleButton.classList.add('active'); // Add pulse animation
      toggleButton.innerHTML = '<span class="chatbrowse-icon">🔥</span>';
      toggleButton.title = 'ChatBrowse - Ready to analyze Xiaohongshu!';
    } else {
      toggleButton.innerHTML = '<span class="chatbrowse-icon">💬</span>';
      toggleButton.title = 'ChatBrowse - Your AI browsing assistant';
    }
    toggleButton.addEventListener('click', () => this.toggleChat());
    
    // Create chat panel
    const chatPanel = document.createElement('div');
    chatPanel.className = 'chatbrowse-chat';
    
    // Create header with dynamic title
    const header = document.createElement('div');
    header.className = 'chatbrowse-header';
    const headerTitle = this.isXiaohongshuPage ? 'ChatBrowse - Xiaohongshu' : 'ChatBrowse';
    header.innerHTML = `
      <span>${headerTitle}</span>
      <span class="chatbrowse-close">&times;</span>
    `;
    header.querySelector('.chatbrowse-close')?.addEventListener('click', () => this.toggleChat());
    
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
    tooltip.className = 'chatbrowse-post-tooltip';
    
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
    
    // Position tooltip
    const rect = linkElement.getBoundingClientRect();
    tooltip.style.position = 'fixed';
    tooltip.style.left = `${rect.left}px`;
    tooltip.style.top = `${rect.bottom + 5}px`;
    tooltip.style.zIndex = '10000';
    
    // Add to document
    document.body.appendChild(tooltip);
    
    // Adjust position if tooltip goes off screen
    const tooltipRect = tooltip.getBoundingClientRect();
    if (tooltipRect.right > window.innerWidth) {
      tooltip.style.left = `${window.innerWidth - tooltipRect.width - 10}px`;
    }
    if (tooltipRect.bottom > window.innerHeight) {
      tooltip.style.top = `${rect.top - tooltipRect.height - 5}px`;
    }
    
    // If still off screen (tooltip too tall), position at top of viewport
    const finalRect = tooltip.getBoundingClientRect();
    if (finalRect.top < 0) {
      tooltip.style.top = '10px';
      tooltip.style.maxHeight = `${window.innerHeight - 20}px`;
      tooltip.style.overflowY = 'auto';
    }
  }

  private hidePostPreview(): void {
    const existingTooltip = document.querySelector('.chatbrowse-post-tooltip');
    if (existingTooltip) {
      existingTooltip.remove();
    }
  }

  toggleChat(): void {
    const chatPanel = this.chatContainer?.querySelector('.chatbrowse-chat');
    if (chatPanel) {
      chatPanel.classList.toggle('active');
      
      // If opening chat on Xiaohongshu, show helpful tips
      if (chatPanel.classList.contains('active') && this.isXiaohongshuPage) {
        const messages = document.getElementById('chatbrowse-messages');
        if (messages && messages.children.length <= 1) {
          this.addWelcomeMessage();
        }
      }
    }
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
} 