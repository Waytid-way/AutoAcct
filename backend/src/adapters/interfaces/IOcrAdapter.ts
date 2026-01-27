// backend/src/adapters/interfaces/IOcrAdapter.ts

import { IAdapter, IAdapterConfig, IAdapterHealthCheck } from './IAdapter';

/**
 * OCR ADAPTER INTERFACE
 *
 * Implementations:
 * - PaddleOcrAdapter (free, offline)
 * - GoogleVisionAdapter (paid, accurate)
 * - MockOcrAdapter (dev mode)
 */

export interface IOcrResult {
  ocrText: string;
  extractedFields: {
    vendor?: string;
    amountSatang?: number;
    issueDate?: Date;
    taxId?: string;
    documentNumber?: string;
  };
  confidenceScores: {
    vendor?: number;
    amount?: number;
    date?: number;
    overall?: number;
  };
  processingTimeMs: number;
}

export interface IOcrAdapter extends IAdapter {
  /**
   * Extract text and fields from image/PDF
   */
  extractReceipt(
    imageBuffer: Buffer,
    options?: {
      language?: 'th' | 'en' | 'auto';
      receiptType?: 'receipt' | 'invoice' | 'tax_invoice';
    }
  ): Promise<IOcrResult>;

  /**
   * Batch processing (multiple receipts)
   */
  extractBatch(
    images: Buffer[],
    options?: { maxConcurrency?: number }
  ): Promise<IOcrResult[]>;

  /**
   * Get current quota usage (for Google Vision)
   */
  getQuotaUsage?(): Promise<{
    used: number;
    limit: number;
    resetAt: Date;
  }>;
}

/**
 * MOCK OCR ADAPTER (for DEV mode)
 */
export class MockOcrAdapter implements IOcrAdapter {
  readonly name = 'MockOCR';
  readonly config: IAdapterConfig;

  constructor(config?: Partial<IAdapterConfig>) {
    this.config = {
      mode: 'dev',
      timeout: 1000,
      ...config,
    };
  }

  async initialize(): Promise<void> {
    // No-op for mock
  }

  async healthCheck(): Promise<IAdapterHealthCheck> {
    return {
      isHealthy: true,
      latencyMs: 0,
      lastCheckedAt: new Date(),
    };
  }

  async shutdown(): Promise<void> {
    // No-op
  }

  async extractReceipt(imageBuffer: Buffer): Promise<IOcrResult> {
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 500));

    return {
      ocrText: 'COFFEE SHOP\nTotal: 125.00 THB\nDate: 22/01/2026',
      extractedFields: {
        vendor: 'Coffee Shop',
        amountSatang: 12500,
        issueDate: new Date('2026-01-22'),
      },
      confidenceScores: {
        vendor: 0.95,
        amount: 0.98,
        date: 0.92,
        overall: 0.95,
      },
      processingTimeMs: 500,
    };
  }

  async extractBatch(images: Buffer[]): Promise<IOcrResult[]> {
    return Promise.all(images.map(img => this.extractReceipt(img)));
  }
}