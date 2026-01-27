import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import mongoose from 'mongoose';
import { Receipt, Transaction } from '@models';
import { ReceiptService } from '@modules/receipt/services/ReceiptService';

describe('Receipt → Transaction Workflow', () => {
  let receiptService: ReceiptService;

  beforeAll(async () => {
    await mongoose.connect(process.env.MONGODB_TEST_URI!);
    receiptService = new ReceiptService();
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });

  test('complete workflow: upload → OCR → confirm → transaction', async () => {
    const clientId = new mongoose.Types.ObjectId();

    // 1. Upload receipt
    const receipt = await receiptService.createReceipt({
      fileName: 'coffee.jpg',
      fileHash: 'abc123',
      clientId: clientId.toString(),
    });

    expect(receipt.status).toBe('queued_for_ocr');

    // 2. Simulate OCR processing
    receipt.ocrText = 'Coffee Shop\nTotal: 125.00';
    receipt.extractedFields = {
      vendor: 'Coffee Shop',
      amountSatang: 12500,
      issueDate: new Date('2026-01-22'),
    };
    receipt.status = 'processed';
    await receipt.save();

    // 3. User confirms → create transaction
    const transaction = await Transaction.create({
      debitAccount: '5100-Food',
      creditAccount: '1010-Checking',
      amountSatang: receipt.extractedFields.amountSatang,
      description: `Coffee from ${receipt.extractedFields.vendor}`,
      receiptId: receipt._id,
      transactionDate: receipt.extractedFields.issueDate,
      clientId,
      status: 'draft',
    });

    // 4. Link back to receipt
    receipt.transactionId = transaction._id;
    receipt.status = 'confirmed';
    await receipt.save();

    // Verify
    expect(transaction.amountSatang).toBe(12500);
    expect(receipt.transactionId).toEqual(transaction._id);
  });
});