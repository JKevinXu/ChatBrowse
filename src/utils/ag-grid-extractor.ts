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
    
    // Add a small delay to allow dynamic content to load
    console.log('⏳ [ag-Grid] Waiting 2 seconds for dynamic content to load...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    let allTablesContent = '';
    
    try {
      // First, check the main document
      const mainPageContent = this.extractFromDocument(document, 'main page');
      if (mainPageContent) {
        allTablesContent += `\n\n## 📊 Data Tables Found in main page\n\n${mainPageContent}`;
      }
      
      // Then check iframes
      const iframes = document.querySelectorAll('iframe');
      console.log(`🔍 [ag-Grid] Found ${iframes.length} iframes to check`);
      
      for (let index = 0; index < iframes.length; index++) {
        const iframe = iframes[index];
        console.log(`🔍 [ag-Grid] Checking iframe ${index + 1}: ${iframe.src || 'inline'}`);
        
        try {
          if (iframe.contentDocument) {
            
            // Try immediate extraction first
            let iframeContent = this.extractFromDocument(iframe.contentDocument, `iframe ${index + 1} (${iframe.src || 'inline'})`);
            
            if (iframeContent) {
              allTablesContent += `\n\n## 📊 Data Tables Found in iframe ${index + 1}\n\n${iframeContent}`;
            }
          } else {
            console.log(`⚠️ [ag-Grid] Cannot access iframe ${index + 1} content (cross-origin or not loaded)`);
          }
        } catch (error) {
          console.log(`❌ [ag-Grid] Error processing iframe ${index + 1}:`, error);
        }
      }
      
      // Also try to extract code examples if no tables found
      if (!allTablesContent.trim() || allTablesContent.length < 100) {
        console.log('🔍 [ag-Grid] No substantial table data found, trying code example extraction...');
        const codeContent = this.parseCodeExamples();
        if (codeContent) {
          allTablesContent += codeContent;
        }
      }
      
    } catch (error) {
      console.error('❌ [ag-Grid] Error during extraction:', error);
    }
    
    console.log(`🎉 [ag-Grid] Total extraction complete. Final content length: ${allTablesContent.length} characters`);
    console.log(`📄 [ag-Grid] Final extracted content:`, allTablesContent);
    
    return allTablesContent;
  }

  /**
   * Extract ag-Grid data from a document or document fragment
   */
  private extractFromDocument(doc: Document, contextName = 'main page'): string {
    console.log(`🔍 [ag-Grid] Starting ag-Grid extraction from ${contextName}...`);
    
    // Log document info for debugging
    const body = doc.body;
    const bodyClasses = body ? body.className : 'no body';
    const title = doc.title || 'no title';
    console.log(`🔍 [ag-Grid] Document body classes in ${contextName}: ${bodyClasses}`);
    console.log(`🔍 [ag-Grid] Document title in ${contextName}: ${title}`);
    
    // Count all elements with "ag" in class name for debugging
    const allAgElements = doc.querySelectorAll('[class*="ag"]');
    console.log(`🔍 [ag-Grid] All elements with "ag" in class name: ${allAgElements.length}`);
    
    // Find ag-Grid containers
    const containers: Element[] = [];
    
    for (const selector of this.AG_GRID_SELECTORS) {
      const elements = doc.querySelectorAll(selector);
      console.log(`🎯 [ag-Grid] Found ${elements.length} elements with selector "${selector}" in ${contextName}`);
      containers.push(...Array.from(elements));
    }
    
    // Remove duplicates
    const uniqueContainers = Array.from(new Set(containers));
    console.log(`🔍 [ag-Grid] Found ${uniqueContainers.length} potential ag-Grid containers in ${contextName}`);
    
    if (uniqueContainers.length === 0) {
      // Debug: show what elements exist if no ag-Grid found
      const allElements = doc.querySelectorAll('*');
      console.log(`🔍 [ag-Grid] Debug: All elements in ${contextName}: ${allElements.length}`);
      
      // Show first 10 element class names for debugging
      console.log(`🔍 [ag-Grid] Debug: First 10 element class names:`);
      Array.from(allElements).slice(0, 10).forEach((el, i) => {
        console.log(`  ${i + 1}. ${el.tagName}.${el.className}`);
      });
      
      console.log(`❌ [ag-Grid] No ag-Grid containers found in ${contextName}`);
      return '';
    }
    
    let allContent = '';
    
    // Extract data from each container
    for (let i = 0; i < uniqueContainers.length; i++) {
      const container = uniqueContainers[i];
      console.log(`🔍 [ag-Grid] Processing container ${i + 1}/${uniqueContainers.length} in ${contextName}`);
      console.log(`🔍 [ag-Grid] Container classes: ${container.className}`);
      
      const tableContent = this.extractTableData(container, i, contextName);
      if (tableContent) {
        allContent += tableContent;
      }
    }
    
    console.log(`🎉 [ag-Grid] Extraction from ${contextName} complete. Content length: ${allContent.length} characters`);
    return allContent;
  }

  /**
   * Extract table data from a specific ag-Grid container
   */
  private extractTableData(container: Element, index: number, contextName: string): string {
    // Extract headers - try multiple strategies
    let headers: string[] = [];
    
    // Strategy 1: Try the traditional .ag-header-cell-text approach
    const headerCells = container.querySelectorAll('.ag-header-cell-text');
    console.log(`🔍 [ag-Grid] Found ${headerCells.length} traditional header cells`);
    
    if (headerCells.length > 0) {
      headers = Array.from(headerCells).map(cell => 
        cell.textContent?.trim() || ''
      ).filter(text => text.length > 0);
    }
    
    // Strategy 2: Look for headers in #header-tooltip elements (for custom implementations)
    if (headers.length === 0) {
      const headerTooltips = container.querySelectorAll('#header-tooltip');
      console.log(`🔍 [ag-Grid] Found ${headerTooltips.length} header tooltip elements`);
      
      headers = Array.from(headerTooltips).map(tooltip => {
        // Get text content but filter out icon elements
        const clone = tooltip.cloneNode(true) as Element;
        const icons = clone.querySelectorAll('kat-icon, .ag-icon, [class*="icon"]');
        icons.forEach(icon => icon.remove());
        return clone.textContent?.trim() || '';
      }).filter(text => text.length > 0);
    }
    
    // Strategy 3: Use col-id attributes from header cells as fallback
    if (headers.length === 0) {
      const headerCellsWithColId = container.querySelectorAll('.ag-header-cell[col-id]');
      console.log(`🔍 [ag-Grid] Found ${headerCellsWithColId.length} header cells with col-id`);
      
      headers = Array.from(headerCellsWithColId).map(cell => {
        const colId = cell.getAttribute('col-id');
        return colId?.replace(/&amp;/g, '&') || '';
      }).filter(text => text.length > 0);
    }
    
    // Strategy 4: Look for any element with header-like attributes in header rows
    if (headers.length === 0) {
      const headerRow = container.querySelector('.ag-header-row');
      if (headerRow) {
        const headerElements = headerRow.querySelectorAll('[role="columnheader"]');
        console.log(`🔍 [ag-Grid] Found ${headerElements.length} columnheader role elements`);
        
        headers = Array.from(headerElements).map(element => {
          // Try to get text from various possible locations
          const tooltip = element.querySelector('#header-tooltip');
          if (tooltip) {
            const clone = tooltip.cloneNode(true) as Element;
            const icons = clone.querySelectorAll('kat-icon, .ag-icon, [class*="icon"]');
            icons.forEach(icon => icon.remove());
            return clone.textContent?.trim() || '';
          }
          
          const colId = element.getAttribute('col-id');
          if (colId) {
            return colId.replace(/&amp;/g, '&');
          }
          
          return element.textContent?.trim() || '';
        }).filter(text => text.length > 0);
      }
    }
    
    console.log(`📋 [ag-Grid] Extracted headers:`, headers);

    if (headers.length === 0) {
      console.log(`⚠️ [ag-Grid] No valid headers found in ${contextName}, skipping this container`);
      return '';
    }

    // Extract rows and generate table
    const rows = this.extractRowsFromContainer(container, headers, contextName);
    
    if (rows.length === 0) {
      console.log(`⚠️ [ag-Grid] No data rows extracted for container ${index + 1} in ${contextName}`);
      return '';
    }

    // Generate markdown table
    let tableContent = `### Table ${index + 1} (${rows.length} rows shown${rows.length > 20 ? ` of ${rows.length} total` : ''})\n\n`;
    
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
   * Extract rows from container
   */
  private extractRowsFromContainer(container: Element, headers: string[], contextName: string): string[][] {
    // Extract data rows - handle virtualized columns
    const leftContainer = container.querySelector('.ag-pinned-left-cols-container');
    const centerContainer = container.querySelector('.ag-center-cols-container');
    const rightContainer = container.querySelector('.ag-pinned-right-cols-container');
    
    console.log(`📊 [ag-Grid] Found containers - Left: ${leftContainer ? 'YES' : 'NO'}, Center: ${centerContainer ? 'YES' : 'NO'}, Right: ${rightContainer ? 'YES' : 'NO'}`);
    
    // Debug: Log how many .ag-row elements are in each container
    if (leftContainer) {
      const leftRows = leftContainer.querySelectorAll('.ag-row');
      console.log(`📊 [ag-Grid] Left container has ${leftRows.length} .ag-row elements`);
    }
    if (centerContainer) {
      const centerRows = centerContainer.querySelectorAll('.ag-row');
      console.log(`📊 [ag-Grid] Center container has ${centerRows.length} .ag-row elements`);
    }
    if (rightContainer) {
      const rightRows = rightContainer.querySelectorAll('.ag-row');
      console.log(`📊 [ag-Grid] Right container has ${rightRows.length} .ag-row elements`);
    }
    
    // Get all unique row IDs to correlate data across containers
    const rowIds = new Set<string>();
    [leftContainer, centerContainer, rightContainer].forEach(cont => {
      if (cont) {
        const rows = cont.querySelectorAll('.ag-row[row-id]');
        rows.forEach(row => {
          const rowId = row.getAttribute('row-id');
          if (rowId) rowIds.add(rowId);
        });
      }
    });
    
    const rowIdArray = Array.from(rowIds);
    console.log(`📊 [ag-Grid] Found ${rowIdArray.length} unique rows with IDs: ${rowIdArray.slice(0, 3).join(', ')}...`);
    
    // Fallback: if no row IDs found, use row indices
    let useRowIndices = false;
    let maxRowCount = 0;
    
    if (rowIdArray.length === 0) {
      console.log(`📊 [ag-Grid] No rows with IDs found, falling back to row indices`);
      useRowIndices = true;
      
      // Find the container with the most rows to determine total count
      [leftContainer, centerContainer, rightContainer].forEach(cont => {
        if (cont) {
          const rows = cont.querySelectorAll('.ag-row');
          maxRowCount = Math.max(maxRowCount, rows.length);
        }
      });
      
      console.log(`📊 [ag-Grid] Found maximum ${maxRowCount} rows using indices`);
    }
    
    const totalRows = useRowIndices ? maxRowCount : rowIdArray.length;
    
    const rows: string[][] = [];

    // Limit to first 20 rows for performance
    const maxRows = Math.min(totalRows, 20);
    console.log(`📊 [ag-Grid] Processing first ${maxRows} rows (of ${totalRows} total)`);
    
    for (let i = 0; i < maxRows; i++) {
      const rowId = useRowIndices ? null : rowIdArray[i];
      console.log(`📊 [ag-Grid] Processing row ${i + 1}${rowId ? ` with ID: ${rowId}` : ` using index ${i}`}`);
      
      // Collect cells from all containers for this row
      const allCells: Element[] = [];
      
      // Left pinned columns
      if (leftContainer) {
        const leftRow = useRowIndices 
          ? leftContainer.querySelectorAll('.ag-row')[i]
          : leftContainer.querySelector(`.ag-row[row-id="${rowId}"]`);
        if (leftRow) {
          const leftCells = leftRow.querySelectorAll('.ag-cell');
          allCells.push(...Array.from(leftCells));
          console.log(`📊 [ag-Grid] Row ${i + 1}: Found ${leftCells.length} left cells`);
        }
      }
      
      // Center columns (main data)
      if (centerContainer) {
        const centerRow = useRowIndices
          ? centerContainer.querySelectorAll('.ag-row')[i]
          : centerContainer.querySelector(`.ag-row[row-id="${rowId}"]`);
        if (centerRow) {
          const centerCells = centerRow.querySelectorAll('.ag-cell');
          allCells.push(...Array.from(centerCells));
          console.log(`📊 [ag-Grid] Row ${i + 1}: Found ${centerCells.length} center cells`);
        }
      }
      
      // Right pinned columns
      if (rightContainer) {
        const rightRow = useRowIndices
          ? rightContainer.querySelectorAll('.ag-row')[i]
          : rightContainer.querySelector(`.ag-row[row-id="${rowId}"]`);
        if (rightRow) {
          const rightCells = rightRow.querySelectorAll('.ag-cell');
          allCells.push(...Array.from(rightCells));
          console.log(`📊 [ag-Grid] Row ${i + 1}: Found ${rightCells.length} right cells`);
        }
      }
      
      console.log(`📊 [ag-Grid] Row ${i + 1}: Total ${allCells.length} cells`);
      
      const rowData = allCells.map(cell => {
        // Handle complex cell content by extracting meaningful text
        const cellClone = cell.cloneNode(true) as Element;
        
        // Remove icons and other visual elements that don't add value
        const iconsAndDecorative = cellClone.querySelectorAll('kat-icon, .ag-icon, [class*="icon"], .ag-selection-checkbox');
        iconsAndDecorative.forEach(element => element.remove());
        
        // For performance trend components, try to extract the main value
        const trendTitle = cellClone.querySelector('.performance-trend-title');
        const trendValue = cellClone.querySelector('.performance-trend-value');
        
        if (trendTitle || trendValue) {
          const title = trendTitle?.textContent?.trim() || '';
          const value = trendValue?.textContent?.trim() || '';
          
          // If we have a meaningful value (not empty and not just the column name), use it
          if (value && value !== '--' && value !== '' && !title.toLowerCase().includes(value.toLowerCase())) {
            return value;
          }
          // Otherwise, if title looks like a data value (contains numbers, currency, %), use it
          else if (title && (title.match(/[\d,¥%$.-]/) || title === '--')) {
            return title;
          }
          // If title is just the column name and value is meaningful, use value
          else if (value && (value === '--' || value.match(/[\d,¥%$.-]/))) {
            return value;
          }
          // Fallback to whichever is not empty
          return value || title;
        }
        
        // For seller detail cells, extract the key information
        const sellerName = cellClone.querySelector('.seller-name');
        if (sellerName) {
          // Handle kat-link elements with label attribute
          const name = sellerName.getAttribute('label') || sellerName.textContent?.trim() || '';
          const sellerId = cellClone.querySelector('.seller-id')?.textContent?.trim() || '';
          return name + (sellerId ? ` (${sellerId})` : '');
        }
        
        // For contact details, extract phone and email
        const contactInfo = cellClone.querySelector('.css-655car');
        if (contactInfo) {
          const phoneLink = contactInfo.querySelector('a[href^="#"]');
          const emailLink = contactInfo.querySelector('a[href^="mailto:"]');
          const parts = [];
          if (phoneLink) parts.push(phoneLink.textContent?.trim() || '');
          if (emailLink) parts.push(emailLink.textContent?.trim() || '');
          return parts.join(', ') || 'Contact info available';
        }
        
        // Check for any links that might contain the main content
        const linkElements = cellClone.querySelectorAll('kat-link[label], a');
        if (linkElements.length > 0) {
          const linkTexts = Array.from(linkElements).map(link => {
            // Get label attribute first, then text content
            const label = link.getAttribute('label');
            if (label) return label;
            return link.textContent?.trim() || '';
          }).filter(text => text && text.length > 0);
          
          if (linkTexts.length > 0) {
            return linkTexts[0]; // Return the first meaningful link text
          }
        }
        
        // Check for specific status or alert indicators
        const alertIcons = cellClone.querySelectorAll('.alert-fill, .success');
        if (alertIcons.length > 0) {
          const statusElement = cellClone.querySelector('.string-around-icon');
          if (statusElement) {
            return statusElement.textContent?.trim() || '';
          }
        }
        
        // For any performance trend component, extract the header value
        const performanceTrendHeader = cellClone.querySelector('.performance-trend-header');
        if (performanceTrendHeader) {
          const titleEl = performanceTrendHeader.querySelector('.performance-trend-title');
          const valueEl = performanceTrendHeader.querySelector('.performance-trend-value');
          
          if (valueEl && valueEl.textContent?.trim()) {
            return valueEl.textContent.trim();
          } else if (titleEl && titleEl.textContent?.trim()) {
            return titleEl.textContent.trim();
          }
        }
        
        // For cells with multiple sections, try to extract meaningful content
        const primarySection = cellClone.querySelector('.primary-section');
        if (primarySection) {
          const cleanText = primarySection.textContent?.trim() || '';
          if (cleanText) return cleanText;
        }
        
        // For standard content, just get the text but clean it up
        let cellText = cellClone.textContent?.trim() || '';
        
        // Clean up excessive whitespace and newlines
        cellText = cellText.replace(/\s+/g, ' ').trim();
        
        // If the text is too long (indicating raw HTML content), truncate it
        if (cellText.length > 100) {
          cellText = cellText.substring(0, 97) + '...';
        }
        
        return cellText;
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
    
    return rows;
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