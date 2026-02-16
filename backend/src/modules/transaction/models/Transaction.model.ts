// backend/src/modules/transaction/models/Transaction.model.ts

import mongoose, { Model, Query } from 'mongoose';
import TransactionSchema, { ITransaction } from './schemas/Transaction.schema';

// ============================================
// TYPE DEFINITIONS
// ============================================

interface ITransactionModel extends Model<ITransaction> {
    /**
     * Calculate trial balance for a client
     */
    getTrialBalance(
        clientId: string,
        startDate?: Date,
        endDate?: Date
    ): Promise<{
        accounts: Array<{
            account: string;
            debit: number;
            credit: number;
            balance: number;
        }>;
        totalDebit: number;
        totalCredit: number;
    }>;

    /**
     * Count posted transactions for a client
     */
    getPostedCount(clientId: string): Promise<number>;
}

// ============================================
// STATIC METHODS
// ============================================

// Use Model<ITransaction> as `this` context to satisfy TS signature compatibility
TransactionSchema.statics.getTrialBalance = async function (
    this: Model<ITransaction>,
    clientId: string,
    startDate?: Date,
    endDate?: Date
) {
    const filter: any = {
        clientId: clientId
    };

    filter.status = 'posted';

    if (startDate || endDate) {
        filter.date = {};
        if (startDate) filter.date.$gte = startDate;
        if (endDate) filter.date.$lte = endDate;
    }

    // Get per-account breakdown
    const accountBreakdown = await this.aggregate([
        { $match: filter },
        {
            $group: {
                _id: '$account.debit',
                debit: { $sum: '$debit' },
                credit: { $sum: 0 },
            },
        },
    ]);

    const creditBreakdown = await this.aggregate([
        { $match: filter },
        {
            $group: {
                _id: '$account.credit',
                debit: { $sum: 0 },
                credit: { $sum: '$credit' },
            },
        },
    ]);

    // Combine debit and credit accounts
    const accountMap = new Map<string, { account: string; debit: number; credit: number }>();

    accountBreakdown.forEach((acc) => {
        if (acc._id) {
            accountMap.set(acc._id, {
                account: acc._id,
                debit: acc.debit,
                credit: 0,
            });
        }
    });

    creditBreakdown.forEach((acc) => {
        if (acc._id) {
            const existing = accountMap.get(acc._id);
            if (existing) {
                existing.credit = acc.credit;
            } else {
                accountMap.set(acc._id, {
                    account: acc._id,
                    debit: 0,
                    credit: acc.credit,
                });
            }
        }
    });

    const accounts = Array.from(accountMap.values()).map((acc) => ({
        ...acc,
        balance: acc.debit - acc.credit,
    }));

    const totalDebit = accounts.reduce((sum, acc) => sum + acc.debit, 0);
    const totalCredit = accounts.reduce((sum, acc) => sum + acc.credit, 0);

    return {
        accounts,
        totalDebit,
        totalCredit,
    };
};

TransactionSchema.statics.getPostedCount = async function (
    this: Model<ITransaction>,
    clientId: string
) {
    return this.countDocuments({
        clientId,
        status: 'posted'
    });
};

// ============================================
// QUERY HELPERS
// ============================================

// Cast query helpers to avoid property does not exist on {} error
(TransactionSchema.query as any).isDraft = function (
    this: Query<any, ITransaction>
) {
    return this.where('status').equals('draft');
};

(TransactionSchema.query as any).isPosted = function (
    this: Query<any, ITransaction>
) {
    return this.where('status').equals('posted');
};

(TransactionSchema.query as any).byDateRange = function (
    this: Query<any, ITransaction>,
    start: Date,
    end: Date
) {
    return this.where('date').gte(start as any).lte(end as any);
};

// Start exporting Model
export type { ITransaction };
export const Transaction = mongoose.model<ITransaction, ITransactionModel>('Transaction', TransactionSchema);
export default Transaction;
