/**
 * Extract key information from the current webpage
 */
export function extractPageInfo(): { title: string; url: string; content: string; useAsContext?: boolean } {
  console.log('Extracting page info...');
  
  try {
    // Always ensure we have a fallback for title and URL
    const title = document.title || 'Unknown Title';
    const url = window.location.href || 'Unknown URL';
    
    console.log('Page info extraction - title:', title);
    console.log('Page info extraction - URL:', url);
    
    // Get the main content of the page with multiple extraction strategies
    let content = '';
    
    // Strategy 1: Use document.body as a fallback
    if (document.body) {
      content = document.body.innerText || '';
      console.log('Initial content length from body:', content.length);
    }
    
    // Strategy 2: Try to find main content containers (prioritized)
    const mainContentSelectors = [
      'main', 'article', '#content', '.content', 
      '#main', '.main', '.article', 'section',
      '[role="main"]', '[data-testid="post-content"]',
      '.post-content', '.article-content', '.entry-content'
    ];
    
    for (const selector of mainContentSelectors) {
      const element = document.querySelector(selector);
      if (element && element.textContent && element.textContent.trim().length > 100) {
        content = element.textContent.trim();
        console.log(`Found content in ${selector}, length:`, content.length);
        break;
      }
    }
    
    // Strategy 3: Extract all paragraphs
    const paragraphs = Array.from(document.querySelectorAll('p')).map(p => p.textContent?.trim()).filter(Boolean);
    if (paragraphs.length > 2) { // At least 3 paragraphs to be considered real content
      const paragraphText = paragraphs.join('\n\n');
      if (paragraphText.length > 200 && (content.length < 100 || paragraphText.length > content.length * 0.5)) {
        content = paragraphText;
        console.log('Using paragraph content, length:', content.length);
      }
    }
    
    // Strategy 4: Try to extract article text using heuristics
    if (content.length < 200) {
      // Clone body to avoid modifying the actual page
      const bodyClone = document.body.cloneNode(true) as HTMLElement;
      
      // Remove non-content elements
      const elementsToRemove = ['header', 'footer', 'nav', '.nav', '.navigation', '.menu', 
                               'aside', '.sidebar', '#sidebar', '.ads', '.advertisement', 
                               'script', 'style', 'noscript', 'iframe', '#header', '#footer'];
      
      for (const selector of elementsToRemove) {
        bodyClone.querySelectorAll(selector).forEach(el => el.remove());
      }
      
      const cleanedText = bodyClone.innerText || '';
      if (cleanedText.length > content.length * 0.7) {
        content = cleanedText;
        console.log('Using cleaned body content, length:', content.length);
      }
    }
    
    // If we still don't have any content, try textContent as a last resort
    if (!content || content.length < 50) {
      content = document.body.textContent?.trim() || 'No content found';
      console.log('Using body textContent as fallback, length:', content.length);
    }
    
    // Make sure content isn't too large or empty
    let finalContent = content;
    if (!content || content.trim().length === 0) {
      finalContent = `No content could be extracted from this page (${title}).`;
      console.log('No valid content found, using placeholder');
    } else {
      // Limit content length
      const maxLength = 4000; // Increased from 3000 to capture more content
      if (finalContent.length > maxLength) {
        finalContent = finalContent.substring(0, maxLength) + '...';
        console.log(`Content truncated to ${maxLength} characters`);
      }
    }
    
    console.log(`Extracted page info: Title: ${title}, URL: ${url}, Content length: ${finalContent.length}`);
    return { title, url, content: finalContent };
  } catch (error) {
    console.error('Error extracting page info:', error);
    // Return basic info even if extraction fails
    return { 
      title: document.title || 'Unknown Title', 
      url: window.location.href || 'Unknown URL', 
      content: `Content extraction failed (${error}). Please try refreshing the page.` 
    };
  }
} 