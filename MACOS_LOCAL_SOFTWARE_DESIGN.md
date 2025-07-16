# ChatBrowse Mac Local Software Design Document

## Executive Summary

This document outlines the design and implementation strategy for converting ChatBrowse from a Chrome extension into a local Mac software application. The design preserves all core functionality while leveraging native macOS capabilities for enhanced performance, security, and user experience.

## Table of Contents

1. [Current Architecture Analysis](#current-architecture-analysis)
2. [Recommended Approach: Electron with Native Integration](#recommended-approach)
3. [Alternative Approaches](#alternative-approaches)
4. [Implementation Plan](#implementation-plan)
5. [Architecture Design](#architecture-design)
6. [Migration Strategy](#migration-strategy)
7. [Technical Specifications](#technical-specifications)
8. [Timeline and Milestones](#timeline-and-milestones)

---

## Current Architecture Analysis

### Core Components
ChatBrowse currently consists of:

- **Chrome Extension**: TypeScript-based with manifest v3
- **Service Layer**: 12 modular services handling different aspects
- **MCP Server**: Node.js with Playwright for web automation
- **AI Integration**: OpenAI, AWS Bedrock, Inception Labs support
- **Content Scripts**: Page interaction and DOM manipulation
- **Background Service Worker**: Message routing and state management

### Key Features to Preserve
1. **Intelligent Action System**: Natural language command processing
2. **Multi-Platform Search**: Google, Bilibili, Xiaohongshu integration
3. **Content Extraction**: Page analysis and summarization
4. **Chat Interface**: Persistent sessions with context awareness
5. **MCP Integration**: Model Context Protocol for AI assistant connectivity

---

## Recommended Approach: Electron with Native Integration

### Why Electron + Native Hybrid?

1. **Code Reuse**: Preserve 90%+ of existing TypeScript codebase
2. **Fast Development**: Minimal refactoring required
3. **Cross-Platform Future**: Easy expansion to Windows/Linux
4. **Rich Ecosystem**: Extensive library support
5. **Native Integration**: macOS-specific features via native modules

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   ChatBrowse Mac App                        │
├─────────────────────────────────────────────────────────────┤
│  Electron Main Process                                      │
│  ├── App Management                                         │
│  ├── Menu & System Integration                              │
│  ├── Native Browser Integration                             │
│  └── Security & Permissions                                 │
├─────────────────────────────────────────────────────────────┤
│  Renderer Process (UI)                                      │
│  ├── React/Vue Frontend                                     │
│  ├── Chat Interface                                         │
│  ├── Browser View Component                                 │
│  └── Settings & Configuration                               │
├─────────────────────────────────────────────────────────────┤
│  Service Layer (Preserved from Extension)                   │
│  ├── MessageRouter                                          │
│  ├── LLMService (OpenAI, Bedrock, Inception)               │
│  ├── SearchService                                          │
│  ├── ActionService                                          │
│  ├── NavigationService                                      │
│  ├── ExtractionService                                      │
│  └── ContextService                                         │
├─────────────────────────────────────────────────────────────┤
│  Enhanced MCP Server                                        │
│  ├── Web Automation (Playwright)                           │
│  ├── Content Extraction                                     │
│  ├── AI Assistant Integration                               │
│  └── External API Coordination                              │
├─────────────────────────────────────────────────────────────┤
│  Native macOS Integration                                   │
│  ├── Spotlight Integration                                  │
│  ├── System Browser Control                                 │
│  ├── Notification Center                                    │
│  ├── Touch Bar Support                                      │
│  └── Accessibility Services                                 │
└─────────────────────────────────────────────────────────────┘
```

---

## Implementation Plan

### Phase 1: Core Electron App (Weeks 1-2)

#### 1.1 Project Setup
```bash
mkdir chatbrowse-mac
cd chatbrowse-mac
npm init -y
npm install electron electron-builder electron-store
npm install --save-dev @types/node typescript webpack
```

#### 1.2 Main Process Architecture
```typescript
// src/main/main.ts
import { app, BrowserWindow, Menu, dialog, shell } from 'electron';
import { MessageRouter } from '../services/message-router';
import { NativeBrowserController } from './native-browser-controller';

class ChatBrowseApp {
  private mainWindow: BrowserWindow | null = null;
  private messageRouter: MessageRouter;
  private browserController: NativeBrowserController;

  constructor() {
    this.messageRouter = new MessageRouter();
    this.browserController = new NativeBrowserController();
    this.initializeApp();
  }

  private async initializeApp(): Promise<void> {
    await app.whenReady();
    this.createMainWindow();
    this.setupMenus();
    this.setupIPC();
  }

  private createMainWindow(): void {
    this.mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js')
      },
      titleBarStyle: 'hiddenInset', // macOS-specific
      vibrancy: 'sidebar' // macOS-specific
    });
  }
}
```

#### 1.3 Browser Integration Component
```typescript
// src/main/native-browser-controller.ts
import { BrowserView, BrowserWindow } from 'electron';
import { shell } from 'electron';

export class NativeBrowserController {
  private browserView: BrowserView | null = null;

  async navigateTo(url: string, parentWindow: BrowserWindow): Promise<void> {
    if (!this.browserView) {
      this.browserView = new BrowserView({
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true
        }
      });
      parentWindow.setBrowserView(this.browserView);
    }

    await this.browserView.webContents.loadURL(url);
    this.setupBrowserEvents();
  }

  async extractPageContent(): Promise<any> {
    if (!this.browserView) return null;
    
    return await this.browserView.webContents.executeJavaScript(`
      ({
        title: document.title,
        url: window.location.href,
        content: document.body.innerText,
        html: document.body.innerHTML
      })
    `);
  }

  private setupBrowserEvents(): void {
    if (!this.browserView) return;
    
    this.browserView.webContents.on('did-finish-load', () => {
      this.extractPageContent().then(content => {
        // Send to renderer process
        this.browserView?.webContents.send('page-loaded', content);
      });
    });
  }
}
```

### Phase 2: Service Layer Migration (Weeks 3-4)

#### 2.1 Service Adaptation
```typescript
// src/services/electron-message-router.ts
import { ipcMain, IpcMainEvent } from 'electron';
import { MessageRouter as BaseMessageRouter } from './message-router';

export class ElectronMessageRouter extends BaseMessageRouter {
  constructor() {
    super();
    this.setupIPCHandlers();
  }

  private setupIPCHandlers(): void {
    ipcMain.handle('chat-message', async (event: IpcMainEvent, payload: any) => {
      return new Promise((resolve) => {
        this.route(
          { type: 'SEND_MESSAGE', payload },
          { 
            // Electron context instead of Chrome context
            source: 'electron-renderer',
            frameId: 0
          },
          (response) => resolve(response)
        );
      });
    });

    ipcMain.handle('navigate', async (event: IpcMainEvent, url: string) => {
      return this.handleElectronNavigation(url);
    });

    ipcMain.handle('extract-content', async (event: IpcMainEvent) => {
      return this.handleElectronExtraction();
    });
  }

  private async handleElectronNavigation(url: string): Promise<any> {
    // Use Electron BrowserView instead of Chrome tabs
    const browserController = new NativeBrowserController();
    await browserController.navigateTo(url, this.getMainWindow());
    
    return {
      type: 'SUCCESS',
      payload: { message: `Navigated to ${url}` }
    };
  }
}
```

#### 2.2 LLM Service Adaptation
```typescript
// src/services/electron-llm-service.ts
import { LLMService as BaseLLMService } from './llm-service';

export class ElectronLLMService extends BaseLLMService {
  async handleChat(payload: any, context: any, sendResponse: any): Promise<void> {
    // Adapt context for Electron instead of Chrome
    const electronContext = {
      ...payload,
      tabId: 'electron-browser-view',
      tabUrl: await this.getCurrentUrl(),
      tabTitle: await this.getCurrentTitle()
    };

    return super.handleChat(electronContext, context, sendResponse);
  }

  private async getCurrentUrl(): Promise<string> {
    // Get URL from Electron BrowserView
    return 'electron://current-page';
  }

  private async getCurrentTitle(): Promise<string> {
    // Get title from Electron BrowserView
    return 'Current Page';
  }
}
```

### Phase 3: Enhanced UI Development (Weeks 5-6)

#### 3.1 React Frontend
```typescript
// src/renderer/components/ChatInterface.tsx
import React, { useState, useEffect } from 'react';
import { ipcRenderer } from 'electron';

interface Message {
  id: string;
  text: string;
  type: 'user' | 'ai';
  timestamp: Date;
}

export const ChatInterface: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');

  const sendMessage = async () => {
    if (!inputText.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputText,
      type: 'user',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');

    try {
      const response = await ipcRenderer.invoke('chat-message', {
        text: inputText,
        sessionId: 'main-session'
      });

      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: response.payload.text,
        type: 'ai',
        timestamp: new Date()
      };

      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  return (
    <div className="chat-interface">
      <div className="messages">
        {messages.map(message => (
          <div key={message.id} className={`message ${message.type}`}>
            <div className="message-content">{message.text}</div>
            <div className="message-time">
              {message.timestamp.toLocaleTimeString()}
            </div>
          </div>
        ))}
      </div>
      <div className="input-area">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
          placeholder="Type your command or question..."
        />
        <button onClick={sendMessage}>Send</button>
      </div>
    </div>
  );
};
```

#### 3.2 Browser View Component
```typescript
// src/renderer/components/BrowserView.tsx
import React, { useRef, useEffect } from 'react';
import { ipcRenderer } from 'electron';

export const BrowserView: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ipcRenderer.on('page-loaded', (event, pageData) => {
      console.log('Page loaded:', pageData);
      // Update UI with page information
    });

    return () => {
      ipcRenderer.removeAllListeners('page-loaded');
    };
  }, []);

  const navigateToUrl = async (url: string) => {
    try {
      await ipcRenderer.invoke('navigate', url);
    } catch (error) {
      console.error('Navigation error:', error);
    }
  };

  return (
    <div className="browser-view" ref={containerRef}>
      <div className="browser-controls">
        <input
          type="url"
          placeholder="Enter URL..."
          onKeyPress={(e) => {
            if (e.key === 'Enter') {
              navigateToUrl((e.target as HTMLInputElement).value);
            }
          }}
        />
      </div>
      <div className="browser-content">
        {/* Browser view will be embedded here by Electron */}
      </div>
    </div>
  );
};
```

### Phase 4: Native macOS Integration (Weeks 7-8)

#### 4.1 Spotlight Integration
```typescript
// src/main/spotlight-integration.ts
import { app, shell } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

export class SpotlightIntegration {
  private metadataPath: string;

  constructor() {
    this.metadataPath = path.join(app.getPath('userData'), 'spotlight');
    this.initializeMetadata();
  }

  async indexChatSession(sessionId: string, content: string, url: string): Promise<void> {
    const metadata = {
      kMDItemDisplayName: `ChatBrowse Session: ${url}`,
      kMDItemContentType: 'com.chatbrowse.session',
      kMDItemTextContent: content,
      kMDItemURL: url,
      kMDItemLastUsedDate: new Date().toISOString()
    };

    const filePath = path.join(this.metadataPath, `${sessionId}.chatbrowse`);
    await fs.promises.writeFile(filePath, JSON.stringify(metadata));
  }

  private initializeMetadata(): void {
    if (!fs.existsSync(this.metadataPath)) {
      fs.mkdirSync(this.metadataPath, { recursive: true });
    }
  }
}
```

#### 4.2 System Browser Control
```typescript
// src/main/system-browser-control.ts
import { shell } from 'electron';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class SystemBrowserControl {
  async openInSystemBrowser(url: string): Promise<void> {
    await shell.openExternal(url);
  }

  async getCurrentSafariUrl(): Promise<string | null> {
    try {
      const { stdout } = await execAsync(`
        osascript -e 'tell application "Safari"
          if (count of windows) > 0 then
            get URL of current tab of window 1
          end if
        end tell'
      `);
      return stdout.trim();
    } catch (error) {
      console.error('Error getting Safari URL:', error);
      return null;
    }
  }

  async getCurrentChromeUrl(): Promise<string | null> {
    try {
      const { stdout } = await execAsync(`
        osascript -e 'tell application "Google Chrome"
          if (count of windows) > 0 then
            get URL of active tab of window 1
          end if
        end tell'
      `);
      return stdout.trim();
    } catch (error) {
      console.error('Error getting Chrome URL:', error);
      return null;
    }
  }

  async extractPageContentFromSystemBrowser(): Promise<any> {
    // Use AppleScript to extract content from system browsers
    try {
      const { stdout } = await execAsync(`
        osascript -e 'tell application "Safari"
          if (count of windows) > 0 then
            do JavaScript "JSON.stringify({
              title: document.title,
              url: window.location.href,
              content: document.body.innerText
            })" in current tab of window 1
          end if
        end tell'
      `);
      return JSON.parse(stdout.trim());
    } catch (error) {
      console.error('Error extracting content:', error);
      return null;
    }
  }
}
```

### Phase 5: Enhanced MCP Server (Weeks 9-10)

#### 5.1 Electron-Integrated MCP Server
```typescript
// src/main/electron-mcp-server.ts
import { fork, ChildProcess } from 'child_process';
import * as path from 'path';
import { app } from 'electron';

export class ElectronMCPServer {
  private mcpProcess: ChildProcess | null = null;
  private isRunning = false;

  async start(): Promise<void> {
    if (this.isRunning) return;

    const serverPath = path.join(__dirname, '../mcp-server/dist/index.js');
    
    this.mcpProcess = fork(serverPath, [], {
      cwd: path.dirname(serverPath),
      stdio: ['pipe', 'pipe', 'pipe', 'ipc']
    });

    this.mcpProcess.on('message', this.handleMCPMessage.bind(this));
    this.mcpProcess.on('error', this.handleMCPError.bind(this));
    this.mcpProcess.on('exit', this.handleMCPExit.bind(this));

    this.isRunning = true;
    console.log('MCP Server started');
  }

  async sendRequest(request: any): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.mcpProcess) {
        reject(new Error('MCP Server not running'));
        return;
      }

      const requestId = Date.now().toString();
      const fullRequest = { ...request, id: requestId };

      const timeout = setTimeout(() => {
        reject(new Error('MCP request timeout'));
      }, 30000);

      const messageHandler = (response: any) => {
        if (response.id === requestId) {
          clearTimeout(timeout);
          this.mcpProcess?.off('message', messageHandler);
          resolve(response);
        }
      };

      this.mcpProcess.on('message', messageHandler);
      this.mcpProcess.send(fullRequest);
    });
  }

  private handleMCPMessage(message: any): void {
    console.log('MCP Server message:', message);
  }

  private handleMCPError(error: Error): void {
    console.error('MCP Server error:', error);
  }

  private handleMCPExit(code: number | null): void {
    console.log('MCP Server exited with code:', code);
    this.isRunning = false;
    this.mcpProcess = null;
  }

  async stop(): Promise<void> {
    if (this.mcpProcess) {
      this.mcpProcess.kill();
      this.mcpProcess = null;
      this.isRunning = false;
    }
  }
}
```

---

## Alternative Approaches

### Option 2: Native Swift App with JavaScript Bridge

#### Architecture Overview
```
┌─────────────────────────────────────────┐
│           SwiftUI Frontend              │
├─────────────────────────────────────────┤
│     JavaScript Core Bridge             │
│  ├── Service Layer (TS/JS)             │
│  └── AI Integration                     │
├─────────────────────────────────────────┤
│        Native Swift Backend            │
│  ├── WebKit Integration                │
│  ├── System Browser Control            │
│  └── macOS APIs                        │
└─────────────────────────────────────────┘
```

**Pros:**
- Native performance and look/feel
- Full access to macOS APIs
- Smaller memory footprint
- Better system integration

**Cons:**
- Requires Swift development
- More complex service layer bridge
- Longer development time
- Platform-specific

### Option 3: Tauri Application

#### Architecture Overview
```
┌─────────────────────────────────────────┐
│      React/Vue Frontend                 │
├─────────────────────────────────────────┤
│         Tauri Core                      │
│  ├── Rust Backend                      │
│  ├── Service Layer Bridge              │
│  └── System Integration                │
├─────────────────────────────────────────┤
│      WebView2 (macOS)                  │
└─────────────────────────────────────────┘
```

**Pros:**
- Smaller bundle size than Electron
- Better performance
- Rust security benefits
- Growing ecosystem

**Cons:**
- Rust learning curve
- Smaller community
- Service layer requires rewriting
- Less mature tooling

### Option 4: Progressive Web App with Capacitor

#### Architecture Overview
```
┌─────────────────────────────────────────┐
│        PWA Frontend                     │
├─────────────────────────────────────────┤
│      Capacitor Bridge                   │
│  ├── Native Plugin System              │
│  └── Platform Adaptations              │
├─────────────────────────────────────────┤
│      Native Container                   │
│  ├── WKWebView (iOS/macOS)             │
│  └── System Integration                │
└─────────────────────────────────────────┘
```

**Pros:**
- Cross-platform from start
- Web-first development
- Service worker capabilities
- Easy distribution

**Cons:**
- Limited native integration
- Performance limitations
- Browser security restrictions
- Less desktop-native feel

---

## Technical Specifications

### System Requirements
- **macOS**: 10.15 (Catalina) or later
- **Memory**: 4GB RAM minimum, 8GB recommended
- **Storage**: 500MB for application, 1GB for cache
- **Network**: Internet connection for AI services

### Dependencies
```json
{
  "dependencies": {
    "electron": "^27.0.0",
    "electron-store": "^8.0.0",
    "playwright": "^1.40.0",
    "openai": "^4.28.0",
    "@aws-sdk/client-bedrock-runtime": "^3.821.0",
    "react": "^18.0.0",
    "typescript": "^5.0.0"
  },
  "devDependencies": {
    "electron-builder": "^24.0.0",
    "webpack": "^5.0.0",
    "@types/node": "^20.0.0"
  }
}
```

### Build Configuration
```javascript
// electron-builder.config.js
module.exports = {
  appId: 'com.chatbrowse.mac',
  productName: 'ChatBrowse',
  directories: {
    output: 'dist'
  },
  files: [
    'dist/**/*',
    'node_modules/**/*'
  ],
  mac: {
    category: 'public.app-category.productivity',
    target: [
      {
        target: 'dmg',
        arch: ['x64', 'arm64']
      },
      {
        target: 'zip',
        arch: ['x64', 'arm64']
      }
    ],
    entitlements: 'build/entitlements.mac.plist',
    extendInfo: {
      NSAppleEventsUsageDescription: 'ChatBrowse needs to control system browsers for web automation.'
    }
  },
  dmg: {
    sign: false,
    contents: [
      {
        x: 130,
        y: 220
      },
      {
        x: 410,
        y: 220,
        type: 'link',
        path: '/Applications'
      }
    ]
  }
};
```

---

## Migration Strategy

### Data Migration
```typescript
// src/migration/chrome-data-migrator.ts
export class ChromeDataMigrator {
  async migrateExtensionData(): Promise<void> {
    const chromeDataPath = this.getChromeExtensionDataPath();
    const electronDataPath = app.getPath('userData');

    // Migrate chat sessions
    const sessions = await this.loadChromeData('chatSessions');
    await this.saveElectronData('chatSessions', sessions);

    // Migrate settings
    const settings = await this.loadChromeData('settings');
    await this.saveElectronData('settings', settings);

    // Migrate search history
    const searchHistory = await this.loadChromeData('searchHistory');
    await this.saveElectronData('searchHistory', searchHistory);
  }

