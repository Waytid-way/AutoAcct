// backend/src/shared/middleware/requestLogger.middleware.ts

import { Request, Response, NextFunction } from 'express';
import logger from '@/config/logger';

/**
 * REQUEST LOGGER MIDDLEWARE
 * 
 * Logs all HTTP requests with structured data:
 * - Method, Path, Query params
 * - Request start time
 * - Response status code & duration
 * - CorrelationId for tracing
 * 
 * Log Format:
 * [correlationId] METHOD /path?query - 200 - 123ms
 * 
 * Reference: Skill 4 - Error Handling & Middleware Pattern
 */
export const requestLoggerMiddleware = (
    req: Request,
    res: Response,
    next: NextFunction
): void => {
    const correlationId = (req as any).correlationId || 'unknown';
    const start = Date.now();

    // Log request start
    logger.info({
        action: 'http_request_start',
        correlationId,
        method: req.method,
        path: req.path,
        query: req.query,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
    });

    // Log response when finished
    res.on('finish', () => {
        const duration = Date.now() - start;
        const logLevel = res.statusCode >= 400 ? 'error' : 'info';

        logger[logLevel]({
            action: 'http_request_complete',
            correlationId,
            method: req.method,
            path: req.path,
            statusCode: res.statusCode,
            duration,
        });
    });

    next();
};
