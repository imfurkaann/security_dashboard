// Test setup file
import dotenv from 'dotenv';

// Load test environment variables
dotenv.config({ path: '.env.test' });

// Set test timeout
jest.setTimeout(10000);

// Global test teardown
afterAll(async () => {
    // Close database connections, etc.
    await new Promise(resolve => setTimeout(resolve, 500));
});
