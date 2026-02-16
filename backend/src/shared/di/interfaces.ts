/**
 * Service Interface Definitions
 * 
 * This file defines all service interfaces for proper Dependency Injection.
 * All services should implement these interfaces to ensure:
 * 1. Testability with mocks
 * 2. Clear contracts between services
 * 3. Type-safe DI container registration
 */

import { IReceipt } from '@/models/Receipt.model';
import { ITransaction } from '@/modules/transaction/models/schemas/Transaction.schema';
import { Logger } from 'winston';
import { MoneyInt } from '@/utils/money';
import { DetectionResult } from '@/modules/anomaly/services/AnomalyDetectionService';
import { IOcrResult } from '@/adapters/interfaces/IOcrAdapter';

// Re-export types from their canonical sources
export { IReceipt, ITransaction, IOcrResult, DetectionResult };

// ==================== Logger Interface ====================

export interface ILogger {
    info(message: string | Record<string, unknown>): void;
    warn(message: string | Record<string, unknown>): void;
    error(message: string | Record<string, unknown>): void;
    debug(message: string | Record<string, unknown>): void;
}

// ==================== Receipt Service ====================

export interface IReceiptService {
    uploadReceipt(
        file: Buffer,
        fileName: string,
        mimeType: string,
        clientId: string,
        correlationId: string,
        userId?: string
    ): Promise<IReceipt>;

    getById(
        receiptId: string,
        clientId: string,
        correlationId: string
    ): Promise<IReceipt>;

    getQueue(
        query: {
            status?: string;
            page: number;
            perPage: number;
        },
        clientId: string,
        correlationId: string
    ): Promise<{ data: IReceipt[]; total: number }>;

    getQueueStats(
        clientId: string,
        correlationId: string
    ): Promise<{
        total: number;
        processing: number;
        queued: number;
        failed: number;
        avgConfidence: number;
    }>;

    submitFeedback(
        receiptId: string,
        feedback: {
            corrections?: {
                vendor?: string;
                amount?: number;
                date?: Date;
                category?: string;
            };
            notes?: string;
        },
        clientId: string,
        correlationId: string,
        userId?: string
    ): Promise<IReceipt>;

    updateWithOcrResult(
        receiptId: string,
        ocrResult: {
            ocrText?: string;
            vendor?: string;
            amountSatang?: number;
            issueDate?: Date;
            taxId?: string;
            confidence: {
                vendor?: number;
                amount?: number;
                date?: number;
                overall: number;
            };
            ocrEngine?: 'paddleocr' | 'googlevision' | 'claude' | 'groq' | 'mock';
        },
        clientId: string,
        correlationId: string
    ): Promise<IReceipt>;

    processQueue(
        clientId: string,
        options?: {
            maxBatch?: number;
            stopOnError?: boolean;
        }
    ): Promise<{
        processed: number;
        failed: number;
        receipts: IReceipt[];
    }>;

    confirmReceipt(
        receiptId: string,
        data: {
            vendor: string;
            amount: number;
            date: string;  // Actual implementation uses string
            category?: string;
            lineItems?: {
                description: string;
                quantity: number;
                unitPrice: number;
                totalPrice: number;
                category?: string;
            }[];
        },
        correlationId: string
    ): Promise<{ receiptId: string; transactionId?: string; splitGroupId?: string; status: 'draft' }>;

    deleteReceipt(receiptId: string, correlationId: string): Promise<void>;

    updateLineItems(
        receiptId: string,
        lineItems: {
            description: string;
            quantity: number;
            unitPrice: number;
            totalPrice: number;
            suggestedCategory?: string;
            aiConfidence?: number;
        }[],
        clientId: string,
        correlationId: string
    ): Promise<IReceipt>;
}

// ==================== Transaction Service ====================

export interface ITransactionService {
    createDraft(
        data: {
            clientId: string;
            receiptId?: string;
            account: {
                debit: string;
                credit: string;
            };
            debit: number;
            credit: number;
            description: string;
            date: Date;
            reference?: string;
        },
        userId: string,
        correlationId: string
    ): Promise<ITransaction>;

    getById(
        transactionId: string,
        clientId: string,
        correlationId: string
    ): Promise<ITransaction>;

    query(
        params: {
            status?: 'draft' | 'posted' | 'voided';
            receiptId?: string;
            startDate?: Date;
            endDate?: Date;
            page: number;
            perPage: number;
        },
        clientId: string,
        correlationId: string
    ): Promise<{ data: ITransaction[]; total: number }>;

