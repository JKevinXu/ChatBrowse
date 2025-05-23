import { loadFromStorage, saveToStorage } from './utils';

interface Settings {
  openaiApiKey?: string;
  showNotifications?: boolean;
  useCurrentBrowser?: boolean;
}

document.addEventListener('DOMContentLoaded', async () => {
  const apiKeyInput = document.getElementById('apiKeyInput') as HTMLInputElement | null;
  const useCurrentBrowserCheckbox = document.getElementById('useCurrentBrowserCheckbox') as HTMLInputElement | null;
  const notificationCheckbox = document.getElementById('notificationCheckbox') as HTMLInputElement | null;
  const saveButton = document.getElementById('saveButton') as HTMLButtonElement | null;
  const statusDiv = document.getElementById('status') as HTMLDivElement | null;
  const toggleApiKeyVisibilityButton = document.getElementById('toggleApiKeyVisibility') as HTMLButtonElement | null;

  // Check if elements exist
  if (!apiKeyInput || !useCurrentBrowserCheckbox || !notificationCheckbox || !saveButton || !statusDiv || !toggleApiKeyVisibilityButton) {
    console.error('One or more required elements not found in the DOM');
    return;
  }

  // Load current settings
  try {
    const settings = await loadFromStorage<Settings>('settings');
    if (settings) {
      apiKeyInput.value = settings.openaiApiKey || '';
      useCurrentBrowserCheckbox.checked = settings.useCurrentBrowser !== false; // Default to true
      notificationCheckbox.checked = settings.showNotifications !== false; // Default to true
    } else {
      // Default settings if none exist
      useCurrentBrowserCheckbox.checked = true;
      notificationCheckbox.checked = true;
    }
  } catch (error) {
    // Set defaults on error
    useCurrentBrowserCheckbox.checked = true;
    notificationCheckbox.checked = true;
    showMessage('Error loading settings: ' + (error as Error).message, 'error');
  }

  // Toggle API key visibility
  toggleApiKeyVisibilityButton.addEventListener('click', () => {
    if (apiKeyInput.type === 'password') {
      apiKeyInput.type = 'text';
      toggleApiKeyVisibilityButton.textContent = 'Hide';
    } else {
      apiKeyInput.type = 'password';
      toggleApiKeyVisibilityButton.textContent = 'Show';
    }
  });

  // Save settings when the button is clicked
  saveButton.addEventListener('click', async () => {
    const newSettings: Settings = {
      openaiApiKey: apiKeyInput.value.trim(),
      useCurrentBrowser: useCurrentBrowserCheckbox.checked,
      showNotifications: notificationCheckbox.checked
    };

    try {
      await saveToStorage('settings', newSettings);
      showMessage('Settings saved successfully!', 'success');
    } catch (error) {
      showMessage('Error saving settings: ' + (error as Error).message, 'error');
    }
  });

  function showMessage(text: string, type: 'success' | 'error') {
    if (!statusDiv) return;
    
    statusDiv.textContent = text;
    statusDiv.className = 'status ' + type;
    statusDiv.style.display = 'block';
    
    setTimeout(() => {
      if (statusDiv) {
        statusDiv.style.display = 'none';
      }
    }, 3000);
  }
}); 