#!/usr/bin/env node

/**
 * Post-build script to prepare the compiled files.
 * This adds shebangs to the executable files and makes them executable.
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SRC_DIR = path.join(__dirname, '../src');
const DIST_DIR = path.join(__dirname, '../dist');
const SHEBANG = '#!/usr/bin/env node\n';

// Add shebang to executable files
const executableFiles = [
  'index.js',
  'native-bridge.js',
  'install.js'
];

for (const file of executableFiles) {
  const filePath = path.join(DIST_DIR, file);
  
  if (fs.existsSync(filePath)) {
    console.log(`Adding shebang to ${file}`);
    
    // Read the file
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Add shebang if it doesn't already have one
    if (!content.startsWith('#!')) {
      content = SHEBANG + content;
      fs.writeFileSync(filePath, content);
    }
    
    // Make the file executable (Unix-like systems only)
    try {
      execSync(`chmod +x "${filePath}"`);
      console.log(`Made ${file} executable`);
    } catch (error) {
      // On Windows, chmod doesn't work, but it's not needed
      console.log(`Note: Could not make ${file} executable. This is normal on Windows.`);
    }
  } else {
    console.warn(`Warning: Expected file ${file} not found`);
  }
}

// Copy and chmod the wrapper script
const wrapperScriptName = 'run-native-bridge.sh';
const srcWrapperPath = path.join(SRC_DIR, wrapperScriptName);
const distWrapperPath = path.join(DIST_DIR, wrapperScriptName);

if (fs.existsSync(srcWrapperPath)) {
  console.log(`Copying ${wrapperScriptName} to dist directory.`);
  fs.copyFileSync(srcWrapperPath, distWrapperPath);
  console.log(`Making ${wrapperScriptName} executable.`);
  try {
    execSync(`chmod +x "${distWrapperPath}"`);
    console.log(`Made ${wrapperScriptName} executable.`);
  } catch (error) {
    console.log(`Note: Could not make ${wrapperScriptName} executable. This is normal on Windows.`);
  }
} else {
  console.warn(`Warning: Wrapper script ${wrapperScriptName} not found in src.`);
}

console.log('Post-build process complete!');

// Export for dynamic import compatibility
export default {}; 