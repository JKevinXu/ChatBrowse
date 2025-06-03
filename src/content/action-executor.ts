interface BrowserAction {
  type: 'click' | 'type' | 'scroll' | 'screenshot' | 'select' | 'submit' | 'wait' | 'hover';
  selector?: string;
  text?: string;
  value?: string;
  x?: number;
  y?: number;
  direction?: 'up' | 'down' | 'left' | 'right';
  amount?: number;
  timeout?: number;
}

interface BrowserActionResult {
  success: boolean;
  error?: string;
  data?: any;
}

interface ActionPlan {
  type: string;
  selector: string;
  value?: string;
  description: string;
  confidence: number;
}

export class ActionExecutor {
  async performAction(action: BrowserAction): Promise<BrowserActionResult> {
    try {
      switch (action.type) {
        case 'click':
          return await this.clickElement(action.selector, action.x, action.y);
        case 'type':
          return await this.typeText(action.selector, action.text);
        case 'scroll':
          return await this.scrollPage(action.direction || 'down', action.amount || 100);
        case 'screenshot':
          return await this.takeScreenshot();
        case 'select':
          return await this.selectOption(action.selector, action.value);
        case 'submit':
          return await this.submitForm(action.selector);
        case 'wait':
          return await this.waitForElement(action.selector, action.timeout);
        case 'hover':
          return await this.hoverElement(action.selector);
        default:
          return { success: false, error: `Unknown action type: ${action.type}` };
      }
    } catch (error) {
      return { 
        success: false, 
        error: `Action execution failed: ${(error as Error).message}` 
      };
    }
  }

  async executeEnhancedAction(action: ActionPlan): Promise<BrowserActionResult> {
    try {
      switch (action.type) {
        case 'search':
          return await this.executeSmartSearch(action);
        case 'type':
          return await this.executeTypeAction(action);
        case 'click':
          return await this.executeClickAction(action);
        default:
          return { success: false, error: `Unknown enhanced action type: ${action.type}` };
      }
    } catch (error) {
      return { 
        success: false, 
        error: `Enhanced action execution failed: ${(error as Error).message}` 
      };
    }
  }

  private async clickElement(selector?: string, x?: number, y?: number): Promise<BrowserActionResult> {
    try {
      if (x !== undefined && y !== undefined) {
        // Click at coordinates
        const element = document.elementFromPoint(x, y) as HTMLElement;
        if (element) {
          element.click();
          return { success: true, data: { clickedElement: element.tagName } };
        } else {
          return { success: false, error: 'No element found at coordinates' };
        }
      } else if (selector) {
        // Try to find element by selector, with fallbacks for text-based matching
        let element = this.findElementBySelector(selector);
        
        if (element) {
          console.log('🔍 [ActionExecutor] Found element, attempting click:', element);
          console.log('🔍 [ActionExecutor] Element details:', {
            tagName: element.tagName,
            className: element.className,
            id: element.id,
            attributes: Array.from(element.attributes).map(attr => `${attr.name}="${attr.value}"`),
            disabled: element.hasAttribute('disabled'),
            hidden: element.hidden,
            offsetWidth: element.offsetWidth,
            offsetHeight: element.offsetHeight,
            clientRect: element.getBoundingClientRect()
          });
          
          // Try multiple click methods for custom web components
          const clickSuccess = this.tryMultipleClickMethods(element);
          
          if (clickSuccess) {
            return { success: true, data: { selector, element: element.tagName } };
          } else {
            return { success: false, error: `Element found but click may not have triggered: ${selector}` };
          }
        } else {
          return { success: false, error: `Element not found: ${selector}` };
        }
      } else {
        return { success: false, error: 'No selector or coordinates provided' };
      }
    } catch (error) {
      return { success: false, error: `Click failed: ${(error as Error).message}` };
    }
  }

  private tryMultipleClickMethods(element: HTMLElement): boolean {
    console.log('🔍 [ActionExecutor] Trying click on:', element);
    
    try {
      // Use simple click approach (like manual test that works)
      console.log('🔍 [ActionExecutor] Executing single click()');
      element.click();
      
      console.log('✅ [ActionExecutor] Click executed successfully');
      return true;
      
    } catch (error) {
      console.log('❌ [ActionExecutor] Error in click:', error);
      return false;
    }
  }

