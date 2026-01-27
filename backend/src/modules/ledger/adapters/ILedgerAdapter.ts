// backend/src/modules/ledger/adapters/ILedgerAdapter.ts

import { ILedgerEntry, ILedgerTransaction } from '../types/ledger.types';

/**
 * LEDGER ADAPTER INTERFACE
 * 
 * Contract for all ledger implementations (Mock/Medici).
 * Ensures loosely coupled integration.
 */
export interface ILedgerAdapter {
    /**
     * Record a valid double-entry journal transaction.
     * @param entry Validated ledger entry
     * @param correlationId For tracing
     */
    recordEntry(entry: ILedgerEntry, correlationId: string): Promise<ILedgerTransaction>;

    /**
     * Get current balance of an account.
     * @param accountPath Account name/path (e.g. "Assets:Cash")
     * @param clientId Tenant ID
     */
    getBalance(accountPath: string, clientId: string): Promise<number>;
}
