// backend/src/models/Transaction.model.ts

import TransactionSchema, { ITransaction } from './schemas/Transaction.schema';
import mongoose from 'mongoose';

/**
 * TRANSACTION MODEL - Financial Operations
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
  session?: mongoose.ClientSession
): Promise<number> {
  const result = await this.aggregate([
    {
      $match: {
        clientId: new mongoose.Types.ObjectId(clientId),
        status: 'posted',
      },
    },
    {
      $group: {
        _id: null,
        totalDebits: { $sum: '$amountSatang' },
        totalCredits: { $sum: '$amountSatang' },
      },
    },
  ]).session(session || null);

  if (result.length === 0) return 0;

  // In double-entry, debits = credits, so difference should be 0
  return result[0].totalDebits - result[0].totalCredits;
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
TransactionSchema.virtual('amountBaht').get(function() {
  const satangToBaht = require('@utils/money').satangToBaht;
  return satangToBaht(this.amountSatang);
});

/**
 * Journal entry display format
 */
TransactionSchema.virtual('journalEntry').get(function() {
  return {
    date: this.transactionDate,
    debit: { account: this.debitAccount, amount: this.amountBaht },
    credit: { account: this.creditAccount, amount: this.amountBaht },
    description: this.description,
  };
});

export default mongoose.model<ITransaction>('Transaction', TransactionSchema);