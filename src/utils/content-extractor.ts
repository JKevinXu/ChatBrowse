import { Readability } from '@mozilla/readability';

/**
 * Extract key information from the current webpage using Mozilla Readability
 */
export function extractPageInfo(): { title: string; url: string; content: string; useAsContext?: boolean } {
  console.log('Extracting page info with Mozilla Readability...');
  
  try {
    const title = document.title || 'Unknown Title';
    const url = window.location.href || 'Unknown URL';
    
    console.log('Page info extraction - title:', title);
    console.log('Page info extraction - URL:', url);
    
    // Clone the document to avoid modifying the original
    const documentClone = document.cloneNode(true) as Document;
    
    // Use Mozilla Readability for intelligent content extraction
    const reader = new Readability(documentClone, {
      charThreshold: 100,  // Minimum characters for content
      classesToPreserve: ['highlight', 'code', 'pre'],  // Preserve important classes
      keepClasses: false,  // Remove most classes for cleaner output
      debug: false
    });
    
    const article = reader.parse();
    
    if (!article || !article.textContent || article.textContent.trim().length < 50) {
      console.log('Readability extraction failed - no meaningful content found');
      return {
        title,
        url,
        content: `Could not extract meaningful content from this page using Readability. The page might not contain article-like content or may have an unusual structure.`
      };
    }
    
    // Use the extracted content from Readability
    let finalContent = article.textContent.trim();
    console.log('Successfully extracted content with Readability, length:', finalContent.length);
    console.log('finalContent', finalContent);
    
    // Add extracted metadata if available
    if (article.byline) {
      finalContent = `Author: ${article.byline}\n\n${finalContent}`;
    }
    if (article.publishedTime) {
      finalContent = `Published: ${article.publishedTime}\n\n${finalContent}`;
    }
    
    console.log(`Extracted page info: Title: ${title}, URL: ${url}, Content length: ${finalContent.length}`);
    console.log('FINAL content being returned:', finalContent);
    return { title, url, content: finalContent };
    
  } catch (error) {
    console.error('Error during Readability extraction:', error);
    return { 
      title: document.title || 'Unknown Title', 
      url: window.location.href || 'Unknown URL', 
      content: `Readability extraction failed: ${error}. This page may not be suitable for content extraction.` 
    };
  }
} 