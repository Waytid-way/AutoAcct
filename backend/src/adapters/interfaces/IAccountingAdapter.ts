// backend/src/adapters/interfaces/IAccountingAdapter.ts

import { IAdapter, IAdapterConfig, IAdapterHealthCheck } from './IAdapter';

/**
 * ACCOUNTING SYSTEM ADAPTER
 *
 * Implementations:
 * - ExpressAccountingAdapter (production)
 * - MockAccountingAdapter (dev mode)
 */

export interface IAccountingDocument {
  documentId: string;
  documentNumber: string;
  status: 'draft' | 'posted' | 'voided';
  createdAt: Date;
}

export interface IAccountingExportRequest {
  transactionDate: Date;
  debitAccount: string;
  creditAccount: string;
  amountSatang: number;
  description: string;
  referenceNumber?: string;
}

export interface IAccountingAdapter extends IAdapter {
  /**
   * Export transaction to accounting system
   */
  exportTransaction(
    request: IAccountingExportRequest
  ): Promise<IAccountingDocument>;

  /**
   * Batch export (multiple transactions)
   */
  exportBatch(
    requests: IAccountingExportRequest[]
  ): Promise<IAccountingDocument[]>;

  /**
   * Get document status
   */
  getDocumentStatus(documentId: string): Promise<IAccountingDocument>;

  /**
   * Void document
   */
  voidDocument(documentId: string, reason: string): Promise<void>;
}

/**
 * MOCK ACCOUNTING ADAPTER (for DEV mode)
 */
export class MockAccountingAdapter implements IAccountingAdapter {
  readonly name = 'MockAccounting';
  readonly config: IAdapterConfig;
  private documents = new Map<string, IAccountingDocument>();

  constructor(config?: Partial<IAdapterConfig>) {
    this.config = {
      mode: 'dev',
      timeout: 1000,
      ...config,
    };
  }

  async initialize(): Promise<void> {
    console.log('[MockAccounting] Initialized (DEV mode)');
  }

  async healthCheck(): Promise<IAdapterHealthCheck> {
    return {
      isHealthy: true,
      latencyMs: 10,
      lastCheckedAt: new Date(),
    };
  }

  async shutdown(): Promise<void> {
    this.documents.clear();
  }

  async exportTransaction(
    request: IAccountingExportRequest
  ): Promise<IAccountingDocument> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 200));

    const doc: IAccountingDocument = {
      documentId: `DOC-${Date.now()}`,
      documentNumber: `JV-${Math.floor(Math.random() * 10000)}`,
      status: 'posted',
      createdAt: new Date(),
    };

    this.documents.set(doc.documentId, doc);

    console.log('[MockAccounting] Exported:', doc.documentNumber);
    return doc;
  }

  async exportBatch(requests: IAccountingExportRequest[]) {
    return Promise.all(requests.map(req => this.exportTransaction(req)));
  }

  async getDocumentStatus(documentId: string) {
    const doc = this.documents.get(documentId);
    if (!doc) throw new Error('Document not found');
    return doc;
  }

  async voidDocument(documentId: string, reason: string) {
    const doc = this.documents.get(documentId);
    if (!doc) throw new Error('Document not found');
    doc.status = 'voided';
  }
}