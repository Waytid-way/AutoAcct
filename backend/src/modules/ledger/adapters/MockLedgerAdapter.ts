// backend/src/modules/ledger/adapters/MockLedgerAdapter.ts

import { ILedgerAdapter } from './ILedgerAdapter';
import { ILedgerEntry, ILedgerTransaction } from '../types/ledger.types';
import logger from '@/config/logger';

/**
 * MOCK LEDGER ADAPTER
 * 
 * Used in DEV/TEST modes.
 * Logs operations without writing to real DB.
 * Simulates success responses.
 */
export class MockLedgerAdapter implements ILedgerAdapter {
    async recordEntry(entry: ILedgerEntry, correlationId: string): Promise<ILedgerTransaction> {
        logger.info({
            action: 'mock_ledger_record',
            correlationId,
            entry,
            message: 'MOCK: Recorded ledger entry',
        });

        // Return mock transaction
        return {
            id: `mock-journal-${Date.now()}`,
            memo: entry.memo,
            date: entry.date,
            voided: false,
            posted: true,
            transactions: Object.entries(entry.entries).map(([acc, amount]) => ({
                accounts: acc,
                credit: amount < 0 ? Math.abs(amount) : 0,
                debit: amount > 0 ? amount : 0,
            })),
        };
    }

    async getBalance(accountPath: string, clientId: string): Promise<number> {
        logger.debug({
            action: 'mock_ledger_balance',
            accountPath,
            clientId,
            message: 'MOCK: Returning 0 balance',
        });
        return 0;
    }
}
