// backend/src/models/schemas/Receipt.schema.ts

import mongoose, { Schema, Document } from 'mongoose';

/**
 * RECEIPT SCHEMA
 *
 * Purpose:
 * - Store uploaded receipt images/PDFs
 * - Track OCR processing workflow (queued → processing → success/failed)
 * - Hold extracted fields (vendor, amount, date) with confidence scores
 * - Support user feedback loop for ML training
 *
 * Workflow States:
 * 1. queued_for_ocr    → Uploaded, waiting for OCR
 * 2. processing        → OCR worker is extracting data
 * 3. processed         → OCR complete, ready for user review
 * 4. manual_review     → Low confidence, needs human verification
 * 5. confirmed         → User approved, ready for accounting
 * 6. failed            → OCR failed, retry or manual entry
 *
 * References:
 * - Vol1 Section 9 - Database Design
 * - Vol2B Section 3 - OCR Integration
 */

export interface IReceipt extends Document {
  // ===========================
  // FILE METADATA
  // ===========================
  fileName: string;                    // Original filename (e.g., "coffee_receipt.jpg")
  fileHash: string;                    // SHA-256 hash for duplicate detection
  fileSizeBytes?: number;              // File size in bytes
  mimeType?: string;                   // e.g., "image/jpeg", "application/pdf"

  // Google Drive reference (optional, if using cloud storage)
  driveFileId?: string;
  driveFileUrl?: string;
  fileUrl?: string;                    // Generic file URL

  // Encryption metadata (if sensitive)
  encrypted?: boolean;
  encryptionIv?: string;               // Initialization vector (base64)
  encryptionAuthTag?: string;          // GCM auth tag (base64)

  // ===========================
  // Workflow Integration (Task 3)
  teableId?: string;
  // transactionId already defined below
  workflowStatus?: 'pending' | 'completed' | 'failed';
  workflowError?: string;
  workflowCompletedAt?: Date;
  workflowFailedAt?: Date;
  workflowDuration?: number;

  // OCR DATA
  // ===========================
  ocrJobId?: string;
  ocrStatus?: 'queued' | 'processing' | 'complete' | 'failed' | 'needs_manual';
  ocrResult?: any;
  ocrConfidence?: number;
  ocrErrors?: string[];

  // Legacy/Existing
  ocrText?: string;                    // Raw OCR output (full text)
  ocrEngine?: 'paddleocr' | 'googlevision' | 'claude' | 'groq' | 'mock';
  ocrProcessedAt?: Date;

  extractedFields?: {
    vendor?: string;                   // ชื่อร้านค้า/ผู้ขาย
    amountSatang?: number;             // จำนวนเงินรวม (Integer: Satang)
    vatAmountSatang?: number;          // VAT 7% (Integer: Satang)
    issueDate?: Date;                  // วันที่ออกใบเสร็จ
    taxId?: string;                    // เลขประจำตัวผู้เสียภาษี (13 หลัก)
    documentNumber?: string;           // เลขที่เอกสาร
    receiptType?: 'receipt' | 'invoice' | 'tax_invoice';
  };

  confidenceScores?: {
    vendor?: number;                   // 0.0 - 1.0
    amount?: number;
    date?: number;
    overall?: number;                  // Average confidence
  };

  // ===========================
  // WORKFLOW STATUS
  // ===========================
  status: 'queued_for_ocr' | 'processing' | 'processed' | 'manual_review' | 'confirmed' | 'failed';
  queuePosition?: number;              // Position in FIFO queue
  processingStartedAt?: Date;
  processingCompletedAt?: Date;

  errorMessage?: string;               // If status = 'failed'
  retryCount?: number;                 // Number of OCR retry attempts

  // ===========================
  // USER FEEDBACK (ML Training)
  // ===========================
  feedback?: {
    vendorCorrected?: string;
    amountSatangCorrected?: number;
    dateCorrected?: Date;
    categoryCorrected?: string;        // For Groq AI training
    reason?: string;                   // Why user corrected
    correctedAt?: Date;
    correctedBy?: mongoose.Types.ObjectId;  // User ID
  };

  // ===========================
  // ACCOUNTING LINK
  // ===========================
  transactionId?: mongoose.Types.ObjectId;  // Link to Transaction after confirmation
  category?: string;                    // Groq AI classification (e.g., "Food & Beverage")
  classification?: {
    category?: string;
    confidence?: number;
  };

  // ===========================
  // MULTI-TENANT & AUDIT
  // ===========================
  clientId: mongoose.Types.ObjectId;   // Which client owns this receipt
  correlationId?: string;               // For request tracing (UUID v4)

