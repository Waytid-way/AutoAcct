import { AnomalyDetectionService } from './AnomalyDetectionService';
import Receipt from '../../../models/Receipt.model';
import logger from '../../../config/logger';

export class BatchAnomalyDetectionService {
    constructor(private anomalyService: AnomalyDetectionService = new AnomalyDetectionService()) { }

    /**
     * Run anomaly detection on all unanalyzed receipts
     */
    async runBatchDetection(
        clientId: string,
        limit: number = 100
    ): Promise<{ processed: number; anomaliesFound: number }> {
        const correlationId = `batch-${Date.now()}`;

        logger.info({
            correlationId,
            action: 'batch_detection_start',
            clientId,
            limit
        });

        // ✅ Find receipts that haven't been analyzed yet
        const receipts = await Receipt.find({
            clientId,
            status: { $in: ['processed', 'confirmed'] },
            anomalyAnalyzed: { $ne: true }  // Add this field to Receipt model
        })
            .sort({ createdAt: -1 })
            .limit(limit);

        let processed = 0;
        let anomaliesFound = 0;

        for (const receipt of receipts) {
            try {
                const result = await this.anomalyService.detectAnomalies(
                    receipt._id.toString(),
                    clientId,
                    correlationId
                );

                if (result.hasAnomaly) {
                    anomaliesFound += result.anomalies.length;
                }

                // ✅ Mark as analyzed
                await Receipt.updateOne(
                    { _id: receipt._id },
                    { $set: { anomalyAnalyzed: true } }
                );

                processed++;
            } catch (error: any) {
                logger.error({
                    correlationId,
                    action: 'batch_detection_error',
                    receiptId: receipt._id,
                    error: error.message
                });
            }
        }

        logger.info({
            correlationId,
            action: 'batch_detection_complete',
            processed,
            anomaliesFound
        });

        return { processed, anomaliesFound };
    }

    /**
     * Schedule daily batch detection (call from cron job)
     */
    async scheduledDailyDetection(clientId: string): Promise<void> {
        logger.info({
            action: 'scheduled_detection_start',
            clientId,
            time: new Date().toISOString()
        });

        await this.runBatchDetection(clientId, 500);  // Process up to 500/day
    }
}
