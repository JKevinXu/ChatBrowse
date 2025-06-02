import { BaseExtractor, ExtractionResult, ExtractedPost } from './base-extractor';

export class GoogleExtractor extends BaseExtractor {
  platform = 'google';

  canHandle(): boolean {
    return window.location.hostname.includes('google.com') && 
           window.location.pathname.includes('/search');
  }

  extractPosts(maxPosts: number = 5, fetchFullContent: boolean = false): ExtractionResult {
    this.logDebug('🔍 Starting Google search results extraction');
    this.logDebug('📊 Max posts:', maxPosts, 'Fetch full content:', fetchFullContent);
    
    const posts: ExtractedPost[] = [];
    
    // Google search result selectors (multiple fallbacks for different layouts)
    const resultSelectors = [
      'div[data-header-feature] div[data-content-feature="1"]', // New Google layout
      'div.g:has(h3)', // Standard organic results
      'div[class*="g"]:has(h3)', // Alternative organic results
      'div.yuRUbf', // Some Google layouts
      '.g', // Classic selector
      '[data-header-feature] > div > div', // Featured snippets area
    ];

    let resultElements: Element[] = [];
    
    // Try different selectors to find search results
    for (const selector of resultSelectors) {
      this.logDebug('Trying selector:', selector);
      const elements = Array.from(document.querySelectorAll(selector));
      this.logDebug('Found elements:', elements.length);
      
      if (elements.length > 0) {
        // Filter out ads and non-organic results
        resultElements = elements.filter(el => {
          const text = el.textContent || '';
          const hasTitle = el.querySelector('h3, h2, h1');
          const hasLink = el.querySelector('a[href]');
          const isAd = el.closest('[data-text-ad]') || 
                      el.querySelector('[data-text-ad]') ||
                      text.includes('广告') || 
                      text.includes('Ad') ||
                      text.includes('Sponsored');
          
          return hasTitle && hasLink && !isAd && text.length > 30;
        });
        
        this.logDebug('Filtered to', resultElements.length, 'organic results with selector:', selector);
        if (resultElements.length > 0) {
          break;
        }
      }
    }

    // Fallback: try to find any clickable results with titles
    if (resultElements.length === 0) {
      this.logDebug('No specific selectors worked, trying generic approach');
      resultElements = Array.from(document.querySelectorAll('div, article, section'))
        .filter(el => {
          const hasTitle = el.querySelector('h3, h2, h1');
          const hasLink = el.querySelector('a[href*="://"]');
          const text = el.textContent || '';
          const isAd = text.includes('广告') || text.includes('Ad') || text.includes('Sponsored');
          
          return hasTitle && hasLink && !isAd && text.length > 50 && text.length < 2000;
        });
      this.logDebug('Generic approach found:', resultElements.length, 'results');
    }

    this.logDebug('Final resultElements count:', resultElements.length);

    // Extract top results
    resultElements.slice(0, maxPosts).forEach((result, index) => {
      this.logDebug('Processing result', index + 1);
      
      const extractedResult = this.extractSingleResult(result, index + 1);
      if (extractedResult) {
        posts.push(extractedResult);
        this.logDebug('Result', index + 1, 'added to results');
      } else {
        this.logDebug('Result', index + 1, 'skipped');
      }
    });

    const extractionResult: ExtractionResult = {
      posts,
      totalFound: resultElements.length,
      pageUrl: window.location.href,
      pageTitle: document.title,
      platform: this.platform
    };
    
    this.logDebug('Final extraction result:', extractionResult);
    return extractionResult;
  }

  private extractSingleResult(result: Element, index: number): ExtractedPost | null {
    this.logDebug('🔍 Extracting single result', index);
    
    try {
      // Extract title
      const title = this.extractTitle(result);
      if (!title) {
        this.logDebug('❌ No title found for result', index);
        return null;
      }

      // Extract link
      const link = this.extractLink(result);
      if (!link) {
        this.logDebug('❌ No link found for result', index);
        return null;
      }

      // Extract content/snippet
      const content = this.extractContent(result);

      // Extract metadata
      const metadata = this.extractMetadata(result);

      const extractedPost: ExtractedPost = {
        index,
        title: this.cleanText(title),
        content: this.cleanText(content),
        link: link,
        metadata
      };

      this.logDebug('✅ Successfully extracted result', index, ':', title.substring(0, 50) + '...');
      return extractedPost;

    } catch (error) {
      this.logDebug('❌ Error extracting result', index, ':', error);
      return null;
    }
  }

