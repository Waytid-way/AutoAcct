// backend/src/modules/transaction/models/schemas/Transaction.schema.ts

import { Schema, Document } from 'mongoose';

/**
 * TRANSACTION INTERFACE
 * 
 * Represents a double-entry journal entry.
 * 
 * Golden Rules:
 * 1. debit MUST equal credit (always)
 * 2. Both amounts in MoneyInt (Satang)
 * 3. Cannot modify after 'posted' status
 * 4. Multi-tenant isolation (clientId)
 */
export interface ITransaction extends Document {
    id: string;
    clientId: string;
    receiptId?: string;

    // Double-Entry Components
    account: {
        debit: string;   // e.g., "1100-Cash"
        credit: string;  // e.g., "4100-Revenue"
    };
    debit: number;     // MoneyInt (Satang)
    credit: number;    // MoneyInt (Satang)

    // Metadata
    description: string;
    reference?: string;
    date: Date;

    // Status & Approval
    status: 'draft' | 'posted' | 'voided';
    createdBy: string;
    approvedBy?: string;
    approvedAt?: Date;
    voidedBy?: string;
    voidedAt?: Date;
    voidReason?: string;

    // Ledger Integration
    ledgerJournalId?: string;  // Reference to external ledger entry

    // Timestamps
    createdAt: Date;
    updatedAt: Date;
}

const TransactionSchema = new Schema<ITransaction>({
    clientId: {
        type: String,
        required: true,
        index: true
    },
    receiptId: {
        type: Schema.Types.ObjectId,
        ref: 'Receipt',
        index: true
    },

    // Double-Entry
    account: {
        debit: {
            type: String,
            required: true,
            match: [/^\d{4}-/, 'Account Code must start with 4 digits'],
        },
        credit: {
            type: String,
            required: true,
            match: [/^\d{4}-/, 'Account Code must start with 4 digits'],
        },
    },
    debit: {
        type: Number,
        required: true,
        min: 0,
    },
    credit: {
        type: Number,
        required: true,
        min: 0,
    },

    // Metadata
    description: {
        type: String,
        required: true,
        maxlength: 500,
    },
    reference: { type: String },
    date: {
        type: Date,
        required: true,
        default: Date.now,
    },

    // Status
    status: {
        type: String,
        enum: ['draft', 'posted', 'voided'],
        default: 'draft',
        index: true,
    },
    createdBy: {
        type: String,
        required: true
    },
    approvedBy: { type: String },
    approvedAt: { type: Date },
    voidedBy: { type: String },
    voidedAt: { type: Date },
    voidReason: { type: String, maxlength: 500 },

    // Ledger Integration
    ledgerJournalId: { type: String, index: true },

    // Timestamps
    createdAt: {
        type: Date,
        default: Date.now,
    },
    updatedAt: {
        type: Date,
        default: Date.now
    },
});

// ============================================
// INDEXES (Performance Critical)
// ============================================

// Query by client + status (Most common)
TransactionSchema.index({ clientId: 1, status: 1, createdAt: -1 });

// Trial balance queries (posted only, by date)
TransactionSchema.index({ clientId: 1, status: 1, date: 1 });

// ============================================
// VALIDATION & HOOKS
// ============================================

TransactionSchema.pre('save', function (next) {
    // 1. Enforce Double-Entry
    if (this.debit !== this.credit) {
        return next(new Error(`Debit (${this.debit}) must equal Credit (${this.credit})`));
    }

    // 2. Update Timestamp
    this.updatedAt = new Date();

    next();
});

export default TransactionSchema;
