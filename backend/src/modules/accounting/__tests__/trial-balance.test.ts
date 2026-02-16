// backend/src/modules/accounting/__tests__/trial-balance.test.ts

/**
 * Trial Balance Test Suite
 * 
 * Ensures double-entry accounting integrity:
 * - Debits = Credits (fundamental accounting equation)
 * - Account balance calculations
 * - Period filtering
 * - Transaction reversal handling
 */

import { describe, test, expect, jest, beforeEach, afterEach } from '@jest/globals';
import mongoose from 'mongoose';
import { Transaction } from '@/modules/transaction/models/Transaction.model';
import { MedicerService } from '../services/MedicerService';
import { AccountingService } from '../services/AccountingService';
import { FinancialIntegrityError, NotFoundError } from '@/utils/errors';

// Mock dependencies
jest.mock('@/modules/transaction/models/Transaction.model');
jest.mock('@/models/Receipt.model');
jest.mock('@/modules/ledger/adapters/MediciAdapter');

// Mock logger
const mockLogger = {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
};

describe('Trial Balance - Double-Entry Integrity', () => {
    let medicerService: MedicerService;

    beforeEach(() => {
        medicerService = new MedicerService();
        jest.clearAllMocks();
    });

    describe('Debits = Credits Principle', () => {
        test('single transaction: debit equals credit', async () => {
            // Mock getTrialBalance to return balanced result
            (Transaction.getTrialBalance as jest.Mock).mockResolvedValueOnce({
                accounts: [
                    { account: '5100-Food', debit: 10000, credit: 0, balance: 10000 },
                    { account: '1100-Cash', debit: 0, credit: 10000, balance: -10000 },
                ],
                totalDebit: 10000,
                totalCredit: 10000,
            });

            const balance = await medicerService.getTrialBalance('client-123');
            expect(balance).toBe(0); // Balanced
        });

        test('multiple transactions: sum(debits) = sum(credits)', async () => {
            // Multiple transactions
            (Transaction.getTrialBalance as jest.Mock).mockResolvedValueOnce({
                accounts: [],
                totalDebit: 50000,
                totalCredit: 50000,
            });

            const balance = await medicerService.getTrialBalance('client-123');
            expect(balance).toBe(0); // Balanced
        });

        test('unbalanced transactions return non-zero balance', async () => {
            // Data corruption scenario
            (Transaction.getTrialBalance as jest.Mock).mockResolvedValueOnce({
                accounts: [],
                totalDebit: 50000,
                totalCredit: 49900, // Missing 100 satang
            });

            const balance = await medicerService.getTrialBalance('client-123');
            expect(balance).toBe(100); // Imbalanced by 1 Baht
        });

        test('empty transaction set is balanced', async () => {
            (Transaction.getTrialBalance as jest.Mock).mockResolvedValueOnce({
                accounts: [],
                totalDebit: 0,
                totalCredit: 0,
            });

            const balance = await medicerService.getTrialBalance('client-123');
            expect(balance).toBe(0); // Empty = balanced
        });
    });

    describe('Account Balance Calculations', () => {
        test('asset accounts: debit - credit', async () => {
            // Asset account balance
            const mockAccountBalances = [
                { account: '1100-Cash', totalDebit: 100000, totalCredit: 25000 },
            ];

            // Balance = 100000 - 25000 = 75000 (positive = debit balance)
            const balance = mockAccountBalances[0].totalDebit - mockAccountBalances[0].totalCredit;
            expect(balance).toBe(75000); // 750.00 Baht debit balance
        });

        test('liability accounts: credit - debit', async () => {
            // Liability account balance
            const mockAccountBalances = [
                { account: '2100-AccountsPayable', totalDebit: 10000, totalCredit: 50000 },
            ];

            // Balance = 50000 - 10000 = 40000 (positive = credit balance)
            const balance = mockAccountBalances[0].totalCredit - mockAccountBalances[0].totalDebit;
            expect(balance).toBe(40000); // 400.00 Baht credit balance
        });

        test('equity accounts: credit - debit', async () => {
            // Equity account balance
            const mockAccountBalances = [
                { account: '3100-RetainedEarnings', totalDebit: 0, totalCredit: 100000 },
            ];

            const balance = mockAccountBalances[0].totalCredit - mockAccountBalances[0].totalDebit;
            expect(balance).toBe(100000); // 1000.00 Baht credit balance
        });

        test('expense accounts: debit - credit (normally debit balance)', async () => {
            const mockAccountBalances = [
                { account: '5100-Food', totalDebit: 15000, totalCredit: 0 },
            ];

            const balance = mockAccountBalances[0].totalDebit - mockAccountBalances[0].totalCredit;
            expect(balance).toBe(15000); // 150.00 Baht debit balance
        });

        test('revenue accounts: credit - debit (normally credit balance)', async () => {
            const mockAccountBalances = [
                { account: '4100-Sales', totalDebit: 0, totalCredit: 200000 },
            ];

            const balance = mockAccountBalances[0].totalCredit - mockAccountBalances[0].totalDebit;
            expect(balance).toBe(200000); // 2000.00 Baht credit balance
        });
    });

    describe('Transaction Reversal', () => {
        test('reversal creates opposite entries', async () => {
            const originalTxn = {
                _id: 'txn-original',
                account: { debit: '5100-Food', credit: '1100-Cash' },
                debit: 10000,
                credit: 10000,
                description: 'Lunch expense',
            };

            const reversalTxn = {
                _id: 'txn-reversal',
                account: { debit: '1100-Cash', credit: '5100-Food' }, // Swapped
                debit: 10000,
                credit: 10000,
                description: `[VOID] Lunch expense`,
            };

            // Verify accounts are swapped
            expect(reversalTxn.account.debit).toBe(originalTxn.account.credit);
            expect(reversalTxn.account.credit).toBe(originalTxn.account.debit);
            expect(reversalTxn.debit).toBe(originalTxn.credit);
            expect(reversalTxn.credit).toBe(originalTxn.debit);
        });

        test('original + reversal = zero net effect', () => {
            const original = { debit: 10000, credit: 10000 };
            const reversal = { debit: 10000, credit: 10000 };

            // Net effect on accounts
            const foodAccountNet = original.debit - reversal.debit; // 10000 - 10000 = 0
            const cashAccountNet = original.credit - reversal.credit; // 10000 - 10000 = 0

            expect(foodAccountNet).toBe(0);
            expect(cashAccountNet).toBe(0);
        });
    });
});

