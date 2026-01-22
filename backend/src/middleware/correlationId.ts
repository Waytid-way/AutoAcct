// backend/src/middleware/correlationId.ts

import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

/**
 * CORRELATION ID MIDDLEWARE
 * 
 * Ensures every request has a unique correlation ID for tracing
 * through the entire system (Frontend → API → Service → External).
 * 
 * Reference: Vol 2C Section 15.2 - Structured Logging
 */

// Extend Express Request type
declare global {
    namespace Express {
        interface Request {
            correlationId: string;
        }
    }
}

/**
 * Attach correlation ID to request
 * - Check if client sent x-correlation-id header
 * - If not, generate a new UUID
 * - Attach to request object
 * - Send back in response header
 */
export function correlationIdMiddleware(
    req: Request,
    res: Response,
    next: NextFunction
): void {
    // Get from header or generate new
    const correlationId = (req.get('x-correlation-id') as string) || uuidv4();

    // Attach to request
    req.correlationId = correlationId;

    // Send back in response
    res.set('x-correlation-id', correlationId);

    next();
}

/**
 * Generate a new correlation ID
 */
export function generateCorrelationId(): string {
    return uuidv4();
}
