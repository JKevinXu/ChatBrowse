#!/usr/bin/env node

/**
 * Build script for the ChatBrowse MCP Server
 * This script handles the full build process including TypeScript compilation and post-build tasks
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Directory paths
const ROOT_DIR = path.resolve(__dirname, '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');

// Create dist directory if it doesn't exist
if (!fs.existsSync(DIST_DIR)) {
  fs.mkdirSync(DIST_DIR, { recursive: true });
}

// Main build process
function build() {
  console.log('Building ChatBrowse MCP Server...');

  try {
    // Step 1: Compile TypeScript
    console.log('Running TypeScript compiler...');
    execSync('npx tsc', { stdio: 'inherit', cwd: ROOT_DIR });
    
    // Step 2: Run post-build script
    console.log('Running post-build tasks...');
    // Use dynamic import instead of require
    import('./post-build.js')
      .then(() => {
        console.log('Build completed successfully! ✨');
      })
      .catch(error => {
        console.error('Post-build failed:', error);
        process.exit(1);
      });
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}

// Check for node_modules
if (!fs.existsSync(path.join(ROOT_DIR, 'node_modules'))) {
  console.log('node_modules not found. Installing dependencies...');
  execSync('npm install', { stdio: 'inherit', cwd: ROOT_DIR });
}

// Run the build
build(); 