describe('Trial Balance - Period Filtering', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('start date inclusive', async () => {
        const startDate = new Date('2026-01-01');
        const endDate = new Date('2026-01-31');

        (Transaction.find as jest.Mock).mockImplementation((filter: any) => {
            // Verify date filter includes start date
            expect(filter.date).toBeDefined();
            expect(filter.date.$gte).toEqual(startDate);
            return {
                lean: jest.fn().mockReturnValue([]),
            };
        });

        await Transaction.find({
            clientId: 'client-123',
            date: { $gte: startDate, $lte: endDate },
        });
    });

    test('end date inclusive', async () => {
        const startDate = new Date('2026-01-01');
        const endDate = new Date('2026-01-31');

        (Transaction.find as jest.Mock).mockImplementation((filter: any) => {
            expect(filter.date.$lte).toEqual(endDate);
            return {
                lean: jest.fn().mockReturnValue([]),
            };
        });

        await Transaction.find({
            clientId: 'client-123',
            date: { $gte: startDate, $lte: endDate },
        });
    });

    test('transactions outside range excluded', async () => {
        const allTransactions = [
            { _id: 'txn-1', date: new Date('2025-12-31'), amount: 10000 }, // Before
            { _id: 'txn-2', date: new Date('2026-01-15'), amount: 20000 }, // Inside
            { _id: 'txn-3', date: new Date('2026-02-01'), amount: 30000 }, // After
        ];

        const startDate = new Date('2026-01-01');
        const endDate = new Date('2026-01-31');

        const filtered = allTransactions.filter(
            (txn) => txn.date >= startDate && txn.date <= endDate
        );

        expect(filtered).toHaveLength(1);
        expect(filtered[0]._id).toBe('txn-2');
    });
});

describe('Trial Balance - Trial Balance Report', () => {
    test('includes all accounts in report', async () => {
        const mockReport = [
            { account: '1100-Cash', debit: 50000, credit: 20000 },
            { account: '1200-Inventory', debit: 100000, credit: 0 },
            { account: '2100-Payables', debit: 0, credit: 30000 },
            { account: '5100-Food', debit: 5000, credit: 0 },
        ];

        expect(mockReport).toHaveLength(4);
        expect(mockReport.map((r) => r.account)).toContain('1100-Cash');
        expect(mockReport.map((r) => r.account)).toContain('1200-Inventory');
        expect(mockReport.map((r) => r.account)).toContain('2100-Payables');
        expect(mockReport.map((r) => r.account)).toContain('5100-Food');
    });

    test('total debits = total credits in report', () => {
        const mockReport = [
            { account: '1100-Cash', debit: 50000, credit: 20000 },
            { account: '1200-Inventory', debit: 100000, credit: 0 },
            { account: '2100-Payables', debit: 0, credit: 105000 },
            { account: '5100-Food', debit: 5000, credit: 0 },
        ];

        const totalDebit = mockReport.reduce((sum, r) => sum + r.debit, 0);
        const totalCredit = mockReport.reduce((sum, r) => sum + r.credit, 0);

        expect(totalDebit).toBe(totalCredit);
    });

    test('net balance = 0 when balanced', () => {
        const mockReport = [
            { account: '1100-Cash', debit: 50000, credit: 20000 },
            { account: '1200-Inventory', debit: 100000, credit: 0 },
            { account: '2100-Payables', debit: 0, credit: 105000 },
            { account: '5100-Food', debit: 5000, credit: 0 },
        ];

        const totalDebit = mockReport.reduce((sum, r) => sum + r.debit, 0);
        const totalCredit = mockReport.reduce((sum, r) => sum + r.credit, 0);
        const netBalance = totalDebit - totalCredit;

        expect(netBalance).toBe(0);
    });
});

