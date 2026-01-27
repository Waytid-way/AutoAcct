import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import mongoose from 'mongoose';
import { Transaction } from '@models';
import { MockAccountingAdapter } from '@adapters/interfaces/IAccountingAdapter';

describe('Adapter Integration Tests', () => {
  let adapter: MockAccountingAdapter;

  beforeAll(async () => {
    await mongoose.connect(process.env.MONGODB_TEST_URI!);
    adapter = new MockAccountingAdapter();
    await adapter.initialize();
  });

  afterAll(async () => {
    await adapter.shutdown();
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });

  test('should export transaction to accounting system', async () => {
    // 1. Create transaction in DB
    const transaction = await Transaction.create({
      debitAccount: '5100-Food',
      creditAccount: '1010-Checking',
      amountSatang: 12500,
      description: 'Coffee expense',
      transactionDate: new Date(),
      clientId: new mongoose.Types.ObjectId(),
      status: 'posted',
    });

    // 2. Export via adapter
    const doc = await adapter.exportTransaction({
      transactionDate: transaction.transactionDate,
      debitAccount: transaction.debitAccount,
      creditAccount: transaction.creditAccount,
      amountSatang: transaction.amountSatang,
      description: transaction.description,
    });

    // 3. Verify
    expect(doc.documentId).toBeDefined();
    expect(doc.status).toBe('posted');

    // 4. Link back to transaction
    transaction.set('exportDocumentId', doc.documentId);
    await transaction.save();
  });

  test('should handle batch export', async () => {
    // Create multiple transactions
    const transactions = await Transaction.insertMany([
      {
        debitAccount: '5100-Food',
        creditAccount: '1010-Checking',
        amountSatang: 5000,
        description: 'Lunch',
        transactionDate: new Date(),
        clientId: new mongoose.Types.ObjectId(),
        status: 'posted',
      },
      {
        debitAccount: '5200-Transport',
        creditAccount: '1010-Checking',
        amountSatang: 3000,
        description: 'Taxi',
        transactionDate: new Date(),
        clientId: new mongoose.Types.ObjectId(),
        status: 'posted',
      },
    ]);

    // Batch export
    const docs = await adapter.exportBatch(
      transactions.map((t: any) => ({
        transactionDate: t.transactionDate,
        debitAccount: t.debitAccount,
        creditAccount: t.creditAccount,
        amountSatang: t.amountSatang,
        description: t.description,
      }))
    );

    // Verify
    expect(docs).toHaveLength(2);
    docs.forEach(doc => {
      expect(doc.documentId).toBeDefined();
      expect(doc.status).toBe('posted');
    });
  });

  test('should get document status', async () => {
    // Export first
    const doc = await adapter.exportTransaction({
      transactionDate: new Date(),
      debitAccount: '5100-Food',
      creditAccount: '1010-Checking',
      amountSatang: 10000,
      description: 'Test',
    });

    // Get status
    const status = await adapter.getDocumentStatus(doc.documentId);

    expect(status.documentId).toBe(doc.documentId);
    expect(status.status).toBe('posted');
  });

  test('should void document', async () => {
    // Export first
    const doc = await adapter.exportTransaction({
      transactionDate: new Date(),
      debitAccount: '5100-Food',
      creditAccount: '1010-Checking',
      amountSatang: 10000,
      description: 'Test void',
    });

    // Void it
    await adapter.voidDocument(doc.documentId, 'Test void');

    // Check status
    const updated = await adapter.getDocumentStatus(doc.documentId);
    expect(updated.status).toBe('voided');
  });

  test('should perform health check', async () => {
    const health = await adapter.healthCheck();

    expect(health.isHealthy).toBe(true);
    expect(health.latencyMs).toBeGreaterThan(0);
    expect(health.lastCheckedAt).toBeInstanceOf(Date);
  });
});