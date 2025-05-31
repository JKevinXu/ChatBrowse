import { loadFromStorage, saveToStorage } from './utils';
import { LLMProvider, LLMSettings } from './types';

interface Settings {
  openaiApiKey?: string;
  showNotifications?: boolean;
  useCurrentBrowser?: boolean;
  llm?: LLMSettings;
}

document.addEventListener('DOMContentLoaded', async () => {
  // Get all form elements
  const llmProviderSelect = document.getElementById('llmProvider') as HTMLSelectElement | null;
  
  // OpenAI elements
  const openaiConfig = document.getElementById('openaiConfig') as HTMLDivElement | null;
  const openaiApiKeyInput = document.getElementById('openaiApiKey') as HTMLInputElement | null;
  const openaiModelSelect = document.getElementById('openaiModel') as HTMLSelectElement | null;
  const toggleOpenaiApiKey = document.getElementById('toggleOpenaiApiKey') as HTMLButtonElement | null;
  const testOpenaiConnection = document.getElementById('testOpenaiConnection') as HTMLButtonElement | null;
  
  // Bedrock elements
  const bedrockConfig = document.getElementById('bedrockConfig') as HTMLDivElement | null;
  const bedrockRegionSelect = document.getElementById('bedrockRegion') as HTMLSelectElement | null;
  const bedrockAccessKeyInput = document.getElementById('bedrockAccessKey') as HTMLInputElement | null;
  const bedrockSecretKeyInput = document.getElementById('bedrockSecretKey') as HTMLInputElement | null;
  const bedrockModelSelect = document.getElementById('bedrockModel') as HTMLSelectElement | null;
  const toggleBedrockAccessKey = document.getElementById('toggleBedrockAccessKey') as HTMLButtonElement | null;
  const toggleBedrockSecretKey = document.getElementById('toggleBedrockSecretKey') as HTMLButtonElement | null;
  const testBedrockConnection = document.getElementById('testBedrockConnection') as HTMLButtonElement | null;
  
  // Other elements
  const useCurrentBrowserCheckbox = document.getElementById('useCurrentBrowserCheckbox') as HTMLInputElement | null;
  const notificationCheckbox = document.getElementById('notificationCheckbox') as HTMLInputElement | null;
  const saveButton = document.getElementById('saveButton') as HTMLButtonElement | null;
  const statusDiv = document.getElementById('status') as HTMLDivElement | null;

  // Check if elements exist
  if (!llmProviderSelect || !openaiConfig || !bedrockConfig || !saveButton || !statusDiv) {
    console.error('One or more required elements not found in the DOM');
    return;
  }

  // Load current settings
  try {
    const settings = await loadFromStorage<Settings>('settings');
    
    if (settings) {
      // Load LLM settings
      if (settings.llm) {
        llmProviderSelect.value = settings.llm.provider;
        
        if (settings.llm.openai && openaiApiKeyInput && openaiModelSelect) {
          openaiApiKeyInput.value = settings.llm.openai.apiKey || '';
          openaiModelSelect.value = settings.llm.openai.model || 'gpt-4-turbo';
        }
        
        if (settings.llm.bedrock && bedrockRegionSelect && bedrockAccessKeyInput && bedrockSecretKeyInput && bedrockModelSelect) {
          bedrockRegionSelect.value = settings.llm.bedrock.region || 'us-east-1';
          bedrockAccessKeyInput.value = settings.llm.bedrock.accessKeyId || '';
          bedrockSecretKeyInput.value = settings.llm.bedrock.secretAccessKey || '';
          bedrockModelSelect.value = settings.llm.bedrock.model || 'claude-3-5-sonnet';
        }
      } else {
        // Migrate from old settings
        llmProviderSelect.value = 'openai';
        if (openaiApiKeyInput) {
          openaiApiKeyInput.value = settings.openaiApiKey || '';
        }
      }
      
      // Load other settings
      if (useCurrentBrowserCheckbox) {
        useCurrentBrowserCheckbox.checked = settings.useCurrentBrowser !== false;
      }
      if (notificationCheckbox) {
        notificationCheckbox.checked = settings.showNotifications !== false;
      }
    } else {
      // Default settings
      llmProviderSelect.value = 'openai';
      if (useCurrentBrowserCheckbox) useCurrentBrowserCheckbox.checked = true;
      if (notificationCheckbox) notificationCheckbox.checked = true;
    }
  } catch (error) {
    console.error('Error loading settings:', error);
    showMessage('Error loading settings: ' + (error as Error).message, 'error');
  }

  // Update provider config visibility
  const updateProviderConfig = () => {
    const selectedProvider = llmProviderSelect.value as LLMProvider;
    
    openaiConfig.classList.toggle('active', selectedProvider === 'openai');
    bedrockConfig.classList.toggle('active', selectedProvider === 'bedrock');
  };

  // Initialize provider config visibility
  updateProviderConfig();

  // Provider selection change handler
  llmProviderSelect.addEventListener('change', updateProviderConfig);

  // Toggle visibility buttons
  const setupToggleButton = (button: HTMLButtonElement | null, input: HTMLInputElement | null) => {
    if (!button || !input) return;
    
    button.addEventListener('click', () => {
      if (input.type === 'password') {
        input.type = 'text';
        button.textContent = 'Hide';
      } else {
        input.type = 'password';
        button.textContent = 'Show';
      }
    });
  };

  setupToggleButton(toggleOpenaiApiKey, openaiApiKeyInput);
  setupToggleButton(toggleBedrockAccessKey, bedrockAccessKeyInput);
  setupToggleButton(toggleBedrockSecretKey, bedrockSecretKeyInput);

  // Test connection buttons
  testOpenaiConnection?.addEventListener('click', async () => {
    if (!openaiApiKeyInput?.value.trim()) {
      showMessage('Please enter your OpenAI API key first.', 'error');
      return;
    }
    
    showMessage('Testing OpenAI connection...', 'success');
    
    try {
      // We would need to implement a test endpoint in the background script
      showMessage('OpenAI connection test not implemented yet.', 'error');
    } catch (error) {
      showMessage('OpenAI connection test failed: ' + (error as Error).message, 'error');
    }
  });

  testBedrockConnection?.addEventListener('click', async () => {
    if (!bedrockAccessKeyInput?.value.trim() || !bedrockSecretKeyInput?.value.trim()) {
      showMessage('Please enter your AWS credentials first.', 'error');
      return;
    }
    
    showMessage('Testing AWS Bedrock connection...', 'success');
    
    try {
      // We would need to implement a test endpoint in the background script
      showMessage('Bedrock connection test not implemented yet.', 'error');
    } catch (error) {
      showMessage('Bedrock connection test failed: ' + (error as Error).message, 'error');
    }
  });

  // Save settings when the button is clicked
  saveButton.addEventListener('click', async () => {
    const selectedProvider = llmProviderSelect.value as LLMProvider;
    
    const llmSettings: LLMSettings = {
      provider: selectedProvider
    };
    
    if (selectedProvider === 'openai' && openaiApiKeyInput && openaiModelSelect) {
      llmSettings.openai = {
        apiKey: openaiApiKeyInput.value.trim(),
        model: openaiModelSelect.value
      };
    }
    
    if (selectedProvider === 'bedrock' && bedrockRegionSelect && bedrockAccessKeyInput && bedrockSecretKeyInput && bedrockModelSelect) {
      llmSettings.bedrock = {
        region: bedrockRegionSelect.value,
        accessKeyId: bedrockAccessKeyInput.value.trim(),
        secretAccessKey: bedrockSecretKeyInput.value.trim(),
        model: bedrockModelSelect.value
      };
    }

    const newSettings: Settings = {
      llm: llmSettings,
      useCurrentBrowser: useCurrentBrowserCheckbox?.checked ?? true,
      showNotifications: notificationCheckbox?.checked ?? true,
      // Keep backward compatibility
      openaiApiKey: selectedProvider === 'openai' ? llmSettings.openai?.apiKey : ''
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