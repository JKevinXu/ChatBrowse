#!/usr/bin/env node

/**
 * Simple script to update the native messaging host manifest to allow all extensions
 * This is useful for development but should be restricted in production
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to the manifest
const manifestDir = path.join(
  os.homedir(),
  'Library/Application Support/Google/Chrome/NativeMessagingHosts'
);
const manifestFile = path.join(manifestDir, 'com.chatbrowse.mcp.json');

// Update the manifest
try {
  if (fs.existsSync(manifestFile)) {
    console.log('Reading native messaging host manifest...');
    const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
    
    // Modify the allowed_origins to allow any extension
    manifest.allowed_origins = ["chrome-extension://*"];
    
    console.log('Writing updated manifest...');
    fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2));
    console.log('Native messaging host manifest updated successfully!');
    console.log('Now any Chrome extension can connect to the MCP server.');
  } else {
    console.error('Native messaging host manifest not found. Please run npm run install-server first.');
  }
} catch (error) {
  console.error('Error updating manifest:', error);
} 