import { Anomaly, AnomalyFilter, AnomalyStatistics } from '@/types/anomaly.types';

// Mock Data - Fixed dates to prevent Hydration Mismatches
const MOCK_ANOMALIES: Anomaly[] = [
    {
        id: 'an_101',
        type: 'PRICE_OUTLIER',
        severity: 'warning',
        title: 'Unusual Coffee Price',
        message: 'Item "Black Coffee" price (85.00) is 20% higher than average (70.00)',
        suggestion: 'Verify if this is a special blend or seasonal price adjustment.',
        detectedAt: "2024-05-20T09:30:00.000Z",
    },
    {
        id: 'an_102',
        type: 'DUPLICATE_RECEIPT',
        severity: 'critical',
        title: 'Potential Duplicate Receipt',
        message: 'Detailed match found with Receipt #R-2024-001 processed yesterday.',
        suggestion: 'Review original receipt. If confirmed duplicate, reject this entry.',
        detectedAt: "2024-05-19T14:15:00.000Z",
    },
    {
        id: 'an_103',
        type: 'TAX_MISMATCH',
        severity: 'info',
        title: 'VAT Calculation Variance',
        message: 'Calculated VAT (45.25) differs slightly from receipt tax (45.00).',
        suggestion: 'Difference is within acceptable rounding threshold. Auto-adjustment recommended.',
        detectedAt: "2024-05-19T11:00:00.000Z",
    },
    {
        id: 'an_104',
        type: 'VENDOR_UNKNOWN',
        severity: 'warning',
        title: 'New Vendor Detected',
        message: 'Vendor "Local Cafe 99" not in master vendor list.',
        suggestion: 'Map to existing vendor category or create new vendor profile.',
        detectedAt: "2024-05-18T16:45:00.000Z",
    },
    {
        id: 'an_105',
        type: 'AFTER_HOURS',
        severity: 'info',
        title: 'After Hours Expense',
        message: 'Transaction time 23:45 is outside standard operating hours.',
        detectedAt: "2024-05-18T23:45:00.000Z",
    }
];

// Helper to simulate network delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const anomalyService = {
    /**
     * Fetch anomalies
     */
    getAnomalies: async (filter?: AnomalyFilter): Promise<Anomaly[]> => {
        await delay(500); // Reduced delay
        let result = [...MOCK_ANOMALIES];

        if (filter?.severity && filter.severity !== 'all') {
            result = result.filter(a => a.severity === filter.severity);
        }

        return result;
    },

    /**
     * Dismiss an anomaly
     */
    dismissAnomaly: async (id: string): Promise<void> => {
        await delay(300);
        console.log(`[MockAPI] Dismissed anomaly ${id}`);
    },

    /**
     * Mark anomaly for review (Action)
     */
    reviewAnomaly: async (id: string): Promise<void> => {
        await delay(300);
        console.log(`[MockAPI] Marked anomaly ${id} for review`);
    },

    /**
     * Get statistics
     */
    getStatistics: async (): Promise<AnomalyStatistics> => {
        await delay(300);
        return {
            total: MOCK_ANOMALIES.length,
            bySeverity: {
                critical: MOCK_ANOMALIES.filter(a => a.severity === 'critical').length,
                warning: MOCK_ANOMALIES.filter(a => a.severity === 'warning').length,
                info: MOCK_ANOMALIES.filter(a => a.severity === 'info').length,
            },
            byType: MOCK_ANOMALIES.reduce((acc, curr) => {
                acc[curr.type] = (acc[curr.type] || 0) + 1;
                return acc;
            }, {} as Record<string, number>),
        };
    }
};
