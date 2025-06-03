/**
 * AgGridExtractor - A utility class for extracting data from ag-Grid tables
 * Handles various scenarios including iframes, cross-origin restrictions, and async loading
 */
export class AgGridExtractor {
  private readonly AG_GRID_SELECTORS = [
    '.ag-root-wrapper',
    '.ag-root',
    '[class*="ag-theme-"]',
    '.ag-theme-alpine',
    '.ag-theme-balham',
    '.ag-theme-material',
    '.ag-theme-fresh',
    '.ag-theme-dark',
    '.ag-theme-blue',
    '.ag-theme-bootstrap',
    'ag-grid-angular',
    '[ag-grid]',
    '.ag-header',
    '.ag-body-viewport',
    '[class*="ag-grid"]'
  ];

  private readonly CODE_SELECTORS = [
    'pre code',
    '.code code',
    'pre.language-ts',
    'pre.language-typescript',
    'pre.language-javascript',
    'pre.language-js',
    '.highlight code',
    '.code-example code'
  ];

  /**
   * Extract ag-Grid table data from the current page and any accessible iframes
   */
  public async extract(): Promise<string> {
    console.log('🔍 [ag-Grid] Starting comprehensive ag-Grid table extraction...');
    
    let allTablesContent = '';
    
    // First, check the main document
    const mainPageContent = this.extractFromDocument(document, 'main page');
    if (mainPageContent) {
      allTablesContent += mainPageContent;
    }
    
    // Then check all accessible iframes
    const iframes = document.querySelectorAll('iframe');
    console.log(`🔍 [ag-Grid] Found ${iframes.length} iframes to check`);
    
    let foundAccessibleAgGrid = false;
    const delayedExtractions: Promise<string>[] = [];
    
    iframes.forEach((iframe, index) => {
      try {
        // Check if we can access the iframe content (same-origin policy)
        const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
        
        if (iframeDoc) {
          console.log(`🔍 [ag-Grid] Checking iframe ${index + 1}: ${iframe.src || 'no src'}`);
          
          // Try immediate extraction first
          let iframeContent = this.extractFromDocument(iframeDoc, `iframe ${index + 1} (${iframe.src || 'inline'})`);
          
          if (iframeContent) {
            allTablesContent += iframeContent;
            foundAccessibleAgGrid = true;
          }
          
          // If no content found, try waiting a bit for ag-Grid to load (only for ag-grid.com iframes)
          else if (iframe.src && iframe.src.includes('ag-grid.com')) {
            console.log(`🔄 [ag-Grid] No immediate content found in ag-grid iframe, scheduling delayed extraction...`);
            
            // Create a promise for delayed extraction
            const delayedPromise = new Promise<string>((resolve) => {
              setTimeout(() => {
                try {
                  console.log(`🔄 [ag-Grid] Attempting delayed extraction from iframe ${index + 1}...`);
                  const delayedContent = this.extractFromDocument(iframeDoc, `iframe ${index + 1} (delayed)`);
                  if (delayedContent) {
                    console.log(`✅ [ag-Grid] Delayed extraction successful! Content length: ${delayedContent.length}`);
                    resolve(delayedContent);
                  } else {
                    resolve('');
                  }
                } catch (delayedError) {
                  console.log(`⚠️ [ag-Grid] Delayed extraction failed:`, delayedError);
                  resolve('');
                }
              }, 2000); // Wait 2 seconds for ag-Grid to load
            });
            
            delayedExtractions.push(delayedPromise);
          }
        } else {
          console.log(`⚠️ [ag-Grid] Cannot access iframe ${index + 1} content (cross-origin): ${iframe.src}`);
        }
      } catch (error) {
        console.log(`⚠️ [ag-Grid] Error accessing iframe ${index + 1}: ${(error as Error).message}`);
        // This is expected for cross-origin iframes, so we just log and continue
      }
    });
    
    // Wait for all delayed extractions to complete
    if (delayedExtractions.length > 0) {
      console.log(`⏳ [ag-Grid] Waiting for ${delayedExtractions.length} delayed extractions to complete...`);
      try {
        const delayedResults = await Promise.all(delayedExtractions);
        const delayedContent = delayedResults.join('');
        if (delayedContent) {
          allTablesContent += delayedContent;
          foundAccessibleAgGrid = true;
          console.log(`✅ [ag-Grid] Delayed extractions completed! Added ${delayedContent.length} characters to final content`);
        } else {
          console.log(`⚠️ [ag-Grid] Delayed extractions completed but no content found`);
        }
      } catch (error) {
        console.error(`❌ [ag-Grid] Error in delayed extractions:`, error);
      }
    }
    
    // If we couldn't access any ag-Grid in iframes, try parsing code examples as fallback
    if (!foundAccessibleAgGrid && !allTablesContent) {
      console.log(`🔄 [ag-Grid] No accessible ag-Grid found in iframes, trying code example parsing as fallback...`);
      const codeContent = this.parseCodeExamples();
      if (codeContent) {
        allTablesContent += codeContent;
      }
    }
    
    if (!allTablesContent) {
      console.log('❌ [ag-Grid] No ag-Grid containers found on page or in accessible iframes');
      return '';
    }
    
    console.log(`🎉 [ag-Grid] Total extraction complete. Final content length: ${allTablesContent.length} characters`);
    console.log(`📄 [ag-Grid] Final extracted content:`, allTablesContent);
    
    return allTablesContent;
  }

