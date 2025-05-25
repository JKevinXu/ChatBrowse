import { BaseExtractor, ExtractionResult, ExtractedPost } from './base-extractor';

export class XiaohongshuExtractor extends BaseExtractor {
  platform = 'xiaohongshu';

  canHandle(): boolean {
    return window.location.hostname.includes('xiaohongshu.com');
  }

  extractPosts(maxPosts: number = 5, fetchFullContent: boolean = false): ExtractionResult {
    this.logDebug('Starting post extraction, maxPosts:', maxPosts, 'fetchFullContent:', fetchFullContent);
    
    const posts: ExtractedPost[] = [];
    
    // Try different selectors to find posts
    const postSelectors = [
      'section[class*="note-item"]', // Based on user's HTML
      'section[class*="note"]',
      'article[class*="note"]', 
      'div[class*="note-item"]',
      'div[class*="feed-item"]',
      'a[class*="note"]',
      '.note-item',
      '.feed-item'
    ];

    let postElements: Element[] = [];
    
    // Try different selectors to find posts
    for (const selector of postSelectors) {
      this.logDebug('Trying selector:', selector);
      const elements = Array.from(document.querySelectorAll(selector));
      this.logDebug('Found elements:', elements.length);
      if (elements.length > 0) {
        postElements = elements;
        this.logDebug('Using selector:', selector, 'Found:', elements.length);
        break;
      }
    }

    // If no specific selectors work, try generic approaches
    if (postElements.length === 0) {
      this.logDebug('No specific selectors worked, trying generic approach');
      postElements = Array.from(document.querySelectorAll('article, section, [class*="card"], [class*="item"]'))
        .filter(el => {
          const text = el.textContent || '';
          return text.length > 50;
        });
      this.logDebug('Generic approach found:', postElements.length);
    }

    this.logDebug('Final postElements count:', postElements.length);

    // Extract top posts
    postElements.slice(0, maxPosts).forEach((post, index) => {
      this.logDebug('Processing post', index + 1);
      
      const extractedPost = this.extractSinglePost(post, index + 1, fetchFullContent);
      if (extractedPost) {
        posts.push(extractedPost);
        this.logDebug('Post', index + 1, 'added to results');
      } else {
        this.logDebug('Post', index + 1, 'skipped');
      }
    });

    const result: ExtractionResult = {
      posts,
      totalFound: postElements.length,
      pageUrl: window.location.href,
      pageTitle: document.title,
      platform: this.platform
    };
    
    this.logDebug('Final extraction result:', result);
    return result;
  }

  private extractSinglePost(post: Element, index: number, fetchFullContent: boolean = false): ExtractedPost | null {
    // Extract title
    const title = this.extractTitle(post, index);
    
    // Extract link (enhanced to get proper post URLs)
    const link = this.extractPostLink(post);
    
    // Extract content (preview or full based on flag)
    const content = fetchFullContent ? 
      this.extractFullContentFromLink(link) : 
      this.extractPreviewContent(post);
    
    // Extract metadata
    const metadata = this.extractMetadata(post);
    
    this.logDebug('Post', index, 'title:', title.slice(0, 50));
    this.logDebug('Post', index, 'link:', link);
    this.logDebug('Post', index, 'content length:', content.length);
    this.logDebug('Post', index, 'content preview:', content.slice(0, 100));
    
    if (content.length > 10) {
      return {
        index,
        title: title.slice(0, 200),
        content,
        link: this.makeAbsoluteUrl(link),
        metadata
      };
    }
    
    return null;
  }

  private extractPostLink(post: Element): string {
    // Enhanced link extraction based on user's HTML structure
    const linkSelectors = [
      'a.cover[href*="/search_result/"]', // Search result links
      'a[href*="/explore/"]', // Explore links
      'a.title[href]', // Title links
      'a[href*="/notes/"]', // Notes links
      'a[href]' // Any link as fallback
    ];
    
    for (const selector of linkSelectors) {
      const linkElement = post.querySelector(selector) as HTMLAnchorElement;
      if (linkElement?.href) {
        this.logDebug('Found link with selector:', selector, 'URL:', linkElement.href);
        return linkElement.href;
      }
    }
    
    // Try to find href attribute in any element
    const anyElementWithHref = post.querySelector('[href]') as HTMLElement;
    if (anyElementWithHref?.getAttribute('href')) {
      return anyElementWithHref.getAttribute('href') || '';
    }
    
    return '';
  }

