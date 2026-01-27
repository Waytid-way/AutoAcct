// backend/src/modules/workflow/__tests__/WorkflowService.test.ts

import { describe, it, expect, mock, beforeEach } from 'bun:test';
import { WorkflowService } from '../services/WorkflowService';

// Mocks
const mockCreateRecord = mock(() => Promise.resolve({ id: 'rec_teable' }));
const mockCreateDraft = mock(() => Promise.resolve({ id: 'tx_ledger' }));
const mockUpdateReceipt = mock(() => Promise.resolve({}));

// Mock Config
mock.module('@/config/ConfigManager', () => ({
    default: {
        get: (key: string) => {
            if (key === 'TEABLE_SERVICE_MODE') return 'mock';
            return 'val';
        },
        isProduction: () => false
    }
}));

// Mock Dependencies
mock.module('../../teable/adapters/MockTeableService', () => ({
    MockTeableService: class {
        createRecord = mockCreateRecord;
    }
}));

mock.module('../../transaction/services/TransactionService', () => ({
    TransactionService: class {
        createDraft = mockCreateDraft;
    }
}));

// Mock Receipt Model
mock.module('@/models/Receipt.model', () => ({
    default: {
        findByIdAndUpdate: mockUpdateReceipt
    }
}));

describe('WorkflowService', () => {
    let service: WorkflowService;

    beforeEach(() => {
        service = new WorkflowService();
        mockCreateRecord.mockClear();
        mockCreateDraft.mockClear();
        mockUpdateReceipt.mockClear();
    });

    it('should orchestrate full workflow', async () => {
        const receipt: any = {
            _id: 'receipt_id',
            clientId: 'client_id',
            ocrResult: {
                vendor: 'Test Vendor',
                amount: 10000,
                date: new Date()
            },
            ocrConfidence: 0.95
        };

        const result = await service.onOCRComplete(receipt, 'corr-id');

        expect(result.teableId).toBe('rec_teable');
        expect(result.transactionId).toBe('tx_ledger');

        expect(mockCreateRecord).toHaveBeenCalled();
        expect(mockCreateDraft).toHaveBeenCalled();
        expect(mockUpdateReceipt).toHaveBeenCalled(); // Should update Receipt with new IDs
    });
});
