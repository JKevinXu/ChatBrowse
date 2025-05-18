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
const EXTENSION_ID = 'ndgnodlfblkobilohbgblmgimnnpgeop'; // Replace with your actual extension ID
const NATIVE_HOST_NAME = 'com.chatbrowse.mcp';

// Current directory
const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function install() {
  console.log('Installing ChatBrowse MCP Server...');
  
  try {
    const wrapperScriptName = 'run-native-bridge.sh';
    const wrapperPath = path.resolve(__dirname, wrapperScriptName); 
    
    try {
        await fs.chmod(wrapperPath, '755');
    } catch (chmodError: any) {
        console.warn(`Warning: Could not chmod ${wrapperPath}. Error: ${chmodError.message}. This might be okay if already set or on Windows.`);
    }
    
    const manifest = {
      name: NATIVE_HOST_NAME,
      description: 'ChatBrowse MCP Server for web automation',
      path: wrapperPath, 
      type: 'stdio',
      allowed_origins: [`chrome-extension://${EXTENSION_ID}/`]
    };
    
    // Determine where to install based on platform (original logic restored)
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
      // For Windows, the manifest path is usually determined via registry, 
      // but writing it beside the executable and registering that path is common.
      // Here we assume install.js is in dist/, so manifest will be in dist/ too.
      manifestPath = path.join(__dirname, `${NATIVE_HOST_NAME}.json`);
      const regKey = `HKCU\Software\Google\Chrome\NativeMessagingHosts\${NATIVE_HOST_NAME}`;
      const regCommand = `REG ADD "${regKey}" /ve /t REG_SZ /d "${manifestPath.replace(/\\/g, '\\\\')}" /f`;
      execSync(regCommand);
    } 
    else if (platform === 'linux') { // Linux
      const userHome = os.homedir();
      const manifestDir = path.join(
        userHome,
        '.config/google-chrome/NativeMessagingHosts' // Or .config/chromium/NativeMessagingHosts
      );
      await fs.mkdir(manifestDir, { recursive: true });
      manifestPath = path.join(manifestDir, `${NATIVE_HOST_NAME}.json`);
    } 
    else {
      throw new Error(`Unsupported platform: ${platform}`);
    }
    
    await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
    
    console.log(`Native messaging host registered successfully at: ${manifestPath}`);
    console.log('Installation complete! The MCP server is now ready to use with ChatBrowse.');
    
  } catch (error: any) {
    console.error(`Installation failed: ${error.message}`);
    process.exit(1);
  }
}

install();