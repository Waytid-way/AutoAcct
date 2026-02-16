// backend/src/modules/workflow/services/WorkflowService.ts

import { ITeableService } from '../../teable/types/teable.types';
import { IReceipt } from '@/models/schemas/Receipt.schema';
import Receipt from '@/models/Receipt.model'; // Mongoose Model
import config from '@/config/ConfigManager';
import logger from '@/config/logger';
import { TeableService } from '../../teable/adapters/TeableService';
import { MockTeableService } from '../../teable/adapters/MockTeableService';
import { ITransactionService, ILogger } from '@/shared/di/interfaces';

/**
 * Dependencies interface for WorkflowService
 */
export interface WorkflowServiceDependencies {
    logger: ILogger;
    teableService: ITeableService;
    transactionService: ITransactionService;
}

/**
 * WORKFLOW SERVICE - Event Orchestrator
 *
 * Triggered by: OCRWorker.onJobCompleted
 * Executes:
 * 1. TeableService.createRecord() -> Teable Kanban
 * 2. TransactionService.createDraft() -> Ledger (Draft)
 * 3. Receipt.findByIdAndUpdate() -> MongoDB (Link IDs)
 */
export class WorkflowService {
    private teableService: ITeableService;
    private transactionService: ITransactionService;
    private logger: ILogger;

    constructor(dependencies: WorkflowServiceDependencies) {
        this.logger = dependencies.logger;
        this.teableService = dependencies.teableService;
        this.transactionService = dependencies.transactionService;
    }

    /**
     * Factory method to create WorkflowService with configured dependencies
     */
    static create(logger: ILogger): WorkflowService {
        // Teable Factory Logic
        let teableService: ITeableService;

        if (config.get('TEABLE_SERVICE_MODE') === 'mock' || !config.isProduction()) {
            teableService = new MockTeableService();
            logger.info({ action: 'workflow_init', mode: 'MOCK_TEABLE' });
        } else {
            const apiKey = config.get('TEABLE_API_KEY');
            const baseId = config.get('TEABLE_BASE_ID');
            const tableId = config.get('TEABLE_RECEIPT_TABLE_ID');
            if (!apiKey || !baseId) throw new Error('Teable Config Missing');

            teableService = new TeableService(
                config.get('TEABLE_API_URL'),
                apiKey,
                baseId,
                tableId
            );
            logger.info({ action: 'workflow_init', mode: 'PROD_TEABLE' });
        }

        // Import container here to avoid circular dependency
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { container: wfContainer, TOKENS: wfTokens } = require('@/shared/di/container') as { container: typeof import('@/shared/di/container').container; TOKENS: typeof import('@/shared/di/container').TOKENS };
        const transactionService = wfContainer.resolve<ITransactionService>(wfTokens.TransactionService);

        return new WorkflowService({
            logger,
            teableService,
            transactionService
        });
    }

    /**
     * Main orchestration method - triggered by OCRWorker on successful OCR completion
     */
    async onOCRComplete(
        receipt: IReceipt,
        correlationId: string
    ): Promise<{ teableId: string; transactionId: string }> {
        const startTime = Date.now();

        try {
            logger.info({
                action: 'workflow_start',
                correlationId,
                receiptId: receipt._id
            });

            // 1. Create Teable Record
            const teableResult = await this.teableService.createRecord({
                receiptId: receipt._id.toString(),
                vendor: receipt.ocrResult?.vendor || 'Unknown Vendor',
                amount: receipt.ocrResult?.amount || 0, // already in Satang
                date: receipt.ocrResult?.date ? new Date(receipt.ocrResult.date) : new Date(),
                taxId: receipt.ocrResult?.taxId,
                ocrConfidence: receipt.ocrConfidence || 0,
                rawOcrText: receipt.ocrResult?.rawText || '',
                imageUrl: receipt.driveFileId, // Assuming driveFileId is URL or ID
                status: this.determineRecordStatus(receipt.ocrConfidence || 0)
            }, correlationId);

            // 2. Create Draft Transaction
            const txResult = await this.transactionService.createDraft({
                clientId: receipt.clientId.toString(),
                receiptId: receipt._id.toString(),
                // Auto-guess accounts (to be refined by user)
                account: {
                    debit: '5000-Expense', // Placeholder
                    credit: '1000-Cash'    // Placeholder
                },
                debit: receipt.ocrResult?.amount || 0,
                credit: receipt.ocrResult?.amount || 0,
                description: receipt.ocrResult?.vendor ? `Receipt from ${receipt.ocrResult.vendor}` : 'OCR Receipt',
                date: receipt.ocrResult?.date ? new Date(receipt.ocrResult.date) : new Date(),
                reference: `OCR-${receipt._id}`
            }, receipt.createdBy?.toString() || 'system', correlationId);

            // 3. Link IDs in MongoDB
            await Receipt.findByIdAndUpdate(receipt._id, {
                teableId: teableResult.id,
                transactionId: txResult.id,
                workflowStatus: 'completed',
                workflowCompletedAt: new Date(),
                workflowDuration: Date.now() - startTime
            });

            logger.info({
                action: 'workflow_complete',
                correlationId,
                teableId: teableResult.id,
                transactionId: txResult.id
            });

            return { teableId: teableResult.id, transactionId: txResult.id };

        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            logger.error({
                action: 'workflow_failed',
                correlationId,
                error: errorMessage
            });

            // Update status
            await Receipt.findByIdAndUpdate(receipt._id, {
                workflowStatus: 'failed',
                workflowError: errorMessage,
                workflowFailedAt: new Date()
            });

            throw error;
        }
    }

    private determineRecordStatus(confidence: number): 'pending' | 'needs_review' {
        const threshold = config.get('WORKFLOW_AUTO_DRAFT_THRESHOLD') || 0.75;
        return confidence >= threshold ? 'pending' : 'needs_review';
    }
}
