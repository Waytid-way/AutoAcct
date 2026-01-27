// backend/src/modules/ledger/__tests__/LedgerIntegrationService.test.ts

import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { LedgerIntegrationService } from '../services/LedgerIntegrationService';

// Mock ConfigManager
mock.module('@/config/ConfigManager', () => ({
    default: {
        isProduction: () => false // Force Mock Mode
    }
}));

describe('LedgerIntegrationService', () => {
    let service: LedgerIntegrationService;

    beforeEach(() => {
        // Re-instantiate to test factory logic (though mock module is static per run usually)
        service = new LedgerIntegrationService();
    });

    it('should use MockLedgerAdapter in DEV mode', async () => {
        // Indirectly test by checking behavior or property if accessible.
        // Or just check if request succeeds.
        const result = await service.recordEntry({
            clientId: 'test',
            memo: 'test',
            date: new Date(),
            entries: { 'A': 10, 'B': -10 }
        }, '123');

        expect(result.id).toContain('mock-journal'); // Mock ID format
    });
});
