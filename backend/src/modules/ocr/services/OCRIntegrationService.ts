// backend/src/modules/ocr/services/OCRIntegrationService.ts

import Queue from 'bull';
import config from '@/config/ConfigManager';
import logger from '@/config/logger';

/**
 * OCR INTEGRATION SERVICE
 * 
 * Facade for OCR operations.
 * 1. Manages the Bull Queue ('receipt-ocr')
 * 2. Adds jobs to the queue (Producer)
 * 3. Does NOT process them (Worker does that)
 */
export class OCRIntegrationService {
    private queue: Queue.Queue;

    constructor() {
        this.queue = new Queue('receipt-ocr', {
            redis: {
                host: process.env.REDIS_HOST || 'localhost',
                port: parseInt(process.env.REDIS_PORT || '6379'),
                password: process.env.REDIS_PASSWORD
            },
            defaultJobOptions: {
                attempts: 3,
                backoff: {
                    type: 'exponential',
                    delay: 2000
                },
                removeOnComplete: 100, // Keep last 100
                removeOnFail: 100
            }
        });

        logger.info({ action: 'ocr_queue_init', queueName: 'receipt-ocr' });
    }

    /**
     * Queue a receipt for OCR extraction
     */
    async extractFromImage(
        receiptId: string,
        fileBuffer: Buffer,
        mimeType: string,
        correlationId: string
    ): Promise<{ jobId: string }> {
        // Generate data uri
        const base64 = fileBuffer.toString('base64');
        const dataUri = `data:${mimeType};base64,${base64}`;

        const job = await this.queue.add({
            receiptId,
            imageUrl: dataUri, // Groq supports Data URI
            correlationId
        }, {
            jobId: `ocr-${receiptId}` // Deduplication ID
        });

        logger.info({
            action: 'ocr_job_queued',
            jobId: job.id,
            receiptId,
            correlationId
        });

        return { jobId: job.id.toString() };
    }

    /**
     * Get Queue Instance (for Worker)
     */
    getQueue(): Queue.Queue {
        return this.queue;
    }
}
