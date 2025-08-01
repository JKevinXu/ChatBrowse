/**
 * Xiaohongshu Configuration
 * Centralized configuration for Xiaohongshu extraction and rate limiting
 */

export interface XiaohongshuConfig {
  // Rate limiting settings
  rateLimitDelay: number; // milliseconds between requests
  maxArticlesPerBatch: number; // maximum articles to extract per batch
  
  // Default extraction settings
  defaultMaxPosts: number; // default number of posts to extract
  defaultFetchFullContent: boolean; // whether to fetch full content by default
  
  // Page load timing
  pageLoadWaitTime: number; // milliseconds to wait for page to load before extraction
}

export const XIAOHONGSHU_CONFIG: XiaohongshuConfig = {
  // Rate limiting settings
  rateLimitDelay: 2000, // 2 seconds between requests - optimized timing
  maxArticlesPerBatch: 5, // Maximum 5 articles per batch
  
  // Default extraction settings
  defaultMaxPosts: 5, // default number of posts to extract
  defaultFetchFullContent: true, // whether to fetch full content by default - optimized for auto-analysis
  
  // Page load timing
  pageLoadWaitTime: 5000, // 5 seconds for page to load - increased for better reliability
};

/**
 * Get Xiaohongshu configuration with optional overrides
 */
export function getXiaohongshuConfig(overrides?: Partial<XiaohongshuConfig>): XiaohongshuConfig {
  return { ...XIAOHONGSHU_CONFIG, ...overrides };
}

/**
 * Validate Xiaohongshu configuration
 */
export function validateXiaohongshuConfig(config: XiaohongshuConfig): boolean {
  return (
    config.rateLimitDelay >= 0 &&
    config.maxArticlesPerBatch > 0 &&
    config.defaultMaxPosts > 0 &&
    config.pageLoadWaitTime >= 0
  );
} 