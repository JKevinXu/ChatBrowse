#!/usr/bin/env node

/**
 * Simple test script for the ChatBrowse MCP Server
 * Sends a test request to browse a webpage
 */

// Sample request for browse_webpage tool
const request = {
  method: 'tool',
  params: {
    name: 'browse_webpage',
    parameters: {
      url: 'https://www.google.com'
    }
  }
};

// Write the request to stdout, which will be piped to the server's stdin
console.log(JSON.stringify(request));

// The server's response will be printed to the console since we'll pipe its output 