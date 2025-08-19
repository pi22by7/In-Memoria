#!/usr/bin/env node
/**
 * Script to build and prepare platform-specific packages for testing
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync, copyFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const platformMap = {
  'linux-x64': { target: 'x86_64-unknown-linux-gnu', ext: '.linux-x64-gnu.node' },
  'darwin-x64': { target: 'x86_64-apple-darwin', ext: '.darwin-x64.node' },
  'darwin-arm64': { target: 'aarch64-apple-darwin', ext: '.darwin-arm64.node' },
  'win32-x64': { target: 'x86_64-pc-windows-msvc', ext: '.win32-x64-msvc.node' }
};

console.log('🔨 Building platform-specific packages...');

// Build the current platform
console.log('Building Rust native module...');
execSync('npm run build:rust', { stdio: 'inherit' });

// Copy the built binary to the appropriate platform package
const currentPlatform = `${process.platform}-${process.arch}`;
if (platformMap[currentPlatform]) {
  const srcFile = join(process.cwd(), 'rust-core', 'in-memoria-core.linux-x64-gnu.node');
  const destDir = join(process.cwd(), 'npm', currentPlatform);
  const destFile = join(destDir, `in-memoria-core${platformMap[currentPlatform].ext}`);
  
  if (existsSync(srcFile)) {
    if (!existsSync(destDir)) {
      mkdirSync(destDir, { recursive: true });
    }
    copyFileSync(srcFile, destFile);
    console.log(`✅ Copied binary to ${destFile}`);
  } else {
    console.log(`❌ Source binary not found: ${srcFile}`);
  }
} else {
  console.log(`❌ Unsupported platform: ${currentPlatform}`);
}

console.log('✨ Platform package preparation complete!');