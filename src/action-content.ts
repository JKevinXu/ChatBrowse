// Content script for intelligent actions
// This handles the actual page manipulation

interface SmartSearchAction {
  type: string;
  selector: string;
  value?: string;
  description: string;
  confidence: number;
}

// Add message listener for smart search
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'EXECUTE_SMART_SEARCH') {
    executeSmartSearchAction(request.action).then(result => {
      sendResponse(result);
    }).catch(error => {
      sendResponse({ success: false, error: error.message });
    });
    return true;
  }
});

async function executeSmartSearchAction(action: SmartSearchAction) {
  console.log('🎯 SMART SEARCH:', action);
  
  try {
    const platform = detectPlatform();
    const config = getSearchConfig(platform);
    
    // Step 1: Find and fill search box
    const searchBox = document.querySelector(config.searchSelector) as HTMLInputElement;
    if (!searchBox) {
      throw new Error(`Search box not found: ${config.searchSelector}`);
    }
    
    // Focus and fill search box
    searchBox.focus();
    searchBox.value = action.value || '';
    searchBox.dispatchEvent(new Event('input', { bubbles: true }));
    
    // Step 2: Submit search
    let submitSuccess = false;
    
    // Try clicking submit button first
    if (config.submitSelector) {
      try {
        const submitButton = document.querySelector(config.submitSelector) as HTMLElement;
        if (submitButton) {
          submitButton.click();
          submitSuccess = true;
        }
      } catch (error) {
        console.log('Submit button click failed, trying Enter key');
      }
    }
    
    // Fallback to Enter key
    if (!submitSuccess) {
      searchBox.dispatchEvent(new KeyboardEvent('keydown', { 
        key: 'Enter', 
        bubbles: true 
      }));
      submitSuccess = true;
    }
    
    return {
      success: submitSuccess,
      data: {
        platform,
        query: action.value,
        method: submitSuccess ? 'completed' : 'failed'
      }
    };
    
  } catch (error) {
    return { 
      success: false, 
      error: (error as Error).message 
    };
  }
}

function detectPlatform(): string {
  const url = window.location.href;
  if (url.includes('youtube.com')) return 'youtube';
  if (url.includes('google.com')) return 'google';
  if (url.includes('amazon.com')) return 'amazon';
  return 'generic';
}

function getSearchConfig(platform: string) {
  const configs = {
    youtube: {
      searchSelector: 'input#search',
      submitSelector: 'button#search-icon-legacy'
    },
    google: {
      searchSelector: 'input[name="q"]',
      submitSelector: 'button[name="btnK"]'
    },
    amazon: {
      searchSelector: 'input#twotabsearchtextbox',
      submitSelector: 'input#nav-search-submit-button'
    },
    generic: {
      searchSelector: 'input[type="search"]',
      submitSelector: 'button[type="submit"]'
    }
  };
  
  return configs[platform] || configs.generic;
}

console.log('🚀 Action Content Script Loaded'); 