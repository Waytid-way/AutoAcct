// backend/src/shared/errors/DuplicateReceiptError.ts

import { DomainError } from './DomainError';

/**
 * DUPLICATE RECEIPT ERROR (409)
 * 
 * Thrown when attempting to upload a receipt that already exists.
 * Uses SHA-256 hash for duplicate detection per client.
 */
export class DuplicateReceiptError extends DomainError {
    code = 'DUPLICATE_RECEIPT';
    statusCode = 409;

    constructor(fileHash: string) {
        super(`Receipt with hash ${fileHash.substring(0, 8)}... already exists`);
        Object.setPrototypeOf(this, DuplicateReceiptError.prototype);
    }
}
