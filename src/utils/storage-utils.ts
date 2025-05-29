/**
 * Save data to Chrome storage
 */
export function saveToStorage<T>(key: string, data: T): Promise<void> {
  console.log('🔧 Storage: saveToStorage called with key:', key, 'data type:', typeof data);
  
  return new Promise((resolve, reject) => {
    if (!chrome?.storage?.local) {
      console.error('❌ Storage: Chrome storage API not available');
      reject(new Error('Chrome storage API not available'));
      return;
    }
    
    console.log('🔧 Storage: Attempting to save to chrome.storage.local...');
    chrome.storage.local.set({ [key]: data }, () => {
      const error = chrome.runtime.lastError;
      if (error) {
        console.error('❌ Storage: Save error:', error);
        reject(error);
      } else {
        console.log('✅ Storage: Data saved successfully for key:', key);
        resolve();
      }
    });
  });
}

/**
 * Load data from Chrome storage
 */
export function loadFromStorage<T>(key: string): Promise<T | null> {
  console.log('🔧 Storage: loadFromStorage called with key:', key);
  
  return new Promise((resolve, reject) => {
    if (!chrome?.storage?.local) {
      console.error('❌ Storage: Chrome storage API not available');
      reject(new Error('Chrome storage API not available'));
      return;
    }
    
    console.log('🔧 Storage: Attempting to load from chrome.storage.local...');
    chrome.storage.local.get([key], (result: {[key: string]: any}) => {
      const error = chrome.runtime.lastError;
      if (error) {
        console.error('❌ Storage: Load error:', error);
        reject(error);
      } else {
        const data = result[key] || null;
        console.log('✅ Storage: Data loaded for key:', key, 'result:', data ? 'Found data' : 'No data');
        resolve(data);
      }
    });
  });
} 