  /**
   * Extract ag-Grid table data from a specific document context
   */
  private extractFromDocument(doc: Document, contextName = 'main page'): string {
    console.log(`🔍 [ag-Grid] Starting ag-Grid extraction from ${contextName}...`);
    
    // First, let's debug what's actually in the document
    console.log(`🔍 [ag-Grid] Document body classes in ${contextName}:`, doc.body?.className || 'no body');
    console.log(`🔍 [ag-Grid] Document title in ${contextName}:`, doc.title);
    console.log(`🔍 [ag-Grid] All elements with "ag" in class name:`, doc.querySelectorAll('[class*="ag"]').length);
    
    let agGridContainers: Element[] = [];
    
    // Try each selector and combine results
    for (const selector of this.AG_GRID_SELECTORS) {
      try {
        const found = doc.querySelectorAll(selector);
        if (found.length > 0) {
          console.log(`🎯 [ag-Grid] Found ${found.length} elements with selector "${selector}" in ${contextName}`);
          // Merge with existing containers (avoiding duplicates)
          const newContainers = Array.from(found).filter(element => 
            !agGridContainers.includes(element)
          );
          if (newContainers.length > 0) {
            agGridContainers.push(...newContainers);
          }
        }
      } catch (e) {
        console.log(`⚠️ [ag-Grid] Error with selector "${selector}":`, e);
      }
    }
    
    console.log(`🔍 [ag-Grid] Found ${agGridContainers.length} potential ag-Grid containers in ${contextName}`);
    
    // If no containers found, let's debug further
    if (agGridContainers.length === 0) {
      console.log(`🔍 [ag-Grid] Debug: All elements in ${contextName}:`, doc.body?.children?.length || 0);
      console.log(`🔍 [ag-Grid] Debug: First 10 element class names:`);
      const allElements = Array.from(doc.body?.children || []).slice(0, 10);
      allElements.forEach((el, i) => {
        console.log(`  ${i + 1}. ${el.tagName}.${(el as Element).className}`);
      });
      
      console.log(`❌ [ag-Grid] No ag-Grid containers found in ${contextName}`);
      return '';
    }

    let tablesContent = `\n\n## 📊 Data Tables Found in ${contextName}\n\n`;
    
    agGridContainers.forEach((container, index) => {
      console.log(`🔍 [ag-Grid] Processing container ${index + 1}/${agGridContainers.length} in ${contextName}`);
      console.log(`🔍 [ag-Grid] Container classes:`, container.className);
      
      try {
        const tableData = this.extractTableData(container, index, contextName);
        if (tableData) {
          tablesContent += tableData;
        }
      } catch (error) {
        console.error(`❌ [ag-Grid] Error extracting table ${index + 1} from ${contextName}:`, error);
        console.error(`❌ [ag-Grid] Container that failed:`, container);
      }
    });

    console.log(`🎉 [ag-Grid] Extraction from ${contextName} complete. Content length: ${tablesContent.length} characters`);
    
    return tablesContent;
  }

  /**
   * Extract table data from a specific ag-Grid container
   */
  private extractTableData(container: Element, index: number, contextName: string): string {
    // Extract headers
    const headerCells = container.querySelectorAll('.ag-header-cell-text');
    console.log(`🔍 [ag-Grid] Found ${headerCells.length} header cells`);
    
    const headers = Array.from(headerCells).map(cell => 
      cell.textContent?.trim() || ''
    ).filter(text => text.length > 0);
    
    console.log(`📋 [ag-Grid] Extracted headers:`, headers);

    if (headers.length === 0) {
      console.log(`⚠️ [ag-Grid] No valid headers found in ${contextName}, skipping this container`);
      return '';
    }

    // Extract data rows
    const rowElements = container.querySelectorAll('.ag-row');
    console.log(`📊 [ag-Grid] Found ${rowElements.length} data rows`);
    
    const rows: string[][] = [];

    // Limit to first 20 rows for performance
    const maxRows = Math.min(rowElements.length, 20);
    console.log(`📊 [ag-Grid] Processing first ${maxRows} rows (of ${rowElements.length} total)`);
    
    for (let i = 0; i < maxRows; i++) {
      const rowElement = rowElements[i];
      const cellElements = rowElement.querySelectorAll('.ag-cell');
      console.log(`📊 [ag-Grid] Row ${i + 1}: Found ${cellElements.length} cells`);
      
      const rowData = Array.from(cellElements).map(cell => {
        return cell.textContent?.trim() || '';
      });

      console.log(`📊 [ag-Grid] Row ${i + 1} data:`, rowData);

      if (rowData.length > 0) {
        // Ensure row has same number of columns as headers
        while (rowData.length < headers.length) {
          rowData.push('');
        }
        rows.push(rowData.slice(0, headers.length));
      }
    }

    console.log(`✅ [ag-Grid] Successfully extracted ${rows.length} rows of data from ${contextName}`);
    
    if (rows.length === 0) {
      console.log(`⚠️ [ag-Grid] No data rows extracted for container ${index + 1} in ${contextName}`);
      return '';
    }

    // Generate markdown table
    let tableContent = `### Table ${index + 1} (${rows.length} rows shown${rowElements.length > 20 ? ` of ${rowElements.length} total` : ''})\n\n`;
    
    // Create markdown table
    tableContent += '| ' + headers.join(' | ') + ' |\n';
    tableContent += '| ' + headers.map(() => '---').join(' | ') + ' |\n';
    
    rows.forEach(row => {
      tableContent += '| ' + row.join(' | ') + ' |\n';
    });
    
    tableContent += '\n';
    
    console.log(`📝 [ag-Grid] Generated markdown table for container ${index + 1} in ${contextName}`);
    console.log(`📝 [ag-Grid] Sample table content:`, tableContent.substring(0, 500) + '...');

    return tableContent;
  }

