import { BaseExtractor, ExtractionResult, ExtractedPost } from './base-extractor';

export class XiaohongshuExtractor extends BaseExtractor {
  platform = 'xiaohongshu';

  canHandle(): boolean {
    return window.location.hostname.includes('xiaohongshu.com');
  }

  extractPosts(maxPosts: number = 5): ExtractionResult {
    this.logDebug('Starting post extraction, maxPosts:', maxPosts);
    
    const posts: ExtractedPost[] = [];
    
    // Try different selectors to find posts
    const postSelectors = [
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
      
      const extractedPost = this.extractSinglePost(post, index + 1);
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

  private extractSinglePost(post: Element, index: number): ExtractedPost | null {
    // Extract title
    const title = this.extractTitle(post, index);
    
    // Extract content
    const content = this.extractContent(post);
    
    // Extract link
    const link = this.extractLink(post);
    
    // Extract metadata
    const metadata = this.extractMetadata(post);
    
    this.logDebug('Post', index, 'title:', title.slice(0, 50));
    this.logDebug('Post', index, 'content length:', content.length);
    this.logDebug('Post', index, 'content preview:', content.slice(0, 100));
    
    if (content.length > 10) {
      return {
        index,
        title: title.slice(0, 200),
        content,
        link,
        metadata
      };
    }
    
    return null;
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

  private extractContent(post: Element): string {
    let content = '';
    
    // Method 1: Try specific Xiaohongshu content selectors
    const xiaohongshuSelectors = [
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
        if (content.length > 100) {
          break;
        }
      }
    }
    
    // Method 2: Search result page extraction
    if (content.length < 100) {
      content = this.extractFromSearchResults(post);
    }
    
    // Method 3: Aggressive extraction as fallback
    if (content.length < 50) {
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

  private extractLink(post: Element): string {
    const linkElement = post.querySelector('a[href]');
    return linkElement?.getAttribute('href') || '';
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