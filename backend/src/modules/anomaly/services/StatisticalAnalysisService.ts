import Receipt from '../../../models/Receipt.model';
import config from '../../../config/ConfigManager';

interface VendorStats {
    vendor: string;
    count: number;
    avgAmount: number;
    stdDev: number;
    minAmount: number;
    maxAmount: number;
    mostCommonCategory: string;
    categoryConfidence: number;  // % of receipts in mostCommonCategory
}

export class StatisticalAnalysisService {
    private readonly CACHE_TTL_MS = 60 * 60 * 1000;  // 1 hour
    private cache: Map<string, { data: any; expiry: number }> = new Map();

    /**
     * Get comprehensive statistics for a vendor
     */
    async getVendorStatistics(
        vendor: string,
        clientId: string,
        lookbackDays: number = 90
    ): Promise<VendorStats | null> {
        const cacheKey = `${clientId}:${vendor}:${lookbackDays}`;

        // ✅ Check cache
        const cached = this.cache.get(cacheKey);
        if (cached && Date.now() < cached.expiry) {
            return cached.data;
        }

        const lookbackDate = new Date();
        lookbackDate.setDate(lookbackDate.getDate() - lookbackDays);

        const stats = await Receipt.aggregate([
            {
                $match: {
                    clientId,
                    'extractedFields.vendor': vendor,
                    'extractedFields.date': { $gte: lookbackDate },
                    status: { $in: ['processed', 'confirmed'] }
                }
            },
            {
                $facet: {
                    amountStats: [
                        {
                            $group: {
                                _id: null,
                                count: { $sum: 1 },
                                avg: { $avg: '$extractedFields.amountSatang' }, // Use amountSatang
                                stdDev: { $stdDevPop: '$extractedFields.amountSatang' },
                                min: { $min: '$extractedFields.amountSatang' },
                                max: { $max: '$extractedFields.amountSatang' }
                            }
                        }
                    ],
                    categoryStats: [
                        {
                            $group: {
                                // Try suggestedCategory first, then classification, then extractedFields
                                _id: { $ifNull: ["$category", "$extractedFields.category"] },
                                count: { $sum: 1 }
                            }
                        },
                        {
                            $sort: { count: -1 }
                        },
                        {
                            $limit: 1
                        }
                    ]
                }
            }
        ]);

        if (!stats[0] || !stats[0].amountStats || stats[0].amountStats.length === 0) {
            return null;
        }

        const amountData = stats[0].amountStats[0];
        const categoryData = stats[0].categoryStats[0];

        const result: VendorStats = {
            vendor,
            count: amountData.count,
            avgAmount: Math.round(amountData.avg),
            stdDev: Math.round(amountData.stdDev || 0),
            minAmount: amountData.min,
            maxAmount: amountData.max,
            mostCommonCategory: categoryData?._id || 'Unknown',
            categoryConfidence: categoryData
                ? (categoryData.count / amountData.count) * 100
                : 0
        };

        // ✅ Cache result
        this.cache.set(cacheKey, {
            data: result,
            expiry: Date.now() + this.CACHE_TTL_MS
        });

        return result;
    }

    /**
     * Calculate Z-score for outlier detection
     */
    calculateZScore(value: number, mean: number, stdDev: number): number {
        if (stdDev === 0) return 0;
        return Math.abs((value - mean) / stdDev);
    }

    /**
     * Get percentile rank of a value
     */
    async getPercentileRank(
        vendor: string,
        amountSatang: number,
        clientId: string
    ): Promise<number> {
        const allReceipts = await Receipt.find({
            clientId,
            'extractedFields.vendor': vendor,
            status: { $in: ['processed', 'confirmed'] }
        })
            .select('extractedFields.amountSatang')
            .sort({ 'extractedFields.amountSatang': 1 })
            .lean();

        if (allReceipts.length === 0) return 50;  // Default: median

        const belowCount = allReceipts.filter(
            r => (r.extractedFields?.amountSatang || 0) < amountSatang
        ).length;

        return (belowCount / allReceipts.length) * 100;
    }

    /**
     * Clear cache for a specific vendor (e.g., after new data)
     */
    clearCache(vendor?: string, clientId?: string) {
        if (vendor && clientId) {
            Array.from(this.cache.keys())
                .filter(key => key.startsWith(`${clientId}:${vendor}:`))
                .forEach(key => this.cache.delete(key));
        } else {
            this.cache.clear();
        }
    }
}
