import { loadFromStorage, saveToStorage } from './utils';

interface Settings {
  openaiApiKey?: string;
  showNotifications?: boolean;
}

document.addEventListener('DOMContentLoaded', async () => {
  const apiKeyInput = document.getElementById('apiKey') as HTMLInputElement | null;
  const showNotificationsCheckbox = document.getElementById('showNotifications') as HTMLInputElement | null;
  const saveButton = document.getElementById('saveButton') as HTMLButtonElement | null;
  const messageDiv = document.getElementById('message') as HTMLDivElement | null;

  // Check if elements exist
  if (!apiKeyInput || !showNotificationsCheckbox || !saveButton || !messageDiv) {
    console.error('One or more required elements not found in the DOM');
    return;
  }

  // Load current settings
  try {
    const settings = await loadFromStorage<Settings>('settings');
    if (settings) {
      apiKeyInput.value = settings.openaiApiKey || '';
      showNotificationsCheckbox.checked = settings.showNotifications !== false;
    } else {
      // Default settings if none exist
      showNotificationsCheckbox.checked = true;
    }
  } catch (error) {
    // Set defaults on error
    showNotificationsCheckbox.checked = true;
    showMessage('Error loading settings: ' + (error as Error).message, 'error');
  }

  // Save settings when the button is clicked
  saveButton.addEventListener('click', async () => {
    const newSettings: Settings = {
      openaiApiKey: apiKeyInput.value.trim(),
      showNotifications: showNotificationsCheckbox.checked
    };

    try {
      await saveToStorage('settings', newSettings);
      showMessage('Settings saved successfully!', 'success');
    } catch (error) {
      showMessage('Error saving settings: ' + (error as Error).message, 'error');
    }
  });

  function showMessage(text: string, type: 'success' | 'error') {
    if (!messageDiv) return;
    
    messageDiv.textContent = text;
    messageDiv.className = 'message ' + type;
    messageDiv.style.display = 'block';
    
    setTimeout(() => {
      if (messageDiv) {
        messageDiv.style.display = 'none';
      }
    }, 3000);
  }
}); 