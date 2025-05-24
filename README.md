# 🌐 ChatBrowse - Intelligent Web Automation Extension

ChatBrowse is a powerful Chrome extension that transforms web browsing through AI-powered natural language commands. Navigate, search, and interact with websites using intelligent automation and conversational interfaces.

![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-4285F4?style=flat&logo=googlechrome&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)
![OpenAI](https://img.shields.io/badge/OpenAI-412991?style=flat&logo=openai&logoColor=white)
![Webpack](https://img.shields.io/badge/Webpack-8DD6F9?style=flat&logo=webpack&logoColor=black)

## ✨ Key Features

### 🤖 **Intelligent Action System**
- **Natural Language Processing**: Execute commands like "find videos about Python programming"
- **Smart Platform Detection**: Automatically detects YouTube, Google, Amazon, and other platforms
- **Two-Step Execution**: AI plans actions, then executes on your command
- **Cross-Platform Search**: Works seamlessly across different websites

### 💬 **Advanced Chat Interface**
- **Persistent Sessions**: Chat history saved per website
- **Context-Aware Responses**: AI understands page content and user intent
- **Real-time Interaction**: Instant feedback and action execution
- **Error Recovery**: Intelligent fallback mechanisms

### 🔧 **Modern Architecture**
- **Service-Based Design**: Modular, maintainable codebase
- **TypeScript**: Full type safety and IntelliSense support
- **Production-Ready**: Optimized builds with tree shaking
- **Developer-Friendly**: Source maps and debugging tools

## 🚀 Quick Start

### Prerequisites
- **Chrome Browser** (latest version recommended)
- **Node.js** v14+ and **npm** v6+
- **OpenAI API Key** ([Get one here](https://platform.openai.com/api-keys))

### Installation

1. **Clone & Setup**
   ```bash
   git clone https://github.com/JKevinXu/ChatBrowse.git
   cd ChatBrowse
   npm install
   ```

2. **Build the Extension**
   ```bash
   npm run build
   ```

3. **Load in Chrome**
   - Open `chrome://extensions/`
   - Enable "Developer mode" (top-right toggle)
   - Click "Load unpacked" → Select the `dist/` folder
   - Pin the ChatBrowse icon to your toolbar

4. **Configure API Key**
   - Click the ChatBrowse icon
   - Click the settings gear ⚙️
   - Enter your OpenAI API key
   - Save settings

## 🎯 Usage Examples

### Smart Search Commands
```
"find videos about machine learning"     → Searches YouTube
"search for wireless headphones"        → Searches Amazon  
"look for news about climate change"    → Searches Google
```

### Navigation Commands
```
"go to youtube.com"                      → Navigates to URL
"navigate to the homepage"              → Smart navigation
```

### Content Commands
```
"extract info from this page"           → Summarizes content
"set context on"                        → Enables page context
```

### Action Execution
1. **Request**: Type your command (e.g., "find cooking videos")
2. **Plan**: AI shows what it will do (90% confidence)
3. **Execute**: Say "do it" to run the actions
4. **Result**: Actions execute automatically with feedback

## 🏗️ Architecture

### Service-Based Design
```
📁 src/
├── 🔧 services/           # Core business logic
│   ├── action-service.ts    # Action planning & execution
│   ├── openai-service.ts    # AI integration
│   ├── search-service.ts    # Multi-platform search
│   ├── message-router.ts    # Message handling
│   ├── navigation-service.ts # Navigation logic
│   ├── context-service.ts   # Page context management
│   └── config-service.ts    # Settings & configuration
├── 📱 popup/             # Extension popup UI
│   ├── popup-ui.ts         # DOM manipulation
│   ├── session-manager.ts  # Session persistence
│   └── message-handler.ts  # Background communication
├── 🌐 content/           # Content script services
│   ├── action-executor.ts  # Page automation
│   ├── page-analyzer.ts    # Page structure analysis
│   └── chat-ui.ts         # Chat interface
├── 🛠️ utils/             # Utility modules
│   ├── content-extractor.ts # Page content extraction
│   ├── command-processor.ts # Command parsing
│   └── storage-utils.ts    # Chrome storage operations
├── background.ts         # Service worker
├── content.ts           # Content script entry
├── popup.ts            # Popup entry
└── types.ts           # TypeScript definitions
```

### Build System
- **Production Build**: `npm run build` (143 KiB, optimized)
- **Development Build**: `npm run build:dev` (199 KiB, debug enabled)
- **Watch Mode**: `npm run watch` (auto-rebuild on changes)

## 🔧 Development

### Build Commands
```bash
npm run build      # Production build (optimized, no console.log)
npm run build:dev  # Development build (source maps, debug)
npm run watch      # Watch mode for development
```

### Environment Configuration
- **Production**: Minified, console.log removed, debug excluded
- **Development**: Source maps, debug tools, full logging

### Architecture Benefits
- ✅ **Single Responsibility Principle**: Each service has one clear purpose
- ✅ **Dependency Injection**: Services can be easily mocked and tested
- ✅ **Type Safety**: Full TypeScript coverage with strict mode
- ✅ **Error Handling**: Consistent error handling across all services
- ✅ **Modularity**: Easy to extend and maintain

## 🎛️ Configuration

### OpenAI Settings
- **API Key**: Required for AI functionality
- **Model**: GPT-3.5-turbo (configurable)
- **Context**: Automatic page content inclusion

### Extension Settings
- **Notifications**: Enable/disable system notifications
- **Theme**: Light/dark mode support
- **Language**: Multi-language support (planned)

## 🤝 Contributing

We welcome contributions! The codebase is designed for easy extension and modification.

### Development Setup
1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Install dependencies: `npm install`
4. Start watch mode: `npm run watch`
5. Make your changes
6. Test with `npm run build:dev`
7. Submit a Pull Request

### Code Standards
- **TypeScript**: Strict mode enabled
- **Services**: Follow the existing service pattern
- **Error Handling**: Use consistent error handling patterns
- **Testing**: Add tests for new functionality (planned)

## 📦 Bundle Size

| **Script** | **Production** | **Development** |
|------------|----------------|-----------------|
| Background | 118 KiB | 158 KiB |
| Content | 18.4 KiB | 22 KiB |
| Popup | 5.44 KiB | 10.3 KiB |
| **Total** | **143 KiB** | **199 KiB** |

## 🐛 Troubleshooting

### Common Issues
- **No response from AI**: Check OpenAI API key in settings
- **Actions not executing**: Refresh page and try again
- **Search not working**: Ensure you're on a supported platform

### Debug Mode
Use development build (`npm run build:dev`) for detailed console logging and debugging tools.

## 📄 License

This project is licensed under the ISC License - see the [LICENSE](LICENSE) file for details.

## 🔗 Links

- **Repository**: [GitHub](https://github.com/JKevinXu/ChatBrowse)
- **Issues**: [Bug Reports](https://github.com/JKevinXu/ChatBrowse/issues)
- **OpenAI API**: [Get API Key](https://platform.openai.com/api-keys)

---

**Made with ❤️ by [JKevinXu](https://github.com/JKevinXu)**

*Transform your browsing experience with intelligent automation* 