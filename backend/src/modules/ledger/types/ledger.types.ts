// backend/src/modules/ledger/types/ledger.types.ts

/**
 * LEDGER TYPES
 * 
 * Standard interfaces for interacting with the Double-Entry Ledger.
 * Abstracted from specific implementation (Medici) to allow swapping.
 */

export interface ILedgerEntry {
    clientId: string;
    memo: string;
    date: Date;
    entries: {
        [accountPath: string]: number; // Account Name -> Amount (MoneyInt Satang)
    };
    metadata?: Record<string, any>;
}

export interface ILedgerTransaction {
    id: string; // Journal Entry ID
    memo: string;
    date: Date;
    voided: boolean;
    posted: boolean;
    transactions: {
        credit: number;
        debit: number;
        accounts: string; // Account path
    }[];
}

export interface ILedgerAccount {
    name: string;
    balance: number;
}
