import { Readability } from '@mozilla/readability';
import { AgGridExtractor } from './ag-grid-extractor';

/**
 * Extract key information from the current webpage using Mozilla Readability
 */
export async function extractPageInfo(): Promise<{ title: string; url: string; content: string; useAsContext?: boolean }> {
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
    
    // Extract ag-Grid tables using the dedicated extractor (now async)
    const agGridExtractor = new AgGridExtractor();
    const agGridContent = await agGridExtractor.extract();
    console.log('agGridContent', agGridContent);
    
    if (!article || !article.textContent || article.textContent.trim().length < 50) {
      console.log('Readability extraction failed - no meaningful content found');
      
      // If Readability fails but we have ag-Grid tables, return those
      if (agGridContent) {
        const fallbackContent = `Could not extract meaningful article content from this page using Readability, but found structured data:${agGridContent}`;
        console.log('==========================================');
        console.log('🎯 [FALLBACK CONTENT] READABILITY FAILED - USING AG-GRID ONLY:');
        console.log('==========================================');
        console.log(`📏 [FALLBACK CONTENT] Total length: ${fallbackContent.length} characters`);
        console.log('🔍 [FALLBACK CONTENT] FULL CONTENT:');
        console.log(fallbackContent);
        console.log('==========================================');
        
        return {
          title,
          url,
          content: fallbackContent
        };
      }
      
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
    
    // Append ag-Grid tables if found
    if (agGridContent) {
      finalContent += agGridContent;
      console.log('✅ [CONTENT] ag-Grid content appended to final content');
      console.log('📊 [CONTENT] ag-Grid content preview:', agGridContent.substring(0, 300) + '...');
    } else {
      console.log('ℹ️ [CONTENT] No ag-Grid content to append');
    }
    
    console.log('==========================================');
    console.log('🎯 [FINAL CONTENT] COMPLETE EXTRACTED CONTENT:');
    console.log('==========================================');
    console.log(`📏 [FINAL CONTENT] Total length: ${finalContent.length} characters`);
    console.log(`📄 [FINAL CONTENT] Content preview (first 500 chars):`);
    console.log(finalContent.substring(0, 500) + (finalContent.length > 500 ? '...' : ''));
    console.log('==========================================');
    console.log('🔍 [FINAL CONTENT] FULL CONTENT:');
    console.log(finalContent);
    console.log('==========================================');
    
    console.log(`Extracted page info: Title: ${title}, URL: ${url}, Content length: ${finalContent.length}`);
    return { title, url, content: finalContent };
    
  } catch (error) {
    console.error('Error during Readability extraction:', error);
    
    // Try to extract just ag-Grid tables as fallback
    try {
      const agGridExtractor = new AgGridExtractor();
      const agGridContent = await agGridExtractor.extract();
      if (agGridContent) {
        const errorFallbackContent = `Readability extraction failed: ${error}. However, found structured data:${agGridContent}`;
        console.log('==========================================');
        console.log('🎯 [ERROR FALLBACK CONTENT] EXTRACTION FAILED - USING AG-GRID ONLY:');
        console.log('==========================================');
        console.log(`📏 [ERROR FALLBACK CONTENT] Total length: ${errorFallbackContent.length} characters`);
        console.log('🔍 [ERROR FALLBACK CONTENT] FULL CONTENT:');
        console.log(errorFallbackContent);
        console.log('==========================================');
        
        return { 
          title: document.title || 'Unknown Title', 
          url: window.location.href || 'Unknown URL', 
          content: errorFallbackContent
        };
      }
    } catch (agGridError) {
      console.error('ag-Grid extraction also failed:', agGridError);
    }
    
    return { 
      title: document.title || 'Unknown Title', 
      url: window.location.href || 'Unknown URL', 
      content: `Readability extraction failed: ${error}. This page may not be suitable for content extraction.` 
    };
  }
} 