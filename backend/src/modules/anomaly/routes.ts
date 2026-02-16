import { Router } from 'express';
import { AnomalyController } from './controllers/AnomalyController';
import { authMiddleware } from '@/shared/middleware';
import { container, TOKENS, initializeContainer } from '@/shared/di/container';
import { IAnomalyDetectionService } from '@/shared/di/interfaces';

const router = Router();

// Initialize DI container if not already initialized
if (!container.has(TOKENS.AnomalyDetectionService)) {
    initializeContainer();
}

const anomalyService = container.resolve<IAnomalyDetectionService>(TOKENS.AnomalyDetectionService);
const anomalyController = new AnomalyController(anomalyService);

router.use(authMiddleware);

router.get(
    '/',
    anomalyController.getPendingAnomalies.bind(anomalyController)
);

router.post(
    '/:id/dismiss',
    anomalyController.dismissAnomaly.bind(anomalyController)
);

router.get(
    '/statistics',
    anomalyController.getStatistics.bind(anomalyController)
);

export default router;
