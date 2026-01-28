import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import mongoose from 'mongoose';
import { AnomalyDetectionService } from '../../src/modules/anomaly/services/AnomalyDetectionService';
import Receipt from '../../src/models/Receipt.model';
import { Anomaly } from '../../src/modules/anomaly/models/Anomaly';
import { connect, disconnect, clearDatabase } from '../../src/tests/setup';

describe('AnomalyDetectionService', () => {
    let service: AnomalyDetectionService;
    const clientId = new mongoose.Types.ObjectId();

    beforeAll(async () => {
        await connect();
        service = new AnomalyDetectionService();
    });

    afterAll(async () => {
        await disconnect();
    });

    beforeEach(async () => {
        await clearDatabase();
        await Anomaly.deleteMany({});
        await Receipt.deleteMany({});
    });

    describe('Rule 1: Duplicate Detection', () => {
        test('should detect exact duplicate', async () => {
            // Create original receipt
            await Receipt.create({
                fileName: 'receipt1.jpg',
                fileHash: 'hash1',
                clientId,
                status: 'processed',
                extractedFields: {
                    vendor: '7-Eleven',
                    amountSatang: 12500,
                    issueDate: new Date('2026-01-27')
                }
            });

            // Create duplicate matching criteria
            const receipt2 = await Receipt.create({
                fileName: 'receipt2.jpg',
                fileHash: 'hash2',
                clientId,
                status: 'processed',
                extractedFields: {
                    vendor: '7-Eleven',
                    amountSatang: 12500,
                    issueDate: new Date('2026-01-27')
                }
            });

            // Need to cast to string for service method if it expects string
            const result = await service.detectAnomalies(
                receipt2._id.toString(),
                clientId.toString(),
                'test-correlation-id'
            );

            expect(result.hasAnomaly).toBe(true);
            const duplicate = result.anomalies.find(a => a.type === 'duplicate_exact');
            expect(duplicate).toBeDefined();
            expect(duplicate?.severity).toBe('critical');
        });

        test('should detect similar duplicate', async () => {
            await Receipt.create({
                fileName: 'receipt1.jpg',
                fileHash: 'hash1',
                clientId,
                status: 'processed',
                extractedFields: {
                    vendor: '7-Eleven',
                    amountSatang: 12500,
                    issueDate: new Date('2026-01-27')
                }
            });

            // Similar: amount +0.50 (50 satang), date +1 day
            const receipt2 = await Receipt.create({
                fileName: 'receipt2.jpg',
                fileHash: 'hash2',
                clientId,
                status: 'processed',
                extractedFields: {
                    vendor: '7-Eleven',
                    amountSatang: 12550,
                    issueDate: new Date('2026-01-28')
                }
            });

            const result = await service.detectAnomalies(
                receipt2._id.toString(),
                clientId.toString(),
                'test-correlation-id'
            );

            expect(result.hasAnomaly).toBe(true);
            expect(result.anomalies.some(a => a.type === 'duplicate_similar')).toBe(true);
        });
    });

    describe('Rule 2: Price Outlier', () => {
        test('should detect outlier when price > 3σ', async () => {
            // Create 10 normal receipts (100-150 baht)
            for (let i = 0; i < 10; i++) {
                await Receipt.create({
                    fileName: `receipt${i}.jpg`,
                    fileHash: `hash${i}`,
                    clientId,
                    status: 'processed',
                    extractedFields: {
                        vendor: '7-Eleven',
                        amountSatang: 10000 + Math.random() * 5000,
                        issueDate: new Date()
                    }
                });
            }

            // Create outlier (5,000 baht)
            const outlier = await Receipt.create({
                fileName: 'outlier.jpg',
                fileHash: 'hash-outlier',
                clientId,
                status: 'processed',
                extractedFields: {
                    vendor: '7-Eleven',
                    amountSatang: 500000,
                    issueDate: new Date()
                }
            });

            const result = await service.detectAnomalies(
                outlier._id.toString(),
                clientId.toString(),
                'test-correlation-id'
            );

            expect(result.hasAnomaly).toBe(true);
            expect(result.anomalies.some(a => a.type === 'price_outlier')).toBe(true);
        });
    });

    describe('Rule 3: New Vendor', () => {
        test('should flag first-time vendor', async () => {
            const receipt = await Receipt.create({
                fileName: 'receipt.jpg',
                fileHash: 'hash1',
                clientId,
                status: 'processed',
                extractedFields: {
                    vendor: 'Brand New Cafe',
                    amountSatang: 15000,
                    issueDate: new Date()
                }
            });

            const result = await service.detectAnomalies(
                receipt._id.toString(),
                clientId.toString(),
                'test-correlation-id'
            );

            expect(result.hasAnomaly).toBe(true);
            expect(result.anomalies.some(a => a.type === 'new_vendor')).toBe(true);
        });
    });

    describe('Rule 4: Unusual Timing', () => {
        test('should flag midnight transaction', async () => {
            const receipt = await Receipt.create({
                fileName: 'receipt.jpg',
                fileHash: 'hash1',
                clientId,
                status: 'processed',
                extractedFields: {
                    vendor: '7-Eleven',
                    amountSatang: 10000,
                    issueDate: new Date('2026-01-27T02:30:00')
                }
            });

            const result = await service.detectAnomalies(
                receipt._id.toString(),
                clientId.toString(),
                'test-correlation-id'
            );

            expect(result.hasAnomaly).toBe(true);
            expect(result.anomalies.some(a => a.type === 'unusual_timing')).toBe(true);
        });
    });

    describe('Rule 5: Category Inconsistency', () => {
        test('should flag category mismatch', async () => {
            // Create 5 receipts with consistent category
            for (let i = 0; i < 5; i++) {
                await Receipt.create({
                    fileName: `receipt${i}.jpg`,
                    fileHash: `hash${i}`,
                    clientId,
                    status: 'processed',
                    extractedFields: {
                        vendor: '7-Eleven',
                        amountSatang: 10000,
                        issueDate: new Date(),
                        category: '5100-Food'
                    }
                });
            }

            // Test with different category
            const testReceipt = await Receipt.create({
                fileName: 'test.jpg',
                fileHash: 'hash-test',
                clientId,
                status: 'processed',
                extractedFields: {
                    vendor: '7-Eleven',
                    amountSatang: 10000,
                    issueDate: new Date(),
                    category: '5800-IT'
                }
            });

            const result = await service.detectAnomalies(
                testReceipt._id.toString(),
                clientId.toString(),
                'test-correlation-id'
            );

            expect(result.hasAnomaly).toBe(true);
            expect(result.anomalies.some(a => a.type === 'category_inconsistency')).toBe(true);
        });
    });
});
