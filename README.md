# ChatBrowse

ChatBrowse is a Chrome extension that adds a chat interface for browsing websites. It allows users to navigate and interact with web content through a conversational interface.

![ChatBrowse Logo](https://via.placeholder.com/150x150?text=ChatBrowse)

## Features

- 💬 **Chat Interface**: Interact with websites using natural language
- 🔍 **Content Extraction**: Extract and summarize information from webpages
- 🧭 **Navigation Commands**: Navigate to different parts of a website using chat commands
- 🔎 **Search Functionality**: Search for content on the current page through the chat
- 💾 **Session Persistence**: Chat history is saved for each website you visit

## Installation

### From Source

1. Clone the repository:
   ```
   git clone https://github.com/JKevinXu/ChatBrowse.git
   cd ChatBrowse
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Build the extension:
   ```
   npm run build
   ```

4. Load in Chrome:
   - Open Chrome and navigate to `chrome://extensions`
   - Enable "Developer mode" (toggle in top-right corner)
   - Click "Load unpacked" and select the `dist` folder

### From Chrome Web Store
*(Coming soon)*

## Usage

After installing the extension, you'll see the ChatBrowse icon in your browser toolbar. 

### Basic Commands

- **Navigation**: "go to [url]" or "navigate to [url]"
- **Search**: "find [term]" or "search for [term]"
- **Information**: "extract info" or "get info"
- **Help**: Type "help" to see available commands

## Development

### Prerequisites

- Node.js (v14 or higher)
- npm (v6 or higher)

### Setup Development Environment

1. Clone the repository
2. Install dependencies: `npm install`
3. Start the development server: `npm run watch`

### Project Structure

```
ChatBrowse/
├── src/                  # Source code
│   ├── background.ts     # Background script
│   ├── content.ts        # Content script injected into pages
│   ├── popup.ts          # Popup script
│   ├── utils.ts          # Utility functions
│   ├── types.ts          # TypeScript type definitions
│   └── chrome.d.ts       # Chrome API type definitions
├── public/               # Static assets
│   ├── popup.html        # Popup HTML
│   ├── popup.css         # Popup styles
│   ├── content.css       # Content script styles
│   └── manifest.json     # Extension manifest
├── dist/                 # Build output (generated)
└── webpack.config.js     # Webpack configuration
```

### Build Commands

- `npm run build`: Build the extension for production
- `npm run watch`: Build and watch for changes

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add some amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## License

This project is licensed under the ISC License.

## Contact

- GitHub Repository: [https://github.com/JKevinXu/ChatBrowse](https://github.com/JKevinXu/ChatBrowse)

---

Made with ❤️ by [JKevinXu](https://github.com/JKevinXu) 