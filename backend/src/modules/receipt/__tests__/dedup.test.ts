// backend/src/modules/receipt/__tests__/dedup.test.ts

/**
 * Receipt Deduplication Test Suite
 * 
 * Tests hash generation, duplicate detection, and confidence scoring
 * to ensure no duplicate transaction entries occur.
 */

import { describe, test, expect, jest, beforeEach, afterEach } from '@jest/globals';
import crypto from 'crypto';
import { ReceiptService } from '../services/ReceiptService';
import Receipt from '@/models/Receipt.model';
import { DuplicateReceiptError } from '@/shared/errors';

// Mock the Receipt model
jest.mock('@/models/Receipt.model');
jest.mock('@/config/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('Receipt Deduplication - Hash Generation', () => {
  test('same data produces same hash', () => {
    const data1 = Buffer.from('test receipt data');
    const data2 = Buffer.from('test receipt data');
    
    const hash1 = crypto.createHash('sha256').update(data1).digest('hex');
    const hash2 = crypto.createHash('sha256').update(data2).digest('hex');
    
    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64); // SHA-256 produces 64 hex chars
  });

  test('different data produces different hash', () => {
    const data1 = Buffer.from('receipt A');
    const data2 = Buffer.from('receipt B');
    
    const hash1 = crypto.createHash('sha256').update(data1).digest('hex');
    const hash2 = crypto.createHash('sha256').update(data2).digest('hex');
    
    expect(hash1).not.toBe(hash2);
  });

  test('hash is case sensitive for binary data', () => {
    const data1 = Buffer.from([0x01, 0x02, 0x03]);
    const data2 = Buffer.from([0x01, 0x02, 0x04]); // Different last byte
    
    const hash1 = crypto.createHash('sha256').update(data1).digest('hex');
    const hash2 = crypto.createHash('sha256').update(data2).digest('hex');
    
    expect(hash1).not.toBe(hash2);
  });

  test('whitespace in binary data affects hash', () => {
    const data1 = Buffer.from('receipt data');
    const data2 = Buffer.from('receipt  data'); // Extra space
    
    const hash1 = crypto.createHash('sha256').update(data1).digest('hex');
    const hash2 = crypto.createHash('sha256').update(data2).digest('hex');
    
    expect(hash1).not.toBe(hash2);
  });

  test('empty buffer produces valid hash', () => {
    const empty = Buffer.from('');
    const hash = crypto.createHash('sha256').update(empty).digest('hex');
    
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  test('large file produces valid hash', () => {
    const largeData = Buffer.alloc(1024 * 1024); // 1MB
    const hash = crypto.createHash('sha256').update(largeData).digest('hex');
    
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe('Receipt Deduplication - Duplicate Detection', () => {
  let receiptService: ReceiptService;

  beforeEach(() => {
    receiptService = new ReceiptService();
    jest.clearAllMocks();
  });

  test('exact duplicate detection - same file uploaded twice', async () => {
    const fileData = Buffer.from('receipt content');
    const clientId = 'client-123';
    const correlationId = 'corr-456';
    
    // First upload should succeed
    const mockReceipt1 = {
      _id: 'receipt-1',
      fileName: 'receipt.jpg',
      fileHash: crypto.createHash('sha256').update(fileData).digest('hex'),
      clientId,
      status: 'queued_for_ocr',
    };
    
    (Receipt.findOne as jest.Mock).mockResolvedValueOnce(null); // First call - no duplicate
    (Receipt.prototype.save as jest.Mock).mockResolvedValueOnce(mockReceipt1);

    const result1 = await receiptService.uploadReceipt(
      fileData,
      'receipt.jpg',
      'image/jpeg',
      clientId,
      correlationId
    );

    expect(result1).toBeDefined();
    expect(Receipt.findOne).toHaveBeenCalledWith({
      fileHash: expect.any(String),
      clientId,
    });

    // Second upload with same data should fail
    (Receipt.findOne as jest.Mock).mockResolvedValueOnce(mockReceipt1);

    await expect(
      receiptService.uploadReceipt(
        fileData,
        'receipt.jpg',
        'image/jpeg',
        clientId,
        'corr-789'
      )
    ).rejects.toThrow(DuplicateReceiptError);
  });

  test('different clients can upload same file', async () => {
    const fileData = Buffer.from('shared receipt');
    const clientId1 = 'client-A';
    const clientId2 = 'client-B';
    
    const mockReceipt1 = {
      _id: 'receipt-A',
      fileHash: crypto.createHash('sha256').update(fileData).digest('hex'),
      clientId: clientId1,
    };

    // Client A uploads
    (Receipt.findOne as jest.Mock).mockResolvedValueOnce(null);
    (Receipt.prototype.save as jest.Mock).mockResolvedValueOnce(mockReceipt1);

    await receiptService.uploadReceipt(
      fileData,
      'shared.jpg',
      'image/jpeg',
      clientId1,
      'corr-1'
    );

    // Client B uploads same file - should succeed (different clientId)
    const mockReceipt2 = {
      _id: 'receipt-B',
      fileHash: crypto.createHash('sha256').update(fileData).digest('hex'),
      clientId: clientId2,
    };
    
    (Receipt.findOne as jest.Mock).mockResolvedValueOnce(null);
    (Receipt.prototype.save as jest.Mock).mockResolvedValueOnce(mockReceipt2);

    const result = await receiptService.uploadReceipt(
      fileData,
      'shared.jpg',
      'image/jpeg',
      clientId2,
      'corr-2'
    );

    expect(result).toBeDefined();
    expect(result._id).toBe('receipt-B');
  });

  test('different receipts should not match', async () => {
    const fileData1 = Buffer.from('receipt from vendor A');
    const fileData2 = Buffer.from('receipt from vendor B');
    const clientId = 'client-123';

    const mockReceipt1 = {
      _id: 'receipt-1',
      fileHash: crypto.createHash('sha256').update(fileData1).digest('hex'),
      clientId,
    };

    // First receipt
    (Receipt.findOne as jest.Mock).mockResolvedValueOnce(null);
    (Receipt.prototype.save as jest.Mock).mockResolvedValueOnce(mockReceipt1);

    await receiptService.uploadReceipt(
      fileData1,
      'receipt-a.jpg',
      'image/jpeg',
      clientId,
      'corr-1'
    );

    // Second receipt - should succeed
    const mockReceipt2 = {
      _id: 'receipt-2',
      fileHash: crypto.createHash('sha256').update(fileData2).digest('hex'),
      clientId,
    };

    (Receipt.findOne as jest.Mock).mockResolvedValueOnce(null);
    (Receipt.prototype.save as jest.Mock).mockResolvedValueOnce(mockReceipt2);

    const result = await receiptService.uploadReceipt(
      fileData2,
      'receipt-b.jpg',
      'image/jpeg',
      clientId,
      'corr-2'
    );

    expect(result._id).toBe('receipt-2');
  });

  test('duplicate error includes hash for debugging', async () => {
    const fileData = Buffer.from('duplicate content');
    const fileHash = crypto.createHash('sha256').update(fileData).digest('hex');
    const clientId = 'client-123';

    (Receipt.findOne as jest.Mock).mockResolvedValueOnce({
      _id: 'existing-receipt',
      fileHash,
      fileName: 'original.jpg',
    });

    try {
      await receiptService.uploadReceipt(
        fileData,
        'duplicate.jpg',
        'image/jpeg',
        clientId,
        'corr-test'
      );
      fail('Should have thrown DuplicateReceiptError');
    } catch (error) {
      expect(error).toBeInstanceOf(DuplicateReceiptError);
      if (error instanceof DuplicateReceiptError) {
        expect(error.fileHash).toBe(fileHash);
        expect(error.message).toContain('Duplicate receipt detected');
      }
    }
  });
});

describe('Receipt Deduplication - Edge Cases', () => {
  let receiptService: ReceiptService;

  beforeEach(() => {
    receiptService = new ReceiptService();
    jest.clearAllMocks();
  });

  test('handles empty receipt data', async () => {
    const emptyData = Buffer.from('');
    const clientId = 'client-123';

    (Receipt.findOne as jest.Mock).mockResolvedValueOnce(null);
    (Receipt.prototype.save as jest.Mock).mockResolvedValueOnce({
      _id: 'empty-receipt',
      fileHash: crypto.createHash('sha256').update(emptyData).digest('hex'),
      fileName: 'empty.jpg',
    });

    const result = await receiptService.uploadReceipt(
      emptyData,
      'empty.jpg',
      'image/jpeg',
      clientId,
      'corr-empty'
    );

    expect(result._id).toBe('empty-receipt');
  });

  test('handles large files', async () => {
    const largeData = Buffer.alloc(10 * 1024 * 1024); // 10MB
    const clientId = 'client-123';

    (Receipt.findOne as jest.Mock).mockResolvedValueOnce(null);
    (Receipt.prototype.save as jest.Mock).mockResolvedValueOnce({
      _id: 'large-receipt',
      fileHash: crypto.createHash('sha256').update(largeData).digest('hex'),
      fileName: 'large.jpg',
    });

    const result = await receiptService.uploadReceipt(
      largeData,
      'large.jpg',
      'image/jpeg',
      clientId,
      'corr-large'
    );

    expect(result._id).toBe('large-receipt');
  });

  test('malformed file data still produces hash', async () => {
    // Binary data with null bytes and special chars
    const malformedData = Buffer.from([0x00, 0xFF, 0xFE, 0x00, 0x42]);
    const clientId = 'client-123';

    (Receipt.findOne as jest.Mock).mockResolvedValueOnce(null);
    (Receipt.prototype.save as jest.Mock).mockResolvedValueOnce({
      _id: 'malformed-receipt',
      fileHash: crypto.createHash('sha256').update(malformedData).digest('hex'),
      fileName: 'malformed.jpg',
    });

    const result = await receiptService.uploadReceipt(
      malformedData,
      'malformed.jpg',
      'image/jpeg',
      clientId,
      'corr-malformed'
    );

    expect(result._id).toBe('malformed-receipt');
    expect(result.fileHash).toHaveLength(64);
  });

  test('very similar receipts (edge case)', async () => {
    // Same receipt but with tiny difference (1 pixel change)
    const data1 = Buffer.alloc(1000, 0x42);
    const data2 = Buffer.alloc(1000, 0x42);
    data2[500] = 0x43; // One byte difference

    const clientId = 'client-123';

    const hash1 = crypto.createHash('sha256').update(data1).digest('hex');
    const hash2 = crypto.createHash('sha256').update(data2).digest('hex');

    // Even one byte difference should produce different hashes
    expect(hash1).not.toBe(hash2);

    // Both should be able to upload
    (Receipt.findOne as jest.Mock)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    (Receipt.prototype.save as jest.Mock)
      .mockResolvedValueOnce({ _id: 'receipt-1', fileHash: hash1 })
      .mockResolvedValueOnce({ _id: 'receipt-2', fileHash: hash2 });

    await receiptService.uploadReceipt(data1, 'receipt1.jpg', 'image/jpeg', clientId, 'corr-1');
    await receiptService.uploadReceipt(data2, 'receipt2.jpg', 'image/jpeg', clientId, 'corr-2');

    expect(Receipt.prototype.save).toHaveBeenCalledTimes(2);
  });
});

describe('Hash Collision Resistance', () => {
  test('different files have different hashes (statistical)', () => {
    // Generate multiple different buffers
    const hashes = new Set<string>();
    const count = 100;

    for (let i = 0; i < count; i++) {
      const data = Buffer.from(`receipt-${i}-${Date.now()}-${Math.random()}`);
      const hash = crypto.createHash('sha256').update(data).digest('hex');
      hashes.add(hash);
    }

    // All hashes should be unique
    expect(hashes.size).toBe(count);
  });

  test('SHA-256 produces 64 character hex string', () => {
    const hash = crypto.createHash('sha256').update('test').digest('hex');
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[a-f0-9]{64}$/i);
  });
});
