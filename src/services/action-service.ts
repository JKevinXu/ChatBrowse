import { ChatResponse } from '../types';

interface ActionPlan {
  type: string;
  selector: string;
  value?: string;
  description: string;
  confidence: number;
}

interface ActionResult {
  success: boolean;
  error?: string;
}

interface StoredActionPlan {
  plans: ActionPlan[];
  tabId: number;
  timestamp: number;
}

export class ActionService {
  private storedActionPlans = new Map<number, StoredActionPlan>();

  hasStoredPlan(tabId: number): boolean {
    return this.storedActionPlans.has(tabId);
  }

  isExecutionCommand(text: string): boolean {
    const executionPhrases = ['do it', 'execute', 'run it', 'go ahead', 'proceed'];
    const lowerText = text.toLowerCase().trim();
    return executionPhrases.some(phrase => lowerText.includes(phrase));
  }

  isActionRequest(text: string): boolean {
    const actionKeywords = ['search', 'find', 'look for', 'videos about'];
    const lowerText = text.toLowerCase().trim();
    return actionKeywords.some(keyword => lowerText.includes(keyword));
  }

  async planActions(
    text: string,
    tabId: number,
    sendResponse: (response: ChatResponse) => void,
    sessionId: string
  ): Promise<void> {
    try {
      // Get basic page info
      const pageInfo = await this.getPageInfo(tabId);
      if (!pageInfo) {
        sendResponse({
          type: 'MESSAGE',
          payload: {
            text: 'Could not analyze the current page. Please refresh and try again.',
            sessionId
          }
        });
        return;
      }
      
      // Create a simple action plan
      const actionPlan = this.createSimpleActionPlan(text, pageInfo);
      
      if (actionPlan.length === 0) {
        sendResponse({
          type: 'MESSAGE',
          payload: {
            text: 'I couldn\'t find a way to perform that action on this page. Please try being more specific.',
            sessionId
          }
        });
        return;
      }
      
      // Store the plan
      this.storedActionPlans.set(tabId, {
        plans: actionPlan,
        tabId,
        timestamp: Date.now()
      });
      
      // Present plan to user
      const planDescription = actionPlan.map((action, i) => 
        `${i + 1}. ${action.description} (${Math.round(action.confidence * 100)}% confidence)`
      ).join('\n');
      
      sendResponse({
        type: 'MESSAGE',
        payload: {
          text: `I can help you with that! Here's my action plan:\n\n${planDescription}\n\nSay "do it" to execute these actions automatically.`,
          sessionId
        }
      });
      
    } catch (error) {
      console.error('Action planning failed:', error);
      sendResponse({
        type: 'MESSAGE',
        payload: {
          text: `Action planning failed: ${(error as Error).message}`,
          sessionId
        }
      });
    }
  }

  async executeStoredPlan(
    tabId: number,
    sendResponse: (response: ChatResponse) => void,
    sessionId: string
  ): Promise<void> {
    const stored = this.storedActionPlans.get(tabId);
    if (!stored) {
      sendResponse({
        type: 'MESSAGE',
        payload: {
          text: 'No action plan found. Please make a new request.',
          sessionId
        }
      });
      return;
    }
    
    try {
      // Execute actions one by one
      const results: ActionResult[] = [];
      
      for (const action of stored.plans) {
        const result = await this.executeAction(tabId, action);
        results.push(result);
        
        // Small delay between actions
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      // Generate summary
      const successful = results.filter(r => r.success).length;
      const total = results.length;
      
      let summary = `✅ Executed ${successful}/${total} actions successfully!\n\n`;
      stored.plans.forEach((action, i) => {
        const result = results[i];
        const status = result?.success ? '✅' : '❌';
        const error = result?.error ? ` (${result.error})` : '';
        summary += `${status} ${action.description}${error}\n`;
      });
      
      sendResponse({
        type: 'MESSAGE',
        payload: {
          text: summary,
          sessionId
        }
      });
      
      // Clean up
      this.storedActionPlans.delete(tabId);
      
    } catch (error) {
      console.error('Action execution failed:', error);
      sendResponse({
        type: 'MESSAGE',
        payload: {
          text: `Action execution failed: ${(error as Error).message}`,
          sessionId
        }
      });
    }
  }

  private createSimpleActionPlan(text: string, pageInfo: any): ActionPlan[] {
    const searchTerm = this.extractSearchTerm(text);
    const platform = this.detectPlatform(pageInfo.url);
    const selector = this.getSearchSelector(platform);
    
    return [{
      type: 'search',
      selector,
      value: searchTerm,
      description: `Search ${platform} for "${searchTerm}"`,
      confidence: 0.8
    }];
  }

  private extractSearchTerm(text: string): string {
    const patterns = [
      /videos about (.+)/i,
      /search for (.+)/i,
      /find (.+)/i,
      /look for (.+)/i
    ];
    
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return match[1].trim();
      }
    }
    
    return text.replace(/^(search|find|look for|videos about)\s*/i, '').trim();
  }

  private detectPlatform(url: string): string {
    if (url.includes('youtube.com')) return 'YouTube';
    if (url.includes('google.com')) return 'Google';
    if (url.includes('amazon.com')) return 'Amazon';
    return 'this website';
  }

  private getSearchSelector(platform: string): string {
    const selectors: { [key: string]: string } = {
      YouTube: 'input#search',
      Google: 'input[name="q"]',
      Amazon: 'input#twotabsearchtextbox'
    };
    return selectors[platform] || 'input[type="search"]';
  }

  private async executeAction(tabId: number, action: ActionPlan): Promise<ActionResult> {
    return new Promise((resolve) => {
      chrome.tabs.sendMessage(tabId, {
        type: 'EXECUTE_ACTION',
        action: action
      }, (response) => {
        if (chrome.runtime.lastError) {
          resolve({ success: false, error: chrome.runtime.lastError.message });
        } else {
          resolve(response || { success: false, error: 'No response' });
        }
      });
    });
  }

  private async getPageInfo(tabId: number): Promise<any> {
    return new Promise((resolve) => {
      chrome.tabs.sendMessage(tabId, { type: 'EXTRACT_PAGE_INFO' }, (pageInfo) => {
        if (chrome.runtime.lastError || !pageInfo) {
          resolve(null);
        } else {
          resolve(pageInfo);
        }
      });
    });
  }
} 