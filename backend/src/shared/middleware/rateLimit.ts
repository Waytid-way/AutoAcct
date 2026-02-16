/**
 * Rate Limiting Configuration
 * 
 * Prevents API abuse and DDoS attacks
 * Different limits for different endpoints
 */

import rateLimit from 'express-rate-limit';
import config from '@/config/ConfigManager';
import logger from '@/config/logger';

/**
 * Global rate limiter - applies to all API routes
 * 100 requests per 15 minutes per IP
 */
export const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    message: {
        error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many requests from this IP, please try again later.',
            retryAfter: '15 minutes'
        }
    },
    handler: (req, res, next, options) => {
        logger.warn({
            action: 'rate_limit_exceeded',
            ip: req.ip,
            path: req.path,
            method: req.method,
        });
        res.status(429).json(options.message);
    },
    skip: (req) => {
        // Skip rate limiting for health checks
        return req.path === '/health';
    },
});

/**
 * Strict rate limiter for expensive operations
 * 10 requests per minute per IP
 * Used for: file uploads, AI processing
 */
export const strictLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 10, // Limit each IP to 10 requests per minute
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many requests for this endpoint, please slow down.',
            retryAfter: '1 minute'
        }
    },
    handler: (req, res, next, options) => {
        logger.warn({
            action: 'strict_rate_limit_exceeded',
            ip: req.ip,
            path: req.path,
            method: req.method,
        });
        res.status(429).json(options.message);
    },
});

/**
 * Authentication rate limiter
 * 5 login attempts per 15 minutes per IP
 * Prevents brute force attacks
 */
export const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // Limit each IP to 5 login attempts per windowMs
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        error: {
            code: 'AUTH_RATE_LIMIT_EXCEEDED',
            message: 'Too many login attempts, please try again later.',
            retryAfter: '15 minutes'
        }
    },
    handler: (req, res, next, options) => {
        logger.warn({
            action: 'auth_rate_limit_exceeded',
            ip: req.ip,
            path: req.path,
            email: req.body?.email, // Log attempted email for security monitoring
        });
        res.status(429).json(options.message);
    },
    skipSuccessfulRequests: true, // Don't count successful logins
});

/**
 * OCR processing rate limiter
 * 20 OCR requests per 5 minutes per IP
 * Prevents abuse of expensive Groq API calls
 */
export const ocrLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 20, // Limit each IP to 20 OCR requests per 5 minutes
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        error: {
            code: 'OCR_RATE_LIMIT_EXCEEDED',
            message: 'Too many OCR requests, please slow down.',
            retryAfter: '5 minutes'
        }
    },
    handler: (req, res, next, options) => {
        logger.warn({
            action: 'ocr_rate_limit_exceeded',
            ip: req.ip,
            path: req.path,
            clientId: req.body?.clientId,
        });
        res.status(429).json(options.message);
    },
});

/**
 * Receipt upload rate limiter
 * 10 uploads per 5 minutes per IP
 */
export const uploadLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 10, // Limit each IP to 10 uploads per 5 minutes
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        error: {
            code: 'UPLOAD_RATE_LIMIT_EXCEEDED',
            message: 'Too many file uploads, please try again later.',
            retryAfter: '5 minutes'
        }
    },
    handler: (req, res, next, options) => {
        logger.warn({
            action: 'upload_rate_limit_exceeded',
            ip: req.ip,
            clientId: req.body?.clientId,
        });
        res.status(429).json(options.message);
    },
});

/**
 * Development bypass
 * In development mode, use more permissive limits
 */
export function getRateLimiters() {
    const isDev = config.get('NODE_ENV') === 'development';
    
    if (isDev) {
        // More permissive limits for development
        return {
            global: rateLimit({
                windowMs: 15 * 60 * 1000,
                max: 1000, // Much higher limit for dev
                standardHeaders: true,
                legacyHeaders: false,
            }),
            strict: strictLimiter,
            auth: authLimiter, // Keep auth strict even in dev
            ocr: ocrLimiter,
            upload: uploadLimiter,
        };
    }
    
    return {
        global: globalLimiter,
        strict: strictLimiter,
        auth: authLimiter,
        ocr: ocrLimiter,
        upload: uploadLimiter,
    };
}
