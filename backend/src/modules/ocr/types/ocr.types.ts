// backend/src/modules/ocr/types/ocr.types.ts

import { MoneyInt } from '@/utils/validators/common.validators';

/**
 * OCR RESULT (Core Output)
 * Contains both structured data and raw AI output/scoring.
 */
export type OCRResult = {
    vendor?: string;              // e.g., "STARBUCKS BANGKOK 456"
    amount?: number;              // MoneyInt (Satang)
    date?: Date;                  // e.g., 2026-01-26
    taxId?: string;               // e.g., "0123456789012"

    // Full Pipeline Specific
    rawText?: string;             // Full OCR text from Groq Vision
    extractionDuration?: number;  // ms, for metrics

    confidenceScores?: {
        vendor?: number;            // 0-1
        amount?: number;
        date?: number;
        overall?: number;           // Average of above
    };

    // Task 3E: Line Items
    lineItems?: {
        description: string;
        quantity: number;
        unitPrice: number;    // Satang
        totalPrice: number;   // Satang
    }[];
};

export type OCRJobStatus = 'queued' | 'processing' | 'complete' | 'failed' | 'needs_manual';

export type OCRJobResult = {
    jobId: string;
    receiptId: string;
    status: OCRJobStatus;
    result?: OCRResult;
    error?: string;
    createdAt: Date;
    completedAt?: Date;
    processingTime?: number;      // ms
};

// Parsed JSON from Step 2 (GroqPromptService)
export type ParsedOCRFields = {
    vendor?: string;
    amount?: string;     // "125.50" (in Baht, string format)
    date?: string;       // "2026-01-26"
    taxId?: string;
    items?: {            // Task 3E: Raw extracted items
        description: string;
        quantity?: number;
        total_price?: string; // "50.00"
    }[];
};
