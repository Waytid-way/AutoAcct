// backend/src/models/Transaction.model.ts

import { TransactionSchema, ITransaction } from './schemas/Transaction.schema';
import mongoose from 'mongoose';

/**
 * TRANSACTION MODEL - Financial Operations
 * 
 * This file extends the TransactionSchema with static methods and virtuals,
 * then creates and exports the Mongoose model.
 */

// ===========================
// STATIC METHODS
// ===========================

/**
 * Get trial balance (sum of all transactions)
 * Should always return 0 if balanced
 */
TransactionSchema.statics.getTrialBalance = async function(
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
}> {
  const matchStage: Record<string, unknown> = {
    clientId: new mongoose.Types.ObjectId(clientId),
    status: 'posted',
  };

  if (startDate || endDate) {
    matchStage.transactionDate = {};
    if (startDate) (matchStage.transactionDate as Record<string, Date>).$gte = startDate;
    if (endDate) (matchStage.transactionDate as Record<string, Date>).$lte = endDate;
  }

  // Get per-account breakdown for debit accounts
  const debitAccounts = await this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: '$debitAccount',
        amount: { $sum: '$amountSatang' },
      },
    },
  ]);

  // Get per-account breakdown for credit accounts
  const creditAccounts = await this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: '$creditAccount',
        amount: { $sum: '$amountSatang' },
      },
    },
  ]);

  // Combine into account breakdown
  const accountMap = new Map<string, { account: string; debit: number; credit: number }>();

  debitAccounts.forEach((acc) => {
    if (acc._id) {
      accountMap.set(acc._id, {
        account: acc._id,
        debit: acc.amount,
        credit: 0,
      });
    }
  });

  creditAccounts.forEach((acc) => {
    if (acc._id) {
      const existing = accountMap.get(acc._id);
      if (existing) {
        existing.credit = acc.amount;
      } else {
        accountMap.set(acc._id, {
          account: acc._id,
          debit: 0,
          credit: acc.amount,
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

/**
 * Get transactions by date range
 */
TransactionSchema.statics.getByDateRange = async function(
  clientId: string,
  startDate: Date,
  endDate: Date
): Promise<ITransaction[]> {
  return await this.find({
    clientId: new mongoose.Types.ObjectId(clientId),
    transactionDate: {
      $gte: startDate,
      $lte: endDate,
    },
    status: 'posted',
  })
    .sort({ transactionDate: -1 })
    .populate('receiptId')
    .exec();
};

/**
 * Get transactions by category (for P&L report)
 */
TransactionSchema.statics.getByCategory = async function(
  clientId: string,
  category: string
): Promise<ITransaction[]> {
  return await this.find({
    clientId: new mongoose.Types.ObjectId(clientId),
    category,
    status: 'posted',
  })
    .sort({ transactionDate: -1 })
    .exec();
};

/**
 * Create reversal transaction (for voiding)
 */
TransactionSchema.statics.createReversal = async function(
  originalId: string,
  voidReason: string,
  voidedBy: string,
  session: mongoose.ClientSession
): Promise<ITransaction> {
  const original = await this.findById(originalId).session(session);
  if (!original) {
    throw new Error('Original transaction not found');
  }

  if (!original.canBeVoided()) {
    throw new Error('Transaction cannot be voided');
  }

  // Create reversal (swap debit/credit)
  const reversal = await this.create(
    [
      {
        debitAccount: original.creditAccount,  // Swap
        creditAccount: original.debitAccount,
        amountSatang: original.amountSatang,
        description: `VOID: ${original.description} (${voidReason})`,
        status: 'reversal',
        originalTransactionId: original._id,
        transactionDate: new Date(),
        postingDate: new Date(),
        clientId: original.clientId,
        correlationId: original.correlationId,
        createdBy: new mongoose.Types.ObjectId(voidedBy),
      },
    ],
    { session }
  );

  // Update original
  await this.updateOne(
    { _id: originalId },
    {
      $set: {
        status: 'voided',
        voidedAt: new Date(),
        voidedBy: new mongoose.Types.ObjectId(voidedBy),
        voidReason,
        reversalTransactionId: reversal[0]._id,
      },
    },
    { session }
  );

  return reversal[0];
};

// ===========================
// VIRTUAL FIELDS
// ===========================

/**
 * Amount in Baht (display)
 */
TransactionSchema.virtual('amountBaht').get(function(this: ITransaction) {
  const satangToBaht = require('@utils/money').satangToBaht;
  return satangToBaht(this.amountSatang);
});

/**
 * Journal entry display format
 */
TransactionSchema.virtual('journalEntry').get(function(this: ITransaction) {
  return {
    date: this.transactionDate,
    debit: { account: this.debitAccount, amount: this.amountBaht },
    credit: { account: this.creditAccount, amount: this.amountBaht },
    description: this.description,
  };
});

// Create and export the model
const TransactionModel = mongoose.model<ITransaction>('Transaction', TransactionSchema);
export default TransactionModel;
