import { Request, Response, NextFunction } from 'express';
import { AnomalyDetectionService } from '../services/AnomalyDetectionService';
import { logger } from '@/config/logger';
import { z } from 'zod';

const dismissAnomalySchema = z.object({
    reason: z.string().min(3).max(500)
});

// Extend Request type to include user
interface AuthenticatedRequest extends Request {
    user?: {
        id: string;
        clientId: string;
        role: string;
    };
}

export class AnomalyController {
    constructor(private anomalyService: AnomalyDetectionService) { }

    /**
     * GET /api/anomalies
     * Get all pending anomalies for client
     */
    async getPendingAnomalies(req: AuthenticatedRequest, res: Response, next: NextFunction) {
        try {
            const clientId = req.user!.clientId;
            const correlationId = req.headers['x-correlation-id'] as string;

            const anomalies = await this.anomalyService.getPendingAnomalies(clientId);

            logger.info({
                correlationId,
                action: 'get_pending_anomalies',
                count: anomalies.length
            });

            res.json({
                success: true,
                data: {
                    anomalies,
                    count: anomalies.length
                },
                meta: {
                    correlationId,
                    timestamp: new Date().toISOString()
                }
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * POST /api/anomalies/:id/dismiss
     * Dismiss an anomaly
     */
    async dismissAnomaly(req: AuthenticatedRequest, res: Response, next: NextFunction) {
        try {
            const { id: anomalyId } = req.params;
            const clientId = req.user!.clientId;
            const userId = req.user!.id;
            const correlationId = req.headers['x-correlation-id'] as string;

            const validated = dismissAnomalySchema.parse(req.body);

            await this.anomalyService.dismissAnomaly(
                anomalyId,
                clientId,
                validated.reason,
                userId,
                correlationId
            );

            res.json({
                success: true,
                data: {
                    message: 'Anomaly dismissed'
                },
                meta: {
                    correlationId,
                    timestamp: new Date().toISOString()
                }
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * GET /api/anomalies/statistics
     * Get anomaly statistics
     */
    async getStatistics(req: AuthenticatedRequest, res: Response, next: NextFunction) {
        try {
            const clientId = req.user!.clientId;
            const correlationId = req.headers['x-correlation-id'] as string;

            const stats = await this.anomalyService.getStatistics(clientId);

            res.json({
                success: true,
                data: stats,
                meta: {
                    correlationId,
                    timestamp: new Date().toISOString()
                }
            });
        } catch (error) {
            next(error);
        }
    }
}
