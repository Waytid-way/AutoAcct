// backend/src/models/Receipt.model.ts

import ReceiptSchema, { IReceipt } from './schemas/Receipt.schema';
import mongoose from 'mongoose';

/**
 * RECEIPT MODEL - Enhanced with Query Helpers
 */

// ===========================
// QUERY HELPERS
// ===========================

interface IReceiptQueryHelpers {
  /**
   * Get receipts in queue (FIFO order)
   */
  inQueue(clientId: string): mongoose.Query<IReceipt[], IReceipt>;

  /**
   * Get receipts needing manual review
   */
  needsReview(clientId: string): mongoose.Query<IReceipt[], IReceipt>;

  /**
   * Get processed receipts waiting for confirmation
   */
  awaitingConfirmation(clientId: string): mongoose.Query<IReceipt[], IReceipt>;

  /**
   * Filter by confidence threshold
   */
  byConfidence(minConfidence: number): mongoose.Query<IReceipt[], IReceipt>;
}

(ReceiptSchema.query as any).inQueue = function (this: mongoose.Query<any, any>, clientId: string) {
  return this.find({
    clientId: new mongoose.Types.ObjectId(clientId),
    status: 'queued_for_ocr',
  }).sort({ queuePosition: 1 });
};

(ReceiptSchema.query as any).needsReview = function (this: mongoose.Query<any, any>, clientId: string) {
  return this.find({
    clientId: new mongoose.Types.ObjectId(clientId),
    status: 'manual_review',
  }).sort({ createdAt: -1 });
};

(ReceiptSchema.query as any).awaitingConfirmation = function (this: mongoose.Query<any, any>, clientId: string) {
  return this.find({
    clientId: new mongoose.Types.ObjectId(clientId),
    status: 'processed',
  }).sort({ processingCompletedAt: -1 });
};

(ReceiptSchema.query as any).byConfidence = function (this: mongoose.Query<any, any>, minConfidence: number) {
  return this.find({
    'confidenceScores.overall': { $gte: minConfidence },
  });
};

// ===========================
// STATIC METHODS
// ===========================

/**
 * Get queue statistics
 */
ReceiptSchema.statics.getQueueStats = async function (
  this: ReceiptModel,
  clientId: string
): Promise<{
  total: number;
  processing: number;
  queued: number;
  failed: number;
  avgConfidence: number;
}> {
  const stats = await this.aggregate([
    {
      $match: {
        clientId: new mongoose.Types.ObjectId(clientId),
      },
    },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        avgConfidence: { $avg: '$confidenceScores.overall' },
      },
    },
  ]);

  const statusMap = stats.reduce((acc, item) => {
    acc[item._id] = item.count;
    return acc;
  }, {} as Record<string, number>);

  return {
    total: stats.reduce((sum, item) => sum + item.count, 0),
    processing: statusMap.processing || 0,
    queued: statusMap.queued_for_ocr || 0,
    failed: statusMap.failed || 0,
    avgConfidence: stats.find((s: any) => s.avgConfidence)?.avgConfidence || 0,
  };
};

/**
 * Find duplicate by file hash
 */
ReceiptSchema.statics.findDuplicate = async function (
  this: ReceiptModel,
  fileHash: string,
  clientId: string
): Promise<IReceipt | null> {
  return await this.findOne({
    fileHash,
    clientId: new mongoose.Types.ObjectId(clientId),
  }).exec();
};

/**
 * Bulk update status
 */
ReceiptSchema.statics.bulkUpdateStatus = async function (
  this: ReceiptModel,
  receiptIds: string[],
  newStatus: IReceipt['status'],
  correlationId?: string
): Promise<number> {
  const result = await this.updateMany(
    {
      _id: { $in: receiptIds.map(id => new mongoose.Types.ObjectId(id)) },
    },
    {
      $set: {
        status: newStatus,
        updatedAt: new Date(),
      },
    }
  );

  return result.modifiedCount;
};

// ===========================
// VIRTUAL FIELDS
// ===========================

/**
 * Display amount in Baht (formatted)
 */
ReceiptSchema.virtual('amountBaht').get(function () {
  if (!this.extractedFields?.amountSatang) return null;
  const satangToBaht = require('@utils/money').satangToBaht;
  return satangToBaht(this.extractedFields.amountSatang);
});

/**
 * Processing duration (ms)
 */
ReceiptSchema.virtual('processingDurationMs').get(function () {
  if (!this.processingStartedAt || !this.processingCompletedAt) return null;
  return this.processingCompletedAt.getTime() - this.processingStartedAt.getTime();
});

/**
 * Is high confidence?
 */
ReceiptSchema.virtual('isHighConfidence').get(function () {
  return (this.confidenceScores?.overall ?? 0) >= 0.85;
});

// Export with type
export type ReceiptModel = mongoose.Model<IReceipt, IReceiptQueryHelpers>;
export type { IReceipt };
export default mongoose.model<IReceipt, ReceiptModel>('Receipt', ReceiptSchema);