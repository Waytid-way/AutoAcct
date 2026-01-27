// backend/src/shared/errors/index.ts

/**
 * DOMAIN ERRORS - Centralized Export
 * 
 * All business logic errors in one place.
 * Import from this index for consistency.
 * 
 * Usage:
 * import { NotFoundError, ValidationError } from '@/shared/errors';
 */

export * from './DomainError';
export * from './ValidationError';
export * from './AuthError';
export * from './ForbiddenError';
export * from './NotFoundError';
export * from './DuplicateReceiptError';
export * from './FinancialIntegrityError';
export * from './ExternalServiceError';
