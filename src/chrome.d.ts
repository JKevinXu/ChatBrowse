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
    openOptionsPage?: () => void;
    getURL: (path: string) => string;
    connectNative: (application: string) => chrome.runtime.Port;
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
    onChanged: {
      addListener: (callback: (changes: { [key: string]: { oldValue?: any; newValue?: any } }, namespace: string) => void) => void;
      removeListener: (callback: (changes: { [key: string]: { oldValue?: any; newValue?: any } }, namespace: string) => void) => void;
    };
  };
  
  tabs: {
    query: (queryInfo: object, callback: (tabs: any[]) => void) => void;
    create: (createProperties: object, callback?: (tab: any) => void) => void;
    update: (tabId: number, updateProperties: { url?: string, active?: boolean }, callback?: (tab?: any) => void) => void;
    sendMessage: (tabId: number, message: any, callback?: (response: any) => void) => void;
    get: (tabId: number, callback: (tab: any) => void) => void;
    captureVisibleTab: (windowId: number | undefined, options: { format: 'png' | 'jpeg' }, callback: (dataUrl: string) => void) => void;
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
    connectNative: (application: string) => Port;
  }

  export interface Port {
    name: string;
    onDisconnect: {
      addListener: (callback: () => void) => void;
      removeListener: (callback: () => void) => void;
    };
    onMessage: {
      addListener: (callback: (message: any) => void) => void;
      removeListener: (callback: (message: any) => void) => void;
    };
    postMessage: (message: any) => void;
    disconnect: () => void;
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

  export interface StorageChange {
    oldValue?: any;
    newValue?: any;
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
    onChanged: {
      addListener: (callback: (changes: { [key: string]: StorageChange }, namespace: string) => void) => void;
      removeListener: (callback: (changes: { [key: string]: StorageChange }, namespace: string) => void) => void;
    };
  }

  export interface Tabs {
    query: (queryInfo: object, callback: (tabs: any[]) => void) => void;
    create: (createProperties: object, callback?: (tab: any) => void) => void;
    update: (tabId: number, updateProperties: { url?: string, active?: boolean }, callback?: (tab?: any) => void) => void;
    sendMessage: (tabId: number, message: any, callback?: (response: any) => void) => void;
    get: (tabId: number, callback: (tab: any) => void) => void;
    captureVisibleTab: (windowId: number | undefined, options: { format: 'png' | 'jpeg' }, callback: (dataUrl: string) => void) => void;
  }

  export const runtime: Runtime;
  export const storage: Storage;
  export const tabs: Tabs;
}

declare const chrome: Chrome; 