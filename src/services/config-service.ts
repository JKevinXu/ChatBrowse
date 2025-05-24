import { loadFromStorage, saveToStorage } from '../utils';

export interface AppSettings {
  showNotifications: boolean;
  openaiApiKey: string;
  theme?: 'light' | 'dark';
  language?: string;
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

  async loadSettings(): Promise<AppSettings> {
    if (this.settings) {
      return this.settings;
    }

    try {
      const storedSettings = await loadFromStorage<AppSettings>('settings');
      this.settings = storedSettings || this.getDefaultSettings();
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
      language: 'en'
    };
  }

  // Convenience methods for common settings
  async getOpenAIApiKey(): Promise<string> {
    return this.getSetting('openaiApiKey');
  }

  async setOpenAIApiKey(apiKey: string): Promise<void> {
    await this.setSetting('openaiApiKey', apiKey);
  }

  async getNotificationPreference(): Promise<boolean> {
    return this.getSetting('showNotifications');
  }

  async setNotificationPreference(enabled: boolean): Promise<void> {
    await this.setSetting('showNotifications', enabled);
  }
} 