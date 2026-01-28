import mongoose, { Schema, Document } from 'mongoose';

export type AnomalyType =
    | 'duplicate_exact'
    | 'duplicate_similar'
    | 'price_outlier'
    | 'new_vendor'
    | 'unusual_timing'
    | 'category_inconsistency';

export type AnomalySeverity = 'info' | 'warning' | 'critical';

export type AnomalyStatus =
    | 'pending'      // Not reviewed
    | 'confirmed'    // User confirmed it's an issue
    | 'dismissed'    // User says it's fine
    | 'resolved';    // Issue fixed

export interface IAnomalyContext {
    receiptId?: string;
    journalEntryId?: string;
    relatedIds?: string[];     // For duplicates
    expectedValue?: number;    // For outliers
    actualValue?: number;
    historicalAverage?: number;
    standardDeviation?: number;
    vendorName?: string;
    category?: string;
}

export interface IAnomaly extends Document {
    // Core fields
    type: AnomalyType;
    severity: AnomalySeverity;
    confidence: number;           // 0.0 - 1.0
    status: AnomalyStatus;

    // Client & correlation
    clientId: string;
    correlationId: string;

    // Description
    title: string;                // "Possible duplicate receipt"
    message: string;              // "Found 2 receipts: same vendor, amount, date"
    suggestion: string;           // "Review receipt #145 and #147"

    // Context
    context: IAnomalyContext;

    // Metadata
    detectedAt: Date;
    reviewedAt?: Date;
    reviewedBy?: string;          // userId
    dismissalReason?: string;

    // Audit
    createdAt: Date;
    updatedAt: Date;
}

const anomalySchema = new Schema<IAnomaly>({
    type: {
        type: String,
        enum: [
            'duplicate_exact',
            'duplicate_similar',
            'price_outlier',
            'new_vendor',
            'unusual_timing',
            'category_inconsistency'
        ],
        required: true,
        index: true
    },

    severity: {
        type: String,
        enum: ['info', 'warning', 'critical'],
        required: true,
        index: true
    },

    confidence: {
        type: Number,
        required: true,
        min: 0.0,
        max: 1.0
    },

    status: {
        type: String,
        enum: ['pending', 'confirmed', 'dismissed', 'resolved'],
        default: 'pending',
        index: true
    },

    clientId: {
        type: String,
        required: true,
        index: true
    },

    correlationId: {
        type: String,
        required: true,
        index: true
    },

    title: {
        type: String,
        required: true,
        maxlength: 200
    },

    message: {
        type: String,
        required: true,
        maxlength: 500
    },

    suggestion: {
        type: String,
        required: true,
        maxlength: 500
    },

    context: {
        receiptId: { type: String },
        journalEntryId: { type: String },
        relatedIds: [{ type: String }],
        expectedValue: { type: Number },
        actualValue: { type: Number },
        historicalAverage: { type: Number },
        standardDeviation: { type: Number },
        vendorName: { type: String },
        category: { type: String }
    },

    detectedAt: {
        type: Date,
        required: true,
        default: Date.now,
        index: true
    },

    reviewedAt: { type: Date },
    reviewedBy: { type: String },
    dismissalReason: { type: String, maxlength: 500 },

    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
}, {
    timestamps: true
});

// ✅ Compound Indexes for common queries
anomalySchema.index({ clientId: 1, status: 1, severity: 1 });
anomalySchema.index({ clientId: 1, type: 1, detectedAt: -1 });
anomalySchema.index({ 'context.receiptId': 1 });

// ✅ Virtual: Time since detection
anomalySchema.virtual('ageDays').get(function () {
    const now = new Date();
    const detected = this.detectedAt;
    return Math.floor((now.getTime() - detected.getTime()) / (1000 * 60 * 60 * 24));
});

export const Anomaly = mongoose.model<IAnomaly>('Anomaly', anomalySchema);