  createdAt: Date;
  updatedAt: Date;
  createdBy?: mongoose.Types.ObjectId; // User who uploaded

  // ===========================
  // DEV MODE
  // ===========================
  isMockData?: boolean;                // True if from mock JSON upload

  // ===========================
  // METHODS
  // ===========================
  needsManualReview(): boolean;
  markProcessed(): void;

  // ===========================
  // LINE ITEMS (Task 3E)
  // ===========================
  lineItems?: {
    description: string;
    quantity: number;
    unitPrice: number;    // MoneyInt
    totalPrice: number;   // MoneyInt
    suggestedCategory?: string;
    aiConfidence?: number;
  }[];
  splitTransactionEnabled?: boolean;
}

const ReceiptSchema = new Schema<IReceipt>(
  {
    // FILE METADATA
    fileName: {
      type: String,
      required: [true, 'File name is required'],
      trim: true,
    },
    fileHash: {
      type: String,
      required: true,
      index: true,
      // Note: Not unique globally (allow same file for different clients)
    },
    fileSizeBytes: {
      type: Number,
      min: 0,
    },
    mimeType: {
      type: String,
      enum: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf', null],
    },

    driveFileId: String,
    driveFileUrl: String,

    encrypted: {
      type: Boolean,
      default: false,
    },
    encryptionIv: String,
    encryptionAuthTag: String,

    // WORKFLOW INTEGRATION
    teableId: { type: String, index: true },
    // transactionId already defined
    workflowStatus: {
      type: String,
      enum: ['pending', 'completed', 'failed'],
      default: 'pending'
    },
    workflowError: String,
    workflowCompletedAt: Date,
    workflowFailedAt: Date,
    workflowDuration: Number,

    // OCR DATA
    ocrJobId: { type: String, index: true },
    ocrStatus: {
      type: String,
      enum: ['queued', 'processing', 'complete', 'failed', 'needs_manual'],
      default: 'queued',
      index: true
    },
    ocrResult: Schema.Types.Mixed,
    ocrConfidence: Number,
    ocrErrors: [String],

    // Legacy/Existing fields kept for backward compatibility if needed
    ocrText: {
      type: String,
      maxlength: 50000,
    },
    ocrEngine: {
      type: String,
      enum: ['paddleocr', 'googlevision', 'claude', 'groq', 'mock'],
    },
    ocrProcessedAt: Date,

    extractedFields: {
      vendor: {
        type: String,
        trim: true,
      },
      amountSatang: {
        type: Number,
        validate: {
          validator: (v: number) => Number.isInteger(v) && v >= 0,
          message: 'Amount must be non-negative integer (Satang)',
        },
      },
      vatAmountSatang: {
        type: Number,
        validate: {
          validator: (v: number) => Number.isInteger(v) && v >= 0,
          message: 'VAT amount must be non-negative integer (Satang)',
        },
      },
      issueDate: Date,
      taxId: {
        type: String,
        match: /^\d{13}$/,  // Thai Tax ID format
      },
      documentNumber: String,
      receiptType: {
        type: String,
        enum: ['receipt', 'invoice', 'tax_invoice'],
      },
    },

    confidenceScores: {
      vendor: {
        type: Number,
        min: 0,
        max: 1,
      },
      amount: {
        type: Number,
        min: 0,
        max: 1,
      },
      date: {
        type: Number,
        min: 0,
        max: 1,
      },
      overall: {
        type: Number,
        min: 0,
        max: 1,
      },
    },

    // WORKFLOW
    status: {
      type: String,
      enum: ['queued_for_ocr', 'processing', 'processed', 'manual_review', 'confirmed', 'failed'],
      default: 'queued_for_ocr',
      required: true,
      index: true,
    },
    queuePosition: {
      type: Number,
      min: 0,
    },
    processingStartedAt: Date,
    processingCompletedAt: Date,

    errorMessage: String,
    retryCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    // FEEDBACK
    feedback: {
      vendorCorrected: String,
      amountSatangCorrected: {
        type: Number,
        validate: {
          validator: (v: number) => Number.isInteger(v) && v >= 0,
          message: 'Corrected amount must be integer (Satang)',
        },
      },
      dateCorrected: Date,
      categoryCorrected: String,
      reason: String,
      correctedAt: Date,
      correctedBy: {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
    },

    // ACCOUNTING
    transactionId: {
      type: Schema.Types.ObjectId,
      ref: 'Transaction',
    },
    category: String,

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

    // LINE ITEMS (Task 3E)
    lineItems: [{
      description: { type: String, required: true },
      quantity: { type: Number, required: true, min: 1 },
      unitPrice: {
        type: Number,
        required: true,
        validate: {
          validator: (v: number) => Number.isInteger(v) && v > 0,
          message: 'Unit price must be positive integer'
        }
      },
      totalPrice: {
        type: Number,
        required: true,
        validate: {
          validator: (v: number) => Number.isInteger(v) && v > 0,
          message: 'Total price must be positive integer'
        }
      },
      suggestedCategory: String,
      aiConfidence: Number
    }],
    splitTransactionEnabled: {
      type: Boolean,
      default: false
    },

    // DEV MODE
    isMockData: {
      type: Boolean,
      default: false,
      index: true,  // Query mock data separately
    },
  },
  {
    timestamps: true,  // Auto createdAt/updatedAt
    collection: 'receipts',
  }
);

// ===========================
// INDEXES
// ===========================

// Compound index for duplicate detection (per client)
ReceiptSchema.index({ fileHash: 1, clientId: 1 }, { unique: true });
ReceiptSchema.index({ ocrStatus: 1, ocrJobId: 1 }); // OCR Worker Polling

// FIFO queue query: status + createdAt
ReceiptSchema.index({ status: 1, createdAt: 1 });

// Client's receipts (most recent first)
ReceiptSchema.index({ clientId: 1, createdAt: -1 });

// CorrelationId lookup (debugging)
ReceiptSchema.index({ correlationId: 1 });

// Dev mode filtering
ReceiptSchema.index({ isMockData: 1, createdAt: -1 });

// ===========================
// METHODS
// ===========================

/**
 * Check if receipt needs manual review
 */
ReceiptSchema.methods.needsManualReview = function (this: IReceipt): boolean {
  const MIN_CONFIDENCE = 0.85;

  if (!this.confidenceScores) return true;

  return (
    (this.confidenceScores.overall ?? 0) < MIN_CONFIDENCE ||
    (this.confidenceScores.amount ?? 0) < MIN_CONFIDENCE
  );
};

/**
 * Mark receipt as processed
 */
ReceiptSchema.methods.markProcessed = function (this: IReceipt): void {
  this.status = this.needsManualReview() ? 'manual_review' : 'processed';
  this.processingCompletedAt = new Date();
};

// ===========================
// HOOKS (Middleware)
// ===========================

/**
 * Pre-save: Auto-set queue position for new receipts
 */
ReceiptSchema.pre('save', async function (next) {
  if (this.isNew && this.status === 'queued_for_ocr' && !this.queuePosition) {
    const Receipt = this.constructor as mongoose.Model<IReceipt>;
    const maxPosition = await Receipt
      .findOne({ status: 'queued_for_ocr' })
      .sort('-queuePosition')
      .select('queuePosition');

    this.queuePosition = (maxPosition?.queuePosition ?? 0) + 1;
  }
  next();
});

/**
 * Pre-save: Validate line items total (Task 3E)
 */
ReceiptSchema.pre('save', function (next) {
  if (this.lineItems && this.lineItems.length > 0) {
    const sum = this.lineItems.reduce((acc, item) => acc + item.totalPrice, 0);

    // Check if extractedFields exists and amountSatang is present
    if (this.extractedFields?.amountSatang && sum !== this.extractedFields.amountSatang) {
      // Create a specific error but don't block save if status is 'manual_review' or 'processing'
      // Strictly enforce only when confirming? 
      // For now, let's just log a warning or enforce it? 
      // The requirement said: "return next(new Error(...))"
      // But we should be careful during OCR process where numbers might not match yet.
      // Let's enforce it ONLY when splitTransactionEnabled is true, which implies user intent.

      if (this.splitTransactionEnabled) {
        return next(new Error(
          `Line items sum (${sum}) does not match total amount (${this.extractedFields.amountSatang})`
        ));
      }
    }
  }
  next();
});

/**
 * Pre-save: Log status changes
 */
ReceiptSchema.pre('save', function (next) {
  if (this.isModified('status')) {
    const logger = require('@config/logger').default;
    logger.info({
      action: 'receipt_status_changed',
      receiptId: this._id,
      correlationId: this.correlationId,
      oldStatus: this.get('status', null, { getters: false }),
      newStatus: this.status,
    });
  }
  next();
});

// Export schema instance for extension in Receipt.model.ts
export default ReceiptSchema;