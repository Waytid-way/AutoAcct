/**
 * Jest Configuration for Backend Tests
 * Works with both npm and Bun (Bun has built-in test runner)
 */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  testPathIgnorePatterns: [
    '/node_modules/',
    'GroqOCRService.test.ts',
    'ConfidenceScorer.test.ts',
    'TransactionService.test.ts',
    'TeableService.test.ts',
    'WorkflowService.test.ts',
    'authMiddleware.test.ts',
    'globalErrorHandler.test.ts',
    'MockLedgerAdapter.test.ts',
    'LedgerIntegrationService.test.ts',
  ],
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      isolatedModules: true,
      diagnostics: {
        ignoreCodes: [2571, 2345, 2322]
      }
    }],
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/__tests__/**',
    '!src/**/mocks/**',
    '!src/**/*.test.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
};
