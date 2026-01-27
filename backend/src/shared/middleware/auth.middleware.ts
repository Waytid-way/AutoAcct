// backend/src/shared/middleware/auth.middleware.ts

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthError, ForbiddenError } from '@/shared/errors';
import logger from '@/config/logger';
import config from '@/config/ConfigManager';

/**
 * AUTH MIDDLEWARE
 * 
 * Verifies JWT token and attaches user to request.
 * 
 * Token Format: Bearer <token>
 * 
 * Decoded Payload:
 * {
 *   userId: string,
 *   clientId: string,
 *   role: 'user' | 'accountant' | 'admin',
 *   email: string,
 *   iat: number,
 *   exp: number
 * }
 * 
 * @throws AuthError if token missing or invalid
 * 
 * Reference: Skill 4 - Error Handling & Middleware Pattern
 */
export const authMiddleware = (
    req: Request,
    res: Response,
    next: NextFunction
): void => {
    try {
        const correlationId = (req as any).correlationId;

        // Extract token from Authorization header
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            logger.warn({
                action: 'auth_no_token',
                correlationId,
                path: req.path,
            });
            throw new AuthError('No token provided. Please login.');
        }

        const token = authHeader.replace('Bearer ', '');

        // Verify token
        const jwtSecret = config.get('JWT_SECRET');
        if (!jwtSecret) {
            logger.error({
                action: 'auth_config_missing',
                error: 'JWT_SECRET not configured',
            });
            throw new Error('Authentication service unavailable');
        }

        const decoded = jwt.verify(token, jwtSecret) as any;

        // Attach user to request
        (req as any).user = {
            id: decoded.userId,
            clientId: decoded.clientId,
            role: decoded.role,
            email: decoded.email,
        };

        logger.debug({
            action: 'auth_success',
            correlationId,
            userId: decoded.userId,
            role: decoded.role,
        });

        next();
    } catch (err: any) {
        // JWT-specific errors
        if (err.name === 'JsonWebTokenError') {
            return next(new AuthError('Invalid token. Please login again.'));
        }
        if (err.name === 'TokenExpiredError') {
            return next(new AuthError('Token expired. Please login again.'));
        }

        // Pass through other errors
        next(err);
    }
};

/**
 * ROLE GUARD MIDDLEWARE FACTORY
 * 
 * Creates middleware that checks if user has required role.
 * 
 * Usage:
 * router.post('/admin-only', 
 *   authMiddleware, 
 *   requireRole('admin'),
 *   handler
 * );
 * 
 * @throws ForbiddenError if user lacks required role
 */
export const requireRole = (...allowedRoles: string[]) => {
    return (req: Request, res: Response, next: NextFunction): void => {
        const user = (req as any).user;
        const correlationId = (req as any).correlationId;

        if (!user) {
            logger.error({
                action: 'role_guard_no_user',
                correlationId,
                error: 'requireRole called without authMiddleware',
            });
            return next(new AuthError('Authentication required'));
        }

        if (!allowedRoles.includes(user.role)) {
            logger.warn({
                action: 'role_guard_forbidden',
                correlationId,
                userId: user.id,
                requiredRoles: allowedRoles,
                userRole: user.role,
            });
            return next(new ForbiddenError(`Access denied. Required roles: ${allowedRoles.join(', ')}`));
        }

        logger.debug({
            action: 'role_guard_passed',
            correlationId,
            userId: user.id,
            role: user.role,
        });

        next();
    };
};
