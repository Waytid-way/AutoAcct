// backend/src/shared/middleware/notFound.middleware.ts

import { Request, Response, NextFunction } from 'express';
import { NotFoundError } from '@/shared/errors';

/**
 * NOT FOUND MIDDLEWARE
 * 
 * Catches all unmatched routes and throws 404 error.
 * Must be placed BEFORE global error handler.
 * 
 * Reference: Skill 4 - Error Handling & Middleware Pattern
 */
export const notFoundMiddleware = (
    req: Request,
    res: Response,
    next: NextFunction
): void => {
    next(new NotFoundError('Route', req.path));
};
