// backend/src/app.ts

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import mongoSanitize from 'express-mongo-sanitize';
import logger from './config/logger';
import {
    correlationIdMiddleware,
    requestLoggerMiddleware,
    notFoundMiddleware,
    globalErrorHandler,
    globalLimiter,
    authLimiter,
    uploadLimiter,
    ocrLimiter,
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
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "blob:"],
            connectSrc: ["'self'"],
            fontSrc: ["'self'"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'none'"],
        },
    },
    hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
    },
})); // Security headers with CSP

app.use(cors({
    origin: (config.get('CORS_ORIGIN') as string)?.split(',') || ['http://localhost:3000', 'http://localhost:3001'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-correlation-id'],
    exposedHeaders: ['x-correlation-id'],
}));

// Prevent NoSQL injection
app.use(mongoSanitize({
    replaceWith: '_',
    onSanitize: ({ req, key }) => {
        logger.warn({
            action: 'nosql_sanitization',
            key,
            ip: req.ip,
            path: req.path,
        });
    },
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
// HEALTH CHECKS (No auth required)
// ============================================
import mongoose from 'mongoose';

// Liveness probe - is the app running?
// Kubernetes uses this to know if the pod should be restarted
app.get('/health/live', (req, res) => {
    res.status(200).json({
        status: 'alive',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
    });
});

// Readiness probe - is the app ready to serve traffic?
// Kubernetes uses this to know when to route traffic to the pod
app.get('/health/ready', async (req, res) => {
    const checks: Record<string, boolean> = {
        server: true,
        database: false,
    };

    // Check MongoDB connection
    try {
        checks.database = mongoose.connection.readyState === 1;
    } catch (error) {
        checks.database = false;
    }

    // Check if OCR worker is running (optional)
    // checks.ocrWorker = ocrWorker.isRunning();

    const isReady = Object.values(checks).every(Boolean);

    if (isReady) {
        res.status(200).json({
            status: 'ready',
            timestamp: new Date().toISOString(),
            checks,
        });
    } else {
        logger.warn({
            action: 'health_check_not_ready',
            checks,
        });
        res.status(503).json({
            status: 'not ready',
            timestamp: new Date().toISOString(),
            checks,
        });
    }
});

// General health check - detailed status
app.get('/health', async (req, res) => {
    const checks: Record<string, { status: string; responseTime?: number }> = {
        server: { status: 'healthy' },
    };

    // Check MongoDB
    const dbStart = Date.now();
    try {
        if (mongoose.connection.readyState === 1) {
            await mongoose.connection.db?.admin().ping();
            checks.database = {
                status: 'connected',
                responseTime: Date.now() - dbStart,
            };
        } else {
            checks.database = { status: 'disconnected' };
        }
    } catch (error) {
        checks.database = { status: 'error' };
    }

    // Memory usage
    const memUsage = process.memoryUsage();

    const isHealthy = Object.values(checks).every(
        (check) => check.status === 'healthy' || check.status === 'connected'
    );

    const response = {
        status: isHealthy ? 'healthy' : 'degraded',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: config.get('NODE_ENV'),
        version: process.env.npm_package_version || '1.0.0',
        checks,
        memory: {
            used: Math.round(memUsage.heapUsed / 1024 / 1024) + 'MB',
            total: Math.round(memUsage.heapTotal / 1024 / 1024) + 'MB',
        },
    };

    res.status(isHealthy ? 200 : 503).json(response);
});

// ============================================
// API ROUTES (Auth applied per-route)
// ============================================

// Apply global rate limiting to all API routes
app.use('/api/', globalLimiter);

// Auth routes - stricter rate limiting for login attempts
// Note: These should be defined before other routes if they exist
// app.use('/api/auth/login', authLimiter);

// Receipt routes - with upload rate limiting
app.use('/api/receipts/upload', uploadLimiter);
app.use('/api/receipts', receiptRoutes);

// OCR routes - expensive operations, use OCR limiter
// Note: Apply to specific OCR endpoints
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
    const ocrWorker = OCRWorker.create();
    ocrWorker.start();
} catch (e) {
    logger.warn('Failed to start OCR Worker (Redis might be missing): ' + e);
}

export default app;
