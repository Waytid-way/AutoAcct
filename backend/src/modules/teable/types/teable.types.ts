// backend/src/modules/teable/types/teable.types.ts

/**
 * Teable Record Structure
 * Represents a single Teable record (card on Kanban board)
 */
export type TeableRecord = {
    id?: string; // Teable-assigned record ID
    fields: Record<string, any>; // Dynamic field values
    createdTime?: string;
    updatedTime?: string;
};

/**
 * Request to create a Teable record from OCR result
 * Used by WorkflowService after OCR completes
 */
export type TeableCreateRecordRequest = {
    receiptId: string;        // MongoDB Receipt ID
    vendor: string;           // From OCR
    amount: number;           // In Satang (MoneyInt)
    date: Date;               // Receipt date
    taxId?: string;           // Tax ID if present
    ocrConfidence: number;    // 0-1 confidence score
    rawOcrText: string;       // Full OCR output (audit trail)
    imageUrl?: string;        // Drive file ID or URL
    status: 'pending' | 'approved' | 'rejected' | 'needs_review';
};

/**
 * Teable Service Interface - Adapter Pattern
 */
export interface ITeableService {
    /**
     * Create a new record in Teable
     * Returns Teable-assigned record ID
     */
    createRecord(
        req: TeableCreateRecordRequest,
        correlationId: string
    ): Promise<{ id: string }>;

    /**
     * Update an existing Teable record
     */
    updateRecord(
        teableId: string,
        fields: Record<string, any>,
        correlationId: string
    ): Promise<void>;

    /**
     * Attach image to Teable record
     */
    attachImage(
        teableId: string,
        imageUrl: string,
        correlationId: string
    ): Promise<void>;

    /**
     * Health check - verify Teable API connectivity
     */
    health(): Promise<'healthy' | 'degraded' | 'down'>;
}