  private extractFullContentFromLink(postUrl: string): string {
    // For content script context, we can't directly fetch other pages
    // This will be handled by the background script opening individual post tabs
    this.logDebug('Full content extraction requested for:', postUrl);
    return '[FETCH_FULL_CONTENT]' + postUrl; // Special marker for background script
  }

  // Method to extract full content when already on a post detail page
  extractFullPostContent(): string {
    this.logDebug('Extracting full content from post detail page');
    
    // Selectors for full post content on detail pages
    const fullContentSelectors = [
      '#detail-desc .note-text', // Main content area
      '.note-text', // Alternative content area
      '.content', // Generic content
      '[class*="content"]', // Any element with "content" in class
      '.desc', // Description area
      'main', // Main content area
      'article' // Article content
    ];
    
    let fullContent = '';
    
    for (const selector of fullContentSelectors) {
      const contentElement = document.querySelector(selector);
      if (contentElement) {
        // Get all text content, handling spans and nested elements
        const textContent = this.extractTextFromElement(contentElement);
        if (textContent && textContent.length > fullContent.length) {
          fullContent = textContent;
          this.logDebug('Found longer content with selector:', selector, 'length:', textContent.length);
        }
      }
    }
    
    // Clean and format the content
    if (fullContent) {
      fullContent = this.cleanText(fullContent);
      fullContent = this.removeUINoise(fullContent);
      // Remove common UI text that might appear in posts
      fullContent = fullContent.replace(/^(点赞|收藏|评论|分享|关注|取消关注)\s*/g, '');
      fullContent = fullContent.replace(/\s*(点赞|收藏|评论|分享|关注|取消关注)\s*$/g, '');
    }
    
    return fullContent || '[No content found on this page]';
  }
  
