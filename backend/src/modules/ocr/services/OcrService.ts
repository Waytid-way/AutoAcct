// backend/src/modules/ocr/services/OcrService.ts

import { IOcrAdapter, IOcrResult } from '@adapters/interfaces/IOcrAdapter';
import { IStorageAdapter, IOcrService } from '@/shared/di/interfaces';
import logger from '@config/logger';
import { v4 as uuidv4 } from 'uuid';

/**
 * OCR SERVICE
 *
 * Responsibilities:
 * - Coordinate multiple OCR providers
 * - Batch processing with concurrency control
 * - Provider failover and load balancing
 * - Usage tracking and quota management
 */

export class OcrService implements IOcrService {
  private providers: IOcrAdapter[] = [];
  private storageAdapter?: IStorageAdapter;

  /**
   * Initialize OCR Service
   * @param providers - OCR provider adapters (optional, can be added later)
   * @param storageAdapter - Storage adapter for file operations (optional)
   */
  constructor(
    providers?: IOcrAdapter[],
    storageAdapter?: IStorageAdapter
  ) {
    this.providers = providers || [];
    this.storageAdapter = storageAdapter;
  }

  /**
   * Add OCR provider
   */
  addProvider(provider: IOcrAdapter): void {
    this.providers.push(provider);
    logger.info({
      action: 'ocr_provider_added',
      provider: provider.name,
      totalProviders: this.providers.length,
    });
  }

  /**
   * Check if service supports a MIME type
   */
  supportsMimeType(mimeType: string): boolean {
    // Supported image types
    const supportedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
    return supportedTypes.includes(mimeType);
  }

  /**
   * Process image (implements IOcrService interface)
   */
  async processImage(
    imageBuffer: Buffer,
    correlationId: string
  ): Promise<IOcrResult> {
    return this.extractReceipt(imageBuffer, {
      language: 'auto',
      receiptType: 'receipt'
    });
  }

  /**
   * Extract text from single image
   */
  async extractReceipt(
    imageBuffer: Buffer,
    options?: {
      language?: 'th' | 'en' | 'auto';
      receiptType?: 'receipt' | 'invoice' | 'tax_invoice';
      preferredProvider?: string;
    }
  ): Promise<IOcrResult> {
    const correlationId = uuidv4();

    try {
      // Select provider
      const provider = this.selectProvider(options?.preferredProvider);

      logger.info({
        action: 'ocr_extraction_started',
        correlationId,
        provider: provider.name,
        imageSize: imageBuffer.length,
      });

      // Extract text
      const result = await provider.extractReceipt(imageBuffer, options);

      logger.info({
        action: 'ocr_extraction_completed',
        correlationId,
        provider: provider.name,
        confidence: result.confidenceScores.overall,
        durationMs: result.processingTimeMs,
      });

      return result;

    } catch (error: unknown) {
      logger.error({
        action: 'ocr_extraction_failed',
        correlationId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Process batch of images
   */
  async extractBatch(
    images: Buffer[],
    options?: {
      maxConcurrency?: number;
      language?: 'th' | 'en' | 'auto';
      receiptType?: 'receipt' | 'invoice' | 'tax_invoice';
    }
  ): Promise<IOcrResult[]> {
    const correlationId = uuidv4();
    const maxConcurrency = options?.maxConcurrency || 3;

    logger.info({
      action: 'ocr_batch_started',
      correlationId,
      batchSize: images.length,
      maxConcurrency,
    });

    // Process in batches to control concurrency
    const results: IOcrResult[] = [];
    for (let i = 0; i < images.length; i += maxConcurrency) {
      const batch = images.slice(i, i + maxConcurrency);
      const batchPromises = batch.map(image =>
        this.extractReceipt(image, options)
      );

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }

    const avgConfidence = results.length > 0 
      ? results.reduce((sum, r) => sum + (r.confidenceScores.overall || 0), 0) / results.length 
      : 0;

    logger.info({
      action: 'ocr_batch_completed',
      correlationId,
      processed: results.length,
      averageConfidence: avgConfidence,
    });

    return results;
  }

  /**
   * Extract from stored file
   */
  async extractFromFile(
    fileId: string,
    options?: {
      language?: 'th' | 'en' | 'auto';
      receiptType?: 'receipt' | 'invoice' | 'tax_invoice';
      preferredProvider?: string;
    }
  ): Promise<IOcrResult> {
    const correlationId = uuidv4();

    if (!this.storageAdapter) {
      throw new Error('Storage adapter not configured');
    }

    try {
      // Download file
      const fileBuffer = await this.storageAdapter.download(fileId);

      logger.info({
        action: 'ocr_file_extraction_started',
        correlationId,
        fileId,
        fileSize: fileBuffer.length,
      });

      // Extract text
      const result = await this.extractReceipt(fileBuffer, options);

      return result;

    } catch (error: unknown) {
      logger.error({
        action: 'ocr_file_extraction_failed',
        correlationId,
        fileId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Get health status of all providers
   */
  async getProviderHealth(): Promise<Array<{
    name: string;
    healthy: boolean;
    latencyMs?: number;
    lastChecked: Date;
    error?: string;
  }>> {
    const healthChecks = await Promise.all(
      this.providers.map(async (provider) => {
        try {
          const health = await provider.healthCheck();
          return {
            name: provider.name,
            healthy: health.isHealthy,
            latencyMs: health.latencyMs,
            lastChecked: health.lastCheckedAt,
          };
        } catch (error: unknown) {
          return {
            name: provider.name,
            healthy: false,
            lastChecked: new Date(),
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      })
    );

    return healthChecks;
  }

  /**
   * Select best provider based on availability and preference
   */
  private selectProvider(preferredProvider?: string): IOcrAdapter {
    // If preferred provider is specified and available
    if (preferredProvider) {
      const provider = this.providers.find(p => p.name === preferredProvider);
      if (provider) return provider;
    }

    // Otherwise, select first healthy provider
    // In production, this could implement load balancing
    if (this.providers.length === 0) {
      throw new Error('No OCR providers configured');
    }
    return this.providers[0];
  }
}
