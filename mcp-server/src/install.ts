#!/usr/bin/env node

/**
 * Installation script for ChatBrowse MCP Server
 * This registers the native messaging host with Chrome
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import * as os from 'os';

// Constants
const EXTENSION_ID = 'PLACEHOLDER_EXTENSION_ID'; // Replace with your actual extension ID
const NATIVE_HOST_NAME = 'com.chatbrowse.mcp';

// Current directory
const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function install() {
  console.log('Installing ChatBrowse MCP Server...');
  
  try {
    // Get the absolute path to the native bridge script
    const bridgePath = path.resolve(__dirname, 'native-bridge.js');
    
    // Make it executable
    await fs.chmod(bridgePath, '755');
    
    // Create manifest file
    const manifest = {
      name: NATIVE_HOST_NAME,
      description: 'ChatBrowse MCP Server for web automation',
      path: bridgePath,
      type: 'stdio',
      allowed_origins: [`chrome-extension://${EXTENSION_ID}/`]
    };
    
    // Determine where to install based on platform
    const platform = os.platform();
    let manifestPath: string;
    
    if (platform === 'darwin') { // macOS
      const userHome = os.homedir();
      const manifestDir = path.join(
        userHome,
        'Library/Application Support/Google/Chrome/NativeMessagingHosts'
      );
      await fs.mkdir(manifestDir, { recursive: true });
      manifestPath = path.join(manifestDir, `${NATIVE_HOST_NAME}.json`);
    } 
    else if (platform === 'win32') { // Windows
      manifestPath = path.join(__dirname, `${NATIVE_HOST_NAME}.json`);
      
      // Add registry key
      const regCmd = `REG ADD "HKCU\\Software\\Google\\Chrome\\NativeMessagingHosts\\${NATIVE_HOST_NAME}" /ve /t REG_SZ /d "${manifestPath.replace(/\\/g, '\\\\')}" /f`;
      execSync(regCmd);
    } 
    else if (platform === 'linux') { // Linux
      const userHome = os.homedir();
      const manifestDir = path.join(
        userHome,
        '.config/google-chrome/NativeMessagingHosts'
      );
      await fs.mkdir(manifestDir, { recursive: true });
      manifestPath = path.join(manifestDir, `${NATIVE_HOST_NAME}.json`);
    } 
    else {
      throw new Error(`Unsupported platform: ${platform}`);
    }
    
    // Write manifest file
    await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
    
    console.log(`Native messaging host registered successfully at: ${manifestPath}`);
    console.log('Installation complete! The MCP server is now ready to use with ChatBrowse.');
    
  } catch (error) {
    console.error('Installation failed:', error);
    process.exit(1);
  }
}

// Run installation
install(); 