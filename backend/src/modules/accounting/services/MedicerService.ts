import mongoose from 'mongoose';
import { MediciAdapter } from '@/modules/ledger/adapters/MediciAdapter';
import { Transaction } from '@/modules/transaction/models/Transaction.model';
import { MoneyInt } from '@/utils/money';
import logger from '@/config/logger';
import { IMedicerService } from '@/shared/di/interfaces';

/**
 * MedicerService
 * 
 * Facade service for interacting with the Double-Entry Ledger (Medici)
 * and Transaction data.
 */
export class MedicerService implements IMedicerService {
    private ledgerAdapter: MediciAdapter;

    constructor() {
        this.ledgerAdapter = new MediciAdapter();
    }

    /**
     * Post a double-entry transaction to the ledger with client context
     */
    async postEntryWithClient(
        clientId: string,
        debitAccount: string,
        creditAccount: string,
        amount: number,
        description: string,
        session?: unknown
    ): Promise<void> {
        const entry = {
            clientId,
            memo: description,
            date: new Date(),
            entries: {
                [debitAccount]: amount,
                [creditAccount]: -amount
            }
        };

        // Pass session if we can (Medici 5+ supports it, Adapter might need update)
        await this.ledgerAdapter.recordEntry(entry, 'INTERNAL_CORRELATION_ID');
    }

    /**
     * Get Trial Balance for validation
     */
    async getTrialBalance(
        clientId: string,
        session?: unknown
    ): Promise<number> {
        // We use the Transaction model's static method to check balance
        // Transaction.getTrialBalance returns { accounts, totalDebit, totalCredit }.

        const balance = await Transaction.getTrialBalance(clientId);
        return balance.totalDebit - balance.totalCredit;
    }
}
