// backend/src/shared/errors/DomainError.ts

/**
 * BASE DOMAIN ERROR
 * 
 * All business logic errors extend this class.
 * Provides consistent error structure across the application.
 * 
 * Properties:
 * - code: Error identifier (UPPER_SNAKE_CASE)
 * - statusCode: HTTP status code for error handler mapping
 * - isOperational: true = expected error, false = programmer bug
 * - details: Additional context (optional)
 * 
 * Reference: Skill 4 - Error Handling & Middleware Pattern
 */
export class DomainError extends Error {
    code: string = 'UNKNOWN_ERROR';
    statusCode: number = 500;
    isOperational: boolean = true;
    details?: any;

    constructor(message: string, details?: any) {
        super(message);
        this.name = this.constructor.name;
        this.details = details;

        // Maintains proper stack trace for where error was thrown
        Error.captureStackTrace(this, this.constructor);

        // Set the prototype explicitly for proper instanceof checks
        Object.setPrototypeOf(this, DomainError.prototype);
    }
}
