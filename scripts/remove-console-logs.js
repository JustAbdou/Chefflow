#!/usr/bin/env node

/**
 * Script to remove all console.log, console.error, and console.warn statements
 * from JavaScript files for production builds
 */

const fs = require('fs');
const path = require('path');

function removeConsoleLogsFromFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Remove console.log, console.error, console.warn statements
    const cleanedContent = content
      .replace(/\s*console\.(log|error|warn|info|debug)\([^)]*\);?\s*/g, '')
      .replace(/\s*console\.(log|error|warn|info|debug)\([^)]*\)\s*$/gm, '')
      // Handle multi-line console statements
      .replace(/\s*console\.(log|error|warn|info|debug)\(\s*[\s\S]*?\);\s*/g, '');
    
    if (content !== cleanedContent) {
      fs.writeFileSync(filePath, cleanedContent, 'utf8');
      console.log(`✅ Cleaned: ${filePath}`);
      return true;
    }
    return false;
  } catch (error) {
    console.error(`❌ Error processing ${filePath}:`, error.message);
    return false;
  }
}

function processDirectory(dir) {
  const items = fs.readdirSync(dir);
  let totalCleaned = 0;
  
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
      totalCleaned += processDirectory(fullPath);
    } else if (stat.isFile() && item.endsWith('.js')) {
      if (removeConsoleLogsFromFile(fullPath)) {
        totalCleaned++;
      }
    }
  }
  
  return totalCleaned;
}

// Start processing from src directory
const srcDir = path.join(__dirname, '../src');
const rootFiles = ['firebase.js', 'firebase-secure.js', 'App.js'].map(f => path.join(__dirname, '..', f));

console.log('🧹 Removing console logs for production build...');

let totalCleaned = 0;

// Process src directory
if (fs.existsSync(srcDir)) {
  totalCleaned += processDirectory(srcDir);
}

// Process root files
for (const file of rootFiles) {
  if (fs.existsSync(file)) {
    if (removeConsoleLogsFromFile(file)) {
      totalCleaned++;
    }
  }
}

console.log(`\n✅ Completed! Cleaned ${totalCleaned} files.`);
console.log('🚀 Your app is now ready for production build.');