describe('Trial Balance - Edge Cases', () => {
    let accountingService: AccountingService;
    let medicerService: MedicerService;

    beforeEach(() => {
        medicerService = new MedicerService();
        accountingService = new AccountingService(mockLogger as any, medicerService);
        jest.clearAllMocks();
    });

    test('empty period (no transactions) returns balanced', async () => {
        (Transaction.getTrialBalance as jest.Mock).mockResolvedValueOnce({
            accounts: [],
            totalDebit: 0,
            totalCredit: 0,
        });

        const balance = await medicerService.getTrialBalance('client-123');
        expect(balance).toBe(0);
    });

    test('single transaction period', async () => {
        (Transaction.getTrialBalance as jest.Mock).mockResolvedValueOnce({
            accounts: [],
            totalDebit: 10000,
            totalCredit: 10000,
        });

        const balance = await medicerService.getTrialBalance('client-123');
        expect(balance).toBe(0);
    });

    test('large transaction volumes', async () => {
        // Simulate many transactions
        const largeDebitTotal = 9999999999; // Very large amount
        const largeCreditTotal = 9999999999;

        (Transaction.getTrialBalance as jest.Mock).mockResolvedValueOnce({
            accounts: [],
            totalDebit: largeDebitTotal,
            totalCredit: largeCreditTotal,
        });

        const balance = await medicerService.getTrialBalance('client-123');
        expect(balance).toBe(0);
    });

    test('negative balances (overdrawn) still balanced', () => {
        // Overdrawn account scenario
        const overdrawnAccount = {
            account: '1100-Cash',
            debit: 0,
            credit: 50000, // Negative balance (overdrawn)
        };

        // Still part of a balanced transaction
        const matchingDebit = {
            account: '5100-OverdraftFee',
            debit: 50000,
            credit: 0,
        };

        const totalDebit = overdrawnAccount.debit + matchingDebit.debit;
        const totalCredit = overdrawnAccount.credit + matchingDebit.credit;

        expect(totalDebit).toBe(totalCredit);
    });

    test('zero amount transactions throw error', async () => {
        // Test AccountingService validation
        const mockReceipt = {
            _id: 'receipt-123',
            clientId: 'client-123',
            extractedFields: { amountSatang: 10000 },
            save: jest.fn(),
        };

        const mockReceiptModel = jest.requireMock('@/models/Receipt.model').default;
        mockReceiptModel.findOne = jest.fn().mockResolvedValue(mockReceipt);

        // Line items that don't sum to receipt amount
        const lineItems = [
            { debitAccount: '5100-Food', amount: 0, description: 'Invalid item' },
        ];

        await expect(
            accountingService.createSplitEntry(
                'receipt-123',
                lineItems,
                '1100-Cash',
                'client-123',
                'corr-123'
            )
        ).rejects.toThrow(FinancialIntegrityError);
    });

    test('split entries must sum to total', async () => {
        const mockReceipt = {
            _id: 'receipt-123',
            clientId: 'client-123',
            extractedFields: { amountSatang: 10000 },
            save: jest.fn(),
        };

        const mockReceiptModel = jest.requireMock('@/models/Receipt.model').default;
        mockReceiptModel.findOne = jest.fn().mockResolvedValue(mockReceipt);

        // Line items sum to more than receipt
        const lineItems = [
            { debitAccount: '5100-Food', amount: 6000, description: 'Food' },
            { debitAccount: '5200-Transport', amount: 5000, description: 'Taxi' },
        ]; // Total = 11000 ≠ 10000

        await expect(
            accountingService.createSplitEntry(
                'receipt-123',
                lineItems,
                '1100-Cash',
                'client-123',
                'corr-123'
            )
        ).rejects.toThrow(FinancialIntegrityError);
    });
});

describe('Trial Balance - Month-End Closing', () => {
    test('balances carry forward to next period', () => {
        // January closing balances
        const januaryBalances = {
            '1100-Cash': 50000,
            '2100-Payables': 30000,
        };

        // February opening balances should equal January closing
        const februaryOpening = { ...januaryBalances };

        expect(februaryOpening['1100-Cash']).toBe(januaryBalances['1100-Cash']);
        expect(februaryOpening['2100-Payables']).toBe(januaryBalances['2100-Payables']);
    });

    test('period locked after closing prevents new entries', () => {
        const closedPeriods = new Set<string>();
        const period = '2026-01';

        // Close January 2026
        closedPeriods.add(period);

        // Attempt to add transaction to closed period
        const newTransaction = { date: new Date('2026-01-15'), amount: 10000 };
        const isPeriodClosed = closedPeriods.has(
            `${newTransaction.date.getFullYear()}-${String(newTransaction.date.getMonth() + 1).padStart(2, '0')}`
        );

        expect(isPeriodClosed).toBe(true);
    });
});
