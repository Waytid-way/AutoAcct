import React, { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { AnomalyCard } from './AnomalyCard';
import { Anomaly } from '@/types/anomaly.types';
import { AlertCircle, Filter } from 'lucide-react';

type FilterType = 'all' | 'critical' | 'warning' | 'info';

interface AnomalyListProps {
    anomalies: Anomaly[];
    onDismiss: (id: string) => void;
    onReview: (id: string) => void;
    className?: string;
}

export const AnomalyList: React.FC<AnomalyListProps> = ({
    anomalies,
    onDismiss,
    onReview,
    className
}) => {
    const [filter, setFilter] = useState<FilterType>('all');

    // Filter and Sort Logic
    const filteredAnomalies = useMemo(() => {
        let result = anomalies;

        // 1. Filter
        if (filter !== 'all') {
            result = result.filter(a => a.severity === filter);
        }

        // 2. Sort: Critical > Warning > Info, then by Date
        return [...result].sort((a, b) => {
            const severityScore = { critical: 0, warning: 1, info: 2 };
            const scoreDiff = severityScore[a.severity] - severityScore[b.severity];

            if (scoreDiff !== 0) return scoreDiff;

            return new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime();
        });
    }, [anomalies, filter]);

    return (
        <div className={cn("flex flex-col h-full bg-black rounded-xl border border-zinc-800 overflow-hidden", className)}>

            {/* Filter Bar */}
            <div className="flex items-center gap-2 p-4 border-b border-zinc-800 bg-zinc-900 overflow-x-auto no-scrollbar">
                <div className="flex items-center gap-2 mr-2 text-zinc-400">
                    <Filter className="w-4 h-4" />
                    <span className="text-sm font-medium">Filter:</span>
                </div>
                {(['all', 'critical', 'warning', 'info'] as const).map((f) => {
                    const count = f === 'all'
                        ? anomalies.length
                        : anomalies.filter(a => a.severity === f).length;

                    return (
                        <Button
                            key={f}
                            variant={filter === f ? 'primary' : 'secondary'}
                            size="sm"
                            onClick={() => setFilter(f)}
                            className={cn(
                                "capitalize min-w-[90px] justify-between",
                                filter !== f && "bg-zinc-800 border-transparent hover:bg-zinc-700 text-zinc-300"
                            )}
                        >
                            {f}
                            <span className={cn(
                                "ml-2 text-xs py-0.5 px-1.5 rounded-full",
                                filter === f ? "bg-white/20 text-white" : "bg-black text-zinc-500"
                            )}>
                                {count}
                            </span>
                        </Button>
                    );
                })}
            </div>

            {/* List Content */}
            <div className="flex-1 bg-zinc-950 min-h-[300px] overflow-y-auto p-4 space-y-3">
                {filteredAnomalies.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-zinc-500 opacity-60">
                        <div className="bg-zinc-900 p-4 rounded-full mb-3 border border-zinc-800">
                            <AlertCircle className="w-8 h-8" />
                        </div>
                        <p className="font-medium">No anomalies found</p>
                        <p className="text-sm">Try adjusting the filters</p>
                    </div>
                ) : (
                    filteredAnomalies.map((anomaly) => (
                        <AnomalyCard
                            key={anomaly.id}
                            anomaly={anomaly}
                            onDismiss={onDismiss}
                            onReview={onReview}
                        />
                    ))
                )}
            </div>
        </div>
    );
};
