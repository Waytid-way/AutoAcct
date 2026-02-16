// backend/src/models/schemas/Transaction.schema.ts

import mongoose, { Schema, Document } from 'mongoose';

/**
 * TRANSACTION SCHEMA
 *
 * Purpose:
 * - Store accounting transactions (double-entry bookkeeping)
 * - Support draft → posted → voided workflow
 * - Link to receipts and export logs
 * - Prepare for Medici library integration (Phase 3)
 *
 * Double-Entry Rules:
 * - Every transaction has debit + credit
 * - Debit amount = Credit amount (always balanced)
 * - Never delete posted transactions (void/reversal only)
 *
 * References:
 * - Vol1 Section 6 - Double-Entry Ledger Pattern
 * - Vol1 Section 3 - Rule #3 (ACID) & Rule #4 (Immutability)
 */

export interface ITransaction extends Document {
  // ===========================
  // DOUBLE-ENTRY ACCOUNTS
  // ===========================
  debitAccount: string;               // COA code (e.g., "5100-Food")
  creditAccount: string;              // COA code (e.g., "1010-Checking")

  amountSatang: number;               // Integer: Satang (same for debit & credit)

  description: string;                // Transaction description

  // ===========================
  // MEDICI INTEGRATION (Phase 3)
  // ===========================
  mediciJournalId?: string;           // Medici journal entry ID
  mediciTimestamp?: Date;

  // ===========================
  // WORKFLOW STATUS
  // ===========================
  status: 'draft' | 'pending_approval' | 'posted' | 'voided' | 'reversal';

  // Approval flow
  approvedBy?: mongoose.Types.ObjectId;  // Accountant/Admin
  approvedAt?: Date;

  // Void/Reversal tracking
  originalTransactionId?: mongoose.Types.ObjectId;  // If this is a reversal
  reversalTransactionId?: mongoose.Types.ObjectId;  // If this was voided
  voidReason?: string;
  voidedAt?: Date;
  voidedBy?: mongoose.Types.ObjectId;

  // ===========================
  // SOURCE LINKS
  // ===========================
  receiptId?: mongoose.Types.ObjectId;    // Source receipt (if from OCR)
  exportLogId?: mongoose.Types.ObjectId;  // Export log (if exported to Express)

  // ===========================
  // CLASSIFICATION
  // ===========================
  category?: string;                   // Groq AI category
  tags?: string[];                     // Custom tags

  // ===========================
  // DATES
  // ===========================
  transactionDate: Date;               // วันที่ทำรายการ (business date)
  postingDate?: Date;                  // วันที่บันทึกบัญชี (when posted)

  // ===========================
  // MULTI-TENANT & AUDIT
  // ===========================
  clientId: mongoose.Types.ObjectId;
  correlationId?: string;

  createdAt: Date;
  updatedAt: Date;
  createdBy?: mongoose.Types.ObjectId;

  // ===========================
  // DEV MODE
  // ===========================
  isMockData?: boolean;

  // ===========================
  // VIRTUALS
  // ===========================
  amountBaht?: number;
  journalEntry?: {
    date: Date;
    debit: { account: string; amount: number };
    credit: { account: string; amount: number };
    description: string;
  };

  // ===========================
  // METHODS
  // ===========================
  isBalanced(): boolean;
  canBeVoided(): boolean;
}

const TransactionSchema = new Schema<ITransaction>(
  {
    // ACCOUNTS
    debitAccount: {
      type: String,
      required: [true, 'Debit account is required'],
      trim: true,
      // Format: "XXXX-Account Name" (e.g., "5100-Food")
      match: /^\d{4}-[\w\s&]+$/,
    },
    creditAccount: {
      type: String,
      required: [true, 'Credit account is required'],
      trim: true,
      match: /^\d{4}-[\w\s&]+$/,
    },

    amountSatang: {
      type: Number,
      required: [true, 'Amount is required'],
      validate: {
        validator: (v: number) => Number.isInteger(v) && v > 0,
        message: 'Amount must be positive integer (Satang)',
      },
    },

    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
      maxlength: 500,
    },

    // MEDICI
    mediciJournalId: String,
    mediciTimestamp: Date,

    // WORKFLOW
    status: {
      type: String,
      enum: ['draft', 'pending_approval', 'posted', 'voided', 'reversal'],
      default: 'draft',
      required: true,
      index: true,
    },

    approvedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    approvedAt: Date,

    originalTransactionId: {
      type: Schema.Types.ObjectId,
      ref: 'Transaction',
    },
    reversalTransactionId: {
      type: Schema.Types.ObjectId,
      ref: 'Transaction',
    },
    voidReason: String,
    voidedAt: Date,
    voidedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },

    // SOURCE
    receiptId: {
      type: Schema.Types.ObjectId,
      ref: 'Receipt',
      index: true,
    },
    exportLogId: {
      type: Schema.Types.ObjectId,
      ref: 'ExportLog',
    },

    // CLASSIFICATION
    category: String,
    tags: [String],

    // DATES
    transactionDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
    postingDate: Date,

    // AUDIT
    clientId: {
      type: Schema.Types.ObjectId,
      ref: 'Client',
      required: true,
      index: true,
    },
    correlationId: {
      type: String,
      index: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },

    // DEV MODE
    isMockData: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    collection: 'transactions',
  }
);

// ===========================
// INDEXES
// ===========================

// Query by status + transaction date
TransactionSchema.index({ status: 1, transactionDate: -1 });

// Client's transactions
TransactionSchema.index({ clientId: 1, transactionDate: -1 });

// Receipt link (quick lookup)
TransactionSchema.index({ receiptId: 1 });

// Void tracking (find original or reversal)
TransactionSchema.index({ originalTransactionId: 1 });
TransactionSchema.index({ reversalTransactionId: 1 });

// Category reporting
TransactionSchema.index({ category: 1, transactionDate: -1 });

// ===========================
// VALIDATION
// ===========================

/**
 * Validate: Debit and Credit accounts must be different
 */
TransactionSchema.pre('save', function(next) {
  if (this.debitAccount === this.creditAccount) {
    next(new Error('Debit and Credit accounts must be different'));
  } else {
    next();
  }
});

/**
 * Validate: Posted transactions cannot be modified
 */
TransactionSchema.pre('save', function(next) {
  if (!this.isNew && this.status === 'posted' && this.isModified()) {
    const modifiedFields = this.modifiedPaths();
    const allowedChanges = ['reversalTransactionId', 'updatedAt'];

    const hasUnallowedChanges = modifiedFields.some(
      field => !allowedChanges.includes(field)
    );

    if (hasUnallowedChanges) {
      next(new Error('Cannot modify posted transaction (void it instead)'));
    }
  }
  next();
});

// ===========================
// METHODS
// ===========================

/**
 * Check if transaction is balanced (for validation)
 */
TransactionSchema.methods.isBalanced = function(this: ITransaction): boolean {
  // In this simple schema, debit = credit always (same amount)
  // In full Medici integration, this would check sum(debits) = sum(credits)
  return this.amountSatang > 0;
};

/**
 * Check if transaction can be voided
 */
TransactionSchema.methods.canBeVoided = function(this: ITransaction): boolean {
  return this.status === 'posted' && !this.reversalTransactionId;
};

// Export the schema for extending with statics/virtuals
export { TransactionSchema };

// Create and export the model
const TransactionModel = mongoose.model<ITransaction>('Transaction', TransactionSchema);
export default TransactionModel;