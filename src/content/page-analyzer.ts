interface PageStructure {
  forms: Array<{
    selector: string;
    fields: Array<{ name: string; type: string; selector: string; placeholder?: string }>;
    submitButton?: string;
  }>;
  buttons: Array<{ text: string; selector: string; type: string }>;
  links: Array<{ text: string; href: string; selector: string }>;
  searchBoxes: Array<{ placeholder: string; selector: string }>;
  navigation: Array<{ text: string; selector: string }>;
  content: {
    headings: Array<{ level: number; text: string; selector: string }>;
    paragraphs: Array<{ text: string; selector: string }>;
    lists: Array<{ type: string; items: string[]; selector: string }>;
  };
  interactive: Array<{ type: string; text: string; selector: string }>;
}

export class PageAnalyzer {
  analyzeStructure(): PageStructure {
    return {
      forms: this.analyzeForms(),
      buttons: this.analyzeButtons(),
      links: this.analyzeLinks(),
      searchBoxes: this.analyzeSearchBoxes(),
      navigation: this.analyzeNavigation(),
      content: this.analyzeContent(),
      interactive: this.analyzeInteractiveElements()
    };
  }

  generateSummaryForAI(): string {
    const structure = this.analyzeStructure();
    
    let summary = `Page Structure Analysis for ${window.location.hostname}:\n\n`;
    
    // Add forms information
    if (structure.forms.length > 0) {
      summary += `Forms (${structure.forms.length}):\n`;
      structure.forms.forEach((form, i) => {
        summary += `- Form ${i + 1}: ${form.fields.length} fields\n`;
        form.fields.forEach(field => {
          summary += `  • ${field.type} field: ${field.name || field.placeholder || 'unnamed'}\n`;
        });
      });
      summary += '\n';
    }
    
    // Add search boxes
    if (structure.searchBoxes.length > 0) {
      summary += `Search Elements (${structure.searchBoxes.length}):\n`;
      structure.searchBoxes.forEach(search => {
        summary += `- ${search.placeholder || 'Search box'}\n`;
      });
      summary += '\n';
    }
    
    // Add navigation
    if (structure.navigation.length > 0) {
      summary += `Navigation (${Math.min(structure.navigation.length, 10)}):\n`;
      structure.navigation.slice(0, 10).forEach(nav => {
        summary += `- ${nav.text}\n`;
      });
      summary += '\n';
    }
    
    // Add key buttons
    if (structure.buttons.length > 0) {
      summary += `Buttons (${Math.min(structure.buttons.length, 15)}):\n`;
      structure.buttons.slice(0, 15).forEach(btn => {
        summary += `- ${btn.text} (${btn.type})\n`;
      });
      summary += '\n';
    }
    
    return summary;
  }

  detectPlatform(): string {
    const url = window.location.hostname.toLowerCase();
    const title = document.title.toLowerCase();
    
    if (url.includes('youtube') || title.includes('youtube')) return 'YouTube';
    if (url.includes('google') || title.includes('google search')) return 'Google';
    if (url.includes('amazon') || title.includes('amazon')) return 'Amazon';
    if (url.includes('bilibili') || title.includes('bilibili')) return 'Bilibili';
    if (url.includes('xiaohongshu') || title.includes('xiaohongshu')) return 'Xiaohongshu';
    if (url.includes('twitter') || url.includes('x.com')) return 'Twitter/X';
    if (url.includes('facebook')) return 'Facebook';
    if (url.includes('instagram')) return 'Instagram';
    if (url.includes('linkedin')) return 'LinkedIn';
    if (url.includes('reddit')) return 'Reddit';
    
    return 'Generic Website';
  }

  getElementSelector(element: Element): string {
    // Try ID first
    if (element.id) {
      return `#${element.id}`;
    }
    
    // Try unique class combinations
    if (element.className) {
      const classes = element.className.split(' ').filter(c => c.trim());
      if (classes.length > 0) {
        const classSelector = '.' + classes.join('.');
        if (document.querySelectorAll(classSelector).length === 1) {
          return classSelector;
        }
      }
    }
    
    // Build hierarchical selector
    const parts: string[] = [];
    let current: Element | null = element;
    
    while (current && current !== document.body) {
      let selector = current.tagName.toLowerCase();
      
      if (current.id) {
        selector = `#${current.id}`;
        parts.unshift(selector);
        break;
      }
      
      if (current.className) {
        const classes = current.className.split(' ').filter(c => c.trim());
        if (classes.length > 0) {
          selector += '.' + classes[0];
        }
      }
      
      parts.unshift(selector);
      current = current.parentElement;
      
      if (parts.length > 4) break; // Limit depth
    }
    
    return parts.join(' > ');
  }