  private findElementBySelector(selector: string): HTMLElement | null {
    console.log('🔍 [ActionExecutor] Looking for element with selector:', selector);
    
    // Split by commas to handle multiple selectors
    const selectors = selector.split(',').map(s => s.trim());
    console.log('🔍 [ActionExecutor] Split selectors:', selectors);
    
    for (const sel of selectors) {
      console.log('🔍 [ActionExecutor] Trying selector:', sel);
      
      // Handle text-based selectors like "button:contains('text')"
      if (sel.includes(':contains(')) {
        console.log('🔍 [ActionExecutor] Using text-based matching for:', sel);
        const element = this.findElementByText(sel);
        if (element) {
          console.log('✅ [ActionExecutor] Found element via text matching:', element);
          return element;
        }
        continue;
      }
      
      // Regular DOM query
      let element = document.querySelector(sel) as HTMLElement;
      if (element) {
        console.log('✅ [ActionExecutor] Found element via regular query:', element);
        
        // Special handling for kat-dropdown-button shadow DOM
        if (element.tagName.toLowerCase() === 'kat-dropdown-button') {
          console.log('🔍 [ActionExecutor] Found kat-dropdown-button, checking shadow DOM...');
          const shadowButton = this.findButtonInShadowDOM(element);
          if (shadowButton) {
            console.log('✅ [ActionExecutor] Found button in shadow DOM:', shadowButton);
            return shadowButton;
          } else {
            console.log('⚠️ [ActionExecutor] No shadow DOM button found, using component directly');
            return element;
          }
        }
        
        return element;
      }
    }
    
    console.log('❌ [ActionExecutor] No element found with any selector');
    return null;
  }

  private findButtonInShadowDOM(katButton: HTMLElement): HTMLElement | null {
    try {
      // Check if the element has shadow root
      const shadowRoot = (katButton as any).shadowRoot;
      if (!shadowRoot) {
        console.log('⚠️ [ActionExecutor] No shadow root found on kat-dropdown-button');
        return null;
      }
      
      console.log('🔍 [ActionExecutor] Searching in shadow DOM...');
      
      // Look for the actual button inside shadow DOM
      const shadowButton = shadowRoot.querySelector('button[part="dropdown-button-toggle-button"]') ||
                          shadowRoot.querySelector('button.indicator') ||
                          shadowRoot.querySelector('button[aria-label="open dropdown"]') ||
                          shadowRoot.querySelector('button');
      
      if (shadowButton) {
        console.log('✅ [ActionExecutor] Found button in shadow DOM:', shadowButton);
        return shadowButton as HTMLElement;
      } else {
        console.log('❌ [ActionExecutor] No button found in shadow DOM');
        return null;
      }
    } catch (error) {
      console.log('❌ [ActionExecutor] Error accessing shadow DOM:', error);
      return null;
    }
  }

  private findElementByText(selector: string): HTMLElement | null {
    // Parse selector like "button:contains('Bulk actions')"
    const match = selector.match(/(.+):contains\(['"]?([^'"]+)['"]?\)/);
    if (!match) return null;
    
    const [, tagSelector, text] = match;
    const elements = document.querySelectorAll(tagSelector);
    
    for (const element of Array.from(elements)) {
      if (element.textContent?.toLowerCase().includes(text.toLowerCase())) {
        return element as HTMLElement;
      }
    }
    
    return null;
  }

  private async typeText(selector?: string, text?: string): Promise<BrowserActionResult> {
    try {
      if (!selector || !text) {
        return { success: false, error: 'Selector and text are required for typing' };
      }

      const element = document.querySelector(selector) as HTMLInputElement;
      if (!element) {
        return { success: false, error: `Element not found: ${selector}` };
      }

      // Focus the element
      element.focus();
      
      // Clear existing text
      element.value = '';
      
      // Type the new text
      element.value = text;
      
      // Trigger input events
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));

