import mongoose from 'mongoose';
import { MoneyInt } from '@/utils/validators/common.validators';

export interface IJournalEntry extends mongoose.Document {
    // Core Fields
    account: {
        debit: string;
        credit: string;
    };
    debit: MoneyInt;
    credit: MoneyInt;
    description: string;
    date: Date;
    reference?: string;

    // Status
    status: 'draft' | 'posted' | 'voided';
    postedAt?: Date;
    postedBy?: mongoose.Types.ObjectId;
    voidedAt?: Date;
    voidedReason?: string;

    // Split Transaction Fields (Phase 3E)
    parentReceiptId?: mongoose.Types.ObjectId;  // Link back to Receipt
    isSplitEntry: boolean;                      // true if part of compound
    splitIndex?: number;                        // Order in sequence (0, 1, 2...)
    splitGroupId?: string;                      // UUID to group entries together

    // Multi-tenant & Audit
    clientId: mongoose.Types.ObjectId;
    createdBy?: mongoose.Types.ObjectId;
    updatedBy?: mongoose.Types.ObjectId;

    createdAt: Date;
    updatedAt: Date;
}

const JournalEntrySchema = new mongoose.Schema<IJournalEntry>(
    {
        account: {
            debit: { type: String, required: true, index: true },
            credit: { type: String, required: true, index: true },
        },
        debit: {
            type: Number,
            required: true,
            validate: (v: number) => Number.isInteger(v) && v >= 0
        },
        credit: {
            type: Number,
            required: true,
            validate: (v: number) => Number.isInteger(v) && v >= 0
        },
        description: { type: String, required: true },
        date: { type: Date, required: true, index: true },
        reference: String,

        status: {
            type: String,
            enum: ['draft', 'posted', 'voided'],
            default: 'draft',
            index: true
        },
        postedAt: Date,
        postedBy: mongoose.Schema.Types.ObjectId,
        voidedAt: Date,
        voidedReason: String,

        // Split entry fields
        parentReceiptId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Receipt',
            index: true
        },
        isSplitEntry: {
            type: Boolean,
            default: false,
            index: true
        },
        splitIndex: {
            type: Number,
            min: 0
        },
        splitGroupId: {
            type: String,
            index: true
        },

        clientId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            index: true
        },
        createdBy: mongoose.Schema.Types.ObjectId,
        updatedBy: mongoose.Schema.Types.ObjectId,
    },
    { timestamps: true }
);

// Compound Indexes
JournalEntrySchema.index({ splitGroupId: 1, splitIndex: 1 });
JournalEntrySchema.index({ clientId: 1, date: -1 });

export const JournalEntry = mongoose.model<IJournalEntry>('JournalEntry', JournalEntrySchema);
export default JournalEntry;
