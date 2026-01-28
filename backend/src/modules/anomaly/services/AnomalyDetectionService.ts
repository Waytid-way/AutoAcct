import Receipt from '../../../models/Receipt.model';
import { Anomaly, IAnomalyContext, AnomalyType } from '../models/Anomaly';
import logger from '../../../config/logger';
import { StatisticalAnalysisService } from './StatisticalAnalysisService';

interface DetectionResult {
    hasAnomaly: boolean;
    anomalies: Array<{
        type: AnomalyType;
        severity: 'info' | 'warning' | 'critical';
        confidence: number;
        title: string;
        message: string;
        suggestion: string;
        context: IAnomalyContext;
    }>;
}

export class AnomalyDetectionService {
    private readonly LOOKBACK_DAYS = 90;  // 3 months historical data
    private readonly OUTLIER_THRESHOLD = 3; // 3 standard deviations
    private statisticalService: StatisticalAnalysisService;

    constructor(statisticalService?: StatisticalAnalysisService) {
        this.statisticalService = statisticalService || new StatisticalAnalysisService();
    }

    /**
     * ✅ MAIN METHOD: Detect all anomalies for a receipt
     * 
     * @param receiptId - Receipt to analyze
     * @param clientId - Client identifier
     * @param correlationId - Trace ID
     * @returns Detection results with all flagged anomalies
     */
    async detectAnomalies(
        receiptId: string,
        clientId: string,
        correlationId: string
    ): Promise<DetectionResult> {
        try {
            logger.debug({
                correlationId,
                action: 'anomaly_detection_start',
                receiptId
            });

            const receipt = await Receipt.findOne({ _id: receiptId, clientId });

            if (!receipt) {
                throw new Error(`Receipt not found: ${receiptId}`);
            }

            const anomalies: DetectionResult['anomalies'] = [];

            // ✅ Rule 1: Duplicate detection
            const duplicates = await this.detectDuplicates(receipt, clientId, correlationId);
            anomalies.push(...duplicates);

            // ✅ Rule 2: Price outlier detection
            const outliers = await this.detectPriceOutliers(receipt, clientId, correlationId);
            anomalies.push(...outliers);

            // ✅ Rule 3: New vendor detection
            const newVendor = await this.detectNewVendor(receipt, clientId, correlationId);
            if (newVendor) anomalies.push(newVendor);

            // ✅ Rule 4: Unusual timing
            const timing = await this.detectUnusualTiming(receipt, clientId, correlationId);
            if (timing) anomalies.push(timing);

            // ✅ Rule 5: Category inconsistency
            const category = await this.detectCategoryInconsistency(receipt, clientId, correlationId);
            if (category) anomalies.push(category);

            // ✅ Persist anomalies to database
            if (anomalies.length > 0) {
                await this.persistAnomalies(anomalies, receiptId, clientId, correlationId);
            }

            logger.info({
                correlationId,
                action: 'anomaly_detection_complete',
                receiptId,
                anomalyCount: anomalies.length,
                types: anomalies.map(a => a.type)
            });

            return {
                hasAnomaly: anomalies.length > 0,
                anomalies
            };

        } catch (error: any) {
            logger.error({
                correlationId,
                action: 'anomaly_detection_failed',
                receiptId,
                error: error.message,
                stack: error.stack
            });

            // ✅ Fail gracefully: return no anomalies on error
            return {
                hasAnomaly: false,
                anomalies: []
            };
        }
    }

