// Type definitions for Chrome extension API
// Project: https://developer.chrome.com/docs/extensions/reference

interface Chrome {
  runtime: {
    lastError?: {
      message?: string;
    };
    onMessage: {
      addListener: (callback: (message: any, sender: any, sendResponse: (response?: any) => void) => void) => void;
      removeListener: (callback: (message: any, sender: any, sendResponse: (response?: any) => void) => void) => void;
    };
    sendMessage: (message: any, callback?: (response: any) => void) => void;
    onInstalled: {
      addListener: (callback: (details: { reason: string; previousVersion?: string; temporary?: boolean }) => void) => void;
    };
  };
  
  storage: {
    local: {
      get: (keys: string | string[] | object | null, callback: (items: { [key: string]: any }) => void) => void;
      set: (items: object, callback?: () => void) => void;
      remove: (keys: string | string[], callback?: () => void) => void;
      clear: (callback?: () => void) => void;
    };
    sync?: {
      get: (keys: string | string[] | object | null, callback: (items: { [key: string]: any }) => void) => void;
      set: (items: object, callback?: () => void) => void;
      remove: (keys: string | string[], callback?: () => void) => void;
      clear: (callback?: () => void) => void;
    };
  };
  
  tabs: {
    query: (queryInfo: object, callback: (tabs: any[]) => void) => void;
    create: (createProperties: object, callback?: (tab: any) => void) => void;
    update: (tabId: number, updateProperties: { url?: string, active?: boolean }, callback?: (tab?: any) => void) => void;
    sendMessage: (tabId: number, message: any, callback?: (response: any) => void) => void;
  };
}

declare namespace chrome {
  export interface Runtime {
    lastError?: {
      message?: string;
    };
    onMessage: {
      addListener: (callback: (message: any, sender: MessageSender, sendResponse: (response?: any) => void) => void) => void;
      removeListener: (callback: (message: any, sender: MessageSender, sendResponse: (response?: any) => void) => void) => void;
    };
    sendMessage: (message: any, callback?: (response: any) => void) => void;
    onInstalled: {
      addListener: (callback: (details: { reason: string; previousVersion?: string; temporary?: boolean }) => void) => void;
    };
  }

  export interface MessageSender {
    tab?: {
      id?: number;
      url?: string;
    };
    frameId?: number;
    id?: string;
    url?: string;
    tlsChannelId?: string;
  }

  export interface Storage {
    local: {
      get: (keys: string | string[] | object | null, callback: (items: { [key: string]: any }) => void) => void;
      set: (items: object, callback?: () => void) => void;
      remove: (keys: string | string[], callback?: () => void) => void;
      clear: (callback?: () => void) => void;
    };
    sync?: {
      get: (keys: string | string[] | object | null, callback: (items: { [key: string]: any }) => void) => void;
      set: (items: object, callback?: () => void) => void;
      remove: (keys: string | string[], callback?: () => void) => void;
      clear: (callback?: () => void) => void;
    };
  }

  export interface Tabs {
    query: (queryInfo: object, callback: (tabs: any[]) => void) => void;
    create: (createProperties: object, callback?: (tab: any) => void) => void;
    update: (tabId: number, updateProperties: { url?: string, active?: boolean }, callback?: (tab?: any) => void) => void;
    sendMessage: (tabId: number, message: any, callback?: (response: any) => void) => void;
  }

  export const runtime: Runtime;
  export const storage: Storage;
  export const tabs: Tabs;
}

declare const chrome: Chrome; 