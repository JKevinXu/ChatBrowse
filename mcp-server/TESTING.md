# Testing the ChatBrowse MCP Server

This guide explains how to test the ChatBrowse MCP server functionality.

## Prerequisites

- Node.js installed
- Project already built with `npm run build`
- Server installed with `npm run install-server`

## Test Using the Test Script

The simplest way to test the server is using the included test script that sends requests via stdin/stdout:

```bash
# Run from the mcp-server directory
node test-request.js | node dist/index.js
```

This will:
1. Start the MCP server
2. Send a request to browse Google
3. Display the response with the extracted content

### Advanced Test with Selector

To test extracting specific content using CSS selectors:

```bash
# Run from the mcp-server directory
node test-advanced.js | node dist/index.js
```

This test will extract headline links from Hacker News using a CSS selector.

## Customizing the Test

You can modify `test-request.js` to test different websites or parameters:

1. Open `test-request.js` in your editor
2. Change the URL in the parameters section:
   ```javascript
   parameters: {
     url: 'https://www.example.com' // Change to any website
   }
   ```
3. Add a CSS selector to extract specific content:
   ```javascript
   parameters: {
     url: 'https://www.example.com',
     selector: 'h1' // Extract only h1 elements
   }
   ```

## Testing with Chrome Extension

To test the integration with the Chrome extension:

1. Make sure the native messaging host is installed (`npm run install-server`)
2. Install the ChatBrowse extension in Chrome
3. Use the extension to send browsing requests to the MCP server

## Troubleshooting

If you encounter issues:

- Check that the server is built properly (`npm run build`)
- Verify the native messaging host is installed correctly
- Check console output for any error messages
- Try running the server directly with `node dist/index.js` to check for startup errors 