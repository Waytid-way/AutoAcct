// backend/src/modules/teable/adapters/MockTeableService.ts

import { ITeableService, TeableCreateRecordRequest, TeableRecord } from '../types/teable.types';
import logger from '@/config/logger';

/**
 * MockTeableService: Dev/Testing implementation
 * Instant results (no network delay)
 * Deterministic output
 * In-memory storage (auto-expires after session)
 */
export class MockTeableService implements ITeableService {
    private records: Map<string, TeableRecord> = new Map();
    private recordCounter: number = 0;
    private name = 'MockTeable';

    async createRecord(
        req: TeableCreateRecordRequest,
        correlationId: string
    ): Promise<{ id: string }> {
        // Generate predictable mock ID
        const teableId = `tbl_${++this.recordCounter}_${Date.now()}`;

        const mockRecord: TeableRecord = {
            id: teableId,
            fields: {
                Vendor: req.vendor,
                Amount: req.amount / 100, // Satang to Baht
                Date: req.date.toISOString().split('T')[0],
                TaxID: req.taxId || '',
                OCRConfidence: parseFloat((req.ocrConfidence * 100).toFixed(2)),
                Status: req.status,
                ReceiptID: req.receiptId,
                RawOCR: req.rawOcrText.substring(0, 100) + '...', // Truncate for logging
            },
            createdTime: new Date().toISOString(),
        };

        // Store in memory
        this.records.set(teableId, mockRecord);

        logger.info({
            action: 'teable_record_created_mock',
            correlationId,
            teableId,
            status: req.status
        });

        return { id: teableId };
    }

    async updateRecord(
        teableId: string,
        fields: Record<string, any>,
        correlationId: string
    ): Promise<void> {
        const record = this.records.get(teableId);
        if (!record) {
            logger.warn({
                action: 'teable_record_not_found_mock',
                correlationId,
                teableId
            });
            return;
        }

        record.fields = { ...record.fields, ...fields };
        record.updatedTime = new Date().toISOString();

        logger.info({
            action: 'teable_record_updated_mock',
            correlationId,
            teableId
        });
    }

    async attachImage(
        teableId: string,
        imageUrl: string,
        correlationId: string
    ): Promise<void> {
        const record = this.records.get(teableId);
        if (!record) {
            return;
        }

        record.fields.ImageAttachment = [{ url: imageUrl, name: 'receipt' }];

        logger.info({
            action: 'teable_image_attached_mock',
            correlationId,
            teableId,
            imageUrl
        });
    }

    async health(): Promise<'healthy' | 'degraded' | 'down'> {
        return 'healthy';
    }

    // ===== Testing Helpers =====

    getRecord(teableId: string): TeableRecord | undefined {
        return this.records.get(teableId);
    }

    clear(): void {
        this.records.clear();
        this.recordCounter = 0;
    }
}
