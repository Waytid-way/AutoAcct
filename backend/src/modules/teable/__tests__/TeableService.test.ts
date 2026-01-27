// backend/src/modules/teable/__tests__/TeableService.test.ts

import { describe, it, expect, mock, beforeEach } from 'bun:test';
import { TeableService } from '../adapters/TeableService';

const mockPost = mock(() => Promise.resolve({ data: { records: [{ id: 'rec123' }] } }));
const mockPatch = mock(() => Promise.resolve({ data: {} }));

// Mock axios
mock.module('axios', () => ({
    default: {
        create: () => ({
            post: mockPost,
            patch: mockPatch,
            get: mock(() => Promise.resolve({}))
        })
    }
}));

describe('TeableService', () => {
    let service: TeableService;

    beforeEach(() => {
        service = new TeableService('http://mock', 'key', 'base');
        mockPost.mockClear();
    });

    it('should create record and return ID', async () => {
        const result = await service.createRecord({
            receiptId: '123',
            vendor: 'Test Vendor',
            amount: 10000,
            date: new Date(),
            ocrConfidence: 0.9,
            rawOcrText: 'raw',
            status: 'pending'
        }, 'corr-id');

        expect(result.id).toBe('rec123');
        expect(mockPost).toHaveBeenCalled();
        const calls: any = mockPost.mock.calls;
        expect(calls.length).toBeGreaterThan(0);
        const payload: any = calls[0][1];
        expect(payload).toBeDefined();
        expect(payload.records).toBeDefined();
        expect(payload.records[0].fields.Vendor).toBe('Test Vendor');
        expect(payload.records[0].fields.Amount).toBe(100); // 100.00
    });
});
