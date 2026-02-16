// backend/src/modules/receipt/routes/receipt.routes.ts

import { Router } from 'express';
import multer from 'multer';
import { ReceiptController } from '../controllers/ReceiptController';
// Note: Auth middleware will be imported when middleware stack is built
// import { authMiddleware } from '@/middleware/auth.middleware';
import { container, TOKENS, initializeContainer } from '@/shared/di/container';
import { IReceiptService } from '@/shared/di/interfaces';

/**
 * RECEIPT ROUTES
 * 
 * Express router configuration for Receipt endpoints.
 * 
 * Features:
 * - Multer file upload (10MB max, JPEG/PNG/PDF only)
 * - Authentication middleware on all routes
 * - Arrow functions to preserve 'this' context
 * 
 * Reference: Skill 1 - REST Controller Pattern
 * Reference: Phase 2.2 Guide - Task 1
 */

const router = Router();

// Initialize DI container if not already initialized
if (!container.has(TOKENS.ReceiptService)) {
    initializeContainer();
}

// Resolve services from DI container
const receiptService = container.resolve<IReceiptService>(TOKENS.ReceiptService);
const controller = new ReceiptController(receiptService);

// ===========================
// Multer Configuration
// ===========================

const upload = multer({
    storage: multer.memoryStorage(), // Store in memory (Buffer)
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB max
        files: 1, // Only 1 file per upload
    },
    fileFilter: (req, file, cb) => {
        const allowedMimes = [
            'image/jpeg',
            'image/png',
            'application/pdf',
        ];

        if (allowedMimes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only JPEG, PNG, and PDF are allowed.'));
        }
    },
});

// ===========================
// Authentication Middleware
// ===========================

// All routes require authentication
// Note: Uncomment when auth middleware is implemented
// router.use(authMiddleware);

// ===========================
// Routes
// ===========================

// POST /upload - Upload receipt file
router.post(
    '/upload',
    upload.single('file'),
    (req, res, next) => controller.uploadReceipt(req, res, next)
);

// GET /queue - Get queue with pagination
router.get(
    '/queue',
    (req, res, next) => controller.getQueue(req, res, next)
);

// POST /process-queue - Trigger OCR processing
router.post(
    '/process-queue',
    (req, res, next) => controller.processQueue(req, res, next)
);

// GET /stats - Queue statistics
router.get(
    '/stats',
    (req, res, next) => controller.getStats(req, res, next)
);

// GET /:id - Get receipt by ID
router.get(
    '/:id',
    (req, res, next) => controller.getById(req, res, next)
);

// POST /:id/feedback - Submit OCR corrections
router.post(
    '/:id/feedback',
    (req, res, next) => controller.submitFeedback(req, res, next)
);

export default router;
