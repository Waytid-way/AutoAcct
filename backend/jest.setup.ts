/**
 * Jest Setup File
 * Run before each test file
 */

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key-min-32-chars-long';
process.env.GROQ_API_KEY = 'test-groq-api-key';
process.env.MONGODB_URI = 'mongodb://localhost:27017/autoacct-test';
process.env.ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

// Silence console logs during tests unless explicitly needed
if (process.env.DEBUG_TESTS !== 'true') {
  global.console = {
    ...console,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    // Keep error for debugging
    error: console.error,
  };
}