    /**
     * ✅ RULE 1: Detect duplicate receipts
     */
    private async detectDuplicates(
        receipt: any,
        clientId: string,
        correlationId: string
    ): Promise<DetectionResult['anomalies']> {
        const anomalies: DetectionResult['anomalies'] = [];

        if (!receipt.extractedFields?.vendor || !receipt.extractedFields?.amount) {
            return anomalies;
        }

        const { vendor, amount, date } = receipt.extractedFields;
        const safeDate = date ? new Date(date) : new Date();

        // ✅ Check 1: Exact duplicate (same vendor, amount, date)
        const exactDuplicates = await Receipt.find({
            _id: { $ne: receipt._id },
            clientId,
            'extractedFields.vendor': vendor,
            'extractedFields.amount': amount,
            'extractedFields.date': {
                $gte: new Date(new Date(safeDate).setHours(0, 0, 0, 0)),
                $lte: new Date(new Date(safeDate).setHours(23, 59, 59, 999))
            },
            status: { $in: ['processed', 'confirmed'] }
        }).limit(5);

        if (exactDuplicates.length > 0) {
            anomalies.push({
                type: 'duplicate_exact',
                severity: 'critical',
                confidence: 1.0,
                title: 'Exact Duplicate Detected',
                message: `Found ${exactDuplicates.length} receipt(s) with same vendor, amount, and date`,
                suggestion: `Review receipt(s): ${exactDuplicates.map(d => d._id).join(', ')}`,
                context: {
                    receiptId: receipt._id.toString(),
                    relatedIds: exactDuplicates.map(d => d._id.toString()),
                    vendorName: vendor,
                    actualValue: amount
                }
            });
        }

        // ✅ Check 2: Similar duplicate (same vendor, amount within ±฿1, within 3 days)
        const similarDuplicates = await Receipt.find({
            _id: { $ne: receipt._id },
            clientId,
            'extractedFields.vendor': vendor,
            'extractedFields.amount': {
                $gte: amount - 100,  // ±฿1.00
                $lte: amount + 100
            },
            'extractedFields.date': {
                $gte: new Date(safeDate.getTime() - 3 * 24 * 60 * 60 * 1000),  // 3 days before
                $lte: new Date(safeDate.getTime() + 3 * 24 * 60 * 60 * 1000)   // 3 days after
            },
            status: { $in: ['processed', 'confirmed'] }
        }).limit(5);

        if (similarDuplicates.length > 0) {
            // Filter out exact duplicates if they were already caught
            const exactIds = new Set(exactDuplicates.map(d => d._id.toString()));
            const uniqueSimilars = similarDuplicates.filter(d => !exactIds.has(d._id.toString()));

            if (uniqueSimilars.length > 0) {
                anomalies.push({
                    type: 'duplicate_similar',
                    severity: 'warning',
                    confidence: 0.85,
                    title: 'Similar Receipt Found',
                    message: `Found ${uniqueSimilars.length} similar receipt(s) (same vendor, amount within ±฿1, within 3 days)`,
                    suggestion: `Verify if these are separate transactions`,
                    context: {
                        receiptId: receipt._id.toString(),
                        relatedIds: uniqueSimilars.map(d => d._id.toString()),
                        vendorName: vendor,
                        actualValue: amount
                    }
                });
            }
        }

        logger.debug({
            correlationId,
            action: 'duplicate_check_complete',
            exact: exactDuplicates.length,
            similar: similarDuplicates.length
        });

        return anomalies;
    }

