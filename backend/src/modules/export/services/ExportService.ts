// backend/src/modules/export/services/ExportService.ts

import Transaction from '@/models/Transaction.model';
import ExportLog from '@/models/ExportLog.model';
import { IExportLog } from '@/models/schemas/ExportLog.schema';
import { IAccountingAdapter } from '@adapters/interfaces/IAccountingAdapter';
import logger from '@config/logger';
import { v4 as uuidv4 } from 'uuid';
import { NotFoundError } from '@utils/errors';

// Local BusinessLogicError until added to utils/errors.ts
class BusinessLogicError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BusinessLogicError';
  }
}

/**
 * EXPORT SERVICE
 *
 * Responsibilities:
 * - Export transactions to Express Accounting
 * - Retry logic with exponential backoff
 * - Audit logging
 */

export class ExportService {
  constructor(private accountingAdapter: IAccountingAdapter) {}

  /**
   * Export single transaction
   */
  async exportTransaction(
    transactionId: string,
    correlationId?: string
  ): Promise<IExportLog> {
    correlationId = correlationId || uuidv4();

    try {
      // 1. Get transaction
      const transaction = await Transaction.findById(transactionId);
      if (!transaction) {
        throw new NotFoundError('Transaction not found');
      }

      if (transaction.status !== 'posted') {
        throw new BusinessLogicError('Only posted transactions can be exported');
      }

      // 2. Create export log
      const exportLog = await ExportLog.create({
        transactionId: transaction._id,
        status: 'pending',
        attemptCount: 0,
        maxRetries: 3,
        expressApiUrl: (this.accountingAdapter as any).config?.endpoint || 'http://localhost:9000/api/v1/transactions',
        clientId: transaction.clientId,
        correlationId,
      });

      // 3. Attempt export
      await this.attemptExport(exportLog);

      return exportLog;

    } catch (error) {
      logger.error({
        action: 'export_failed',
        correlationId,
        transactionId,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * Attempt export (with error handling)
   */
  private async attemptExport(exportLog: IExportLog): Promise<void> {
    try {
      exportLog.status = 'in_progress';
      exportLog.startedAt = new Date();
      await exportLog.save();

      // Get transaction details
      const transaction = await Transaction.findById(exportLog.transactionId);
      if (!transaction) throw new Error('Transaction not found');

      // Call Express API via adapter
      const doc = await this.accountingAdapter.exportTransaction({
        transactionDate: transaction.transactionDate,
        debitAccount: transaction.debitAccount,
        creditAccount: transaction.creditAccount,
        amountSatang: transaction.amountSatang,
        description: transaction.description,
        referenceNumber: transaction._id.toString(),
      });

      // Success!
      exportLog.status = 'success';
      exportLog.completedAt = new Date();
      exportLog.durationMs = exportLog.completedAt.getTime() - exportLog.startedAt!.getTime();
      exportLog.expressDocumentId = doc.documentId;
      exportLog.expressResponseStatus = 201;
      exportLog.expressResponseBody = doc;

      await exportLog.save();

      logger.info({
        action: 'export_success',
        correlationId: exportLog.correlationId,
        transactionId: transaction._id,
        documentId: doc.documentId,
        durationMs: exportLog.durationMs,
      });

    } catch (error) {
      // Determine if retryable
      const isRetryable = this.isRetryableError(error as Error);

      await exportLog.markFailed(error as Error, isRetryable);

      logger.warn({
        action: 'export_attempt_failed',
        correlationId: exportLog.correlationId,
        attemptCount: exportLog.attemptCount,
        isRetryable,
        nextRetryAt: exportLog.nextRetryAt,
        error: (error as Error).message,
      });
    }
  }

  /**
   * Process retry queue
   */
  async processRetryQueue(): Promise<{
    processed: number;
    succeeded: number;
    failed: number;
  }> {
    const now = new Date();

    // Get exports ready for retry
    const exports = await ExportLog.find({
      status: 'failed',
      nextRetryAt: { $lte: now },
    }).limit(10);

    let succeeded = 0;
    let failed = 0;

    for (const exportLog of exports) {
      try {
        await this.attemptExport(exportLog);
        if (exportLog.status === 'success') succeeded++;
      } catch (error) {
        failed++;
      }
    }

    logger.info({
      action: 'retry_queue_processed',
      processed: exports.length,
      succeeded,
      failed,
    });

    return {
      processed: exports.length,
      succeeded,
      failed,
    };
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: Error): boolean {
    const retryablePatterns = [
      'ECONNREFUSED',
      'ETIMEDOUT',
      'ENOTFOUND',
      'Network timeout',
      '503',
      '504',
    ];

    return retryablePatterns.some(pattern =>
      error.message.includes(pattern)
    );
  }
}