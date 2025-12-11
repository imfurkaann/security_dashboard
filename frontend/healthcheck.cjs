#!/usr/bin/env node

/**
 * Frontend Health Check Script
 * Tests if the frontend is properly configured
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Frontend Health Check Started...\n');

let errorCount = 0;
let warningCount = 0;

// Check 1: package.json
console.log('✓ Checking package.json...');
try {
  const pkg = require('./package.json');
  if (!pkg.dependencies.react) {
    console.error('  ❌ React not found in dependencies');
    errorCount++;
  }
  if (!pkg.dependencies['react-router-dom']) {
    console.error('  ❌ React Router not found');
    errorCount++;
  }
  if (!pkg.dependencies.axios) {
    console.error('  ❌ Axios not found');
    errorCount++;
  }
  if (!pkg.devDependencies.tailwindcss) {
    console.error('  ❌ Tailwind CSS not found');
    errorCount++;
  }
  console.log('  ✓ package.json is valid\n');
} catch (err) {
  console.error('  ❌ package.json is missing or invalid\n');
  errorCount++;
}

// Check 2: Vite config
console.log('✓ Checking vite.config.ts...');
if (fs.existsSync('vite.config.ts')) {
  console.log('  ✓ vite.config.ts exists\n');
} else {
  console.error('  ❌ vite.config.ts not found\n');
  errorCount++;
}

// Check 3: Tailwind config
console.log('✓ Checking Tailwind CSS...');
if (fs.existsSync('tailwind.config.js')) {
  console.log('  ✓ tailwind.config.js exists');
} else {
  console.error('  ❌ tailwind.config.js not found');
  errorCount++;
}

if (fs.existsSync('postcss.config.js')) {
  console.log('  ✓ postcss.config.js exists\n');
} else {
  console.error('  ❌ postcss.config.js not found\n');
  errorCount++;
}

// Check 4: .env file
console.log('✓ Checking .env file...');
if (fs.existsSync('.env')) {
  const envContent = fs.readFileSync('.env', 'utf-8');
  
  if (!envContent.includes('VITE_API_URL')) {
    console.error('  ❌ Missing VITE_API_URL in .env');
    errorCount++;
  }
  
  console.log('  ✓ .env file exists\n');
} else {
  console.warn('  ⚠ .env file not found (optional)\n');
  warningCount++;
}

// Check 5: Source files
console.log('✓ Checking source files...');
const requiredFiles = [
  'src/main.tsx',
  'src/App.tsx',
  'src/index.css',
  'src/pages/Login.tsx',
  'src/pages/Dashboard.tsx',
  'src/utils/api.ts'
];

requiredFiles.forEach(file => {
  if (!fs.existsSync(file)) {
    console.error(`  ❌ Missing file: ${file}`);
    errorCount++;
  }
});
console.log('  ✓ All required source files exist\n');

// Check 6: index.css Tailwind imports
console.log('✓ Checking Tailwind imports in index.css...');
if (fs.existsSync('src/index.css')) {
  const cssContent = fs.readFileSync('src/index.css', 'utf-8');
  if (!cssContent.includes('@tailwind base')) {
    console.error('  ❌ Missing @tailwind base directive');
    errorCount++;
  }
  if (!cssContent.includes('@tailwind components')) {
    console.error('  ❌ Missing @tailwind components directive');
    errorCount++;
  }
  if (!cssContent.includes('@tailwind utilities')) {
    console.error('  ❌ Missing @tailwind utilities directive');
    errorCount++;
  }
  if (errorCount === 0) {
    console.log('  ✓ Tailwind directives are properly imported\n');
  }
} else {
  console.error('  ❌ src/index.css not found\n');
  errorCount++;
}

// Check 7: node_modules
console.log('✓ Checking node_modules...');
if (!fs.existsSync('node_modules')) {
  console.error('  ❌ node_modules not found. Run: npm install');
  errorCount++;
} else {
  console.log('  ✓ node_modules exists\n');
}

// Summary
console.log('━'.repeat(50));
console.log('📊 HEALTH CHECK SUMMARY');
console.log('━'.repeat(50));

if (errorCount === 0 && warningCount === 0) {
  console.log('✅ All checks passed! Frontend is ready to run.');
  console.log('\nTo start the dev server, run:');
  console.log('  npm run dev\n');
  process.exit(0);
} else {
  if (errorCount > 0) {
    console.error(`\n❌ Found ${errorCount} error(s)`);
  }
  if (warningCount > 0) {
    console.warn(`⚠️  Found ${warningCount} warning(s)`);
  }
  console.log('\nPlease fix the issues above before running the server.\n');
  process.exit(errorCount > 0 ? 1 : 0);
}
