// backend/src/shared/middleware/__tests__/globalErrorHandler.test.ts

import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { globalErrorHandler } from '../globalErrorHandler';
import { DomainError, ValidationError } from '@/shared/errors';
import { ZodError, ZodIssue } from 'zod';

// Mock ConfigManager
mock.module('@/config/ConfigManager', () => ({
    default: {
        get: (key: string) => null,
        isDev: () => true
    }
}));

describe('globalErrorHandler', () => {
    let req: any;
    let res: any;
    let next: any;
    let jsonMock: any;
    let statusMock: any;

    beforeEach(() => {
        req = { path: '/test', method: 'GET', correlationId: '123' };
        jsonMock = mock();
        statusMock = mock(() => ({ json: jsonMock }));
        res = { status: statusMock };
        next = mock();
    });

    it('should handle DomainError (404)', () => {
        const error = new DomainError('Not found');
        error.statusCode = 404;
        error.code = 'NOT_FOUND';

        globalErrorHandler(error, req, res, next);

        expect(statusMock).toHaveBeenCalledWith(404);
        expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({
            success: false,
            error: expect.objectContaining({
                code: 'NOT_FOUND',
                message: 'Not found'
            })
        }));
    });

    it('should handle Zod Validation Error (400)', () => {
        const issues: ZodIssue[] = [
            { code: 'invalid_type', expected: 'string', received: 'number', path: ['email'], message: 'Invalid email' }
        ];
        const error = new ZodError(issues);

        globalErrorHandler(error, req, res, next);

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({
            success: false,
            error: expect.objectContaining({
                code: 'VALIDATION_ERROR'
            })
        }));
    });

    it('should handle Unknown Error (500)', () => {
        const error = new Error('Database crash');

        globalErrorHandler(error, req, res, next);

        expect(statusMock).toHaveBeenCalledWith(500);
        expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({
            success: false,
            error: expect.objectContaining({
                code: 'INTERNAL_ERROR'
            })
        }));
    });
});
