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
    private ocrService: GroqOCRService | MockOCRService;
    private classificationService: IGroqClassificationService | undefined; // Task 3E
    private workflowService: WorkflowService;

    constructor() {
        this.integrationService = new OCRIntegrationService();
        this.workflowService = new WorkflowService(container.resolve<ILogger>(TOKENS.Logger));

        // Factory Logic for Processor
        if (config.get('OCR_SERVICE_MODE') === 'mock' || !config.isProduction()) {
            this.ocrService = new MockOCRService();
            logger.info({ action: 'ocr_worker_init', mode: 'MOCK' });
        } else {
            const apiKey = config.get('GROQ_API_KEY');
            if (!apiKey) throw new Error('GROQ_API_KEY required for production OCR');
            this.ocrService = new GroqOCRService(apiKey);
            this.classificationService = new GroqClassificationService(
                container.resolve<ILogger>(TOKENS.Logger),
                apiKey
            ); // Task 3E
            logger.info({ action: 'ocr_worker_init', mode: 'GROQ_PRODUCTION' });
        }
    }

    /**
     * Start processing jobs
     */
    start() {
        const queue = this.integrationService.getQueue();

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
                let classifiedItems: any[] = [];
                if (result.lineItems && result.lineItems.length > 0 && this.classificationService) {
                    // Convert line items to MoneyInt format expected by classification service
                    const itemsForClassification = result.lineItems.map(item => ({
                        description: item.description,
                        quantity: item.quantity,
                        totalPrice: item.totalPrice as unknown as import('@/utils/money').MoneyInt
                    }));
                    const classifications = await this.classificationService.classifyLineItems(
                        itemsForClassification,
                        correlationId
                    );

                    // Merge classification with extracted data
                    classifiedItems = result.lineItems.map((item, idx) => ({
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
                    ocrConfidence: result.confidenceScores?.overall || 0,
                    lineItems: classifiedItems, // Structurally compatible
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
                    } catch (wfErr: any) {
                        logger.error({
                            action: 'workflow_trigger_failed',
                            correlationId,
                            error: wfErr.message
                        });
                        // Don't fail the job if workflow fails (OCR itself succeeded)
                    }
                }

                return result;

            } catch (err: any) {
                logger.error({
                    action: 'ocr_job_failed',
                    jobId: job.id,
                    receiptId,
                    error: err.message,
                    correlationId
                });

                // Update DB Status
                await Receipt.updateOne({ _id: receiptId }, {
                    ocrStatus: 'failed',
                    $push: { ocrErrors: err.message },
                    updatedAt: new Date()
                });

                throw err; // Trigger Bull retry
            }
        });

        logger.info('OCR Worker started listening for jobs');
    }
}
