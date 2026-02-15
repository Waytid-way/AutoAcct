// backend/src/modules/receipt/services/ReceiptService.ts

import crypto from 'crypto';
import Receipt, { IReceipt } from '@/models/Receipt.model';
import { TransactionService } from '@/modules/transaction/services/TransactionService';
import { AccountingService } from '@/modules/accounting/services/AccountingService';
import { GroqClassificationService } from '@/modules/ai/GroqClassificationService';
import { AnomalyDetectionService } from '@/modules/anomaly/services/AnomalyDetectionService';
import { MoneyInt } from '@/utils/money';
import config from '@/config/ConfigManager';
import {
  DuplicateReceiptError,
  NotFoundError,
  ValidationError
} from '@/shared/errors';
import logger from '@/config/logger';
import { Logger } from 'winston';
import { sanitizeFileName, sanitizeText, validateFileType, validateFileSize } from '@/shared/utils/sanitization';
import type {
  QueueQueryInput,
  FeedbackInput,
  ConfirmReceiptInput
} from '../validators/receipt.validators';

/**
 * RECEIPT SERVICE
 * 
 * Business logic for Receipt operations following Skill 3 (Service Layer Pattern):
 * - Upload with duplicate detection (hash-based)
 * - Queue management (FIFO)
 * - OCR result processing
 * - User feedback/corrections
 * - Statistics for dashboard
 * - Transaction creation (Draft)
 * 
 * Reference: Skill 3 - Service Layer Pattern
 * Reference: Phase 2.2 Task 1.5
 */
export class ReceiptService {
  private logger: Logger;
  private transactionService: TransactionService;
  private accountingService: AccountingService;
  private groqService: GroqClassificationService;
  private anomalyService: AnomalyDetectionService;

  /**
   * Initialize Service with Dependencies
   * @param loggerInstance - Optional logger for DI (uses default if omitted)
   * @param transactionService - Optional transaction service
   * @param accountingService - Optional accounting service
   */
  constructor(
    loggerInstance?: Logger,
    transactionService?: TransactionService,
    accountingService?: AccountingService,
    groqService?: GroqClassificationService,
    anomalyService?: AnomalyDetectionService
  ) {
    this.logger = loggerInstance || logger;
    this.transactionService = transactionService || new TransactionService(this.logger);
    this.accountingService = accountingService || new AccountingService();
    this.groqService = groqService || new GroqClassificationService(process.env.GROQ_API_KEY || '');
    this.anomalyService = anomalyService || new AnomalyDetectionService();
  }

  /**
   * Upload receipt file with duplicate detection
   */
  async uploadReceipt(
    file: Buffer,
    fileName: string,
    mimeType: string,
    clientId: string,
    correlationId: string,
    userId?: string
  ): Promise<IReceipt> {
    // Validate and sanitize inputs
    const sanitizedFileName = sanitizeFileName(fileName);
    
    // Validate file type
    if (!validateFileType(mimeType)) {
      throw new ValidationError(`Invalid file type: ${mimeType}. Allowed: JPEG, PNG, PDF`);
    }
    
    // Validate file size (10MB max)
    if (!validateFileSize(file.length, 10)) {
      throw new ValidationError('File too large. Maximum size is 10MB');
    }

    this.logger.info({
      action: 'upload_receipt_start',
      correlationId,
      fileName: sanitizedFileName,
      originalFileName: fileName,
      clientId,
      fileSize: file.length,
    });

    // Step 1: Calculate hash
    const fileHash = this.calculateHash(file);

    this.logger.debug({
      action: 'file_hash_calculated',
      correlationId,
      fileHash,
    });

    // Step 2: Check for duplicates
    await this.ensureNotDuplicate(fileHash, clientId, correlationId);

    // Step 3: Save to database
    const receipt = await this.saveReceipt({
      fileName: sanitizedFileName,
      fileHash,
      mimeType,
      fileSizeBytes: file.length,
      clientId,
      userId,
      correlationId,
    }, correlationId);

    this.logger.info({
      action: 'receipt_uploaded',
      correlationId,
      receiptId: receipt._id,
      status: receipt.status,
      queuePosition: receipt.queuePosition,
    });

    return receipt;
  }

  /**
   * Get receipt by ID
   */
  async getById(
    receiptId: string,
    clientId: string,
    correlationId: string
  ): Promise<IReceipt> {
    this.logger.debug({
      action: 'get_receipt_by_id',
      correlationId,
      receiptId,
      clientId,
    });

    const receipt = await Receipt.findOne({
      _id: receiptId,
      clientId,
    });

    if (!receipt) {
      this.logger.warn({
        action: 'receipt_not_found',
        correlationId,
        receiptId,
        clientId,
      });
      throw new NotFoundError('Receipt not found');
    }

    return receipt;
  }

