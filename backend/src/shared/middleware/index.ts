// backend/src/shared/middleware/index.ts

/**
 * MIDDLEWARE - Centralized Export
 * 
 * All middleware components in one place.
 * Import from this index for consistency.
 * 
 * Usage:
 * import {
 *   correlationIdMiddleware,
 *   authMiddleware,
 *   globalErrorHandler
 * } from '@/shared/middleware';
 */

export * from './correlationId.middleware';
export * from './requestLogger.middleware';
export * from './auth.middleware';
export * from './globalErrorHandler';
export * from './notFound.middleware';
export * from './rateLimit';
