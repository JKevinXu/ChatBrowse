import { loadFromStorage, saveToStorage } from '../utils';
import { LLMProvider, LLMSettings, OpenAIConfig, BedrockConfig } from '../types';

export interface AppSettings {
  showNotifications: boolean;
  openaiApiKey: string;
  theme?: 'light' | 'dark';
  language?: string;
  llm?: LLMSettings;
}

export class ConfigService {
  private static instance: ConfigService;
  private settings: AppSettings | null = null;

  private constructor() {}

  static getInstance(): ConfigService {
    if (!ConfigService.instance) {
      ConfigService.instance = new ConfigService();
    }
    return ConfigService.instance;
  }

  // Clear cache and force reload from storage
  clearCache(): void {
    console.log('[ConfigService] Cache cleared - will reload settings from storage');
    this.settings = null;
  }

  async loadSettings(): Promise<AppSettings> {
    if (this.settings) {
      return this.settings;
    }

    try {
      const storedSettings = await loadFromStorage<AppSettings>('settings');
      this.settings = storedSettings || this.getDefaultSettings();
      
      // Migrate old OpenAI settings to new LLM structure if needed
      if (this.settings.openaiApiKey && !this.settings.llm) {
        this.settings.llm = {
          provider: 'openai',
          openai: {
            apiKey: this.settings.openaiApiKey,
            model: 'gpt-4-turbo'
          }
        };
        await this.saveSettings();
      }
      
      return this.settings;
    } catch (error) {
      console.error('Failed to load settings:', error);
      this.settings = this.getDefaultSettings();
      return this.settings;
    }
  }

  async updateSettings(newSettings: Partial<AppSettings>): Promise<void> {
    await this.loadSettings(); // Ensure settings are loaded
    
    this.settings = {
      ...this.settings!,
      ...newSettings
    };

    console.log('[ConfigService] Settings updated:', JSON.stringify({
      provider: this.settings.llm?.provider,
      bedrockModel: this.settings.llm?.bedrock?.model,
      openaiModel: this.settings.llm?.openai?.model
    }, null, 2));

    await this.saveSettings();
  }

  private async saveSettings(): Promise<void> {
    try {
      await saveToStorage('settings', this.settings);
    } catch (error) {
      console.error('Failed to save settings:', error);
      throw error;
    }
  }

  async getSetting<K extends keyof AppSettings>(key: K): Promise<AppSettings[K]> {
    const settings = await this.loadSettings();
    return settings[key];
  }

  async setSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]): Promise<void> {
    await this.updateSettings({ [key]: value } as Partial<AppSettings>);
  }

  getDefaultSettings(): AppSettings {
    return {
      showNotifications: true,
      openaiApiKey: '',
      theme: 'light',
      language: 'en',
      llm: {
        provider: 'openai',
        openai: {
          apiKey: '',
          model: 'gpt-4-turbo'
        },
        bedrock: {
          region: 'us-east-1',
          accessKeyId: '',
          secretAccessKey: '',
          model: 'claude-4-sonnet'
        }
      }
    };
  }

  // LLM-specific methods
  async getLLMSettings(): Promise<LLMSettings> {
    const settings = await this.loadSettings();
    return settings.llm || this.getDefaultSettings().llm!;
  }

  async setLLMProvider(provider: LLMProvider): Promise<void> {
    const currentLLM = await this.getLLMSettings();
    await this.updateSettings({
      llm: {
        ...currentLLM,
        provider
      }
    });
  }

  async setOpenAIConfig(config: OpenAIConfig): Promise<void> {
    const currentLLM = await this.getLLMSettings();
    await this.updateSettings({
      llm: {
        ...currentLLM,
        provider: 'openai',
        openai: config
      },
      openaiApiKey: config.apiKey // Keep backward compatibility
    });
  }

  async setBedrockConfig(config: BedrockConfig): Promise<void> {
    const currentLLM = await this.getLLMSettings();
    await this.updateSettings({
      llm: {
        ...currentLLM,
        provider: 'bedrock',
        bedrock: config
      }
    });
  }

  // Convenience methods for common settings
  async getOpenAIApiKey(): Promise<string> {
    const llmSettings = await this.getLLMSettings();
    return llmSettings.openai?.apiKey || this.getSetting('openaiApiKey') || '';
  }

  async setOpenAIApiKey(apiKey: string): Promise<void> {
    await this.setSetting('openaiApiKey', apiKey);
    const currentLLM = await this.getLLMSettings();
    if (currentLLM.openai) {
      await this.setOpenAIConfig({
        ...currentLLM.openai,
        apiKey
      });
    }
  }

  async getNotificationPreference(): Promise<boolean> {
    return this.getSetting('showNotifications');
  }

  async setNotificationPreference(enabled: boolean): Promise<void> {
    await this.setSetting('showNotifications', enabled);
  }
} 