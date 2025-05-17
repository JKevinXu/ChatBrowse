/**
 * Type declarations for external modules
 */

declare module 'playwright-chromium' {
  import type { Page, Browser } from 'playwright';
  import * as playwright from 'playwright';
  
  // Re-export types from playwright
  export type { Page, Browser };
  
  // Export chromium object
  export const chromium: {
    launch(options?: any): Promise<Browser>;
  };
}

// Add any other type declarations needed for the project 