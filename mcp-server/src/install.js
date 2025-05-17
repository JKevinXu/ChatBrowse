#!/usr/bin/env node

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import os from 'os';

// Get the directory name of the current module
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Extension ID - this needs to be updated with your actual extension ID
const EXTENSION_ID = 'PLACEHOLDER_EXTENSION_ID';

// Function to register the native messaging host
async function registerNativeMessagingHost() {
  try {
    // Get the absolute path to the wrapper script
    const wrapperScriptPath = path.resolve(__dirname, 'native-messaging-wrapper.js');
    
    // Make the wrapper script executable
    await fs.chmod(wrapperScriptPath, '755');
    
    // Read the manifest template
    const manifestTemplatePath = path.resolve(__dirname, 'native-messaging-host-manifest.json');
    const manifestTemplate = JSON.parse(await fs.readFile(manifestTemplatePath, 'utf8'));
    
    // Update the path in the manifest
    manifestTemplate.path = wrapperScriptPath;
    manifestTemplate.allowed_origins = [`chrome-extension://${EXTENSION_ID}/`];
    
    // Determine the manifest location based on the platform
    let manifestPath;
    const platform = os.platform();
    
    if (platform === 'darwin') { // macOS
      const userHome = os.homedir();
      const manifestDir = path.join(
        userHome,
        'Library',
        'Application Support',
        'Google',
        'Chrome',
        'NativeMessagingHosts'
      );
      
      // Create the directory if it doesn't exist
      await fs.mkdir(manifestDir, { recursive: true });
      manifestPath = path.join(manifestDir, 'com.chatbrowse.mcp.json');
    } else if (platform === 'win32') { // Windows
      // On Windows, we need to add registry keys
      const manifestDir = path.resolve(__dirname);
      manifestPath = path.join(manifestDir, 'com.chatbrowse.mcp.json');
      
      // Write the registry keys
      const regCommand = `REG ADD "HKCU\\Software\\Google\\Chrome\\NativeMessagingHosts\\com.chatbrowse.mcp" /ve /t REG_SZ /d "${manifestPath.replace(/\\/g, '\\\\')}" /f`;
      execSync(regCommand);
      
    } else if (platform === 'linux') { // Linux
      const userHome = os.homedir();
      const manifestDir = path.join(
        userHome,
        '.config',
        'google-chrome',
        'NativeMessagingHosts'
      );
      
      // Create the directory if it doesn't exist
      await fs.mkdir(manifestDir, { recursive: true });
      manifestPath = path.join(manifestDir, 'com.chatbrowse.mcp.json');
    } else {
      throw new Error(`Unsupported platform: ${platform}`);
    }
    
    // Write the manifest file
    await fs.writeFile(manifestPath, JSON.stringify(manifestTemplate, null, 2));
    
    console.log(`Native messaging host registered successfully at ${manifestPath}`);
    return true;
  } catch (error) {
    console.error('Failed to register native messaging host:', error);
    return false;
  }
}

// Main function
async function main() {
  console.log('Installing ChatBrowse MCP Server...');
  
  // Register the native messaging host
  const success = await registerNativeMessagingHost();
  
  if (success) {
    console.log('ChatBrowse MCP Server installed successfully!');
    console.log(`Please ensure the ChatBrowse extension with ID ${EXTENSION_ID} is installed in Chrome.`);
  } else {
    console.error('Installation failed. Please try again or install manually.');
    process.exit(1);
  }
}

// Run the main function
main(); 