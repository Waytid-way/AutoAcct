/**
 * AutoAcct Task 1: Medici Ledger Adapter Pattern
 * 
 * This template provides the complete structure for implementing
 * the Medici integration with Adapter Pattern (dev/prod switching).
 * 
 * Files to create from this template:
 * 1. modules/ledger/types/ledger.types.ts
 * 2. modules/ledger/adapters/ILedgerAdapter.ts
 * 3. modules/ledger/adapters/MockLedgerAdapter.ts
 * 4. modules/ledger/adapters/MediciAdapter.ts
 * 5. modules/ledger/services/LedgerIntegrationService.ts
 */

// ============================================
// FILE 1: modules/ledger/types/ledger.types.ts
// ============================================

export type LedgerAccount = {
  accountId: string;
  accountCode: string;
  accountName: string;
  balance: number; // in satang
  currency: 'THB';
  status: 'active' | 'inactive';
  createdAt: Date;
};

export type LedgerEntry = {
  entryId: string;
  date: Date;
  description: string;
  debit: {
    accountId: string;
    accountCode: string;
    amount: number; // satang
  };
  credit: {
    accountId: string;
    accountCode: string;
    amount: number; // satang
  };
  reference?: string; // Invoice number, etc
  correlationId: string;
};

export type PostEntryRequest = {
  entry: LedgerEntry;
  correlationId: string;
};

export type PostEntryResponse = {
  ledgerId: string;
  status: 'posted' | 'queued' | 'failed';
  timestamp: Date;
};

export type TrialBalance = {
  totalDebit: number;
  totalCredit: number;
  isBalanced: boolean;
  asOfDate: Date;
};

export type LedgerHealth = 'healthy' | 'degraded' | 'down';

export type LedgerConfig = {
  apiUrl?: string;
  apiKey?: string;
  requestTimeout?: number;
  retryMaxAttempts?: number;
  circuitBreakerThreshold?: number;
};

// ============================================
// FILE 2: modules/ledger/adapters/ILedgerAdapter.ts
// ============================================

import {
  LedgerEntry,
  PostEntryResponse,
  TrialBalance,
  LedgerHealth,
} from '../types/ledger.types';

/**
 * Interface for ledger adapters.
 * Implementations: MockLedgerAdapter (dev), MediciAdapter (prod)
 */
export interface ILedgerAdapter {
  /**
   * Post a journal entry to the ledger
   * @param entry The journal entry to post
   * @param correlationId For tracing
   * @returns Response with ledger ID and status
   */
  postEntry(
    entry: LedgerEntry,
    correlationId: string
  ): Promise<PostEntryResponse>;

  /**
   * Get account balance
   * @param accountId The account to query
   * @returns Balance in satang
   */
  getBalance(accountId: string): Promise<number>;

  /**
   * Get trial balance (total debit vs credit)
   * @returns Trial balance summary
   */
  reconcile(): Promise<TrialBalance>;

  /**
   * Health check
   * @returns Health status
   */
  health(): Promise<LedgerHealth>;
}

// ============================================
// FILE 3: modules/ledger/adapters/MockLedgerAdapter.ts
// ============================================

import { LedgerEntry, PostEntryResponse, TrialBalance, LedgerHealth } from '../types/ledger.types';
import { ILedgerAdapter } from './ILedgerAdapter';

/**
 * Mock ledger adapter for development and testing.
 * Stores entries in-memory, no real API calls.
 */
export class MockLedgerAdapter implements ILedgerAdapter {
  private ledger: Map<string, LedgerEntry> = new Map();
  private balances: Map<string, number> = new Map();
  private entryCounter: number = 0;

  constructor() {
    // Initialize some test accounts with 0 balance
    this.balances.set('1000', 0); // Cash
    this.balances.set('2000', 0); // Accounts Payable
    this.balances.set('3000', 0); // Revenue
    this.balances.set('5000', 0); // Expenses
  }

