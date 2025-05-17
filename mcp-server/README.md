# ChatBrowse MCP Server

A Model Context Protocol (MCP) server that enables AI assistants to browse the web through the ChatBrowse Chrome extension.

## 🌟 Features

- **Web Browsing**: Navigate to URLs and extract page content
- **Selective Extraction**: Target specific elements using CSS selectors
- **Chrome Integration**: Seamless integration with Chrome extensions via Native Messaging API
- **AI Compatibility**: Works with Claude and other MCP-compatible AI assistants

## 📋 Prerequisites

- Node.js 16 or higher
- npm or yarn
- Google Chrome browser

## 🚀 Quick Start

### Installation

1. Clone this repository:
```bash
git clone https://github.com/yourusername/chatbrowse-mcp-server.git
cd chatbrowse-mcp-server
```

2. Install dependencies:
```bash
npm install
```

3. Build the server:
```bash
npm run build
```

4. Register the native messaging host with Chrome:
```bash
npm run install-server
```

### Usage with ChatBrowse Extension

1. Make sure you have the ChatBrowse extension installed in Chrome
2. Update the extension's manifest.json to include the "nativeMessaging" permission
3. Add MCP client code to the extension (see INTEGRATION.md for details)

### Usage with Claude Desktop

1. Create a configuration file for Claude Desktop:
```json
{
  "mcpServers": {
    "chatbrowse-mcp": {
      "command": "node",
      "args": ["/absolute/path/to/chatbrowse-mcp-server/dist/index.js"]
    }
  }
}
```

2. Start Claude Desktop with your config:
```bash
claude --config-file your-config.json
```

## 🔧 Development

To run in development mode with auto-reloading:
```bash
npm run dev
```

## 🧰 Architecture

The server consists of the following components:

1. **MCP Server**: Core implementation that handles MCP protocol and Playwright browser control
2. **Native Bridge**: Connects Chrome extensions to the MCP server
3. **Playwright Integration**: Provides web automation capabilities

## 📜 Available Tools

### browse_webpage

The server exposes a single tool called `browse_webpage` with the following parameters:

- `url` (required): The URL to navigate to
- `selector` (optional): CSS selector to extract specific content from the page

Example usage:
```javascript
// From within the browser extension
const result = await mcpClient.browseWebpage('https://example.com', 'h1');
console.log(result.content); // Contains the extracted h1 content
```

## 🔍 Troubleshooting

If you encounter issues:

- Check Chrome extension errors in the browser console
- Look for native messaging errors in the extension manifest
- Verify the native messaging host is registered correctly
- Check the server logs for any startup or runtime errors

## 📚 Documentation

For more details, see:

- [INTEGRATION.md](./INTEGRATION.md) - Guide for integrating with the ChatBrowse extension
- [extension-integration.md](./extension-integration.md) - Code examples for extension integration
- [TESTING.md](./TESTING.md) - Instructions for testing the MCP server

## 📄 License

MIT 