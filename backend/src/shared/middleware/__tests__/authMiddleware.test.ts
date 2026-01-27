// backend/src/shared/middleware/__tests__/authMiddleware.test.ts

import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { authMiddleware, requireRole } from '../auth.middleware';
import { AuthError, ForbiddenError } from '@/shared/errors';
import jwt from 'jsonwebtoken';
import config from '@/config/ConfigManager';

// Mock ConfigManager
mock.module('@/config/ConfigManager', () => ({
    default: {
        get: (key: string) => {
            if (key === 'JWT_SECRET') return 'test-secret';
            return null;
        }
    }
}));

describe('authMiddleware', () => {
    let req: any;
    let res: any;
    let next: any;

    beforeEach(() => {
        req = {
            headers: {},
            path: '/api/test',
            correlationId: '123'
        };
        res = {};
        next = mock();
    });

    it('should authenticate valid token', () => {
        const token = jwt.sign(
            { userId: 'u1', clientId: 'c1', role: 'user', email: 'test@test.com' },
            'test-secret'
        );
        req.headers.authorization = `Bearer ${token}`;

        authMiddleware(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(next).not.toHaveBeenCalledWith(expect.any(Error));
        expect(req.user).toBeDefined();
        expect(req.user.id).toBe('u1');
    });

    it('should throw AuthError if no token', () => {
        authMiddleware(req, res, next);

        expect(next).toHaveBeenCalledWith(expect.any(AuthError));
    });

    it('should throw AuthError if invalid token', () => {
        req.headers.authorization = 'Bearer invalid-token';

        authMiddleware(req, res, next);

        expect(next).toHaveBeenCalledWith(expect.any(AuthError));
    });
});

describe('requireRole', () => {
    let req: any;
    let res: any;
    let next: any;

    beforeEach(() => {
        req = {
            user: { id: 'u1', role: 'user' },
            correlationId: '123'
        };
        res = {};
        next = mock();
    });

    it('should allow user with correct role', () => {
        const middleware = requireRole('user');
        middleware(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(next).not.toHaveBeenCalledWith(expect.any(Error));
    });

    it('should throw ForbiddenError if wrong role', () => {
        const middleware = requireRole('admin');
        middleware(req, res, next);

        expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
    });

    it('should allow multiple roles', () => {
        const middleware = requireRole('admin', 'user'); // user is allowed
        middleware(req, res, next);

        expect(next).toHaveBeenCalled();
    });
});
