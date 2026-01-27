// backend/src/modules/ledger/__tests__/MockLedgerAdapter.test.ts

import { describe, it, expect } from 'bun:test';
import { MockLedgerAdapter } from '../adapters/MockLedgerAdapter';

describe('MockLedgerAdapter', () => {
    it('should record entry and return valid transaction structure', async () => {
        const adapter = new MockLedgerAdapter();
        const result = await adapter.recordEntry({
            clientId: 'test-client',
            memo: 'Test Entry',
            date: new Date(),
            entries: { 'Cash': 100, 'Revenue': -100 }
        }, 'correlation-123');

        expect(result.id).toBeDefined();
        expect(result.posted).toBe(true);
        expect(result.transactions.length).toBe(2);
    });

    it('should return 0 balance', async () => {
        const adapter = new MockLedgerAdapter();
        const balance = await adapter.getBalance('Cash', 'test-client');
        expect(balance).toBe(0);
    });
});
