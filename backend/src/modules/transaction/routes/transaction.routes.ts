// backend/src/modules/transaction/routes/transaction.routes.ts

import { Router } from 'express';
import { TransactionController } from '../controllers/TransactionController';
import { TransactionService } from '../services/TransactionService';
import { authMiddleware, requireRole } from '@/shared/middleware';
import logger from '@/config/logger';

const router = Router();

// Dependency Injection
const transactionService = new TransactionService(logger);
const transactionController = new TransactionController(transactionService);

// Apply Auth globally for this router
router.use(authMiddleware);

// Routes
router.post(
    '/',
    requireRole('user', 'accountant', 'admin'),
    transactionController.createDraft
);

router.get(
    '/',
    requireRole('user', 'accountant', 'admin'),
    transactionController.query
);

// Specific report route via query param or dedicated path? 
// Controller has query() but also getTrialBalance().
// To avoid conflict with /:id, place static routes ABOVE dynamic routes
router.get(
    '/report/trial-balance',
    requireRole('accountant', 'admin'),
    transactionController.getTrialBalance
);

router.get(
    '/:id',
    requireRole('user', 'accountant', 'admin'),
    transactionController.getById
);

router.patch(
    '/:id',
    requireRole('user', 'accountant', 'admin'),
    transactionController.updateDraft
);

router.delete(
    '/:id',
    requireRole('user', 'accountant', 'admin'),
    transactionController.deleteDraft
);

// Workflow Actions
router.post(
    '/:id/approve',
    requireRole('accountant', 'admin'), // Only Accountants can approve/post
    transactionController.approve
);

router.post(
    '/:id/void',
    requireRole('accountant', 'admin'), // Only Accountants can void
    transactionController.void
);

export default router;
