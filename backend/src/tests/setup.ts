// backend/src/tests/setup.ts

import mongoose from 'mongoose';
import { beforeAll, afterAll, beforeEach } from 'bun:test';

// Use in-memory or local test DB
const uri = process.env.MONGO_TEST_URI || 'mongodb://localhost:27017/autoaccl-test';

export async function connect() {
    if (mongoose.connection.readyState === 0) {
        await mongoose.connect(uri);
    }
}

export async function disconnect() {
    await mongoose.connection.close();
}

export async function clearDatabase() {
    const collections = mongoose.connection.collections;
    for (const key in collections) {
        await collections[key].deleteMany({});
    }
}

// Global hooks for all tests importing this setup
beforeAll(async () => {
    await connect();
});

afterAll(async () => {
    await disconnect();
});

beforeEach(async () => {
    await clearDatabase();
});
