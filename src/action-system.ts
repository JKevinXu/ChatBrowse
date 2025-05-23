// Intelligent Action Execution System
// This module provides smart page interaction capabilities

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
  data?: any;
}

interface StoredActionPlan {
  plans: ActionPlan[];
  tabId: number;
  timestamp: number;
}

class IntelligentActionSystem {
  private storedActionPlans = new Map<number, StoredActionPlan>();

  isExecutionCommand(text: string): boolean {
    const executionPhrases = ['do it', 'execute', 'run it', 'go ahead', 'proceed'];
    return executionPhrases.some(phrase => text.includes(phrase));
  }

  isActionRequest(text: string): boolean {
    const actionKeywords = ['search', 'find', 'look for', 'videos about'];
    return actionKeywords.some(keyword => text.includes(keyword));
  }

  async executeSmartSearch(action: ActionPlan): Promise<ActionResult> {
    return new Promise((resolve) => {
      // This will be handled by content script
      chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
        if (tabs[0]?.id) {
          chrome.tabs.sendMessage(tabs[0].id, {
            type: 'EXECUTE_SMART_SEARCH',
            action: action
          }, (response) => {
            if (chrome.runtime.lastError) {
              resolve({ success: false, error: chrome.runtime.lastError.message });
            } else {
              resolve(response || { success: false, error: 'No response' });
            }
          });
        }
      });
    });
  }

  detectPlatformFromUrl(url: string): string {
    if (url.includes('youtube.com')) return 'YouTube';
    if (url.includes('google.com')) return 'Google';
    if (url.includes('amazon.com')) return 'Amazon';
    return 'this website';
  }

  getSearchSelector(platform: string): string {
    const selectors: { [key: string]: string } = {
      YouTube: 'input#search',
      Google: 'input[name="q"]',
      Amazon: 'input#twotabsearchtextbox'
    };
    return selectors[platform] || 'input[type="search"]';
  }

  extractSearchTerm(text: string): string {
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

  async createActionPlan(text: string, pageInfo: any): Promise<ActionPlan[]> {
    const platform = this.detectPlatformFromUrl(pageInfo.url);
    const searchTerm = this.extractSearchTerm(text);
    
    // Simple action plan creation
    return [{
      type: 'search',
      selector: this.getSearchSelector(platform),
      value: searchTerm,
      description: `Search ${platform} for "${searchTerm}"`,
      confidence: 0.9
    }];
  }

  storePlan(tabId: number, plans: ActionPlan[]) {
    this.storedActionPlans.set(tabId, {
      plans,
      tabId,
      timestamp: Date.now()
    });
  }

  getStoredPlan(tabId: number): StoredActionPlan | undefined {
    return this.storedActionPlans.get(tabId);
  }

  clearStoredPlan(tabId: number) {
    this.storedActionPlans.delete(tabId);
  }
}

// Export singleton instance
export const actionSystem = new IntelligentActionSystem();
export { ActionPlan, ActionResult, StoredActionPlan }; 