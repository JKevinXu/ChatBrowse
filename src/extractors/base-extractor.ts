export interface ExtractedPost {
  index: number;
  title: string;
  content: string;
  link: string;
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
   * Extract posts from the current page
   * @param maxPosts Maximum number of posts to extract
   * @returns Extraction result with posts and metadata
   */
  extractPosts(maxPosts: number): ExtractionResult;
  
  /**
   * Check if this extractor can handle the current page
   * @returns true if this extractor can handle the current page
   */
  canHandle(): boolean;
}

export abstract class BaseExtractor implements PlatformExtractor {
  abstract platform: string;
  abstract canHandle(): boolean;
  abstract extractPosts(maxPosts: number): ExtractionResult;
  
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