import { loadFromStorage, saveToStorage } from './utils';

interface Settings {
  openaiApiKey?: string;
  theme?: 'light' | 'dark';
  fontSize?: 'small' | 'medium' | 'large';
  showNotifications?: boolean;
}

document.addEventListener('DOMContentLoaded', async () => {
  const apiKeyInput = document.getElementById('apiKey') as HTMLInputElement;
  const themeSelect = document.getElementById('theme') as HTMLSelectElement;
  const fontSizeSelect = document.getElementById('fontSize') as HTMLSelectElement;
  const showNotificationsCheckbox = document.getElementById('showNotifications') as HTMLInputElement;
  const saveButton = document.getElementById('saveButton') as HTMLButtonElement;
  const messageDiv = document.getElementById('message') as HTMLDivElement;

  // Load current settings
  try {
    const settings = await loadFromStorage<Settings>('settings');
    if (settings) {
      apiKeyInput.value = settings.openaiApiKey || '';
      themeSelect.value = settings.theme || 'light';
      fontSizeSelect.value = settings.fontSize || 'medium';
      showNotificationsCheckbox.checked = settings.showNotifications !== false;
    }
  } catch (error) {
    showMessage('Error loading settings: ' + (error as Error).message, 'error');
  }

  // Save settings when the button is clicked
  saveButton.addEventListener('click', async () => {
    const newSettings: Settings = {
      openaiApiKey: apiKeyInput.value.trim(),
      theme: themeSelect.value as 'light' | 'dark',
      fontSize: fontSizeSelect.value as 'small' | 'medium' | 'large',
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
    messageDiv.textContent = text;
    messageDiv.className = 'message ' + type;
    messageDiv.style.display = 'block';
    
    setTimeout(() => {
      messageDiv.style.display = 'none';
    }, 3000);
  }
}); 