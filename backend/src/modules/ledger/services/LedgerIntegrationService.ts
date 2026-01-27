// backend/src/modules/ledger/services/LedgerIntegrationService.ts

import { ILedgerAdapter } from '../adapters/ILedgerAdapter';
import { MockLedgerAdapter } from '../adapters/MockLedgerAdapter';
import { MediciAdapter } from '../adapters/MediciAdapter';
import { ILedgerEntry, ILedgerTransaction } from '../types/ledger.types';
import config from '@/config/ConfigManager';
import logger from '@/config/logger';

/**
 * LEDGER INTEGRATION SERVICE
 * 
 * Factory/Facade for interacting with the Ledger.
 * Handles Dual Mode switching (MOCK vs MEDICI).
 */
export class LedgerIntegrationService {
    private adapter: ILedgerAdapter;

    constructor() {
        // Factory Logic
        if (config.isProduction()) {
            this.adapter = new MediciAdapter();
            logger.info({ action: 'ledger_init', mode: 'PRODUCTION', adapter: 'MediciAdapter' });
        } else {
            this.adapter = new MockLedgerAdapter();
            logger.info({ action: 'ledger_init', mode: 'DEV', adapter: 'MockLedgerAdapter' });
        }
    }

    /**
     * Record a journal entry to the ledger.
     */
    async recordEntry(entry: ILedgerEntry, correlationId: string): Promise<ILedgerTransaction> {
        logger.info({
            action: 'ledger_record_start',
            correlationId,
            clientId: entry.clientId,
            memo: entry.memo
        });

        const result = await this.adapter.recordEntry(entry, correlationId);

        logger.info({
            action: 'ledger_record_success',
            correlationId,
            transactionId: result.id
        });

        return result;
    }

    /**
     * Get account balance
     */
    async getBalance(accountPath: string, clientId: string): Promise<number> {
        return this.adapter.getBalance(accountPath, clientId);
    }
}
