// backend/src/utils/errors.ts

/**
 * CUSTOM ERROR HIERARCHY
 * 
 * Distinguishes between:
 * - Business Logic Errors (User fixable, 4xx)
 * - System Errors (Admin fixable, 5xx)
 * 
 * Reference: Vol 1 Section 11 - Error Handling
 */

export class AppError extends Error {
    constructor(
        public statusCode: number,
        public message: string,
        public code: string,
        public details?: Record<string, unknown>
    ) {
        super(message);
        this.name = this.constructor.name;
        Error.captureStackTrace(this, this.constructor);
    }
}

/**
 * 500 - Financial Integrity Violations
 * Triggered when Golden Rules are broken
 */
export class FinancialIntegrityError extends AppError {
    constructor(message: string, details?: Record<string, unknown>) {
        super(500, message, 'FINANCIAL_INTEGRITY_ERROR', details);
    }
}

/**
 * 409 - Duplicate Receipt Detected
 */
export class DuplicateReceiptError extends AppError {
    constructor(fileHash: string) {
        super(409, 'Duplicate receipt detected', 'DUPLICATE_RECEIPT', { fileHash });
    }
}

/**
 * 422 - OCR Validation Failed
 */
export class OCRValidationError extends AppError {
    constructor(message: string, field: string) {
        super(422, message, 'OCR_VALIDATION_ERROR', { field });
    }
}

/**
 * 403 - Dev Mode Authentication Error
 */
export class DevModeAuthError extends AppError {
    constructor() {
        super(403, 'Dev mode not enabled or invalid token', 'DEV_AUTH_ERROR');
    }
}

/**
 * 404 - Resource Not Found
 */
export class NotFoundError extends AppError {
    constructor(message: string) {
        super(404, message, 'NOT_FOUND');
    }
}

/**
 * 400 - Validation Error
 */
export class ValidationError extends AppError {
    constructor(message: string, details?: Record<string, unknown>) {
        super(400, message, 'VALIDATION_ERROR', details);
    }
}

/**
 * 429 - Rate Limit Exceeded
 */
export class RateLimitError extends AppError {
    constructor(retryAfter: number) {
        super(429, 'Too many requests', 'RATE_LIMIT_EXCEEDED', { retryAfter });
    }
}
