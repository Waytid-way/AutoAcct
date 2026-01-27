// backend/src/shared/errors/ValidationError.ts

import { DomainError } from './DomainError';

/**
 * VALIDATION ERROR (400)
 * 
 * Thrown when input validation fails.
 * Used by Zod validators and manual validation.
 */
export class ValidationError extends DomainError {
    code = 'VALIDATION_ERROR';
    statusCode = 400;

    constructor(
        message: string,
        public fieldErrors?: Record<string, string[]>
    ) {
        super(message, { fieldErrors });
        Object.setPrototypeOf(this, ValidationError.prototype);
    }
}
