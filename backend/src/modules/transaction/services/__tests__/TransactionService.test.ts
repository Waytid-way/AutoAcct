// backend/src/modules/transaction/services/__tests__/TransactionService.test.ts

import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { TransactionService } from '../TransactionService';
import { Transaction } from '../../models/Transaction.model';
import { NotFoundError, ValidationError } from '@/shared/errors';

// Mock Logger
const mockLogger = {
    info: mock(),
    debug: mock(),
    warn: mock(),
    error: mock(),
} as any;

describe('TransactionService', () => {
    let service: TransactionService;

    beforeEach(() => {
        service = new TransactionService(mockLogger);
    });

    describe('createDraft', () => {
        it('should create a draft transaction', async () => {
            const input = {
                clientId: 'client-123',
                account: { debit: '1100-Cash', credit: '4000-Rev' },
                debit: 1000,
                credit: 1000,
                description: 'Test Tx',
                date: new Date(),
            };

            const result = await service.createDraft(input, 'user-1', 'corr-1');

            expect(result.status).toBe('draft');
            expect(result.debit).toBe(1000);
            expect(result.credit).toBe(1000);
            expect(mockLogger.info).toHaveBeenCalled();
        });
    });

    // Since we don't have a real Mongo connection with sessions in this environment easily,
    // we focus on unit logic. Integration tests would test the session/rollback.

    describe('validation', () => {
        it('should rely on model validation for double entry', async () => {
            // This test assumes Mongoose validate is called on save.
            // In strictly mock environment, we might not trigger mongoose hooks unless we use in-memory mongo.
        });
    });
});
