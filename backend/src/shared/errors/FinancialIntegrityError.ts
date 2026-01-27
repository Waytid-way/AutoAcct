// backend/src/shared/errors/FinancialIntegrityError.ts

import { DomainError } from './DomainError';

/**
 * FINANCIAL INTEGRITY ERROR (500)
 * 
 * Thrown when accounting golden rules are violated.
 * This is a CRITICAL error that indicates data corruption.
 * 
 * Examples:
 * - Double-entry imbalance (Debit ≠ Credit)
 * - Negative balances where not allowed
 * - Journal entry validation failures
 */
export class FinancialIntegrityError extends DomainError {
    code = 'FINANCIAL_INTEGRITY_ERROR';
    statusCode = 500;

    constructor(
        message: string,
        public balanceDetails?: { totalDebit: number; totalCredit: number }
    ) {
        super(message, { balanceDetails });
        Object.setPrototypeOf(this, FinancialIntegrityError.prototype);
    }
}
