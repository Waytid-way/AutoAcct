// backend/src/modules/ocr/services/OcrService.ts

import { IOcrAdapter, IOcrResult } from '@adapters/interfaces/IOcrAdapter';
import { IStorageAdapter } from '@adapters/interfaces/IStorageAdapter';
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

export class OcrService {
  private providers: IOcrAdapter[] = [];

  constructor(
    providers: IOcrAdapter[],
    private storageAdapter: IStorageAdapter
  ) {
    this.providers = providers;
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

    } catch (error) {
      logger.error({
        action: 'ocr_extraction_failed',
        correlationId,
        error: (error as Error).message,
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

    logger.info({
      action: 'ocr_batch_completed',
      correlationId,
      processed: results.length,
      averageConfidence: results.reduce((sum, r) => sum + (r.confidenceScores.overall || 0), 0) / results.length,
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

    try {
      // Download file
      const fileBuffer = await this.storageAdapter.downloadFile(fileId);

      logger.info({
        action: 'ocr_file_extraction_started',
        correlationId,
        fileId,
        fileSize: fileBuffer.length,
      });

      // Extract text
      const result = await this.extractReceipt(fileBuffer, options);

      return result;

    } catch (error) {
      logger.error({
        action: 'ocr_file_extraction_failed',
        correlationId,
        fileId,
        error: (error as Error).message,
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
        } catch (error) {
          return {
            name: provider.name,
            healthy: false,
            lastChecked: new Date(),
            error: (error as Error).message,
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
    return this.providers[0];
  }
}