import { PlatformExtractor } from './base-extractor';
import { XiaohongshuExtractor } from './xiaohongshu-extractor';

export class ExtractorFactory {
  private static extractors: PlatformExtractor[] = [
    new XiaohongshuExtractor(),
    // Add more extractors here as needed:
    // new WeiboExtractor(),
    // new TwitterExtractor(),
    // new RedditExtractor(),
  ];

  /**
   * Get the appropriate extractor for the current page
   * @returns PlatformExtractor that can handle the current page, or null if none found
   */
  static getExtractor(): PlatformExtractor | null {
    for (const extractor of this.extractors) {
      if (extractor.canHandle()) {
        console.log(`🚀 Using ${extractor.platform} extractor for current page`);
        return extractor;
      }
    }
    
    console.log('❌ No suitable extractor found for current page');
    return null;
  }

  /**
   * Get extractor by platform name
   * @param platform Platform name
   * @returns PlatformExtractor for the specified platform, or null if not found
   */
  static getExtractorByPlatform(platform: string): PlatformExtractor | null {
    const extractor = this.extractors.find(e => e.platform === platform);
    return extractor || null;
  }

  /**
   * Get list of all supported platforms
   * @returns Array of platform names
   */
  static getSupportedPlatforms(): string[] {
    return this.extractors.map(e => e.platform);
  }

  /**
   * Check if a platform is supported
   * @param platform Platform name
   * @returns true if platform is supported
   */
  static isPlatformSupported(platform: string): boolean {
    return this.extractors.some(e => e.platform === platform);
  }
} 