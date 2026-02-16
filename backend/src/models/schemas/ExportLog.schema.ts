// backend/src/models/schemas/ExportLog.schema.ts

import mongoose, { Schema, Document } from 'mongoose';

/**
 * EXPORT LOG SCHEMA
 *
 * Purpose:
 * - Track all export attempts to Express Accounting API
 * - Support retry logic with exponential backoff
 * - Audit trail for regulatory compliance
 * - Enable error recovery and debugging
 *
 * Workflow:
 * 1. pending       → Export job queued
 * 2. in_progress   → Currently exporting
 * 3. success       → Export successful
 * 4. failed        → Export failed (will retry)
 * 5. abandoned     → Max retries exceeded
 *
 * References:
 * - Vol2B Section 5 - Express Accounting Integration
 * - Phase3D - Retry Logic with Exponential Backoff
 */

export interface IExportLog extends Document {
  // ===========================
  // EXPORT TARGET
  // ===========================
  transactionId: mongoose.Types.ObjectId;  // Transaction being exported

  // ===========================
  // STATUS & RETRY
  // ===========================
  status: 'pending' | 'in_progress' | 'success' | 'failed' | 'abandoned';

  attemptCount: number;                // Current attempt number
  maxRetries: number;                  // Max allowed retries (from config)

  nextRetryAt?: Date;                  // When to retry next (exponential backoff)
  lastAttemptAt?: Date;

  // ===========================
  // EXPRESS API DATA
  // ===========================
  expressApiUrl: string;               // Full API endpoint
  expressRequestBody?: any;            // Request payload (JSON)
  expressResponseStatus?: number;      // HTTP status code
  expressResponseBody?: any;           // Response data
  expressDocumentId?: string;          // Express document ID (if success)

  // ===========================
  // ERROR TRACKING
  // ===========================
  errorMessage?: string;
  errorCode?: string;                  // e.g., "NETWORK_TIMEOUT", "INVALID_DATA"
  errorStack?: string;

  isRetryable?: boolean;               // Can this error be retried?

  // ===========================
  // TIMING METRICS
  // ===========================
  startedAt?: Date;
  completedAt?: Date;
  durationMs?: number;                 // Request duration in milliseconds

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
  isMockExport?: boolean;              // True if using mock Express API

  // ===========================
  // METHODS
  // ===========================
  calculateNextRetry(): Date;
  shouldAbandon(): boolean;
  markFailed(error: Error, isRetryable?: boolean): Promise<void>;
}

const ExportLogSchema = new Schema<IExportLog>(
  {
    // TARGET
    transactionId: {
      type: Schema.Types.ObjectId,
      ref: 'Transaction',
      required: true,
      index: true,
    },

    // STATUS
    status: {
      type: String,
      enum: ['pending', 'in_progress', 'success', 'failed', 'abandoned'],
      default: 'pending',
      required: true,
      index: true,
    },

    attemptCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    maxRetries: {
      type: Number,
      default: 3,
      min: 0,
    },

    nextRetryAt: {
      type: Date,
      index: true,  // Query for retry queue
    },
    lastAttemptAt: Date,

    // EXPRESS API
    expressApiUrl: {
      type: String,
      required: true,
    },
    expressRequestBody: Schema.Types.Mixed,
    expressResponseStatus: Number,
    expressResponseBody: Schema.Types.Mixed,
    expressDocumentId: String,

    // ERROR
    errorMessage: String,
    errorCode: String,
    errorStack: String,
    isRetryable: Boolean,

    // TIMING
    startedAt: Date,
    completedAt: Date,
    durationMs: Number,

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
    isMockExport: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    collection: 'exportlogs',
  }
);

// ===========================
// INDEXES
// ===========================

// Retry queue: status + nextRetryAt
ExportLogSchema.index({ status: 1, nextRetryAt: 1 });

// Transaction lookup
ExportLogSchema.index({ transactionId: 1, createdAt: -1 });

// Client's export history
ExportLogSchema.index({ clientId: 1, createdAt: -1 });

// Failed exports (for monitoring)
ExportLogSchema.index({ status: 1, lastAttemptAt: -1 });

// ===========================
// METHODS
// ===========================

/**
 * Calculate next retry time using exponential backoff
 */
ExportLogSchema.methods.calculateNextRetry = function(this: IExportLog): Date {
  const config = require('@config/ConfigManager').default;
  const retryConfig = config.getRetryConfig();

  const baseInterval = retryConfig.initialInterval;  // 5 min
  const multiplier = retryConfig.multiplier;         // 1.5
  const maxInterval = retryConfig.maxInterval;       // 1 hour

  const backoffMs = Math.min(
    baseInterval * Math.pow(multiplier, this.attemptCount),
    maxInterval
  );

  return new Date(Date.now() + backoffMs);
};

/**
 * Check if export should be abandoned
 */
ExportLogSchema.methods.shouldAbandon = function(this: IExportLog): boolean {
  return this.attemptCount >= this.maxRetries;
};

/**
 * Mark export as failed and schedule retry
 */
ExportLogSchema.methods.markFailed = async function(
  this: IExportLog,
  error: Error,
  isRetryable: boolean = true
): Promise<void> {
  this.status = 'failed';
  this.errorMessage = error.message;
  this.errorStack = error.stack;
  this.isRetryable = isRetryable;
  this.attemptCount += 1;
  this.lastAttemptAt = new Date();

  if (this.shouldAbandon()) {
    this.status = 'abandoned';
    this.nextRetryAt = undefined;
  } else if (isRetryable) {
    this.nextRetryAt = this.calculateNextRetry();
  }

  await this.save();
};

// Export the schema for extending with statics/virtuals
export { ExportLogSchema };

// Create and export the model
const ExportLogModel = mongoose.model<IExportLog>('ExportLog', ExportLogSchema);
export default ExportLogModel;