  async postEntry(
    entry: LedgerEntry,
    correlationId: string
  ): Promise<PostEntryResponse> {
    // Simulate processing delay
    await this.delay(50);

    const ledgerId = `MOCK-${++this.entryCounter}`;

    // Validate accounts exist
    if (
      !this.balances.has(entry.debit.accountId) ||
      !this.balances.has(entry.credit.accountId)
    ) {
      throw new Error(
        `Account not found: ${entry.debit.accountId} or ${entry.credit.accountId}`
      );
    }

    // Validate amounts match
    if (entry.debit.amount !== entry.credit.amount) {
      throw new Error('Debit and credit amounts do not match');
    }

    // Update balances
    const debitBalance = this.balances.get(entry.debit.accountId) || 0;
    const creditBalance = this.balances.get(entry.credit.accountId) || 0;

    this.balances.set(entry.debit.accountId, debitBalance + entry.debit.amount);
    this.balances.set(
      entry.credit.accountId,
      creditBalance - entry.credit.amount
    );

    // Store entry
    this.ledger.set(ledgerId, { ...entry, entryId: ledgerId });

    console.log(
      `[${correlationId}] MockLedger: Posted entry ${ledgerId}`,
      { debit: entry.debit.amount, credit: entry.credit.amount }
    );

    return {
      ledgerId,
      status: 'posted',
      timestamp: new Date(),
    };
  }

  async getBalance(accountId: string): Promise<number> {
    await this.delay(20);
    return this.balances.get(accountId) || 0;
  }

  async reconcile(): Promise<TrialBalance> {
    await this.delay(30);

    let totalDebit = 0;
    let totalCredit = 0;

    for (const entry of this.ledger.values()) {
      totalDebit += entry.debit.amount;
      totalCredit += entry.credit.amount;
    }

    return {
      totalDebit,
      totalCredit,
      isBalanced: totalDebit === totalCredit,
      asOfDate: new Date(),
    };
  }

