// backend/src/app.ts

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import logger from './config/logger';
import {
    correlationIdMiddleware,
    requestLoggerMiddleware,
    notFoundMiddleware,
    globalErrorHandler,
} from './shared/middleware';
import config from './config/ConfigManager';

// Import routes
import receiptRoutes from './modules/receipt/routes/receipt.routes';
import transactionRoutes from './modules/transaction/routes/transaction.routes';
import anomalyRoutes from './modules/anomaly/routes';
// import journalRoutes from './modules/journal/routes/journal.routes'; // Task 3

/**
 * EXPRESS APP CONFIGURATION
 * 
 * Middleware execution order is CRITICAL:
 * 1. Security (helmet, cors)
 * 2. CorrelationId (MUST BE FIRST logical middleware)
 * 3. Request Logger
 * 4. Body Parsing
 * 5. Routes
 * 6. 404 Handler
 * 7. Global Error Handler (MUST BE LAST)
 * 
 * Reference: Skill 4 - Error Handling & Middleware Pattern
 */
const app = express();

// ============================================
// SECURITY MIDDLEWARE (First Layer)
// ============================================
app.use(helmet()); // Security headers
app.use(cors({
    origin: (config.get('CORS_ORIGIN') as string)?.split(',') || ['http://localhost:3000', 'http://localhost:3001'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-correlation-id'],
    exposedHeaders: ['x-correlation-id'],
}));

// ============================================
// ESSENTIAL MIDDLEWARE (Order Matters!)
// ============================================

// 1️⃣ CorrelationId (MUST BE FIRST)
app.use(correlationIdMiddleware);

// 2️⃣ Request Logger
app.use(requestLoggerMiddleware);

// 3️⃣ Body Parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ============================================
// HEALTH CHECK (No auth required)
// ============================================
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: config.get('NODE_ENV'),
    });
});

// ============================================
// API ROUTES (Auth applied per-route)
// ============================================
app.use('/api/receipts', receiptRoutes);
app.use('/api/anomalies', anomalyRoutes);
app.use('/api/transactions', transactionRoutes);
// app.use('/api/journals', journalRoutes);          // Task 3

// ============================================
// ERROR HANDLING (MUST BE LAST)
// ============================================

// 404 Handler (before global error handler)
app.use(notFoundMiddleware);

// Global Error Handler (MUST BE VERY LAST)
app.use(globalErrorHandler);

// Initialize Workers
import { OCRWorker } from '@/modules/ocr/workers/OCRWorker';
try {
    const ocrWorker = new OCRWorker();
    ocrWorker.start();
} catch (e) {
    logger.warn('Failed to start OCR Worker (Redis might be missing): ' + e);
}

export default app;