  private extractTitle(result: Element): string {
    // Try multiple selectors for title
    const titleSelectors = [
      'h3', // Most common
      'h2', 
      'h1',
      '[role="heading"]',
      'a h3',
      'a[data-testid="result-title-a"] h3',
      'div[role="heading"]'
    ];

    for (const selector of titleSelectors) {
      const titleElement = result.querySelector(selector);
      if (titleElement?.textContent?.trim()) {
        return titleElement.textContent.trim();
      }
    }

    // Fallback: look for clickable text that looks like a title
    const links = Array.from(result.querySelectorAll('a[href]'));
    for (const link of links) {
      const text = link.textContent?.trim();
      if (text && text.length > 10 && text.length < 200 && !text.includes('http')) {
        return text;
      }
    }

    return '';
  }

  private extractLink(result: Element): string {
    // Try to find the main result link
    const linkSelectors = [
      'h3 a[href]',
      'h2 a[href]',
      'h1 a[href]',
      'a[data-testid="result-title-a"]',
      'a[href*="://"]'
    ];

    for (const selector of linkSelectors) {
      const linkElement = result.querySelector(selector) as HTMLAnchorElement;
      if (linkElement?.href && !linkElement.href.includes('google.com/search')) {
        return linkElement.href;
      }
    }

    // Fallback: find any external link
    const allLinks = Array.from(result.querySelectorAll('a[href]')) as HTMLAnchorElement[];
    for (const link of allLinks) {
      if (link.href && 
          !link.href.includes('google.com') && 
          !link.href.includes('javascript:') && 
          (link.href.startsWith('http://') || link.href.startsWith('https://'))) {
        return link.href;
      }
    }

    return '';
  }

  private extractContent(result: Element): string {
    // Try to find the snippet/description
    const contentSelectors = [
      '[data-content-feature="1"] span', // New Google layout
      '.VwiC3b', // Classic snippet
      '[data-sncf]', // Some layouts
      '.s3v9rd', // Alternative snippet
      '.st', // Older layout
      'span[data-toggle-trigger="true"]', // Some snippets
      '.aCOpRe', // Featured snippet content
      'div:not([class]):not([id]) span', // Generic spans in result
    ];

    for (const selector of contentSelectors) {
      const contentElement = result.querySelector(selector);
      if (contentElement?.textContent?.trim()) {
        const text = contentElement.textContent.trim();
        if (text.length > 20 && text.length < 1000) {
          return text;
        }
      }
    }

    // Fallback: extract text from the entire result but clean it up
    const fullText = result.textContent || '';
    
    // Remove title and URL from the text
    const title = this.extractTitle(result);
    const url = this.extractLink(result);
    
    let cleanedText = fullText;
    if (title) {
      cleanedText = cleanedText.replace(title, '');
    }
    if (url) {
      const urlParts = url.split('/');
      const domain = urlParts[2];
      if (domain) {
        cleanedText = cleanedText.replace(new RegExp(domain, 'g'), '');
      }
    }
    
    // Clean up and return a reasonable snippet
    cleanedText = this.cleanText(cleanedText);
    cleanedText = cleanedText.replace(/^https?:\/\/[^\s]+/g, ''); // Remove URLs
    cleanedText = cleanedText.replace(/\d{4}年\d{1,2}月\d{1,2}日/g, ''); // Remove Chinese dates
    cleanedText = cleanedText.replace(/\d{1,2}\/\d{1,2}\/\d{4}/g, ''); // Remove dates
    
    return cleanedText.substring(0, 300);
  }

  private extractMetadata(result: Element): any {
    const metadata: any = {};
    
    // Try to extract published date
    const dateElements = Array.from(result.querySelectorAll('span, div'));
    for (const element of dateElements) {
      const text = element.textContent?.trim();
      if (text) {
        // Look for date patterns
        if (text.match(/\d{4}年\d{1,2}月\d{1,2}日/) || 
            text.match(/\d{1,2}\/\d{1,2}\/\d{4}/) ||
            text.match(/\d{1,2} \w+ \d{4}/)) {
          metadata.publishDate = text;
          break;
        }
      }
    }
    
    // Try to extract source/domain
    const link = this.extractLink(result);
    if (link) {
      try {
        const url = new URL(link);
        metadata.source = url.hostname.replace('www.', '');
      } catch (e) {
        // Invalid URL, ignore
      }
    }
    
    return Object.keys(metadata).length > 0 ? metadata : undefined;
  }
} 