    /**
     * ✅ RULE 2: Detect price outliers using 3-sigma rule
     */
    private async detectPriceOutliers(
        receipt: any,
        clientId: string,
        correlationId: string
    ): Promise<DetectionResult['anomalies']> {
        const anomalies: DetectionResult['anomalies'] = [];

        if (!receipt.extractedFields?.vendor || !receipt.extractedFields?.amount) {
            return anomalies;
        }

        const { vendor, amount } = receipt.extractedFields;

        // ✅ Get historical data using Statistical Service (Cached)
        const stats = await this.statisticalService.getVendorStatistics(vendor, clientId, this.LOOKBACK_DAYS);

        if (!stats || stats.count < 5) {
            // Not enough data for statistical analysis
            logger.debug({
                correlationId,
                action: 'outlier_check_skipped',
                reason: 'insufficient_data',
                count: stats?.count || 0
            });
            return anomalies;
        }

        const avg = stats.avgAmount;
        const stdDev = stats.stdDev;

        if (stdDev === 0) return anomalies; // No variance

        const zScore = this.statisticalService.calculateZScore(amount, avg, stdDev);

        // ✅ Flag if beyond 3 standard deviations (99.7% confidence)
        if (zScore > this.OUTLIER_THRESHOLD) {
            const isHigher = amount > avg;
            const percentDiff = ((amount - avg) / avg * 100).toFixed(0);

            anomalies.push({
                type: 'price_outlier',
                severity: 'warning',
                confidence: Math.min(0.95, zScore / 5),  // Cap at 0.95
                title: `Unusual ${isHigher ? 'High' : 'Low'} Price`,
                message: `${vendor}: ฿${(amount / 100).toFixed(2)} is ${percentDiff}% ${isHigher ? 'above' : 'below'} average`,
                suggestion: `Typical: ฿${(avg / 100).toFixed(2)} ± ฿${(stdDev / 100).toFixed(2)}. Verify if correct.`,
                context: {
                    receiptId: receipt._id.toString(),
                    vendorName: vendor,
                    actualValue: amount,
                    expectedValue: Math.round(avg),
                    historicalAverage: Math.round(avg),
                    standardDeviation: Math.round(stdDev)
                }
            });
        }

        logger.debug({
            correlationId,
            action: 'outlier_check_complete',
            zScore: zScore.toFixed(2),
            isOutlier: zScore > this.OUTLIER_THRESHOLD
        });

        return anomalies;
    }

    /**
     * ✅ RULE 3: Detect new vendors (first-time appearance)
     */
    private async detectNewVendor(
        receipt: any,
        clientId: string,
        correlationId: string
    ): Promise<DetectionResult['anomalies'][0] | null> {
        if (!receipt.extractedFields?.vendor) {
            return null;
        }

        const { vendor } = receipt.extractedFields;

        // Check if this vendor has been seen before
        const existingVendorCount = await Receipt.countDocuments({
            _id: { $ne: receipt._id },
            clientId,
            'extractedFields.vendor': vendor,
            status: { $in: ['processed', 'confirmed'] }
        });

        if (existingVendorCount === 0) {
            logger.debug({
                correlationId,
                action: 'new_vendor_detected',
                vendor
            });

            return {
                type: 'new_vendor',
                severity: 'info',
                confidence: 1.0,
                title: 'New Vendor',
                message: `First time seeing vendor: ${vendor}`,
                suggestion: 'Verify vendor name and category are correct',
                context: {
                    receiptId: receipt._id.toString(),
                    vendorName: vendor
                }
            };
        }

        return null;
    }

    /**
     * ✅ RULE 4: Detect unusual timing (e.g., midnight transactions)
     */
    private async detectUnusualTiming(
        receipt: any,
        clientId: string,
        correlationId: string
    ): Promise<DetectionResult['anomalies'][0] | null> {
        if (!receipt.extractedFields?.date) {
            return null;
        }

        const date = new Date(receipt.extractedFields.date);
        const hour = date.getHours();

        // ✅ Flag transactions between midnight and 5am (unusual for retail)
        if (hour >= 0 && hour < 5) {
            logger.debug({
                correlationId,
                action: 'unusual_timing_detected',
                hour
            });

            return {
                type: 'unusual_timing',
                severity: 'warning',
                confidence: 0.70,
                title: 'Unusual Transaction Time',
                message: `Receipt dated at ${hour}:00 (between midnight and 5am)`,
                suggestion: 'Verify if timestamp is correct',
                context: {
                    receiptId: receipt._id.toString(),
                    vendorName: receipt.extractedFields?.vendor
                }
            };
        }

        return null;
    }