    updateDraft(
        transactionId: string,
        updates: {
            date?: Date;
            description?: string;
            receiptId?: string;
            account?: { debit: string; credit: string };
            debit?: number;
            credit?: number;
            reference?: string;
        },
        clientId: string,
        correlationId: string
    ): Promise<ITransaction>;

    deleteDraft(
        transactionId: string,
        clientId: string,
        correlationId: string
    ): Promise<void>;

    approve(
        transactionId: string,
        clientId: string,
        approvedBy: string,
        correlationId: string
    ): Promise<ITransaction>;

    void(
        transactionId: string,
        voidData: { reason: string },
        clientId: string,
        voidedBy: string,
        correlationId: string
    ): Promise<ITransaction>;

    getTrialBalance(
        clientId: string,
        startDate: Date | undefined,
        endDate: Date | undefined,
        correlationId: string
    ): Promise<{
        accounts: Array<{
            account: string;
            debit: number;
            credit: number;
            balance: number;
        }>;
        totalDebit: number;
        totalCredit: number;
    }>;
}

// ==================== Accounting Service ====================

export interface IAccountingService {
    createSplitEntry(
        receiptId: string,
        lineItems: Array<{
            debitAccount: string;
            amount: MoneyInt;
            description: string;
        }>,
        creditAccount: string,
        clientId: string,
        correlationId: string
    ): Promise<any[]>;

    getSplitEntries(
        splitGroupId: string,
        clientId: string
    ): Promise<any[]>;
}

// ==================== Ledger Integration Service ====================

export interface ILedgerEntry {
    clientId: string;
    memo: string;
    date: Date;
    entries: Record<string, number>;
    metadata?: {
        transactionId?: string;
        receiptId?: string | null;
        reference?: string;
    };
}

export interface ILedgerTransaction {
    id: string;
    date: Date;
    entries: Array<{
        account: string;
        amount: number;
    }>;
}

export interface ILedgerIntegrationService {
    recordEntry(entry: ILedgerEntry, correlationId: string): Promise<ILedgerTransaction>;
    getBalance(accountPath: string, clientId: string): Promise<number>;
    reverseEntry?(transactionId: string, correlationId: string): Promise<void>;
}

// ==================== AI/Classification Service ====================

export interface IClassificationResult {
    category: string;
    confidence: number;
}

export interface IGroqClassificationService {
    classifyLineItems(
        items: Array<{
            description: string;
            quantity: number;
            totalPrice: MoneyInt;
        }>,
        correlationId: string
    ): Promise<IClassificationResult[]>;

    classifyVendor(
        vendorName: string,
        correlationId: string
    ): Promise<IClassificationResult>;
}

// ==================== Anomaly Detection Service ====================

export interface IAnomalyResult {
    isAnomaly: boolean;
    score: number;
    reason?: string;
}

export interface IAnomalyDetectionService {
    detectAnomalies(
        receiptId: string,
        clientId: string,
        correlationId: string
    ): Promise<DetectionResult>;

    analyzeReceipt?(
        receipt: IReceipt,
        correlationId: string
    ): Promise<IAnomalyResult>;
}

// ==================== Storage Adapter ====================

export interface IStorageAdapter {
    upload(file: Buffer, fileName: string, mimeType: string): Promise<string>;
    download(url: string): Promise<Buffer>;
    delete(url: string): Promise<void>;
    exists(url: string): Promise<boolean>;
}

// ==================== OCR Service ====================

export interface IOcrService {
    processImage(
        imageBuffer: Buffer,
        correlationId: string
    ): Promise<IOcrResult>;

    supportsMimeType(mimeType: string): boolean;
}

// ==================== Statistical Analysis Service ====================

export interface IVendorStatistics {
    count: number;
    avgAmount: number;
    stdDev: number;
}

export interface IStatisticalAnalysisService {
    getVendorStatistics(
        vendor: string,
        clientId: string,
        lookbackDays: number
    ): Promise<IVendorStatistics | null>;

    calculateZScore(
        value: number,
        mean: number,
        stdDev: number
    ): number;
}

// ==================== Medicer Service ====================

export interface IMedicerService {
    postEntryWithClient(
        clientId: string,
        debitAccount: string,
        creditAccount: string,
        amount: number,
        description: string,
        session: unknown
    ): Promise<void>;

    getTrialBalance(
        clientId: string,
        session: unknown
    ): Promise<number>;
}
