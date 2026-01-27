/**
 * API Type Definitions
 * Generated from AutoAcct backend Phase 2.2
 */

// ============================================
// Receipt Types
// ============================================

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
            suggestedCategory?: string;
            aiConfidence?: number;
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
    vendor: string;
    amount: number; // Satang
    date: string;   // ISO 8601
    category?: string;
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

export interface ErrorResponse {
    success: false;
    error: {
        code: string;
        message: string;
        details?: any;
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
