// backend/src/shared/middleware/correlationId.middleware.ts

import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

/**
 * CORRELATION ID MIDDLEWARE
 * 
 * Generates or extracts correlation ID for distributed tracing.
 * ⚠️ MUST be the FIRST middleware in the chain.
 * 
 * Flow:
 * 1. Check for existing 'x-correlation-id' header
 * 2. Generate new UUID if not present
 * 3. Attach to req.correlationId
 * 4. Return in response header
 * 
 * Usage in Controllers/Services:
 * - Pass correlationId to all service methods
 * - Include in all log statements
 * - Propagate to external services
 * 
 * Reference: Skill 4 - Error Handling & Middleware Pattern
 */
export const correlationIdMiddleware = (
    req: Request,
    res: Response,
    next: NextFunction
): void => {
    // Extract from header or generate new
    const correlationId =
        (req.headers['x-correlation-id'] as string) ||
        uuidv4();

    // Attach to request (available in all handlers)
    (req as any).correlationId = correlationId;

    // Return in response header (client can track)
    res.setHeader('x-correlation-id', correlationId);

    next();
};
