#!/usr/bin/env node

/**
 * Backend Health Check Script
 * Tests if the backend server is properly configured
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Backend Health Check Started...\n');

let errorCount = 0;
let warningCount = 0;

// Check 1: package.json
console.log('✓ Checking package.json...');
try {
    const pkg = require('./package.json');
    if (!pkg.dependencies.express) {
        console.error('  ❌ Express not found in dependencies');
        errorCount++;
    }
    if (!pkg.dependencies.pg) {
        console.error('  ❌ PostgreSQL driver not found');
        errorCount++;
    }
    if (!pkg.devDependencies.typescript) {
        console.error('  ❌ TypeScript not found in devDependencies');
        errorCount++;
    }
    console.log('  ✓ package.json is valid\n');
} catch (err) {
    console.error('  ❌ package.json is missing or invalid\n');
    errorCount++;
}

// Check 2: tsconfig.json
console.log('✓ Checking tsconfig.json...');
try {
    const tsconfig = require('./tsconfig.json');
    if (tsconfig.compilerOptions.module !== 'commonjs') {
        console.warn('  ⚠ Module should be "commonjs"');
        warningCount++;
    }
    console.log('  ✓ tsconfig.json is valid\n');
} catch (err) {
    console.error('  ❌ tsconfig.json is missing or invalid\n');
    errorCount++;
}

// Check 3: .env file
console.log('✓ Checking .env file...');
if (fs.existsSync('.env')) {
    const envContent = fs.readFileSync('.env', 'utf-8');
    const requiredVars = ['PORT', 'DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASSWORD', 'JWT_SECRET'];

    requiredVars.forEach(varName => {
        if (!envContent.includes(varName)) {
            console.error(`  ❌ Missing environment variable: ${varName}`);
            errorCount++;
        }
    });

    if (envContent.includes('your_password') || envContent.includes('change_this')) {
        console.warn('  ⚠ Please update default values in .env');
        warningCount++;
    }

    console.log('  ✓ .env file exists and has required variables\n');
} else {
    console.error('  ❌ .env file not found\n');
    errorCount++;
}

// Check 4: Source files
console.log('✓ Checking source files...');
const requiredFiles = [
    'src/server.ts',
    'src/config/database.ts'
];

requiredFiles.forEach(file => {
    if (!fs.existsSync(file)) {
        console.error(`  ❌ Missing file: ${file}`);
        errorCount++;
    }
});
console.log('  ✓ All required source files exist\n');

// Check 5: node_modules
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
    console.log('✅ All checks passed! Backend is ready to run.');
    console.log('\nTo start the server, run:');
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