      return { success: true, data: { selector, text } };
    } catch (error) {
      return { success: false, error: `Type failed: ${(error as Error).message}` };
    }
  }

  private async scrollPage(direction: string, amount: number): Promise<BrowserActionResult> {
    try {
      const scrollOptions: ScrollToOptions = { behavior: 'smooth' };
      
      switch (direction) {
        case 'up':
          window.scrollBy({ top: -amount, ...scrollOptions });
          break;
        case 'down':
          window.scrollBy({ top: amount, ...scrollOptions });
          break;
        case 'left':
          window.scrollBy({ left: -amount, ...scrollOptions });
          break;
        case 'right':
          window.scrollBy({ left: amount, ...scrollOptions });
          break;
        default:
          return { success: false, error: `Invalid scroll direction: ${direction}` };
      }

      return { success: true, data: { direction, amount } };
    } catch (error) {
      return { success: false, error: `Scroll failed: ${(error as Error).message}` };
    }
  }

  private async takeScreenshot(): Promise<BrowserActionResult> {
    // Note: Screenshots require special permissions and are typically handled by browser extensions
    return { success: false, error: 'Screenshot functionality not implemented in content script' };
  }

  private async selectOption(selector?: string, value?: string): Promise<BrowserActionResult> {
    try {
      if (!selector || !value) {
        return { success: false, error: 'Selector and value are required for selection' };
      }

      const element = document.querySelector(selector) as HTMLSelectElement;
      if (!element) {
        return { success: false, error: `Element not found: ${selector}` };
      }

      element.value = value;
      element.dispatchEvent(new Event('change', { bubbles: true }));

      return { success: true, data: { selector, value } };
    } catch (error) {
      return { success: false, error: `Select failed: ${(error as Error).message}` };
    }
  }

  private async submitForm(selector?: string): Promise<BrowserActionResult> {
    try {
      const element = selector ? 
        document.querySelector(selector) as HTMLFormElement : 
        document.querySelector('form') as HTMLFormElement;
      
      if (!element) {
        return { success: false, error: selector ? `Form not found: ${selector}` : 'No form found on page' };
      }

      element.submit();
      return { success: true, data: { selector: selector || 'form' } };
    } catch (error) {
      return { success: false, error: `Submit failed: ${(error as Error).message}` };
    }
  }

  private async waitForElement(selector?: string, timeout: number = 5000): Promise<BrowserActionResult> {
    if (!selector) {
      return { success: false, error: 'Selector is required for waiting' };
    }

    return new Promise((resolve) => {
      const checkElement = () => {
        const element = document.querySelector(selector);
        if (element) {
          resolve({ success: true, data: { selector } });
        }
      };

      // Check immediately
      checkElement();

      // Set up interval to check periodically
      const interval = setInterval(checkElement, 100);
      
      // Set timeout
      setTimeout(() => {
        clearInterval(interval);
        resolve({ success: false, error: `Element not found within ${timeout}ms: ${selector}` });
      }, timeout);
    });
  }

  private async hoverElement(selector?: string): Promise<BrowserActionResult> {
    try {
      if (!selector) {
        return { success: false, error: 'Selector is required for hovering' };
      }

      const element = document.querySelector(selector) as HTMLElement;
      if (!element) {
        return { success: false, error: `Element not found: ${selector}` };
      }

      // Create and dispatch mouseenter event
      const mouseEnterEvent = new MouseEvent('mouseenter', {
        bubbles: true,
        cancelable: true,
        view: window
      });
      
      element.dispatchEvent(mouseEnterEvent);

      return { success: true, data: { selector } };
    } catch (error) {
      return { success: false, error: `Hover failed: ${(error as Error).message}` };
    }
  }

  private async executeSmartSearch(action: ActionPlan): Promise<BrowserActionResult> {
    try {
      const element = document.querySelector(action.selector) as HTMLInputElement;
      if (!element) {
        return { success: false, error: `Search element not found: ${action.selector}` };
      }

      // Focus and clear the search input
      element.focus();
      element.value = '';
      
      // Type the search term
      if (action.value) {
        element.value = action.value;
        
        // Trigger events
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
        
        // Try to submit by pressing Enter
        const keyEvent = new KeyboardEvent('keydown', {
          key: 'Enter',
          code: 'Enter',
          bubbles: true
        });
        element.dispatchEvent(keyEvent);
        
        // Also look for a nearby search button
        const form = element.closest('form');
        if (form) {
          const submitButton = form.querySelector('button[type="submit"], input[type="submit"], button:not([type])');
          if (submitButton) {
            (submitButton as HTMLElement).click();
          }
        }
      }

      return { 
        success: true, 
        data: { 
          selector: action.selector, 
          searchTerm: action.value,
          description: action.description 
        } 
      };
    } catch (error) {
      return { success: false, error: `Smart search failed: ${(error as Error).message}` };
    }
  }

  private async executeTypeAction(action: ActionPlan): Promise<BrowserActionResult> {
    return this.typeText(action.selector, action.value);
  }

  private async executeClickAction(action: ActionPlan): Promise<BrowserActionResult> {
    console.log('🔍 [ActionExecutor] Starting click action:', action);
    const result = await this.clickElement(action.selector);
    console.log('🔍 [ActionExecutor] Click action result:', result);
    return result;
  }
} 