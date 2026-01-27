// backend/src/shared/errors/AuthError.ts

import { DomainError } from './DomainError';

/**
 * AUTH ERROR (401)
 * 
 * Thrown when authentication is required or fails.
 * Examples: Missing token, invalid token, expired token
 */
export class AuthError extends DomainError {
    code = 'AUTH_REQUIRED';
    statusCode = 401;

    constructor(message: string = 'Authentication required') {
        super(message);
        Object.setPrototypeOf(this, AuthError.prototype);
    }
}
