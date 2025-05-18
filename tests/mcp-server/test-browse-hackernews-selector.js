#!/usr/bin/env node

/**
 * Advanced test script for the ChatBrowse MCP Server
 * Demonstrates using a CSS selector to extract specific content
 */

// Sample request for browse_webpage tool with CSS selector
const request = {
  method: 'tool',
  params: {
    name: 'browse_webpage',
    parameters: {
      url: 'https://news.ycombinator.com',
      selector: '.titleline > a' // Extract headline links from Hacker News
    }
  }
};

// Write the request to stdout, which will be piped to the server's stdin
console.log(JSON.stringify(request));

// The server's response will be printed to the console 