    /**
     * ✅ RULE 5: Detect category inconsistency (vendor usually in different category)
     */
    private async detectCategoryInconsistency(
        receipt: any,
        clientId: string,
        correlationId: string
    ): Promise<DetectionResult['anomalies'][0] | null> {
        // Check if we have a category to check against
        const category = receipt.extractedFields?.category || receipt.classification?.category;

        if (!receipt.extractedFields?.vendor || !category) {
            return null;
        }

        const { vendor } = receipt.extractedFields;

        // ✅ Get most common category for this vendor
        const historicalCategories = await Receipt.aggregate([
            {
                $match: {
                    _id: { $ne: receipt._id },
                    clientId,
                    'extractedFields.vendor': vendor,
                    $or: [
                        { 'extractedFields.category': { $exists: true, $ne: null } },
                        { 'classification.category': { $exists: true, $ne: null } }
                    ],
                    status: { $in: ['processed', 'confirmed'] }
                }
            },
            {
                $project: {
                    category: { $ifNull: ["$extractedFields.category", "$classification.category"] }
                }
            },
            {
                $group: {
                    _id: '$category',
                    count: { $sum: 1 }
                }
            },
            {
                $sort: { count: -1 }
            },
            {
                $limit: 1
            }
        ]);

        if (historicalCategories.length > 0) {
            const mostCommonCategory = historicalCategories[0]._id;
            const count = historicalCategories[0].count;

            // ✅ Flag if current category differs from historical pattern (with 5+ samples)
            if (mostCommonCategory !== category && count >= 5) {
                logger.debug({
                    correlationId,
                    action: 'category_inconsistency_detected',
                    vendor,
                    currentCategory: category,
                    expectedCategory: mostCommonCategory
                });

                return {
                    type: 'category_inconsistency',
                    severity: 'warning',
                    confidence: 0.75,
                    title: 'Unusual Category',
                    message: `${vendor} usually categorized as ${mostCommonCategory}, but this is ${category}`,
                    suggestion: `Verify category. Historical: ${mostCommonCategory} (${count} receipts)`,
                    context: {
                        receiptId: receipt._id.toString(),
                        vendorName: vendor,
                        category,
                        expectedValue: mostCommonCategory
                    }
                };
            }
        }

        return null;
    }

    /**
     * ✅ Persist detected anomalies to database
     */
    private async persistAnomalies(
        anomalies: DetectionResult['anomalies'],
        receiptId: string,
        clientId: string,
        correlationId: string
    ): Promise<void> {
        const docs = anomalies.map(anomaly => ({
            ...anomaly,
            clientId,
            correlationId,
            detectedAt: new Date(),
            status: 'pending',
            context: {
                ...anomaly.context,
                receiptId // Ensure receiptId is always set
            }
        }));

        await Anomaly.insertMany(docs);

        logger.info({
            correlationId,
            action: 'anomalies_persisted',
            receiptId,
            count: docs.length
        });
    }

    /**
     * ✅ Get all pending anomalies for client
     */
    async getPendingAnomalies(
        clientId: string,
        limit: number = 50
    ): Promise<any[]> {
        return Anomaly.find({
            clientId,
            status: 'pending'
        })
            .sort({ severity: 1, detectedAt: -1 })  // Critical first, then newest
            .limit(limit)
            .lean();
    }

    /**
     * ✅ Dismiss an anomaly
     */
    async dismissAnomaly(
        anomalyId: string,
        clientId: string,
        reason: string,
        userId: string,
        correlationId: string
    ): Promise<void> {
        await Anomaly.findOneAndUpdate(
            { _id: anomalyId, clientId },
            {
                status: 'dismissed',
                reviewedAt: new Date(),
                reviewedBy: userId,
                dismissalReason: reason
            }
        );

        logger.info({
            correlationId,
            action: 'anomaly_dismissed',
            anomalyId,
            reason
        });
    }

    /**
     * ✅ Get anomaly statistics
     */
    async getStatistics(clientId: string): Promise<any> {
        const stats = await Anomaly.aggregate([
            {
                $match: { clientId }
            },
            {
                $facet: {
                    byType: [
                        { $group: { _id: '$type', count: { $sum: 1 } } }
                    ],
                    bySeverity: [
                        { $group: { _id: '$severity', count: { $sum: 1 } } }
                    ],
                    byStatus: [
                        { $group: { _id: '$status', count: { $sum: 1 } } }
                    ],
                    total: [
                        { $count: 'count' }
                    ]
                }
            }
        ]);

        return stats[0];
    }
}
