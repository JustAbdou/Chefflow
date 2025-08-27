#!/usr/bin/env node

/**
 * Script to fix syntax errors caused by aggressive console log removal
 */

const fs = require('fs');
const path = require('path');

function fixSyntaxErrorsInFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Fix common syntax patterns caused by console log removal
    const fixedContent = content
      // Fix missing semicolons after combined statements
      .replace(/(\w+)setSuppliers/g, '$1;\n      setSuppliers')
      .replace(/(\w+)setFridgeNames/g, '$1;\n      setFridgeNames')
      .replace(/(\w+)setInputValues/g, '$1;\n                              setInputValues')
      // Fix catch blocks without content
      .replace(/} catch \(error\) {}/g, '} catch (error) {\n      // Error handling\n    }')
      // Fix try blocks with missing content
      .replace(/try {(.*?)} catch/gs, (match, p1) => {
        if (p1.trim() === '') {
          return 'try {\n      // Operation\n    } catch';
        }
        return match;
      })
      // Fix empty if statements
      .replace(/if \(__DEV__\) {},/g, 'if (__DEV__) {\n      // Debug info\n    }')
      // Fix return statements that are concatenated
      .replace(/(\w+)return/g, '$1;\n    return')
      // Fix missing spaces after } characters
      .replace(/}(\w)/g, '}\n    $1')
      // Fix concatenated const declarations
      .replace(/(\w+)const /g, '$1;\n      const ')
      // Fix concatenated await statements
      .replace(/(\w+)await /g, '$1;\n      await ')
      // Fix function calls that got merged
      .replace(/(\w+)setSaving/g, '$1;\n    setSaving')
      // Fix missing newlines in complex expressions
      .replace(/;(\s*)(const|let|var|await|if|for|while|function)/g, ';\n$1$2');
    
    if (content !== fixedContent) {
      fs.writeFileSync(filePath, fixedContent, 'utf8');
      console.log(`✅ Fixed: ${filePath}`);
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
  let totalFixed = 0;
  
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
      totalFixed += processDirectory(fullPath);
    } else if (stat.isFile() && item.endsWith('.js')) {
      if (fixSyntaxErrorsInFile(fullPath)) {
        totalFixed++;
      }
    }
  }
  
  return totalFixed;
}

// Start processing from src directory
const srcDir = path.join(__dirname, '../src');
const rootFiles = ['firebase.js', 'firebase-secure.js', 'App.js'].map(f => path.join(__dirname, '..', f));

console.log('🔧 Fixing syntax errors caused by console log removal...');

let totalFixed = 0;

// Process src directory
if (fs.existsSync(srcDir)) {
  totalFixed += processDirectory(srcDir);
}

// Process root files
for (const file of rootFiles) {
  if (fs.existsSync(file)) {
    if (fixSyntaxErrorsInFile(file)) {
      totalFixed++;
    }
  }
}

console.log(`\n✅ Fixed ${totalFixed} files.`);
console.log('🚀 Syntax errors should now be resolved.');
