// Global test setup
// This file is preloaded before running tests

import { beforeAll, afterAll } from 'bun:test';

beforeAll(() => {
    // Setup before all tests
    process.env.APP_MODE = 'test';
    process.env.NODE_ENV = 'test';
});

afterAll(() => {
    // Cleanup after all tests
});
