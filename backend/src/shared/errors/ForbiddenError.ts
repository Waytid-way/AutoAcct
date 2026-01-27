// backend/src/shared/errors/ForbiddenError.ts

import { DomainError } from './DomainError';

/**
 * FORBIDDEN ERROR (403)
 * 
 * Thrown when user lacks required permissions.
 * User is authenticated but not authorized for this action.
 */
export class ForbiddenError extends DomainError {
    code = 'FORBIDDEN';
    statusCode = 403;

    constructor(message: string = 'Access forbidden') {
        super(message);
        Object.setPrototypeOf(this, ForbiddenError.prototype);
    }
}