  /**
   * Parse ag-Grid configuration from code examples on documentation pages
   */
  private parseCodeExamples(): string {
    console.log('🔍 [ag-Grid] Attempting to parse ag-Grid code examples from page...');
    
    let codeContent = '';
    
    for (const selector of this.CODE_SELECTORS) {
      const codeBlocks = document.querySelectorAll(selector);
      console.log(`🔍 [ag-Grid] Found ${codeBlocks.length} code blocks with selector "${selector}"`);
      
      codeBlocks.forEach((block, index) => {
        const codeText = block.textContent || '';
        
        // Check if this code block contains ag-Grid related content
        if (this.isAgGridCodeBlock(codeText)) {
          console.log(`🎯 [ag-Grid] Found ag-Grid code example in block ${index + 1}`);
          const parsedContent = this.parseCodeBlock(codeText);
          if (parsedContent) {
            codeContent += parsedContent;
          }
        }
      });
    }
    
    if (codeContent) {
      console.log(`✅ [ag-Grid] Successfully parsed ag-Grid code examples`);
      console.log(`📄 [ag-Grid] Code content:`, codeContent.substring(0, 500) + '...');
    } else {
      console.log(`❌ [ag-Grid] No ag-Grid code examples found on page`);
    }
    
    return codeContent;
  }

  /**
   * Check if a code block contains ag-Grid related content
   */
  private isAgGridCodeBlock(codeText: string): boolean {
    return codeText.includes('columnDefs') || 
           codeText.includes('ag-grid') ||
           codeText.includes('AgGridAngular') ||
           codeText.includes('rowData') ||
           codeText.includes('GridOptions');
  }

  /**
   * Parse ag-Grid configuration from a specific code block
   */
  private parseCodeBlock(codeText: string): string {
    let content = '';

    // Extract column definitions
    const columnDefMatch = codeText.match(/columnDefs\s*:\s*.*?\[(.*?)\]/s);
    if (columnDefMatch) {
      const columnDefsText = columnDefMatch[1];
      console.log(`📋 [ag-Grid] Found columnDefs:`, columnDefsText);
      
      // Extract field names from column definitions
      const fieldMatches = columnDefsText.match(/field\s*:\s*["']([^"']+)["']/g);
      if (fieldMatches) {
        const headers = fieldMatches.map(match => {
          const fieldMatch = match.match(/["']([^"']+)["']/);
          return fieldMatch ? fieldMatch[1] : '';
        }).filter(field => field);
        
        console.log(`📋 [ag-Grid] Extracted headers from code:`, headers);
        
        if (headers.length > 0) {
          content += '\n\n## 📊 ag-Grid Configuration Found in Code\n\n';
          content += `### Column Definitions\n\n`;
          content += `| Column Field | Description |\n`;
          content += `| --- | --- |\n`;
          
          headers.forEach(field => {
            content += `| ${field} | Data field for ${field} |\n`;
          });
          
          content += '\n';
        }
      }
    }
    
    // Extract data source URL if present
    const dataUrlMatch = codeText.match(/["'](https?:\/\/[^"']*\.json)["']/);
    if (dataUrlMatch) {
      const dataUrl = dataUrlMatch[1];
      console.log(`🔗 [ag-Grid] Found data source URL:`, dataUrl);
      content += `### Data Source\n\nData is loaded from: \`${dataUrl}\`\n\n`;
    }
    
    // Extract key parts of the ag-Grid configuration
    const agGridMatch = codeText.match(/<ag-grid-angular[\s\S]*?\/>/);
    if (agGridMatch) {
      console.log(`🔧 [ag-Grid] Found ag-grid-angular template`);
      content += `### Grid Configuration\n\nThe ag-Grid is configured with Angular component using:\n`;
      content += `- Column definitions for data structure\n`;
      content += `- Row data binding for dynamic content\n`;
      content += `- Grid ready event handling\n\n`;
    }

    return content;
  }
} 