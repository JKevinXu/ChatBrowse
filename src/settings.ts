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
  
  // Bedrock elements
  const bedrockConfig = document.getElementById('bedrockConfig') as HTMLDivElement | null;
  const bedrockRegionSelect = document.getElementById('bedrockRegion') as HTMLSelectElement | null;
  const bedrockAccessKeyInput = document.getElementById('bedrockAccessKey') as HTMLInputElement | null;
  const bedrockSecretKeyInput = document.getElementById('bedrockSecretKey') as HTMLInputElement | null;
  const bedrockModelSelect = document.getElementById('bedrockModel') as HTMLSelectElement | null;
  const toggleBedrockAccessKey = document.getElementById('toggleBedrockAccessKey') as HTMLButtonElement | null;
  const toggleBedrockSecretKey = document.getElementById('toggleBedrockSecretKey') as HTMLButtonElement | null;
  
  // Inception elements
  const inceptionConfig = document.getElementById('inceptionConfig') as HTMLDivElement | null;
  const inceptionApiKeyInput = document.getElementById('inceptionApiKey') as HTMLInputElement | null;
  const inceptionModelSelect = document.getElementById('inceptionModel') as HTMLSelectElement | null;
  const inceptionBaseUrlInput = document.getElementById('inceptionBaseUrl') as HTMLInputElement | null;
  const toggleInceptionApiKey = document.getElementById('toggleInceptionApiKey') as HTMLButtonElement | null;
  
  // Other elements
  const useCurrentBrowserCheckbox = document.getElementById('useCurrentBrowserCheckbox') as HTMLInputElement | null;
  const notificationCheckbox = document.getElementById('notificationCheckbox') as HTMLInputElement | null;
  const saveButton = document.getElementById('saveButton') as HTMLButtonElement | null;
  const statusDiv = document.getElementById('status') as HTMLDivElement | null;

  // Check if elements exist
  if (!llmProviderSelect || !openaiConfig || !bedrockConfig || !inceptionConfig || !saveButton || !statusDiv) {
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
        
        if (settings.llm.inception && inceptionApiKeyInput && inceptionModelSelect && inceptionBaseUrlInput) {
          inceptionApiKeyInput.value = settings.llm.inception.apiKey || '';
          inceptionModelSelect.value = settings.llm.inception.model || 'mercury-coder';
          inceptionBaseUrlInput.value = settings.llm.inception.baseUrl || 'https://api.inceptionlabs.ai/v1';
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
    inceptionConfig.classList.toggle('active', selectedProvider === 'inception');
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
  setupToggleButton(toggleInceptionApiKey, inceptionApiKeyInput);



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
    
    if (selectedProvider === 'inception' && inceptionApiKeyInput && inceptionModelSelect && inceptionBaseUrlInput) {
      llmSettings.inception = {
        apiKey: inceptionApiKeyInput.value.trim(),
        model: inceptionModelSelect.value,
        baseUrl: inceptionBaseUrlInput.value.trim() || 'https://api.inceptionlabs.ai/v1'
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