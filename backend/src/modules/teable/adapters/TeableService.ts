// backend/src/modules/teable/adapters/TeableService.ts

import axios, { AxiosInstance } from 'axios';
import { ITeableService, TeableCreateRecordRequest } from '../types/teable.types';
import { ExternalServiceError } from '@/shared/errors';
import logger from '@/config/logger';

/**
 * TEABLE SERVICE - Production Implementation
 * Interact with real Teable API
 */
export class TeableService implements ITeableService {
    private axiosInstance: AxiosInstance;
    private baseUrl: string;
    private baseId: string;
    private tableId: string = 'Receipt'; // Configurable via constructor or env if needed
    private requestTimeout: number = 30000;

    constructor(baseUrl: string, apiKey: string, baseId: string, tableId?: string) {
        this.baseUrl = baseUrl;
        this.baseId = baseId;
        if (tableId) this.tableId = tableId;

        // Configure axios with Teable auth
        this.axiosInstance = axios.create({
            baseURL: `${baseUrl}/api/v1`,
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            timeout: this.requestTimeout,
        });
    }

    /**
     * Create a new receipt record in Teable Kanban board
     */
    async createRecord(
        req: TeableCreateRecordRequest,
        correlationId: string
    ): Promise<{ id: string }> {
        try {
            const payload = {
                records: [
                    {
                        fields: {
                            // Field mapping - matches PDF Spec
                            Vendor: req.vendor,
                            Amount: this.satangToBaht(req.amount),
                            Date: req.date.toISOString().split('T')[0],
                            TaxID: req.taxId || '',
                            OCRConfidence: parseFloat((req.ocrConfidence * 100).toFixed(2)),
                            Status: req.status,
                            ReceiptID: req.receiptId,
                            RawOCR: req.rawOcrText,
                            ImageAttachment: req.imageUrl ? [{ name: 'receipt', url: req.imageUrl }] : [],
                        },
                    },
                ],
            };

            const response = await this.axiosInstance.post(
                `/base/${this.baseId}/table/${this.tableId}/record`,
                payload
            );

            const teableId = response.data?.records?.[0]?.id;
            if (!teableId) {
                throw new Error('No record ID returned from Teable API');
            }

            logger.info({
                action: 'teable_record_created',
                correlationId,
                teableId
            });

            return { id: teableId };

        } catch (err: any) {
            logger.error({
                action: 'teable_create_failed',
                correlationId,
                error: err.message
            });
            throw new ExternalServiceError(
                'Teable',
                `Failed to create record: ${err.message}`,
                err.response?.status || 502
            );
        }
    }

    /**
     * Update an existing Teable record
     */
    async updateRecord(
        teableId: string,
        fields: Record<string, any>,
        correlationId: string
    ): Promise<void> {
        try {
            const payload = {
                records: [
                    {
                        id: teableId,
                        fields,
                    },
                ],
            };

            await this.axiosInstance.patch(
                `/base/${this.baseId}/table/${this.tableId}/record`,
                payload
            );

            logger.info({
                action: 'teable_record_updated',
                correlationId,
                teableId
            });

        } catch (err: any) {
            logger.error({
                action: 'teable_update_failed',
                correlationId,
                error: err.message
            });
            throw new ExternalServiceError(
                'Teable',
                `Failed to update record: ${err.message}`,
                err.response?.status || 502
            );
        }
    }

    /**
     * Attach image to Teable record
     */
    async attachImage(
        teableId: string,
        imageUrl: string,
        correlationId: string
    ): Promise<void> {
        try {
            await this.updateRecord(
                teableId,
                {
                    ImageAttachment: [{ url: imageUrl, name: 'receipt_image' }],
                },
                correlationId
            );
        } catch (err: any) {
            // Log but don't rethrow (non-critical)
            logger.warn({
                action: 'teable_image_attach_failed',
                correlationId,
                error: err.message
            });
        }
    }

    /**
     * Health Check
     */
    async health(): Promise<'healthy' | 'degraded' | 'down'> {
        try {
            // Just check if we can access the table metadata
            await this.axiosInstance.get(`/base/${this.baseId}/table/${this.tableId}`);
            return 'healthy';
        } catch (err) {
            return 'down';
        }
    }

    private satangToBaht(satang: number): number {
        return satang / 100;
    }
}
