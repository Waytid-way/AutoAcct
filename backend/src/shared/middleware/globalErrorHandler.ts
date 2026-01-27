// backend/src/shared/middleware/globalErrorHandler.ts

import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { DomainError } from '@/shared/errors';
import logger from '@/config/logger';
import config from '@/config/ConfigManager';

/**
 * GLOBAL ERROR HANDLER
 * 
 * Centralized error handling for all routes.
 * ⚠️ MUST be the LAST middleware in the chain.
 * 
 * Error Flow:
 * 1. Controller catches error → next(error)
 * 2. Service throws domain error
 * 3. This handler catches all errors
 * 4. Maps domain errors → HTTP responses
 * 5. Returns standardized error JSON
 * 
 * Error Response Format:
 * {
 *   success: false,
 *   error: {
 *     code: string,
 *     message: string,
 *     details?: any (dev only),
 *     stack?: string (dev only)
 *   },
 *   meta: {
 *     correlationId: string,
 *     timestamp: string
 *   }
 * }
 * 
 * Reference: Skill 4 - Error Handling & Middleware Pattern
 */
export const globalErrorHandler = (
    err: any,
    req: Request,
    res: Response,
    next: NextFunction
): void => {
    const correlationId = (req as any).correlationId || 'unknown';
    const isDev = config.isDev();

    // ============================================
    // 1. Zod Validation Errors (400)
    // ============================================
    if (err instanceof ZodError) {
        const fieldErrors: Record<string, string[]> = {};
        err.errors.forEach((e) => {
            const field = e.path.join('.');
            if (!fieldErrors[field]) fieldErrors[field] = [];
            fieldErrors[field].push(e.message);
        });

        logger.warn({
            action: 'validation_error',
            correlationId,
            path: req.path,
            fieldErrors,
        });

        return res.status(400).json({
            success: false,
            error: {
                code: 'VALIDATION_ERROR',
                message: 'Validation failed',
                ...(isDev && { details: { fieldErrors } }),
            },
            meta: {
                correlationId,
                timestamp: new Date().toISOString(),
            },
        }) as any;
    }

    // ============================================
    // 2. Domain Errors (Business Logic Errors)
    // ============================================
    if (err instanceof DomainError) {
        const logLevel = err.statusCode >= 500 ? 'error' : 'warn';

        logger[logLevel]({
            action: 'domain_error',
            correlationId,
            path: req.path,
            statusCode: err.statusCode,
            code: err.code,
            message: err.message,
            details: err.details,
        });

        return res.status(err.statusCode).json({
            success: false,
            error: {
                code: err.code,
                message: err.message,
                ...(isDev && err.details && { details: err.details }),
            },
            meta: {
                correlationId,
                timestamp: new Date().toISOString(),
            },
        }) as any;
    }

    // ============================================
    // 3. Multer Errors (File Upload)
    // ============================================
    if (err.name === 'MulterError') {
        logger.warn({
            action: 'multer_error',
            correlationId,
            code: err.code,
            message: err.message,
        });

        let message = 'File upload error';
        if (err.code === 'LIMIT_FILE_SIZE') {
            message = 'File size exceeds 10MB limit';
        } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
            message = 'Unexpected file field';
        }

        return res.status(400).json({
            success: false,
            error: {
                code: 'FILE_UPLOAD_ERROR',
                message,
            },
            meta: {
                correlationId,
                timestamp: new Date().toISOString(),
            },
        }) as any;
    }

    // ============================================
    // 4. Unknown Errors (500 - Programmer Bugs)
    // ============================================
    logger.error({
        action: 'internal_error',
        correlationId,
        path: req.path,
        method: req.method,
        error: err.message,
        stack: err.stack,
    });

    return res.status(500).json({
        success: false,
        error: {
            code: 'INTERNAL_ERROR',
            message: isDev
                ? err.message
                : 'An unexpected error occurred. Please contact support.',
            ...(isDev && { stack: err.stack }),
        },
        meta: {
            correlationId,
            timestamp: new Date().toISOString(),
        },
    }) as any;
};