  /**
   * Get queue of receipts with pagination and filters
   */
  async getQueue(
    query: QueueQueryInput,
    clientId: string,
    correlationId: string
  ): Promise<{ data: IReceipt[]; total: number }> {
    this.logger.debug({
      action: 'get_queue',
      correlationId,
      query,
      clientId,
    });

    // Build filter
    const filter: any = { clientId };
    if (query.status) {
      filter.status = query.status;
    }

    // Execute query with pagination
    const [data, total] = await Promise.all([
      Receipt.find(filter)
        .sort({ createdAt: 1 }) // FIFO
        .skip((query.page - 1) * query.perPage)
        .limit(query.perPage)
        .lean<IReceipt[]>(),
      Receipt.countDocuments(filter),
    ]);

    this.logger.debug({
      action: 'queue_fetched',
      correlationId,
      count: data.length,
      total,
      page: query.page,
    });

    return { data, total };
  }

  /**
   * Get queue statistics for dashboard
   */
  async getQueueStats(
    clientId: string,
    correlationId: string
  ): Promise<{
    total: number;
    processing: number;
    queued: number;
    failed: number;
    avgConfidence: number;
  }> {
    this.logger.debug({
      action: 'get_queue_stats',
      correlationId,
      clientId,
    });

    const stats = await Receipt.aggregate([
      { $match: { clientId } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          avgConfidence: { $avg: '$confidenceScores.overall' },
        }
      },
    ]);

    const statusMap = stats.reduce((acc: Record<string, number>, item: { _id: string; count: number }) => {
      acc[item._id] = item.count;
      return acc;
    }, {} as Record<string, number>);

    const result = {
      total: stats.reduce((sum: number, item: { count: number }) => sum + item.count, 0),
      processing: statusMap.processing || 0,
      queued: statusMap.queued_for_ocr || 0,
      failed: statusMap.failed || 0,
      avgConfidence: stats.find((s: { avgConfidence: number }) => s.avgConfidence)?.avgConfidence || 0,
    };

    this.logger.debug({
      action: 'queue_stats_fetched',
      correlationId,
      stats: result,
    });

