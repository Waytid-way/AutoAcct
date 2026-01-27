// backend/src/shared/errors/NotFoundError.ts

import { DomainError } from './DomainError';

/**
 * NOT FOUND ERROR (404)
 * 
 * Thrown when a requested resource doesn't exist.
 * Provides context about which resource and identifier.
 */
export class NotFoundError extends DomainError {
    code = 'NOT_FOUND';
    statusCode = 404;

    constructor(resource: string, identifier?: string) {
        const message = identifier
            ? `${resource} with id '${identifier}' not found`
            : `${resource} not found`;
        super(message);
        Object.setPrototypeOf(this, NotFoundError.prototype);
    }
}