  private extractTextFromElement(element: Element): string {
    // Extract text while preserving structure and handling nested elements
    const textNodes: string[] = [];
    
    const walker = document.createTreeWalker(
      element,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: function(node) {
          const parent = node.parentElement;
          // Skip text in script, style, or hidden elements
          if (parent && (
            parent.tagName === 'SCRIPT' || 
            parent.tagName === 'STYLE' ||
            parent.style.display === 'none' ||
            parent.style.visibility === 'hidden'
          )) {
            return NodeFilter.FILTER_REJECT;
          }
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );
    
    let textNode;
    while (textNode = walker.nextNode()) {
      const text = textNode.textContent?.trim();
      if (text && text.length > 3) {
        textNodes.push(text);
      }
    }
    
    return textNodes.join(' ').trim();
  }

  private extractPreviewContent(post: Element): string {
    // This is the existing preview content extraction logic
    let content = '';
    
    // Method 1: Try specific Xiaohongshu content selectors
    const xiaohongshuSelectors = [
      '.title span', // Based on user's HTML: <span>Python学不会的就疯狂去蹭这几位老师的课！</span>
      '#detail-desc .note-text span',
      '.desc .note-text span', 
      '.note-text span',
      '#detail-desc .note-text',
      '.desc .note-text',
      '.note-text',
      '#detail-desc',
      '.desc'
    ];
    
    for (const selector of xiaohongshuSelectors) {
      const contentElement = post.querySelector(selector);
      if (contentElement) {
        content = this.extractFromContentElement(contentElement, selector);
        this.logDebug('Found content with selector:', selector, 'length:', content.length);
        if (content.length > 20) { // Lower threshold for preview
          break;
        }
      }
    }
    
    // Method 2: Search result page extraction
    if (content.length < 50) {
      content = this.extractFromSearchResults(post);
    }
    
    // Method 3: Aggressive extraction as fallback
    if (content.length < 20) {
      content = this.extractAggressively(post);
    }
    
    // Clean up the content
    if (content) {
      content = this.cleanText(content);
      content = this.removeUINoise(content);
      content = content.replace(/\s+\d+$/, ''); // Remove trailing numbers
      content = content.slice(0, 800); // Limit length
    }
    
    return content;
  }

  private makeAbsoluteUrl(url: string): string {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    if (url.startsWith('/')) {
      return 'https://www.xiaohongshu.com' + url;
    }
    return url;
  }

  private extractTitle(post: Element, index: number): string {
    const titleSelectors = [
      'h1', 'h2', 'h3', 'h4',
      '[class*="title"]', 
      '[class*="header"]',
      '[class*="name"]',
      'a[title]',
      '.note-title',
      '.feed-title',
      '[class*="text"]'
    ];
    
    for (const selector of titleSelectors) {
      const titleElement = post.querySelector(selector);
      if (titleElement?.textContent?.trim()) {
        const titleText = titleElement.textContent.trim();
        if (titleText.length > 5 && titleText.length < 200) {
          return titleText;
        }
      }
    }
    
    return `Post ${index}`;
  }

  private extractFromContentElement(contentElement: Element, selector: string): string {
    if (selector.includes('span')) {
      const spans = contentElement.parentElement?.querySelectorAll('span');
      if (spans && spans.length > 0) {
        const mainSpan = Array.from(spans).find(span => {
          const text = span.textContent?.trim();
          return text && text.length > 50 && !span.querySelector('a');
        });
        if (mainSpan) {
          return mainSpan.textContent?.trim() || '';
        }
      }
      return contentElement.textContent?.trim() || '';
    } else {
      // For parent elements, try to get only text content, not tags
      const textNodes: string[] = [];
      const walker = document.createTreeWalker(
        contentElement,
        NodeFilter.SHOW_TEXT,
        {
          acceptNode: function(node) {
            const parent = node.parentElement;
            if (parent?.tagName === 'A' && parent.classList.contains('tag')) {
              return NodeFilter.FILTER_REJECT;
            }
            return NodeFilter.FILTER_ACCEPT;
          }
        }
      );
      
      let textNode;
      while (textNode = walker.nextNode()) {
        const text = textNode.textContent?.trim();
        if (text && text.length > 5) {
          textNodes.push(text);
        }
      }
      
      return textNodes.join(' ').trim();
    }
  }

  private extractFromSearchResults(post: Element): string {
    this.logDebug('Extracting from search results');
    
    const searchResultSelectors = [
      '[class*="content"]',
      '[class*="text"]', 
      '[class*="desc"]',
      '[class*="summary"]',
      '[class*="note"]',
      '[class*="feed"]',
      '[class*="card"]',
      '[class*="item"]',
      'p',
      'div',
      'span'
    ];
    
    const potentialContents: string[] = [];
    
    for (const selector of searchResultSelectors) {
      const elements = post.querySelectorAll(selector);
      Array.from(elements).forEach(element => {
        const text = element.textContent?.trim();
        if (text && text.length > 30 && text.length < 1000) {
          const hasWords = (text.match(/[\u4e00-\u9fa5]{2,}|[a-zA-Z]{3,}/g) || []).length > 3;
          if (hasWords) {
            potentialContents.push(text);
          }
        }
      });
    }
    
    // Remove duplicates and find the longest meaningful content
    const uniqueContents = potentialContents.filter((text, index, arr) => {
      return arr.findIndex(other => 
        other.includes(text) || text.includes(other)
      ) === index;
    });
    
    this.logDebug('Found', uniqueContents.length, 'potential content pieces');
    
    // Pick the longest meaningful content
    return uniqueContents.reduce((longest, current) => {
      return current.length > longest.length ? current : longest;
    }, '');
  }

  private extractAggressively(post: Element): string {
    this.logDebug('Trying aggressive extraction');
    
    const getAllTextNodes = (element: Element): string[] => {
      const texts: string[] = [];
      const walker = document.createTreeWalker(
        element,
        NodeFilter.SHOW_TEXT,
        null
      );
      
      let node;
      while (node = walker.nextNode()) {
        const text = node.textContent?.trim();
        if (text && text.length > 5) {
          texts.push(text);
        }
      }
      return texts;
    };
    
    const allTexts = getAllTextNodes(post);
    this.logDebug('Found', allTexts.length, 'text nodes');
    
    const meaningfulTexts = allTexts.filter(text => {
      return text.length > 10 && 
             !/^\d+$/.test(text) && 
             !/^(点赞|收藏|评论|分享|关注)/.test(text);
    });
    
    return meaningfulTexts.join(' ');
  }

  private extractMetadata(post: Element): any {
    // Try to extract additional metadata like author, view count, etc.
    const metadata: any = {};
    
    // Try to find author
    const authorSelectors = ['[class*="author"]', '[class*="user"]', '[class*="name"]'];
    for (const selector of authorSelectors) {
      const authorElement = post.querySelector(selector);
      if (authorElement?.textContent?.trim()) {
        metadata.author = authorElement.textContent.trim();
        break;
      }
    }
    
    // Try to find view/like counts
    const countElements = post.querySelectorAll('[class*="count"], [class*="num"]');
    Array.from(countElements).forEach(element => {
      const text = element.textContent?.trim();
      if (text?.match(/\d+/)) {
        if (text.includes('万') || text.includes('千')) {
          metadata.viewCount = text;
        }
      }
    });
    
    return Object.keys(metadata).length > 0 ? metadata : undefined;
  }
} 