    return result;
  }

  /**
   * Submit user feedback/corrections for OCR results
   */
  async submitFeedback(
    receiptId: string,
    feedback: FeedbackInput,
    clientId: string,
    correlationId: string,
    userId?: string
  ): Promise<IReceipt> {
    this.logger.info({
      action: 'submit_feedback_start',
      correlationId,
      receiptId,
      clientId,
      userId,
    });

    // Step 1: Get receipt
    const receipt = await this.getById(receiptId, clientId, correlationId);

    // Step 2: Update with feedback
    const feedbackData: any = {
      correctedAt: new Date(),
    };

    if (userId) {
      feedbackData.correctedBy = userId;
    }

    if (feedback.corrections?.vendor !== undefined) {
      feedbackData.vendorCorrected = sanitizeText(feedback.corrections.vendor);
    }
    if (feedback.corrections?.amount !== undefined) {
      feedbackData.amountSatangCorrected = feedback.corrections.amount;
    }
    if (feedback.corrections?.date !== undefined) {
      feedbackData.dateCorrected = feedback.corrections.date;
    }
    if (feedback.corrections?.category !== undefined) {
      feedbackData.categoryCorrected = sanitizeText(feedback.corrections.category);
    }
    if (feedback.notes !== undefined) {
      feedbackData.reason = sanitizeText(feedback.notes);
    }

    receipt.feedback = feedbackData;

    // Step 3: Mark as processed if still processing
    if (receipt.status === 'processing') {
      receipt.status = 'processed';
    }

    receipt.updatedAt = new Date();

    // Step 4: Save
    await receipt.save();

    this.logger.info({
      action: 'feedback_submitted',
      correlationId,
      receiptId: receipt._id,
      status: receipt.status,
      hasCorrectedVendor: !!feedbackData.vendorCorrected,
      hasCorrectedAmount: !!feedbackData.amountSatangCorrected,
    });

    return receipt;
  }

  /**
   * Update receipt with OCR results
   */
  async updateWithOcrResult(
    receiptId: string,
    ocrResult: {
      ocrText?: string;
      vendor?: string;
      amountSatang?: number;
      issueDate?: Date;
      taxId?: string;
      confidence: {
        vendor?: number;
        amount?: number;
        date?: number;
        overall: number;
      };
      ocrEngine?: 'paddleocr' | 'googlevision' | 'claude' | 'groq' | 'mock';
    },
    clientId: string,
    correlationId: string
  ): Promise<IReceipt> {
    this.logger.info({
      action: 'update_with_ocr_result_start',
      correlationId,
      receiptId,
      confidence: ocrResult.confidence.overall,
    });

    // Sanitize OCR results to prevent XSS
    const sanitizedOcrResult = {
      ...ocrResult,
      ocrText: ocrResult.ocrText ? sanitizeText(ocrResult.ocrText) : undefined,
      vendor: ocrResult.vendor ? sanitizeText(ocrResult.vendor) : undefined,
      taxId: ocrResult.taxId ? sanitizeText(ocrResult.taxId) : undefined,
    };

    // Step 1: Get receipt
    const receipt = await this.getById(receiptId, clientId, correlationId);

    // Step 2: Update with OCR data (using sanitized results)
    receipt.ocrText = sanitizedOcrResult.ocrText;
    receipt.ocrEngine = sanitizedOcrResult.ocrEngine || 'paddleocr';
    receipt.ocrProcessedAt = new Date();

    receipt.extractedFields = {
      vendor: sanitizedOcrResult.vendor,
      amountSatang: sanitizedOcrResult.amountSatang,
      issueDate: sanitizedOcrResult.issueDate,
      taxId: sanitizedOcrResult.taxId,
    };

    receipt.confidenceScores = sanitizedOcrResult.confidence;

    // Step 3: Mark as processed (or manual review if low confidence)
    receipt.markProcessed();
    receipt.updatedAt = new Date();

    // Step 4: Save
    await receipt.save();

    this.logger.info({
      action: 'ocr_result_updated',
      correlationId,
      receiptId: receipt._id,
      status: receipt.status,
      confidence: ocrResult.confidence.overall,
    });

    return receipt;
  }

  /**
   * Process entire queue (batch)
   */
  async processQueue(
    clientId: string,
    options?: {
      maxBatch?: number;
      stopOnError?: boolean;
    }
  ): Promise<{
    processed: number;
    failed: number;
    receipts: IReceipt[];
  }> {
    const maxBatch = options?.maxBatch || 10;
    const stopOnError = options?.stopOnError ?? false;

    const results: IReceipt[] = [];
    let processed = 0;
    let failed = 0;

    this.logger.info({
      action: 'process_queue_start',
      clientId,
      maxBatch,
    });

    // Get receipts in queue
    const receipts = await Receipt.find({
      clientId,
      status: 'queued_for_ocr',
    })
      .sort({ queuePosition: 1 })
      .limit(maxBatch);

    for (const receipt of receipts) {
      try {
        // Update status to processing
        receipt.status = 'processing';
        receipt.processingStartedAt = new Date();
        await receipt.save();

        // Note: Actual OCR processing would happen here
        // For now, just mark as processed
        results.push(receipt);
        processed++;
      } catch (error) {
        failed++;
        this.logger.error({
          action: 'receipt_processing_failed',
          receiptId: receipt._id,
          error: (error as Error).message,
        });

        if (stopOnError) break;
      }
    }

    this.logger.info({
      action: 'process_queue_complete',
      clientId,
      processed,
      failed,
    });

    return { processed, failed, receipts: results };
  }

  /**
   * Confirm OCR result and create draft transaction
   */
  async confirmReceipt(
    receiptId: string,
    data: ConfirmReceiptInput,
    correlationId: string
  ): Promise<{ receiptId: string; transactionId?: string; splitGroupId?: string; status: 'draft' }> {
    this.logger.info(`[${correlationId}] Confirming receipt ${receiptId}`);

    // 1. Get receipt
    const receipt = await Receipt.findById(receiptId);
    if (!receipt) {
      throw new NotFoundError(`Receipt`, receiptId);
    }

    let result;

    // 2. Branch: Split Transaction vs Simple Transaction
    if (data.lineItems && data.lineItems.length > 0) {
      // Handle Split Entry via AccountingService
      let splitItems = data.lineItems.map(item => ({
        debitAccount: item.category || '',
        amount: item.totalPrice as MoneyInt,
        description: `${item.description} (x${item.quantity})`,
        quantity: item.quantity,
        totalPrice: item.totalPrice,
        category: item.category
      }));

      this.logger.debug({
        correlationId,
        action: 'classify_line_items_start',
        itemCount: splitItems.length
      });

      // Call Groq AI to classify each item
      const classifications = await this.groqService.classifyLineItems(
        splitItems.map(item => ({
          description: item.description,
          quantity: item.quantity,
          totalPrice: item.totalPrice as MoneyInt
        })),
        correlationId
      );

      // Merge AI suggestions into line items
      splitItems = splitItems.map((item, idx) => {
        const classification = classifications[idx];
        const finalCategory = item.category || classification.category;

        return {
          ...item,
          debitAccount: finalCategory === 'PENDING_REVIEW' ? 'Uncategorized Expense' : (finalCategory || 'Uncategorized Expense'),
          category: finalCategory
        };
      });

      // Call Accounting Service for Split Transaction
      const entries = await this.accountingService.createSplitEntry(
        receiptId,
        splitItems.map(item => ({
          debitAccount: item.debitAccount,
          amount: item.totalPrice as MoneyInt, // Ensure amount is used from totalPrice
          description: `${item.description} (x${item.quantity})`
        })),
        'Cash/AgriBank', // Default credit account
        receipt.clientId.toString(),
        correlationId
      );

      result = {
        receiptId,
        splitGroupId: entries[0]?.splitGroupId,
        status: 'draft' as const
      };

    } else {
      // Handle Simple Entry via TransactionService
      const transaction = await this.transactionService.createDraft({
        clientId: receipt.clientId.toString(),
        receiptId: receiptId,
        account: {
          debit: data.category || 'Uncategorized Expense', // Simple mapping
          credit: 'Cash/AgriBank', // Default credit account
        },
        debit: data.amount,
        credit: data.amount,
        description: `${data.vendor} - ${data.category || 'Expense'}`,
        date: new Date(data.date),
        reference: receipt.fileName,
      }, receipt.createdBy ? receipt.createdBy.toString() : 'system', correlationId);

      result = {
        receiptId,
        transactionId: transaction._id.toString(),
        status: 'draft' as const
      };
    }

    // 3. Update receipt status (common)
    receipt.status = 'confirmed';
    receipt.updatedAt = new Date();
    await receipt.save();

    return result;
  }

  /**
   * Delete receipt
   */
  async deleteReceipt(
    receiptId: string,
    correlationId: string
  ): Promise<void> {
    this.logger.info(`[${correlationId}] Deleting receipt ${receiptId}`);

    const receipt = await Receipt.findById(receiptId);
    if (!receipt) {
      throw new NotFoundError(`Receipt`, receiptId);
    }

    // Delete from storage if exists (TODO: Inject StorageAdapter)
    // if (receipt.fileUrl && this.storageAdapter) {
    //     await this.storageAdapter.delete(receipt.fileUrl);
    // }

    // Delete from database
    await receipt.deleteOne();
  }

  /**
   * Update receipt line items (Task 3E)
   */
  async updateLineItems(
    receiptId: string,
    lineItems: {
      description: string;
      quantity: number;
      unitPrice: number;
      totalPrice: number;
      suggestedCategory?: string;
      aiConfidence?: number;
    }[],
    clientId: string,
    correlationId: string
  ): Promise<IReceipt> {
    this.logger.info({
      action: 'update_line_items',
      correlationId,
      receiptId,
      itemCount: lineItems.length
    });

    const receipt = await this.getById(receiptId, clientId, correlationId);

    receipt.lineItems = lineItems;
    receipt.splitTransactionEnabled = lineItems.length > 0;

    await receipt.save();

    this.logger.info({
      action: 'line_items_updated',
      correlationId,
      receiptId
    });

    return receipt;
  }
  // PRIVATE HELPER METHODS
  // ============================================

  /**
   * Calculate SHA-256 hash of file buffer
   */
  private calculateHash(file: Buffer): string {
    return crypto.createHash('sha256').update(file).digest('hex');
  }

  /**
   * Ensure no duplicate receipt exists for this client
   */
  private async ensureNotDuplicate(
    fileHash: string,
    clientId: string,
    correlationId: string
  ): Promise<void> {
    const existing = await Receipt.findOne({
      fileHash,
      clientId,
    }).select('_id fileName createdAt');

    if (existing) {
      this.logger.warn({
        action: 'duplicate_receipt_detected',
        correlationId,
        fileHash,
        existingReceiptId: existing._id,
        existingFileName: existing.fileName,
      });

      throw new DuplicateReceiptError(fileHash);
    }
  }

  /**
   * Save receipt to database
   */
  private async saveReceipt(
    data: {
      fileName: string;
      fileHash: string;
      mimeType: string;
      fileSizeBytes: number;
      clientId: string;
      userId?: string;
      correlationId: string;
    },
    correlationId: string
  ): Promise<IReceipt> {
    const receipt = new Receipt({
      fileName: data.fileName,
      fileHash: data.fileHash,
      mimeType: data.mimeType,
      fileSizeBytes: data.fileSizeBytes,
      clientId: data.clientId,
      createdBy: data.userId,
      correlationId: data.correlationId,
      status: 'queued_for_ocr',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await receipt.save();

    this.logger.debug({
      action: 'receipt_saved',
      correlationId,
      receiptId: receipt._id,
      status: receipt.status,
      queuePosition: receipt.queuePosition,
    });

    return receipt;
  }
}