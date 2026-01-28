import { Router } from 'express';
import { AnomalyController } from './controllers/AnomalyController';
import { AnomalyDetectionService } from './services/AnomalyDetectionService';
import { authenticate } from '@/shared/middleware/auth.middleware';

const router = Router();
const anomalyService = new AnomalyDetectionService();
const anomalyController = new AnomalyController(anomalyService);

router.use(authenticate);

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
