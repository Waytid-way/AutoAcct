// backend/src/models/ExportLog.model.ts

import ExportLogSchema, { IExportLog } from './schemas/ExportLog.schema';
import mongoose from 'mongoose';

/**
 * EXPORT LOG MODEL - Enhanced with export management methods
 */

// ===========================
// QUERY HELPERS
// ===========================

interface IExportLogQueryHelpers {
  /**
   * Get pending exports for retry
   */
  pendingRetries(): mongoose.Query<IExportLog[], IExportLog>;

  /**
   * Get failed exports
   */
  failedExports(): mongoose.Query<IExportLog[], IExportLog>;

  /**
   * Get successful exports
   */
  successfulExports(): mongoose.Query<IExportLog[], IExportLog>;
}

ExportLogSchema.query.pendingRetries = function() {
  return this.find({
    status: { $in: ['pending', 'failed'] },
    nextRetryAt: { $lte: new Date() },
  }).sort({ nextRetryAt: 1 });
};

ExportLogSchema.query.failedExports = function() {
  return this.find({
    status: 'failed',
  }).sort({ lastAttemptAt: -1 });
};

ExportLogSchema.query.successfulExports = function() {
  return this.find({
    status: 'success',
  }).sort({ createdAt: -1 });
};

// ===========================
// STATIC METHODS
// ===========================

/**
 * Get export statistics for a client
 */
ExportLogSchema.statics.getExportStats = async function(
  clientId: string
): Promise<{
  total: number;
  pending: number;
  inProgress: number;
  success: number;
  failed: number;
  abandoned: number;
  avgDurationMs: number;
  successRate: number;
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
        avgDuration: { $avg: '$durationMs' },
      },
    },
  ]);

  const statusMap = stats.reduce((acc, item) => {
    acc[item._id] = item.count;
    return acc;
  }, {} as Record<string, number>);

  const total = stats.reduce((sum, item) => sum + item.count, 0);
  const success = statusMap.success || 0;

  return {
    total,
    pending: statusMap.pending || 0,
    inProgress: statusMap.in_progress || 0,
    success,
    failed: statusMap.failed || 0,
    abandoned: statusMap.abandoned || 0,
    avgDurationMs: stats.find(s => s.avgDuration)?.avgDuration || 0,
    successRate: total > 0 ? (success / total) * 100 : 0,
  };
};

/**
 * Get exports ready for retry
 */
ExportLogSchema.statics.getReadyForRetry = async function(): Promise<IExportLog[]> {
  return await this.find({
    status: { $in: ['pending', 'failed'] },
    nextRetryAt: { $lte: new Date() },
  })
    .sort({ nextRetryAt: 1 })
    .populate('transactionId')
    .exec();
};

/**
 * Mark multiple exports as abandoned (max retries exceeded)
 */
ExportLogSchema.statics.bulkAbandon = async function(
  exportIds: string[],
  reason: string = 'Max retries exceeded'
): Promise<number> {
  const result = await this.updateMany(
    {
      _id: { $in: exportIds.map(id => new mongoose.Types.ObjectId(id)) },
      status: 'failed',
    },
    {
      $set: {
        status: 'abandoned',
        errorMessage: reason,
        updatedAt: new Date(),
      },
      $unset: {
        nextRetryAt: 1,
      },
    }
  );

  const logger = require('@config/logger').default;
  logger.warn({
    action: 'bulk_export_abandon',
    count: result.modifiedCount,
    reason,
  });

  return result.modifiedCount;
};

/**
 * Clean up old successful exports (keep last 30 days)
 */
ExportLogSchema.statics.cleanupOldExports = async function(
  olderThanDays: number = 30
): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

  const result = await this.deleteMany({
    status: 'success',
    createdAt: { $lt: cutoffDate },
  });

  const logger = require('@config/logger').default;
  logger.info({
    action: 'export_logs_cleanup',
    deletedCount: result.deletedCount,
    olderThanDays,
  });

  return result.deletedCount;
};

// ===========================
// VIRTUAL FIELDS
// ===========================

/**
 * Is ready for retry?
 */
ExportLogSchema.virtual('isReadyForRetry').get(function() {
  return (
    (this.status === 'pending' || this.status === 'failed') &&
    (!this.nextRetryAt || this.nextRetryAt <= new Date())
  );
});

/**
 * Time until next retry (ms)
 */
ExportLogSchema.virtual('timeUntilRetryMs').get(function() {
  if (!this.nextRetryAt) return null;
  return Math.max(0, this.nextRetryAt.getTime() - Date.now());
});

/**
 * Has exceeded max retries?
 */
ExportLogSchema.virtual('hasExceededRetries').get(function() {
  return this.attemptCount >= this.maxRetries;
});

export default mongoose.model<IExportLog>('ExportLog', ExportLogSchema);