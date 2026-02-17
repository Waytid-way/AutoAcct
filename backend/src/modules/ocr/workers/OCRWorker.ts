// backend/src/modules/ocr/workers/OCRWorker.ts

import { Job } from 'bull';
import { OCRIntegrationService } from '../services/OCRIntegrationService';
import { GroqOCRService } from '../services/GroqOCRService';
import { MockOCRService } from '../services/MockOCRService';
import Receipt from '@/models/Receipt.model';
import config from '@/config/ConfigManager';
import logger from '@/config/logger';
import { WorkflowService } from '../../workflow/services/WorkflowService';
import { container, TOKENS } from '@/shared/di/container';
import { ILogger, IGroqClassificationService } from '@/shared/di/interfaces';
import { IOcrService } from '@/shared/di/interfaces';

/**
 * Dependencies interface for OCRWorker
 */
export interface OCRWorkerDependencies {
    integrationService: OCRIntegrationService;
    workflowService: WorkflowService;
    ocrService: IOcrService;
    classificationService?: IGroqClassificationService;
    logger: ILogger;
}

/**
 * OCR WORKER
 *
 * Consumes 'receipt-ocr' queue.
 * Processes images using Groq or Mock service.
 * Updates Receipt in MongoDB.
 */
import { GroqClassificationService } from '../../ai/GroqClassificationService';

export class OCRWorker {
    private integrationService: OCRIntegrationService;
    private ocrService: IOcrService;
    private classificationService: IGroqClassificationService | undefined;
    private workflowService: WorkflowService;
    private logger: ILogger;

    constructor(dependencies: OCRWorkerDependencies) {
        this.integrationService = dependencies.integrationService;
        this.workflowService = dependencies.workflowService;
        this.ocrService = dependencies.ocrService;
        this.classificationService = dependencies.classificationService;
        this.logger = dependencies.logger;
    }

    /**
     * Factory method to create OCRWorker with dependencies from DI container
     * 
     * REFACTORED: Now uses DI container instead of direct instantiation
     * This ensures consistent service lifecycle management and testability
     */
    static create(): OCRWorker {
        const logger = container.resolve<ILogger>(TOKENS.Logger);
        const integrationService = container.resolve<OCRIntegrationService>(TOKENS.OCRIntegrationService);
        const workflowService = container.resolve<WorkflowService>(TOKENS.WorkflowService);

        // Factory Logic for OCR Service (mock vs production)
        let ocrService: IOcrService;
        let classificationService: IGroqClassificationService | undefined;

        if (config.get('OCR_SERVICE_MODE') === 'mock' || !config.isProduction()) {
            ocrService = new MockOCRService();
            logger.info({ action: 'ocr_worker_init', mode: 'MOCK' });
        } else {
            const apiKey = config.get('GROQ_API_KEY');
            if (!apiKey) throw new Error('GROQ_API_KEY required for production OCR');
            
            // Create GroqOCRService with its dependencies
            ocrService = GroqOCRService.createWithApiKey(apiKey);
            
            // Resolve classification service from container
            classificationService = container.resolve<IGroqClassificationService>(TOKENS.GroqClassificationService);
            
            logger.info({ action: 'ocr_worker_init', mode: 'GROQ_PRODUCTION' });
        }

        return new OCRWorker({
            integrationService,
            workflowService,
            ocrService,
            classificationService,
            logger
        });
    }

    /**
     * Start processing jobs
     */
    start() {
        const queue = this.integrationService.getQueue();
        const logger = this.logger; // Capture for closure

        queue.process(async (job: Job) => {
            const { receiptId, imageUrl, correlationId } = job.data;

            logger.info({
                action: 'ocr_job_start',
                jobId: job.id,
                receiptId,
                correlationId
            });

            try {
                // 1. Update Status to Processing
                await Receipt.updateOne({ _id: receiptId }, {
                    ocrStatus: 'processing',
                    ocrJobId: job.id
                });

                // 2. Process
                // Typescript casting needed as interface isn't shared strictly but structural match exists
                const result = await this.ocrService.processImage(imageUrl, correlationId);

                // 3. Classify Line Items (Task 3E)
                interface LineItem {
                    description: string;
                    quantity: number;
                    unitPrice: number;
                    totalPrice: number;
                    suggestedCategory: string;
                    aiConfidence: number;
                }
                let classifiedItems: LineItem[] = [];
                const resultWithLineItems = result as { lineItems?: Array<{ description: string; quantity: number; unitPrice: number; totalPrice: number }> };
                if (resultWithLineItems.lineItems && resultWithLineItems.lineItems.length > 0 && this.classificationService) {
                    // Convert line items to MoneyInt format expected by classification service
                    const itemsForClassification = resultWithLineItems.lineItems.map(item => ({
                        description: item.description,
                        quantity: item.quantity,
                        totalPrice: item.totalPrice as unknown as import('@/utils/money').MoneyInt
                    }));
                    const classifications = await this.classificationService.classifyLineItems(
                        itemsForClassification,
                        correlationId
                    );

                    // Merge classification with extracted data
                    classifiedItems = resultWithLineItems.lineItems.map((item, idx) => ({
                        description: item.description,
                        quantity: item.quantity,
                        unitPrice: item.unitPrice,
                        totalPrice: item.totalPrice,
                        suggestedCategory: classifications[idx]?.category || 'PENDING_REVIEW',
                        aiConfidence: classifications[idx]?.confidence || 0
                    }));
                }

                // 4. Update Status to Complete
                const updatedReceipt = await Receipt.findOneAndUpdate({ _id: receiptId }, {
                    ocrStatus: 'complete',
                    ocrResult: result,
                    ocrConfidence: 'confidenceScores' in result ? result.confidenceScores?.overall || 0 : 0,
                    lineItems: classifiedItems,
                    splitTransactionEnabled: classifiedItems.length > 0,
                    updatedAt: new Date()
                }, { new: true });

                if (!updatedReceipt) throw new Error('Receipt not found');

                logger.info({
                    action: 'ocr_job_complete',
                    jobId: job.id,
                    receiptId,
                    lineItemsCount: classifiedItems.length,
                    correlationId
                });

                // 5. Trigger Workflow (Task 3)
                if (config.get('WORKFLOW_AUTO_TRIGGER')) {
                    try {
                        await this.workflowService.onOCRComplete(updatedReceipt, correlationId);
                    } catch (wfErr: unknown) {
                        const errorMessage = wfErr instanceof Error ? wfErr.message : 'Unknown error';
                        logger.error({
                            action: 'workflow_trigger_failed',
                            correlationId,
                            error: errorMessage
                        });
                        // Don't fail the job if workflow fails (OCR itself succeeded)
                    }
                }

                return result;

            } catch (err: unknown) {
                const errorMessage = err instanceof Error ? err.message : 'Unknown error';
                logger.error({
                    action: 'ocr_job_failed',
                    jobId: job.id,
                    receiptId,
                    error: errorMessage,
                    correlationId
                });

                // Update DB Status
                await Receipt.updateOne({ _id: receiptId }, {
                    ocrStatus: 'failed',
                    $push: { ocrErrors: errorMessage },
                    updatedAt: new Date()
                });

                throw err; // Trigger Bull retry
            }
        });

        logger.info('OCR Worker started listening for jobs');
    }
}