  async health(): Promise<LedgerHealth> {
    return 'healthy';
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ============================================
// FILE 4: modules/ledger/adapters/MediciAdapter.ts
// ============================================

import axios, { AxiosInstance } from 'axios';
import { LedgerEntry, PostEntryResponse, TrialBalance, LedgerHealth } from '../types/ledger.types';
import { ILedgerAdapter } from './ILedgerAdapter';
import { ExternalServiceError } from '../../../shared/errors';

/**
 * Real Medici ledger adapter for production.
 * Connects to Medici API with retry logic and circuit breaker.
 */
export class MediciAdapter implements ILedgerAdapter {
  private httpClient: AxiosInstance;
  private apiUrl: string;
  private apiKey: string;
  private requestTimeout: number = 10000;
  private retryMaxAttempts: number = 3;

  // Circuit breaker
  private failureCount: number = 0;
  private circuitBreakerThreshold: number = 5;
  private circuitBreakerResetTime: number = 30000; // 30 seconds
  private circuitBreakerOpenedAt: Date | null = null;
  private circuitState: 'closed' | 'open' | 'half-open' = 'closed';

  constructor(apiUrl: string, apiKey: string) {
    this.apiUrl = apiUrl;
    this.apiKey = apiKey;

    this.httpClient = axios.create({
      baseURL: apiUrl,
      timeout: this.requestTimeout,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });
  }

  async postEntry(
    entry: LedgerEntry,
    correlationId: string
  ): Promise<PostEntryResponse> {
    // Check circuit breaker
    if (this.circuitState === 'open') {
      const now = Date.now();
      const elapsedTime = now - (this.circuitBreakerOpenedAt?.getTime() || now);

      if (elapsedTime > this.circuitBreakerResetTime) {
        // Try to recover
        this.circuitState = 'half-open';
        console.log(
          `[${correlationId}] Circuit breaker transitioning to half-open`
        );
      } else {
        // Circuit still open
        throw new ExternalServiceError(
          'Medici',
          'Circuit breaker open - service temporarily unavailable',
          503
        );
      }
    }

    // Prepare payload
    const payload = {
      journalEntry: {
        date: entry.date.toISOString(),
        description: entry.description,
        reference: entry.reference,
        lines: [
          {
            accountCode: entry.debit.accountCode,
            debit: entry.debit.amount,
            credit: 0,
          },
          {
            accountCode: entry.credit.accountCode,
            debit: 0,
            credit: entry.credit.amount,
          },
        ],
      },
      correlationId,
    };

    // Retry logic with exponential backoff
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.retryMaxAttempts; attempt++) {
      try {
        console.log(
          `[${correlationId}] Medici: POST attempt ${attempt + 1}/${this.retryMaxAttempts}`
        );

        const response = await this.httpClient.post(
          '/api/journal-entries',
          payload
        );

        // Success - reset circuit breaker
        this.failureCount = 0;
        if (this.circuitState === 'half-open') {
          this.circuitState = 'closed';
          console.log(`[${correlationId}] Circuit breaker closed`);
        }

        console.log(
          `[${correlationId}] Medici: Posted entry ${response.data.entryId}`
        );

        return {
          ledgerId: response.data.entryId,
          status: 'posted',
          timestamp: new Date(),
        };
      } catch (err: any) {
        lastError = err;

        const statusCode = err.response?.status || 500;
        const errorMessage = err.response?.data?.message || err.message;

        console.error(
          `[${correlationId}] Medici error (attempt ${attempt + 1}): ${statusCode} ${errorMessage}`
        );

        // Don't retry on client errors (4xx)
        if (statusCode >= 400 && statusCode < 500) {
          throw new ExternalServiceError(
            'Medici',
            `${statusCode} ${errorMessage}`,
            statusCode
          );
        }

        // Exponential backoff: 1s, 2s, 4s
        if (attempt < this.retryMaxAttempts - 1) {
          const backoffMs = Math.pow(2, attempt) * 1000;
          console.log(`[${correlationId}] Retrying in ${backoffMs}ms...`);
          await this.delay(backoffMs);
        }
      }
    }

    // All retries exhausted
    this.failureCount++;

    if (this.failureCount >= this.circuitBreakerThreshold) {
      this.circuitState = 'open';
      this.circuitBreakerOpenedAt = new Date();
      console.error(
        `[${correlationId}] Circuit breaker opened (${this.failureCount} failures)`
      );
    }

    // Throw error
    throw new ExternalServiceError(
      'Medici',
      `Failed after ${this.retryMaxAttempts} attempts: ${lastError?.message}`,
      lastError instanceof ExternalServiceError ? lastError.originalStatusCode : 502
    );
  }

  async getBalance(accountId: string): Promise<number> {
    try {
      const response = await this.httpClient.get(`/api/accounts/${accountId}/balance`);
      return response.data.balance;
    } catch (err: any) {
      throw new ExternalServiceError(
        'Medici',
        `Failed to get balance: ${err.message}`,
        err.response?.status || 502
      );
    }
  }

  async reconcile(): Promise<TrialBalance> {
    try {
      const response = await this.httpClient.get('/api/trial-balance');
      return {
        totalDebit: response.data.totalDebit,
        totalCredit: response.data.totalCredit,
        isBalanced: response.data.totalDebit === response.data.totalCredit,
        asOfDate: new Date(),
      };
    } catch (err: any) {
      throw new ExternalServiceError(
        'Medici',
        `Trial balance check failed: ${err.message}`,
        err.response?.status || 502
      );
    }
  }

  async health(): Promise<LedgerHealth> {
    try {
      // Quick health check
      await this.httpClient.get('/health', { timeout: 3000 });

      if (this.circuitState === 'open') return 'degraded';
      return 'healthy';
    } catch (err) {
      return 'down';
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ============================================
// FILE 5: modules/ledger/services/LedgerIntegrationService.ts
// ============================================

import { ILedgerAdapter } from '../adapters/ILedgerAdapter';
import { LedgerEntry, PostEntryResponse } from '../types/ledger.types';

/**
 * Service that integrates with JournalService.
 * Handles posting entries to Medici ledger with fallback to queue.
 */
export class LedgerIntegrationService {
  constructor(private ledgerAdapter: ILedgerAdapter) {}

  async postEntryToLedger(
    entry: LedgerEntry,
    correlationId: string
  ): Promise<PostEntryResponse> {
    try {
      console.log(
        `[${correlationId}] Posting entry to ledger: ${entry.debit.accountCode} → ${entry.credit.accountCode}`
      );

      const response = await this.ledgerAdapter.postEntry(entry, correlationId);

      console.log(
        `[${correlationId}] Successfully posted to ledger: ${response.ledgerId}`
      );

      return response;
    } catch (err: any) {
      // Log error
      console.error(
        `[${correlationId}] Failed to post to ledger: ${err.message}`
      );

      // TODO: Queue for retry in Phase 2.3B
      // await this.retryQueue.enqueue({
      //   type: 'ledger_post',
      //   entry,
      //   retryCount: 0,
      //   nextRetryAt: Date.now() + 5000,
      //   correlationId
      // });

      // Return queued status (async posting)
      return {
        ledgerId: 'queued',
        status: 'queued',
        timestamp: new Date(),
      };
    }
  }

  async getLedgerHealth(): Promise<string> {
    const health = await this.ledgerAdapter.health();
    return health;
  }
}

// ============================================
// FILE 6: Example usage in JournalService
// ============================================

/**
 * In modules/journal/services/JournalService.ts:
 * 
 * import { LedgerIntegrationService } from '../../ledger/services/LedgerIntegrationService';
 * 
 * export class JournalService {
 *   constructor(
 *     private gl: GeneralLedgerService,
 *     private ledgerIntegration: LedgerIntegrationService
 *   ) {}
 * 
 *   async postEntry(
 *     journalEntry: JournalEntry,
 *     correlationId: string
 *   ): Promise<{ entryId: string }> {
 *     // 1. Validate
 *     if (journalEntry.debit.amount !== journalEntry.credit.amount) {
 *       throw new ValidationError('Debit and credit must match');
 *     }
 * 
 *     // 2. Update GL
 *     await this.gl.postEntry(journalEntry, correlationId);
 * 
 *     // 3. Post to Medici (new in Phase 2.3)
 *     const ledgerResponse = await this.ledgerIntegration.postEntryToLedger(
 *       journalEntry,
 *       correlationId
 *     );
 *     
 *     // 4. Update receipt status
 *     if (ledgerResponse.status === 'posted') {
 *       // Set status = POSTED_TO_LEDGER
 *     } else if (ledgerResponse.status === 'queued') {
 *       // Set status = POSTING_TO_LEDGER (async, will retry)
 *     }
 * 
 *     return { entryId: journalEntry.entryId };
 *   }
 * }
 */

// ============================================
// FILE 7: Example test file
// ============================================

/**
 * In modules/ledger/__tests__/MediciAdapter.test.ts:
 * 
 * import { MediciAdapter } from '../adapters/MediciAdapter';
 * import { LedgerEntry } from '../types/ledger.types';
 * import { ExternalServiceError } from '../../../shared/errors';
 * 
 * describe('MediciAdapter', () => {
 *   let adapter: MediciAdapter;
 * 
 *   beforeEach(() => {
 *     adapter = new MediciAdapter(
 *       'http://localhost:9000',
 *       'test-api-key'
 *     );
 *   });
 * 
 *   it('should post entry successfully', async () => {
 *     const entry: LedgerEntry = {
 *       entryId: 'je-001',
 *       date: new Date(),
 *       description: 'Test entry',
 *       debit: { accountId: '1000', accountCode: '1000', amount: 50000 },
 *       credit: { accountId: '2000', accountCode: '2000', amount: 50000 },
 *       correlationId: 'corr-123'
 *     };
 * 
 *     const response = await adapter.postEntry(entry, 'corr-123');
 *     expect(response.status).toBe('posted');
 *     expect(response.ledgerId).toBeDefined();
 *   });
 * 
 *   it('should retry on failure', async () => {
 *     // Test exponential backoff
 *     const entry: LedgerEntry = {...};
 *     // Mock API to fail twice, succeed on 3rd
 *     const response = await adapter.postEntry(entry, 'corr-123');
 *     expect(response.status).toBe('posted');
 *   });
 * 
 *   it('should open circuit breaker after 5 failures', async () => {
 *     // Test circuit breaker
 *     // Mock API to always fail
 *     for (let i = 0; i < 5; i++) {
 *       try {
 *         await adapter.postEntry(entry, 'corr-123');
 *       } catch (err) {
 *         // expected
 *       }
 *     }
 * 
 *     // Now circuit should be open
 *     await expect(adapter.postEntry(entry, 'corr-123'))
 *       .rejects.toThrow('Circuit breaker open');
 *   });
 * });
 */

export { MockLedgerAdapter, MediciAdapter, LedgerIntegrationService };
export type { LedgerEntry, PostEntryResponse, TrialBalance, LedgerHealth };
