export type AnomalySeverity = 'info' | 'warning' | 'critical';

export interface Anomaly {
    id: string;
    type: string;
    severity: AnomalySeverity;
    title: string;
    message: string;
    suggestion?: string;
    detectedAt: string;
}

export interface AnomalyStatistics {
    total: number;
    bySeverity: {
        critical: number;
        warning: number;
        info: number;
    };
    byType: Record<string, number>;
}

export interface AnomalyFilter {
    severity?: AnomalySeverity | 'all';
    dateRange?: {
        start: Date;
        end: Date;
    };
}
