/**
 * Save data to Chrome storage
 */
export function saveToStorage<T>(key: string, data: T): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!chrome?.storage?.local) {
      reject(new Error('Chrome storage API not available'));
      return;
    }
    
    chrome.storage.local.set({ [key]: data }, () => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
}

/**
 * Load data from Chrome storage
 */
export function loadFromStorage<T>(key: string): Promise<T | null> {
  return new Promise((resolve, reject) => {
    if (!chrome?.storage?.local) {
      reject(new Error('Chrome storage API not available'));
      return;
    }
    
    chrome.storage.local.get([key], (result: {[key: string]: any}) => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(error);
      } else {
        resolve(result[key] || null);
      }
    });
  });
} 