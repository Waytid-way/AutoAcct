import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import mongoose from 'mongoose';
import { Receipt } from '@models';

describe('Receipt Schema', () => {
  beforeAll(async () => {
    await mongoose.connect(process.env.MONGODB_TEST_URI!);
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });

  test('should auto-assign queue position', async () => {
    const receipt1 = await Receipt.create({
      fileName: 'test1.jpg',
      fileHash: 'hash1',
      clientId: new mongoose.Types.ObjectId(),
      status: 'queued_for_ocr',
    });

    const receipt2 = await Receipt.create({
      fileName: 'test2.jpg',
      fileHash: 'hash2',
      clientId: receipt1.clientId,
      status: 'queued_for_ocr',
    });

    expect(receipt1.queuePosition).toBe(1);
    expect(receipt2.queuePosition).toBe(2);
  });

  test('should validate MoneyInt', async () => {
    expect(async () => {
      await Receipt.create({
        fileName: 'test.jpg',
        fileHash: 'hash',
        clientId: new mongoose.Types.ObjectId(),
        extractedFields: {
          amountSatang: 12.5,  // ❌ Float not allowed
        },
      });
    }).toThrow();
  });
});