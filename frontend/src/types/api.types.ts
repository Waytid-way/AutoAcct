/**
 * API Type Definitions
 * Generated from AutoAcct backend Phase 2.2
 */

// ============================================
// Receipt Types
// ============================================

export type Receipt = ReceiptDetailResponse["data"];

export interface LineItem {
    description: string;
    quantity: number;
    unitPrice: number;        // Satang
    totalPrice: number;       // Satang
    category?: string;        // User-selected or AI-suggested
    suggestedCategory?: string;  // ✅ AI suggestion
    aiConfidence?: number;    // ✅ 0.0 - 1.0
    aiReasoning?: string;     // ✅ "Food and beverage"
}

export type ReceiptStatus =
    | "queued"
    | "processing"
    | "processed"
    | "error";

export interface ReceiptUploadResponse {
    success: true;
    data: {
        receiptId: string;
        fileName: string;
        status: ReceiptStatus;
        queuePosition?: number;
    };
    meta: {
        correlationId: string;
        timestamp: string;
    };
}

export interface ExtractedFields {
    vendor: string | null;
    amount: number | null; // Satang (integer)
    date: string | null;    // ISO 8601
}

export interface ConfidenceScores {
    vendor: number;  // 0-1
    amount: number;  // 0-1
    overall: number; // 0-1
}

export interface Classification {
    category: string | null;
    confidence: number; // 0-1
}

export interface ReceiptDetailResponse {
    success: true;
    data: {
        id: string;
        fileName: string;
        status: ReceiptStatus;
        extractedFields: ExtractedFields;
        confidenceScores: ConfidenceScores;
        classification?: Classification;
        lineItems?: Array<{
            description: string;
            quantity: number;
            unitPrice: number;
            totalPrice: number;
            category?: string;
            suggestedCategory?: string;
            aiConfidence?: number;
            aiReasoning?: string;
        }>;
        teableCardUrl?: string;
        createdAt: string;
        updatedAt: string;
    };
    meta: {
        correlationId: string;
        timestamp: string;
    };
}

export interface ConfirmReceiptRequest {
    vendor?: string;
    amount?: number; // Satang
    date?: string;   // ISO 8601
    category?: string;

    // Split Transactions
    lineItems?: LineItem[];
    corrections?: {
        creditAccount?: string;
    };
}

export interface ConfirmReceiptResponse {
    success: true;
    data: {
        receiptId: string;
        transactionId: string;
        status: "draft";
    };
    meta: {
        correlationId: string;
        timestamp: string;
    };
}

// ============================================
// Error Response
// ============================================

export interface ErrorDetails {
    field?: string;
    code?: string;
    [key: string]: unknown;
}

export interface ErrorResponse {
    success: false;
    error: {
        code: string;
        message: string;
        details?: ErrorDetails;
        stack?: string; // Dev only
    };
    meta: {
        correlationId: string;
        timestamp: string;
    };
}

// ============================================
// API Response Union Type
// ============================================

export type ApiResponse<T> = T | ErrorResponse;

// ============================================
// Validation Types
// ============================================

export interface FileValidation {
    maxSize: number;
    acceptedTypes: string[];
    maxFiles: number;
}
