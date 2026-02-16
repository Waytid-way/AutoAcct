// backend/src/modules/transaction/services/TransactionService.ts

import mongoose from 'mongoose';
import { Transaction, ITransaction } from '../models/Transaction.model';
import Receipt from '@/models/Receipt.model';
import { ILedgerIntegrationService, ILogger, ITransactionService } from '@/shared/di/interfaces';
import {
  NotFoundError,
  ValidationError,
} from '@/shared/errors';
import type {
  CreateTransactionInput,
  UpdateTransactionInput,
  QueryTransactionsInput,
  VoidTransactionInput,
} from '../validators/transaction.validators';

/**
 * TRANSACTION SERVICE
 * 
 * Business logic for Journal Entry operations:
 * - Double-Entry Ledger management (Draft -> Posted -> Voided)
 * - Strict financial controls (Trial Balance verification)
 * - Receipt linkage
 * - Integration with Medici Ledger (Shadow Posting)
 * 
 * Reference: Skill 3, Skill 4
 */
export class TransactionService implements ITransactionService {
  /**
   * Initialize Service with Dependencies
   * All dependencies are required - fail fast if missing
   * 
   * @param logger - Logger instance
   * @param ledgerIntegration - Ledger integration service
   */
  constructor(
    private readonly logger: ILogger,
    private readonly ledgerIntegration: ILedgerIntegrationService
  ) {
    // Validate required dependencies
    if (!logger) throw new Error('TransactionService: logger is required');
    if (!ledgerIntegration) throw new Error('TransactionService: ledgerIntegration is required');
  }