  private getChromeExtensionDataPath(): string {
    const homeDir = os.homedir();
    return path.join(
      homeDir,
      'Library/Application Support/Google/Chrome/Default/Local Extension Settings'
    );
  }
}
```

### Settings Migration
```typescript
// src/migration/settings-migrator.ts
export class SettingsMigrator {
  async migrateSettings(chromeSettings: any): Promise<any> {
    return {
      llm: {
        provider: chromeSettings.llm?.provider || 'openai',
        openai: {
          apiKey: chromeSettings.openaiApiKey || chromeSettings.llm?.openai?.apiKey,
          model: chromeSettings.llm?.openai?.model || 'gpt-4-turbo'
        },
        bedrock: chromeSettings.llm?.bedrock || {},
        inception: chromeSettings.llm?.inception || {}
      },
      ui: {
        theme: 'auto',
        language: 'en',
        chatSize: chromeSettings.chatSize || 'medium'
      },
      privacy: {
        storeHistory: true,
        anonymizeData: false
      }
    };
  }
}
```

---

## Timeline and Milestones

### Phase 1: Foundation (Weeks 1-2)
- [ ] Electron app setup and basic UI
- [ ] Service layer migration planning
- [ ] Architecture validation

### Phase 2: Core Migration (Weeks 3-4)
- [ ] Service layer adaptation for Electron
- [ ] Basic chat functionality
- [ ] MCP server integration

### Phase 3: UI Development (Weeks 5-6)
- [ ] React frontend implementation
- [ ] Browser view component
- [ ] Settings and configuration UI

### Phase 4: Native Integration (Weeks 7-8)
- [ ] macOS system integration
- [ ] Spotlight indexing
- [ ] System browser control

### Phase 5: Enhanced Features (Weeks 9-10)
- [ ] Enhanced MCP server
- [ ] Performance optimization
- [ ] Testing and debugging

### Phase 6: Polish and Distribution (Weeks 11-12)
- [ ] UI/UX refinement
- [ ] Data migration tools
- [ ] App signing and distribution
- [ ] Documentation and user guides

---

## Success Metrics

1. **Feature Parity**: 100% of extension features available
2. **Performance**: <3 second app startup time
3. **Stability**: <1% crash rate in testing
4. **User Experience**: Native macOS look and feel
5. **Migration**: Seamless data import from extension

---

## Risk Mitigation

### Technical Risks
- **Service Layer Compatibility**: Extensive testing and adaptation layer
- **MCP Server Integration**: Fallback to embedded Playwright
- **Native Browser Control**: AppleScript fallbacks

### Development Risks
- **Timeline Delays**: Phased approach with MVP milestones
- **Resource Constraints**: Focus on core features first
- **Platform Changes**: Electron's stable APIs and LTS versions

### User Adoption Risks
- **Migration Friction**: Automated data migration tools
- **Feature Gaps**: Parallel extension support during transition
- **Learning Curve**: Comprehensive documentation and tutorials

---

## Conclusion

The Electron-based approach provides the optimal balance of development speed, feature preservation, and native integration for converting ChatBrowse to a macOS application. The phased implementation plan ensures steady progress while maintaining the quality and functionality that users expect.

The resulting application will offer enhanced performance, better system integration, and a foundation for future cross-platform expansion while preserving the intelligent automation capabilities that make ChatBrowse unique. 