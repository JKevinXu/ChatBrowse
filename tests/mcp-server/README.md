# Testing the ChatBrowse MCP Server

This guide explains how to test the ChatBrowse MCP server functionality.

## Prerequisites

- Node.js installed
- Project already built with `npm run build`
- Server installed with `npm run install-server`

## Test Using the Test Script

The simplest way to test the server is using the included test script that sends requests via stdin/stdout.

**Note:** These commands should be run from the **project root directory**.

For a basic test (e.g., browsing Google):
```bash
# Run from the project root directory
node tests/mcp-server/test-browse-google.js | node mcp-server/dist/index.js
```

This will:
1. Start the MCP server (via `mcp-server/dist/index.js`)
2. Send a request to browse Google
3. Display the response with the extracted content

For a basic test browsing example.com:
```bash
# Run from the project root directory
node tests/mcp-server/test-browse-example.js | node mcp-server/dist/index.js
```

### Advanced Test with Selector

To test extracting specific content using CSS selectors (e.g., Hacker News headlines):
```bash
# Run from the project root directory
node tests/mcp-server/test-browse-hackernews-selector.js | node mcp-server/dist/index.js
```

This test will extract headline links from Hacker News using a CSS selector.

## Customizing the Test

You can modify the test scripts (e.g., `tests/mcp-server/test-browse-google.js` or `tests/mcp-server/test-browse-example.js`) to test different websites or parameters:

1. Open the desired script (e.g., `tests/mcp-server/test-browse-google.js`) in your editor.
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

1.  Ensure the MCP server is built (`cd mcp-server && npm run build && cd ..`)
2.  Make sure the native messaging host is installed (`cd mcp-server && npm run install-server && cd ..`)
3. Install the ChatBrowse extension in Chrome
4. Use the extension to send browsing requests to the MCP server

## Troubleshooting

If you encounter issues:

- Check that the server is built properly (`cd mcp-server && npm run build && cd ..`)
- Verify the native messaging host is installed correctly
- Check console output for any error messages
- Try running the server directly with `node mcp-server/dist/index.js` (from the project root) to check for startup errors 