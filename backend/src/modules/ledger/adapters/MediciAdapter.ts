// backend/src/modules/ledger/adapters/MediciAdapter.ts

import { Book } from 'medici';
import { ILedgerAdapter } from './ILedgerAdapter';
import { ILedgerEntry, ILedgerTransaction } from '../types/ledger.types';
import { ExternalServiceError } from '@/shared/errors';
import logger from '@/config/logger';

/**
 * MEDICI LEDGER ADAPTER
 * 
 * Production implementation using 'medici' library.
 * Features:
 * - Double-entry enforcement (native to Medici)
 * - Resilience: Retry with Exponential Backoff
 * - Circuit Breaker pattern
 */
export class MediciAdapter implements ILedgerAdapter {
    // Circuit Breaker State
    private failures = 0;
    private lastFailureTime = 0;
    private static readonly FAILURE_THRESHOLD = 5;
    private static readonly RESET_TIMEOUT_MS = 30000; // 30 seconds

    /**
     * Record Entry with Resilience
     */
    async recordEntry(entry: ILedgerEntry, correlationId: string): Promise<ILedgerTransaction> {
        this.checkCircuitBreaker();

        try {
            return await this.retryOperation(async () => {
                const book = new Book(entry.clientId);

                // Prepare Entry
                // Medici entry(memo) requires memo string
                let journal = book.entry(entry.memo);

                Object.entries(entry.entries).forEach(([account, amount]) => {
                    if (amount > 0) {
                        journal.debit(account, amount);
                    } else if (amount < 0) {
                        journal.credit(account, Math.abs(amount));
                    }
                });

                // Commit (Writes to DB)
                // Result is IJournal document (mongoose doc)
                const result: any = await journal.commit();

                this.resetCircuitBreaker();

                // Map Result
                // We cast result to any or specific Medici type if available to avoid mapping errors
                // Medici IJournal usually has: _id, memo, timestamp, voided, etc.
                // But types might be loose or differ by version.
                // We safely map.

                return {
                    id: result._id ? result._id.toString() : result.id?.toString() || 'unknown',
                    memo: result.memo,
                    date: result.timestamp || new Date(),
                    voided: !!result.voided,
                    posted: true,
                    transactions: (result.transactions || []).map((t: any) => ({
                        credit: t.credit,
                        debit: t.debit,
                        accounts: t.accounts,
                    })),
                };
            });
        } catch (err: any) {
            this.recordFailure();
            logger.error({
                action: 'medici_record_failed',
                correlationId,
                error: err.message,
                failures: this.failures,
            });
            throw new ExternalServiceError('Medici Ledger', `Failed to record entry: ${err.message}`);
        }
    }

    async getBalance(accountPath: string, clientId: string): Promise<number> {
        try {
            const book = new Book(clientId);
            const balance = await book.balance({ account: accountPath });
            return balance.balance;
        } catch (err: any) {
            throw new ExternalServiceError('Medici Ledger', `Failed to get balance: ${err.message}`);
        }
    }

    async reverseEntry(journalId: string, clientId: string, correlationId: string): Promise<void> {
        this.checkCircuitBreaker();

        try {
            await this.retryOperation(async () => {
                const book = new Book(clientId);
                await book.void(journalId);
            });

            this.resetCircuitBreaker();

            logger.info({
                action: 'medici_reverse_success',
                correlationId,
                journalId,
                clientId,
            });
        } catch (err: any) {
            this.recordFailure();
            logger.error({
                action: 'medici_reverse_failed',
                correlationId,
                journalId,
                error: err.message,
                failures: this.failures,
            });
            throw new ExternalServiceError('Medici Ledger', `Failed to reverse entry: ${err.message}`);
        }
    }

    // ============================================
    // RESILIENCE HELPERS
    // ============================================

    private checkCircuitBreaker(): void {
        if (this.failures >= MediciAdapter.FAILURE_THRESHOLD) {
            const now = Date.now();
            if (now - this.lastFailureTime < MediciAdapter.RESET_TIMEOUT_MS) {
                throw new ExternalServiceError('Medici Ledger', 'Circuit Breaker Open: Service Temporarily Unavailable', 503);
            }
        }
    }

    private recordFailure(): void {
        this.failures++;
        this.lastFailureTime = Date.now();
    }

    private resetCircuitBreaker(): void {
        this.failures = 0;
        this.lastFailureTime = 0;
    }

    private async retryOperation<T>(operation: () => Promise<T>, retries = 3): Promise<T> {
        let lastError: any;
        for (let i = 0; i < retries; i++) {
            try {
                return await operation();
            } catch (err) {
                lastError = err;
                const delay = Math.pow(2, i) * 1000;
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
        throw lastError;
    }
}
