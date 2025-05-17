# ChatBrowse MCP Integration Guide

This document provides quick instructions for integrating the ChatBrowse MCP server with the ChatBrowse extension.

## 1. Install Dependencies

```bash
cd mcp-server
npm install
```

## 2. Build the MCP Server

```bash
npm run build
```

## 3. Install the Native Messaging Host

```bash
npm run install-server
```

This will register the native messaging host with Chrome for the current user.

## 4. Update the Extension Manifest

Edit your ChatBrowse extension's `manifest.json` to add the native messaging permission:

```json
{
  "permissions": [
    "nativeMessaging",
    // ... existing permissions
  ]
}
```

## 5. Create MCP Client in Extension

Create a new file in your extension's source (e.g., `src/mcp-client.ts`) with the code from `extension-integration.md`.

## 6. Update Background Script

Add MCP client integration to your background script (see `extension-integration.md` for details).

## 7. Test Integration

Now when you load the extension, it should be able to communicate with the MCP server. You can test this by:

1. Making a web browsing request from the extension
2. Checking the browser console for connection messages
3. Verifying the MCP server logs show the request

## Debugging

If you encounter issues:

1. Check Chrome's Extensions page (chrome://extensions) for error messages
2. Look for native messaging errors in the browser console
3. Run the MCP server manually to see any startup errors:
   ```
   npm run start
   ```

## Using with Claude or other AI Assistants

To use the MCP server with Claude Desktop or other MCP-compatible AI assistants:

1. Create a config file (e.g., `claude_config.json`):
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

2. Start Claude Desktop with the config:
   ```
   claude --config-file claude_config.json
   ```

3. Now Claude can use the browsing capabilities whenever asked to retrieve web content. 