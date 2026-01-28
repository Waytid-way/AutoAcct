// backend/src/modules/receipt/services/__tests__/ReceiptService.test.ts

import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { ReceiptService } from '../ReceiptService';
import Receipt from '@/models/Receipt.model';
import { DuplicateReceiptError, NotFoundError } from '@/utils/errors';
import { Logger } from 'winston';
// Ensure setup runs
import '@/tests/setup';

describe('ReceiptService', () => {
    let service: ReceiptService;
    let mockLogger: any;

    beforeEach(() => {
        // Mock Logger
        mockLogger = {
            info: mock(),
            debug: mock(),
            warn: mock(),
            error: mock(),
        };

        // Inject mock logger
        service = new ReceiptService(mockLogger as Logger);
    });

    describe('uploadReceipt', () => {
        it('should upload receipt successfully', async () => {
            const file = Buffer.from('test file content');
            const fileName = 'invoice-001.pdf';
            const mimeType = 'application/pdf';
            const clientId = '507f1f77bcf86cd799439011'; // valid ObjectId
            const correlationId = 'corr-123';

            const receipt = await service.uploadReceipt(
                file,
                fileName,
                mimeType,
                clientId,
                correlationId
            );

            expect(receipt.fileName).toBe(fileName);
            expect(receipt.status).toBe('queued_for_ocr');
            expect(receipt.clientId.toString()).toBe(clientId);
            expect(receipt.fileHash).toBeDefined();
            expect(receipt.fileHash.length).toBe(64); // SHA-256
            expect(mockLogger.info).toHaveBeenCalled();
        });

        it('should throw DuplicateReceiptError for duplicate hash', async () => {
            const file = Buffer.from('duplicate file');
            const clientId = '507f1f77bcf86cd799439011';

            // Upload first time
            await service.uploadReceipt(
                file,
                'original.pdf',
                'application/pdf',
                clientId,
                'corr-1'
            );

            // Try upload same file again
            await expect(
                service.uploadReceipt(
                    file,
                    'duplicate.pdf',
                    'application/pdf',
                    clientId,
                    'corr-2'
                )
            ).rejects.toThrow(DuplicateReceiptError);
        });

        it('should allow same file for different clients', async () => {
            const file = Buffer.from('same content');

            const client1 = '507f1f77bcf86cd799439011';
            const client2 = '507f1f77bcf86cd799439012';

            // Upload for client 1
            const receipt1 = await service.uploadReceipt(
                file,
                'file.pdf',
                'application/pdf',
                client1,
                'corr-1'
            );

            // Upload same file for client 2
            const receipt2 = await service.uploadReceipt(
                file,
                'file.pdf',
                'application/pdf',
                client2,
                'corr-2'
            );

            expect(receipt1._id).not.toEqual(receipt2._id);
            expect(receipt1.fileHash).toBe(receipt2.fileHash);
            expect(receipt1.clientId.toString()).toBe(client1);
            expect(receipt2.clientId.toString()).toBe(client2);
        });
    });

    describe('getById', () => {
        it('should return receipt by id', async () => {
            const file = Buffer.from('test');
            const clientId = '507f1f77bcf86cd799439011';

            const created = await service.uploadReceipt(
                file,
                'test.pdf',
                'application/pdf',
                clientId,
                'corr-1'
            );

            const receipt = await service.getById(
                created._id.toString(),
                clientId,
                'corr-2'
            );

            expect(receipt._id.toString()).toBe(created._id.toString());
            expect(receipt.fileName).toBe('test.pdf');
        });

        it('should throw NotFoundError if receipt not found', async () => {
            const clientId = '507f1f77bcf86cd799439011';
            const fakeId = '507f1f77bcf86cd799439999';

            await expect(
                service.getById(fakeId, clientId, 'corr-1')
            ).rejects.toThrow(NotFoundError);
        });

        it('should throw NotFoundError for different client', async () => {
            const file = Buffer.from('test');
            const client1 = '507f1f77bcf86cd799439011';
            const client2 = '507f1f77bcf86cd799439012';

            const created = await service.uploadReceipt(
                file,
                'test.pdf',
                'application/pdf',
                client1,
                'corr-1'
            );

            // Try to access with different clientId
            await expect(
                service.getById(created._id.toString(), client2, 'corr-2')
            ).rejects.toThrow(NotFoundError);
        });
    });

    describe('getQueue', () => {
        const clientId = '507f1f77bcf86cd799439011';

        beforeEach(async () => {
            // Create 25 test receipts
            // We process sequentially to ensure predictable order
            for (let i = 0; i < 25; i++) {
                await service.uploadReceipt(
                    Buffer.from(`content-${i}`),
                    `file-${i}.pdf`,
                    'application/pdf',
                    clientId,
                    'corr-setup'
                );
                // Small delay to ensure createdAt differs
                await new Promise(r => setTimeout(r, 1));
            }
        });

        it('should paginate results', async () => {
            const result = await service.getQueue(
                { page: 1, perPage: 10 },
                clientId,
                'corr-1'
            );

            expect(result.data.length).toBe(10);
            expect(result.total).toBe(25);
        });

        it('should return correct page 2', async () => {
            const result = await service.getQueue(
                { page: 2, perPage: 10 },
                clientId,
                'corr-1'
            );

            expect(result.data.length).toBe(10);
            expect(result.total).toBe(25);
            // Ensure specific sorting (FIFO)
            expect(result.data[0].fileName).toBe('file-10.pdf');
        });

        it('should filter by status', async () => {
            // Mark 5 receipts as processed
            const receipts = await Receipt.find({ clientId }).limit(5);
            await Promise.all(
                receipts.map((r) =>
                    Receipt.updateOne({ _id: r._id }, { status: 'processed' })
                )
            );

            const result = await service.getQueue(
                { page: 1, perPage: 20, status: 'processed' },
                clientId,
                'corr-1'
            );

            expect(result.data.length).toBe(5);
            expect(result.data.every((r) => r.status === 'processed')).toBe(true);
        });
    });

    describe('getQueueStats', () => {
        const clientId = '507f1f77bcf86cd799439011';

        it('should return zero for empty queue', async () => {
            const stats = await service.getQueueStats(clientId, 'corr-1');

            expect(stats.queued).toBe(0);
            expect(stats.processing).toBe(0);
            expect(stats.failed).toBe(0);
            expect(stats.total).toBe(0);
        });

        it('should return correct counts', async () => {
            // Upload 2 receipts
            await service.uploadReceipt(
                Buffer.from('file1'),
                'file1.pdf',
                'application/pdf',
                clientId,
                'corr-1'
            );
            await service.uploadReceipt(
                Buffer.from('file2'),
                'file2.pdf',
                'application/pdf',
                clientId,
                'corr-2'
            );

            const stats = await service.getQueueStats(clientId, 'corr-3');

            expect(stats.queued).toBe(2);
            expect(stats.total).toBe(2);
        });
    });

    describe('submitFeedback', () => {
        const clientId = '507f1f77bcf86cd799439011';

        it('should update receipt with corrections', async () => {
            const file = Buffer.from('test');
            const created = await service.uploadReceipt(
                file,
                'test.pdf',
                'application/pdf',
                clientId,
                'corr-1'
            );

            const updated = await service.submitFeedback(
                created._id.toString(),
                {
                    corrections: {
                        amount: 10000,
                        vendor: 'Acme Corp',
                        date: new Date('2026-01-26'),
                    },
                    notes: 'User correction',
                },
                clientId,
                'corr-2',
                'user-456'
            );

            // Check feedback object structure (nested)
            expect(updated.feedback?.amountSatangCorrected).toBe(10000);
            expect(updated.feedback?.vendorCorrected).toBe('Acme Corp');
            expect(updated.feedback?.correctedBy?.toString()).toBe('user-456');
        });
    });
});
