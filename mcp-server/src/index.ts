/**
 * Simplified MCP Server Implementation for ChatBrowse
 * This server provides web browsing capabilities through Playwright
 */

import { chromium, Browser, Page } from 'playwright-chromium';

// Track browser instances
let browser: Browser | null = null;
let page: Page | null = null;

// Interface for browse_webpage parameters
interface BrowseParams {
  url: string;
  selector?: string;
}

// Interface for google_search parameters
interface GoogleSearchParams {
  query: string;
}

// Interface for bilibili_search parameters
interface BilibiliSearchParams {
  query: string;
}

// Response structure
interface ToolResponse {
  success: boolean;
  content?: any;
  title?: string;
  url?: string;
  error?: string;
}

// Initialize browser function
async function ensureBrowser(): Promise<Page> {
  if (!browser) {
    try {
      browser = await chromium.launch({ headless: false });
      page = await browser.newPage();
    } catch (error) {
      console.error('Failed to initialize browser:', error);
      throw error;
    }
  }
  
  if (!page || page.isClosed()) {
    page = await browser.newPage();
  }
  
  return page;
}

// Simple MCP request handler
async function handleRequest(request: any): Promise<any> {
  // Process tool call
  if (request.method === 'tool' && request.params) {
    const { name, parameters } = request.params;
    
    if (name === 'browse_webpage') {
      return handleBrowseWebpage(parameters);
    } else if (name === 'google_search') {
      return handleGoogleSearch(parameters);
    } else if (name === 'bilibili_search') {
      return handleBilibiliSearch(parameters);
    } else {
      return {
        success: false,
        error: `Unknown tool: ${name}`
      };
    }
  }
  
  return {
    success: false,
    error: 'Invalid request format'
  };
}

// Tool: Browse webpage
async function handleBrowseWebpage(params: BrowseParams): Promise<ToolResponse> {
  try {
    const page = await ensureBrowser();
    
    // Navigate to the page
    await page.goto(params.url, { waitUntil: 'domcontentloaded' });
    
    // Extract content
    let content;
    if (params.selector) {
      content = await page.textContent(params.selector) || '';
    } else {
      content = await page.evaluate(() => {
        return {
          title: document.title,
          text: document.body.innerText.slice(0, 5000),
          url: window.location.href
        };
      });
    }
    
    return {
      success: true,
      content,
      url: page.url(),
      title: await page.title()
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: `Failed to browse webpage: ${errorMessage}`
    };
  }
}

// New Tool: Google Search
async function handleGoogleSearch(params: GoogleSearchParams): Promise<ToolResponse> {
  try {
    const page = await ensureBrowser();
    const query = params.query;

    if (!query) {
      return {
        success: false,
        error: 'Google search query is missing.'
      };
    }

    // Navigate to Google
    await page.goto('https://www.google.com', { waitUntil: 'domcontentloaded' });

    // Type the search query
    const searchInputSelector = 'textarea[name="q"]';
    await page.waitForSelector(searchInputSelector, { state: 'visible' });
    await page.fill(searchInputSelector, query);

    // Submit the search (by pressing Enter)
    await page.press(searchInputSelector, 'Enter');

    // Wait for search results to load
    await page.waitForLoadState('domcontentloaded');
    // It might be beneficial to wait for a specific element that indicates results are loaded,
    // e.g., await page.waitForSelector('#search'); or similar, for robustness.

    // Extract content (similar to browseWebpage)
    const content = await page.evaluate(() => {
      return {
        title: document.title,
        text: document.body.innerText.slice(0, 5000), // Get a snippet of the results page
        url: window.location.href
      };
    });

    return {
      success: true,
      content,
      url: page.url(),
      title: await page.title()
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: `Failed to perform Google search: ${errorMessage}`
    };
  }
}

// New Tool: Bilibili Search
async function handleBilibiliSearch(params: BilibiliSearchParams): Promise<ToolResponse> {
  try {
    const page = await ensureBrowser();
    const query = params.query;

    if (!query) {
      return {
        success: false,
        error: 'Bilibili search query is missing.'
      };
    }

    // Navigate to Bilibili
    await page.goto('https://www.bilibili.com/', { waitUntil: 'domcontentloaded' });

    // Type the search query
    const searchInputSelector = 'input.nav-search-input';
    await page.waitForSelector(searchInputSelector, { state: 'visible' });
    await page.fill(searchInputSelector, query);

    // Submit the search (by pressing Enter in the input field)
    await page.press(searchInputSelector, 'Enter');

    // Wait for search results to load
    await page.waitForLoadState('domcontentloaded');
    // Consider waiting for a specific results container element for more robustness

    // Extract content
    const content = await page.evaluate(() => {
      return {
        title: document.title,
        text: document.body.innerText.slice(0, 5000), // Snippet of results page
        url: window.location.href
      };
    });

    return {
      success: true,
      content,
      url: page.url(),
      title: await page.title()
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: `Failed to perform Bilibili search: ${errorMessage}`
    };
  }
}

// Process stdin/stdout communication
function setupCommunication(): void {
  // Read lines from stdin
  process.stdin.on('data', async (data: Buffer) => {
    try {
      const request = JSON.parse(data.toString().trim());
      const response = await handleRequest(request);
      process.stdout.write(JSON.stringify(response) + '\n');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      process.stdout.write(JSON.stringify({
        success: false,
        error: `Request processing failed: ${errorMessage}`
      }) + '\n');
    }
  });
}

// Clean up resources on exit
process.on('exit', async () => {
  if (browser) {
    await browser.close();
  }
});

// Start the server
async function main(): Promise<void> {
  try {
    console.log('ChatBrowse MCP Server starting...');
    setupCommunication();
    console.log('ChatBrowse MCP Server ready to accept requests');
  } catch (error) {
    console.error('Failed to start MCP Server:', error);
    process.exit(1);
  }
}

// Run the server
main(); 