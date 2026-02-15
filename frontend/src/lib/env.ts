/**
 * Environment Variable Validation
 * Validates all required environment variables on app startup
 */

const requiredEnvVars = [
  'NEXT_PUBLIC_API_BASE_URL',
];

const optionalEnvVars = [
  'NEXT_PUBLIC_API_TIMEOUT',
  'NEXT_PUBLIC_ENABLE_DEBUG',
  'NEXT_PUBLIC_MOCK_AUTH',
];

export function validateEnv(): void {
  const missing: string[] = [];

  // Check required variables
  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      missing.push(envVar);
    }
  }

  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:');
    missing.forEach(v => console.error(`  - ${v}`));
    console.error('\nPlease check your .env.local file');
    console.error('Copy .env.example to .env.local and fill in the values\n');
    
    // Don't throw in production, just warn
    if (process.env.NODE_ENV === 'development') {
      console.warn('⚠️  Using default values for development...');
    }
  }

  // Log configuration in development
  if (process.env.NODE_ENV === 'development') {
    console.log('✅ Environment Configuration:');
    console.log(`  API Base URL: ${process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001/api'}`);
    console.log(`  API Timeout: ${process.env.NEXT_PUBLIC_API_TIMEOUT || '30000'}ms`);
    console.log(`  Mock Auth: ${process.env.NEXT_PUBLIC_MOCK_AUTH === 'true' ? 'ENABLED' : 'DISABLED'}`);
  }
}

export function getEnvVar(name: string, defaultValue?: string): string {
  const value = process.env[name];
  if (value === undefined) {
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    throw new Error(`Environment variable ${name} is not defined`);
  }
  return value;
}