  private analyzeForms(): PageStructure['forms'] {
    const forms: PageStructure['forms'] = [];
    
    document.querySelectorAll('form').forEach(form => {
      const fields: Array<{ name: string; type: string; selector: string; placeholder?: string }> = [];
      
      // Find all input fields
      form.querySelectorAll('input, textarea, select').forEach(field => {
        const input = field as HTMLInputElement;
        fields.push({
          name: input.name || input.id || '',
          type: input.type || input.tagName.toLowerCase(),
          selector: this.getElementSelector(field),
          placeholder: input.placeholder || undefined
        });
      });
      
      // Find submit button
      const submitBtn = form.querySelector('input[type="submit"], button[type="submit"], button:not([type])');
      
      forms.push({
        selector: this.getElementSelector(form),
        fields,
        submitButton: submitBtn ? this.getElementSelector(submitBtn) : undefined
      });
    });
    
    return forms;
  }

  private analyzeButtons(): PageStructure['buttons'] {
    const buttons: PageStructure['buttons'] = [];
    
    document.querySelectorAll('button, input[type="button"], input[type="submit"], .btn, [role="button"]').forEach(btn => {
      const element = btn as HTMLElement;
      const text = element.textContent?.trim() || element.getAttribute('value') || element.getAttribute('aria-label') || '';
      
      if (text) {
        buttons.push({
          text,
          selector: this.getElementSelector(btn),
          type: element.tagName.toLowerCase()
        });
      }
    });
    
    return buttons;
  }

  private analyzeLinks(): PageStructure['links'] {
    const links: PageStructure['links'] = [];
    
    document.querySelectorAll('a[href]').forEach(link => {
      const anchor = link as HTMLAnchorElement;
      const text = anchor.textContent?.trim() || '';
      
      if (text && text.length < 100) { // Avoid very long link texts
        links.push({
          text,
          href: anchor.href,
          selector: this.getElementSelector(link)
        });
      }
    });
    
    return links.slice(0, 50); // Limit to avoid overwhelming data
  }

  private analyzeSearchBoxes(): PageStructure['searchBoxes'] {
    const searchBoxes: PageStructure['searchBoxes'] = [];
    
    // Look for search inputs
    const searchSelectors = [
      'input[type="search"]',
      'input[name*="search" i]',
      'input[placeholder*="search" i]',
      'input[id*="search" i]',
      'input[class*="search" i]'
    ];
    
    searchSelectors.forEach(selector => {
      document.querySelectorAll(selector).forEach(input => {
        const element = input as HTMLInputElement;
        searchBoxes.push({
          placeholder: element.placeholder || 'Search',
          selector: this.getElementSelector(input)
        });
      });
    });
    
    return searchBoxes;
  }

  private analyzeNavigation(): PageStructure['navigation'] {
    const navigation: PageStructure['navigation'] = [];
    
    // Look for navigation elements
    const navSelectors = ['nav a', '.nav a', '.navigation a', 'header a', '.menu a', '[role="navigation"] a'];
    
    navSelectors.forEach(selector => {
      document.querySelectorAll(selector).forEach(link => {
        const text = link.textContent?.trim() || '';
        if (text && text.length < 50) {
          navigation.push({
            text,
            selector: this.getElementSelector(link)
          });
        }
      });
    });
    
    return navigation.slice(0, 30); // Limit navigation items
  }

  private analyzeContent(): PageStructure['content'] {
    const content: PageStructure['content'] = {
      headings: [],
      paragraphs: [],
      lists: []
    };
    
    // Analyze headings
    document.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach(heading => {
      const text = heading.textContent?.trim() || '';
      if (text) {
        content.headings.push({
          level: parseInt(heading.tagName.substring(1)),
          text,
          selector: this.getElementSelector(heading)
        });
      }
    });
    
    // Analyze paragraphs (limit to avoid too much data)
    document.querySelectorAll('p').forEach((p, index) => {
      if (index < 20) { // Limit paragraphs
        const text = p.textContent?.trim() || '';
        if (text && text.length > 20) {
          content.paragraphs.push({
            text: text.length > 200 ? text.substring(0, 200) + '...' : text,
            selector: this.getElementSelector(p)
          });
        }
      }
    });
    
    // Analyze lists
    document.querySelectorAll('ul, ol').forEach((list, index) => {
      if (index < 10) { // Limit lists
        const items = Array.from(list.querySelectorAll('li')).map(li => li.textContent?.trim() || '');
        if (items.length > 0) {
          content.lists.push({
            type: list.tagName.toLowerCase(),
            items: items.slice(0, 10), // Limit list items
            selector: this.getElementSelector(list)
          });
        }
      }
    });
    
    return content;
  }

  private analyzeInteractiveElements(): PageStructure['interactive'] {
    const interactive: PageStructure['interactive'] = [];
    
    // Look for interactive elements
    const interactiveSelectors = [
      'select',
      'input[type="checkbox"]',
      'input[type="radio"]',
      '[onclick]',
      '[data-action]',
      '.clickable',
      '[role="button"]'
    ];
    
    interactiveSelectors.forEach(selector => {
      document.querySelectorAll(selector).forEach(element => {
        const text = element.textContent?.trim() || 
                    element.getAttribute('aria-label') || 
                    element.getAttribute('title') || '';
        
        if (text) {
          interactive.push({
            type: element.tagName.toLowerCase(),
            text,
            selector: this.getElementSelector(element)
          });
        }
      });
    });
    
    return interactive.slice(0, 30); // Limit interactive elements
  }
} 