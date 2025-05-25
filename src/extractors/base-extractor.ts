export interface ExtractedPost {
  index: number;
  title: string;
  content: string;
  link: string;
  image?: string;
  metadata?: {
    author?: string;
    publishDate?: string;
    viewCount?: string;
    likeCount?: string;
    tags?: string[];
  };
}

export interface ExtractionResult {
  posts: ExtractedPost[];
  totalFound: number;
  pageUrl: string;
  pageTitle: string;
  platform: string;
}

export interface PlatformExtractor {
  platform: string;
  
  /**
   * Extract posts from the current page (synchronous)
   * @param maxPosts Maximum number of posts to extract
   * @param fetchFullContent Whether to fetch full content from individual post links
   * @returns Extraction result with posts and metadata
   */
  extractPosts(maxPosts: number, fetchFullContent?: boolean): ExtractionResult;
  
  /**
   * Extract posts from the current page (asynchronous with rate limiting)
   * @param maxPosts Maximum number of posts to extract
   * @param fetchFullContent Whether to fetch full content from individual post links
   * @returns Promise of extraction result with posts and metadata
   */
  extractPostsAsync?(maxPosts: number, fetchFullContent?: boolean): Promise<ExtractionResult>;
  
  /**
   * Check if this extractor can handle the current page
   * @returns true if this extractor can handle the current page
   */
  canHandle(): boolean;
}

export abstract class BaseExtractor implements PlatformExtractor {
  abstract platform: string;
  abstract canHandle(): boolean;
  abstract extractPosts(maxPosts: number, fetchFullContent?: boolean): ExtractionResult;
  
  // Optional async method for rate-limited extraction
  async extractPostsAsync?(maxPosts: number, fetchFullContent?: boolean): Promise<ExtractionResult> {
    // Default implementation falls back to sync method
    return this.extractPosts(maxPosts, fetchFullContent);
  }
  
  protected logDebug(message: string, ...args: any[]): void {
    console.log(`🐛 ${this.platform.toUpperCase()} EXTRACTOR:`, message, ...args);
  }
  
  protected cleanText(text: string): string {
    return text
      .replace(/\s+/g, ' ')
      .replace(/\t/g, ' ')
      .trim();
  }
  
  protected removeUINoise(text: string): string {
    return text
      .replace(/^(点赞|收藏|评论|分享|关注|取消关注)\s*\d*/g, '')
      .replace(/\s*(点赞|收藏|评论|分享|关注|取消关注)\s*\d*$/g, '')
      .replace(/^\d+$/g, '')
      .trim();
  }
} 