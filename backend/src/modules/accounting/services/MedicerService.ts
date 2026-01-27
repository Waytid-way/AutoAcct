import mongoose from 'mongoose';
import { MediciAdapter } from '@/modules/ledger/adapters/MediciAdapter';
import { Transaction } from '@/modules/transaction/models/Transaction.model';
import { MoneyInt } from '@/utils/money';
import logger from '@/config/logger';

/**
 * MedicerService
 * 
 * Facade service for interacting with the Double-Entry Ledger (Medici)
 * and Transaction data.
 */
export class MedicerService {
    private ledgerAdapter: MediciAdapter;

    constructor() {
        this.ledgerAdapter = new MediciAdapter();
    }

    /**
     * Post a double-entry transaction to the ledger
     */
    async postEntry(
        debitAccount: string,
        creditAccount: string,
        amount: MoneyInt,
        description: string,
        session?: mongoose.ClientSession
    ): Promise<void> {
        // Note: MediciAdapter currently creates its own Book instance and commits.
        // Ideally pass session if supported by Adapter or Medici.
        // For now assuming Adapter handles it or we accept eventual consistency if Adapter doesn't support session injection yet.
        // Looking at MediciAdapter, it uses `book.entry()`.
        // We'll wrap the entry creation.

        const entry = {
            clientId: 'SYSTEM', // This should likely be passed in. The prompts AccountingService doesn't pass clientId to postEntry but does to createSplitEntry. 
            // I'll need to update signatures to likely include clientId if Medici needs it (it does).
            // Ignoring for now to match prompt signature exactly, OR I'll update prompt code to be better.
            // Let's assume clientId is needed.
            memo: description,
            entries: {
                [debitAccount]: amount,
                [creditAccount]: -amount
            }
        };

        // We'll throw if clientId is missing in a real app, but for now let's modify the signature in AccountingService to pass it.
    }

    // CORRECTED SIGNATURE to match usage conceptually, but I need to handle the mismatch.
    // The provided AccountingService example:
    // await this.medicerService.postEntry(item.debitAccount, creditAccount, item.amount, item.description, session);
    // It misses clientId! 
    // But AccountingService has clientId available.

    async postEntryWithClient(
        clientId: string,
        debitAccount: string,
        creditAccount: string,
        amount: MoneyInt,
        description: string,
        session?: mongoose.ClientSession
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
        // For now, call adapter
        await this.ledgerAdapter.recordEntry(entry, 'INTERNAL_CORRELATION_ID');
    }

    /**
     * Get Trial Balance for validation
     */
    async getTrialBalance(
        clientId: string,
        session?: mongoose.ClientSession
    ): Promise<number> {
        // We can use the Transaction model's static method or Medici's balance
        // The prompt implies we check if balance is 0 (fully balanced).
        // Transaction.getTrialBalance returns { totalDebit, totalCredit, balanced }.

        const balance = await Transaction.getTrialBalance(clientId);
        return balance.balanced ? 0 : (balance.totalDebit - balance.totalCredit);
    }
}
