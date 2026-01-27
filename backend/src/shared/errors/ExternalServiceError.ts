// backend/src/shared/errors/ExternalServiceError.ts

import { DomainError } from './DomainError';

/**
 * EXTERNAL SERVICE ERROR (502/503/504)
 * 
 * Thrown when external service calls fail.
 * Maps external status codes to appropriate gateway errors.
 * 
 * Examples:
 * - OCR service unavailable
 * - Express API timeout
 * - Teable connection failed
 */
export class ExternalServiceError extends DomainError {
    code = 'EXTERNAL_SERVICE_ERROR';
    statusCode = 502;

    constructor(
        public serviceName: string,
        message: string,
        public originalStatusCode?: number
    ) {
        super(`${serviceName} error: ${message}`);

        // Map external status codes
        if (originalStatusCode === 503) this.statusCode = 503; // Service Unavailable
        if (originalStatusCode === 504) this.statusCode = 504; // Gateway Timeout

        Object.setPrototypeOf(this, ExternalServiceError.prototype);
    }
}