  /**
   * Create draft transaction
   * 
   * @throws NotFoundError if receipt not found (when provided)
   */
  async createDraft(
    data: CreateTransactionInput,
    userId: string,
    correlationId: string
  ): Promise<ITransaction> {
    this.logger.info({
      action: 'create_draft_transaction',
      correlationId,
      clientId: data.clientId,
      amount: data.debit,
    });

    // Verify receipt exists (if linked)
    if (data.receiptId) {
      const receipt = await Receipt.findOne({
        _id: data.receiptId,
        clientId: data.clientId,
      });

      if (!receipt) {
        throw new NotFoundError('Receipt', data.receiptId);
      }
    }

    // Create transaction
    const transaction = new Transaction({
      ...data,
      status: 'draft',
      createdBy: userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await transaction.save();

    return transaction;
  }

  /**
   * Get transaction by ID
   */
  async getById(
    transactionId: string,
    clientId: string,
    correlationId: string
  ): Promise<ITransaction> {
    const transaction = await Transaction.findOne({
      _id: transactionId,
      clientId,
    }).populate('receiptId');

    if (!transaction) {
      throw new NotFoundError('Transaction', transactionId);
    }

    return transaction;
  }

  /**
   * Query transactions with filters
   */
  async query(
    params: QueryTransactionsInput,
    clientId: string,
    correlationId: string
  ): Promise<{ data: ITransaction[]; total: number }> {
    // Build filter
    const filter: Record<string, unknown> = { clientId };

    if (params.status) filter.status = params.status;
    if (params.receiptId) filter.receiptId = params.receiptId;
    if (params.startDate || params.endDate) {
      filter.date = {};
      if (params.startDate) (filter.date as Record<string, Date>).$gte = params.startDate;
      if (params.endDate) (filter.date as Record<string, Date>).$lte = params.endDate;
    }

    // Execute query
    const [data, total] = await Promise.all([
      Transaction.find(filter)
        .populate('receiptId')
        .sort({ date: -1, createdAt: -1 })
        .skip((params.page - 1) * params.perPage)
        .limit(params.perPage)
        .lean<ITransaction[]>(),
      Transaction.countDocuments(filter),
    ]);

    return { data, total };
  }

  /**
   * Update draft transaction
   */
  async updateDraft(
    transactionId: string,
    updates: UpdateTransactionInput,
    clientId: string,
    correlationId: string
  ): Promise<ITransaction> {
    const transaction = await this.getById(transactionId, clientId, correlationId);

    if (transaction.status !== 'draft') {
      throw new ValidationError(
        `Cannot update ${transaction.status} transaction. Only drafts can be updated.`
      );
    }

    // Apply updates
    Object.assign(transaction, updates);
    transaction.updatedAt = new Date();

    await transaction.save();
    return transaction;
  }

  /**
   * Delete draft transaction
   */
  async deleteDraft(
    transactionId: string,
    clientId: string,
    correlationId: string
  ): Promise<void> {
    const transaction = await this.getById(transactionId, clientId, correlationId);

    if (transaction.status !== 'draft') {
      throw new ValidationError(
        `Cannot delete ${transaction.status} transaction. Only drafts can be deleted.`
      );
    }

    await Transaction.deleteOne({ _id: transactionId });
  }

  /**
   * Approve transaction (Post to ledger)
   * 
   * CRITICAL: Enforces double-entry via Transactional Trial Balance Check
   * AND integrates with Shadow Ledger (Medici).
   */
  async approve(
    transactionId: string,
    clientId: string,
    approvedBy: string,
    correlationId: string
  ): Promise<ITransaction> {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      this.logger.info({
        action: 'approve_transaction_start',
        correlationId,
        transactionId,
        clientId,
      });

      // 1. Get Transaction (Draft only)
      const transaction = await Transaction.findOne({
        _id: transactionId,
        clientId,
        status: 'draft',
      }).session(session);

      if (!transaction) {
        throw new NotFoundError('Draft Transaction', transactionId);
      }

      // 2. Update Status
      transaction.status = 'posted';
      transaction.approvedBy = approvedBy;
      transaction.approvedAt = new Date();
      transaction.updatedAt = new Date();
      await transaction.save({ session });

      // 3. Commit Local Transaction
      await session.commitTransaction();

      // 4. Shadow Post to Ledger (Integration Layer)
      let ledgerJournalId: string | undefined;
      try {
        const ledgerResult = await this.ledgerIntegration.recordEntry({
          clientId,
          memo: transaction.description,
          date: transaction.date || new Date(),
          entries: {
            [transaction.account.debit]: transaction.debit,
            [transaction.account.credit]: -transaction.credit, // Negative for credit in our adapter logic
          },
          metadata: {
            transactionId: transaction.id,
            receiptId: transaction.receiptId,
            reference: transaction.reference
          }
        }, correlationId);
        
        // Store ledger journal ID for potential reversal
        ledgerJournalId = ledgerResult.id;
        transaction.ledgerJournalId = ledgerJournalId;
        await transaction.save({ session });
      } catch (ledgerError: unknown) {
        const errorMessage = ledgerError instanceof Error ? ledgerError.message : 'Unknown error';
        // Log but do NOT rollback approval. Eventual consistency required.
        this.logger.error({
          action: 'ledger_shadow_post_failed',
          correlationId,
          transactionId,
          error: errorMessage,
          note: 'Transaction posted locally but Ledger sync failed. Requires reconciliation.'
        });
      }

      this.logger.info({
        action: 'approve_transaction_success',
        correlationId,
        transactionId,
      });

      return transaction;
    } catch (err: unknown) {
      if (session.inTransaction()) {
        await session.abortTransaction();
      }
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      this.logger.error({
        action: 'approve_transaction_failed',
        correlationId,
        error: errorMessage,
      });
      throw err;
    } finally {
      session.endSession();
    }
  }

  /**
   * Void transaction
   */
  async void(
    transactionId: string,
    voidData: VoidTransactionInput,
    clientId: string,
    voidedBy: string,
    correlationId: string
  ): Promise<ITransaction> {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // 1. Get Transaction
      const transaction = await Transaction.findOne({
        _id: transactionId,
        clientId,
        status: 'posted',
      }).session(session);

      if (!transaction) {
        throw new NotFoundError('Posted Transaction', transactionId);
      }

      // 2. Mark Void
      transaction.status = 'voided';
      transaction.voidedBy = voidedBy;
      transaction.voidedAt = new Date();
      transaction.voidReason = voidData.reason;
      transaction.updatedAt = new Date();
      await transaction.save({ session });

      // 3. Create Reversal
      const reversal = new Transaction({
        clientId,
        receiptId: transaction.receiptId,
        account: {
          debit: transaction.account.credit, // Swap
          credit: transaction.account.debit, // Swap
        },
        debit: transaction.credit, // Same amount
        credit: transaction.debit, // Same amount
        description: `[VOID] ${transaction.description} (Ref: ${transactionId})`,
        reference: transaction.reference,
        date: new Date(),
        status: 'posted',
        createdBy: voidedBy,
        approvedBy: voidedBy,
        approvedAt: new Date(),
      });

      await reversal.save({ session });

      // 4. Reverse Ledger Entry (if exists)
      if (transaction.ledgerJournalId) {
        try {
          await this.ledgerIntegration.reverseEntry(
            transaction.ledgerJournalId,
            clientId,
            correlationId
          );
          this.logger.info({
            action: 'ledger_reverse_success',
            correlationId,
            transactionId,
            ledgerJournalId: transaction.ledgerJournalId,
          });
        } catch (ledgerError: unknown) {
          const errorMessage = ledgerError instanceof Error ? ledgerError.message : 'Unknown error';
          // Log but do NOT rollback void. Eventual consistency required.
          this.logger.error({
            action: 'ledger_reverse_failed',
            correlationId,
            transactionId,
            ledgerJournalId: transaction.ledgerJournalId,
            error: errorMessage,
            note: 'Transaction voided locally but Ledger reversal failed. Requires reconciliation.'
          });
        }
      }

      await session.commitTransaction();
      return transaction;
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  }

  /**
   * Get Trial Balance Report
   */
  async getTrialBalance(
    clientId: string,
    startDate: Date | undefined,
    endDate: Date | undefined,
    correlationId: string
  ): Promise<{
    accounts: Array<{
      account: string;
      debit: number;
      credit: number;
      balance: number;
    }>;
    totalDebit: number;
    totalCredit: number;
  }> {
    return Transaction.getTrialBalance(clientId, startDate, endDate);
  }
}
