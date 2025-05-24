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

// Interface for xiaohongshu_search parameters
interface XiaohongshuSearchParams {
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
    } else if (name === 'xiaohongshu_search') {
      return handleXiaohongshuSearch(parameters);
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

// New Tool: Xiaohongshu Search
async function handleXiaohongshuSearch(params: XiaohongshuSearchParams): Promise<ToolResponse> {
  try {
    const page = await ensureBrowser();
    const query = params.query;

    if (!query) {
      return {
        success: false,
        error: 'Xiaohongshu search query is missing.'
      };
    }

    // Navigate to Xiaohongshu explore page
    await page.goto('https://www.xiaohongshu.com/explore', { waitUntil: 'domcontentloaded' });

    // Check if login is required
    const loginRequired = await page.evaluate(() => {
      // Check for common login indicators
      const loginButton = document.querySelector('.login-btn, .sign-in, [class*="login"], [href*="login"]');
      const loginModal = document.querySelector('.login-modal, .auth-modal, [class*="login-modal"]');
      const loginRedirect = window.location.href.includes('login') || window.location.href.includes('signin');
      
      return !!(loginButton || loginModal || loginRedirect);
    });

    if (loginRequired) {
      return {
        success: false,
        error: 'Xiaohongshu requires login. Please log in manually in the browser window that opened, then try your search again.',
        url: page.url(),
        title: await page.title()
      };
    }

    // Look for search input with multiple possible selectors
    const searchSelectors = [
      'input#search-input',
      'input[placeholder*="搜索"]',
      'input[placeholder*="search"]',
      '.search-input input',
      '[class*="search"] input'
    ];

    let searchInputSelector = null;
    for (const selector of searchSelectors) {
      try {
        await page.waitForSelector(selector, { state: 'visible', timeout: 2000 });
        searchInputSelector = selector;
        break;
      } catch (e) {
        // Continue to next selector
      }
    }

    if (!searchInputSelector) {
      return {
        success: false,
        error: 'Could not find search input on Xiaohongshu. The page structure may have changed or login may be required.',
        url: page.url(),
        title: await page.title()
      };
    }

    // Type the search query
    await page.fill(searchInputSelector, query);

    // Submit the search (by pressing Enter in the input field)
    await page.press(searchInputSelector, 'Enter');

    // Wait for search results to load
    await page.waitForLoadState('domcontentloaded');
    
    // Wait a bit more for dynamic content to load
    await page.waitForTimeout(3000);

    // Check if we got redirected to login page after search
    const currentUrl = page.url();
    if (currentUrl.includes('login') || currentUrl.includes('signin')) {
      return {
        success: false,
        error: 'Xiaohongshu redirected to login page. Please log in manually and try again.',
        url: currentUrl,
        title: await page.title()
      };
    }

    // Extract top 5 posts from search results
    const posts = await page.evaluate(() => {
      // Common selectors for Xiaohongshu posts
      const postSelectors = [
        'section[class*="note"]',
        'article[class*="note"]',
        'div[class*="note-item"]',
        'div[class*="feed-item"]',
        'a[class*="note"]'
      ];

      let postElements: Element[] = [];
      
      // Try different selectors to find posts
      for (const selector of postSelectors) {
        const elements = Array.from(document.querySelectorAll(selector));
        if (elements.length > 0) {
          postElements = elements;
          break;
        }
      }

      // If no specific post elements found, try generic article/section elements
      if (postElements.length === 0) {
        postElements = Array.from(document.querySelectorAll('article, section, [class*="card"], [class*="item"]'))
          .filter(el => {
            const text = el.textContent || '';
            const hasMinText = text.length > 50;
            const hasLink = el.querySelector('a[href*="/discovery/item/"]') || el.querySelector('a[href*="/explore/"]');
            return hasMinText || hasLink;
          });
      }

      // Extract content from top 5 posts
      const extractedPosts = postElements.slice(0, 5).map((post, index) => {
        const titleElement = post.querySelector('h1, h2, h3, [class*="title"], [class*="header"]');
        const title = titleElement?.textContent?.trim() || `Post ${index + 1}`;
        
        const contentElement = post.querySelector('p, [class*="content"], [class*="text"], [class*="desc"]');
        let content = contentElement?.textContent?.trim() || '';
        
        // If no specific content found, get general text from the post
        if (!content) {
          content = post.textContent?.trim().slice(0, 200) || 'No content available';
        }
        
        // Clean up content - remove excessive whitespace
        content = content.replace(/\s+/g, ' ').slice(0, 300);
        
        const linkElement = post.querySelector('a[href]');
        const link = linkElement?.getAttribute('href') || '';
        
        // Extract image if available
        const imageElement = post.querySelector('img[src]');
        const image = imageElement?.getAttribute('src') || '';
        
        return {
          index: index + 1,
          title: title.slice(0, 100),
          content: content,
          link: link,
          image: image,
          hasContent: content.length > 10
        };
      }).filter(post => post.hasContent);

      return {
        posts: extractedPosts,
        totalFound: postElements.length,
        pageUrl: window.location.href,
        pageTitle: document.title
      };
    });

    // Prepare the response with extracted posts
    const content = {
      title: await page.title(),
      url: page.url(),
      query: query,
      posts: posts.posts,
      totalPostsFound: posts.totalFound,
      extractedCount: posts.posts.length,
      summary: `Found ${posts.totalFound} posts for "${query}". Extracted top ${posts.posts.length} posts for summarization.`
    };

    return {
      success: true,
      content,
      url: page.url(),
      title: `Xiaohongshu Search: ${query} (${posts.posts.length} posts extracted)`
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: `Failed to perform Xiaohongshu search: ${errorMessage}. This might be due to login requirements.`
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