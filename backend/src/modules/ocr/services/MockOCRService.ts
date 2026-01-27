// backend/src/modules/ocr/services/MockOCRService.ts

import { OCRResult } from '../types/ocr.types';
import { ExternalServiceError } from '@/shared/errors';
import logger from '@/config/logger';

/**
 * MOCK OCR SERVICE
 * 
 * For Development/Testing.
 * Returns static data simulating a successful OCR scan.
 */
export class MockOCRService {
    async processImage(
        imageUrl: string,
        correlationId: string
    ): Promise<OCRResult> {
        logger.info({
            action: 'mock_ocr_start',
            correlationId,
            imageUrl: imageUrl.substring(0, 50) + '...'
        });

        // Simulate delay
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Return dummy result
        return {
            vendor: "Mock Coffee Shop",
            amount: 15000, // 150.00 THB
            date: new Date(),
            taxId: "1234567890123",
            rawText: "MOCK RECEIPT\nMock Coffee Shop\nDate: 2026-01-01\nTotal: 150.00",
            confidenceScores: {
                vendor: 0.95,
                amount: 0.99,
                date: 0.9,
                overall: 0.95
            },
            extractionDuration: 1000
        };
    }
}
