import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { anomalyService } from '@/services/anomalyService';
import { AnomalyFilter } from '@/types/anomaly.types';

export const ANOMALY_KEYS = {
    all: ['anomalies'] as const,
    stats: ['anomalies', 'stats'] as const,
    list: (filter: AnomalyFilter) => [...ANOMALY_KEYS.all, 'list', filter] as const,
};

export function useAnomalies(filter: AnomalyFilter = {}) {
    return useQuery({
        queryKey: ANOMALY_KEYS.list(filter),
        queryFn: () => anomalyService.getAnomalies(filter),
        staleTime: 1000 * 60 * 2, // 2 mins
    });
}

export function useAnomalyStatistics() {
    return useQuery({
        queryKey: ANOMALY_KEYS.stats,
        queryFn: () => anomalyService.getStatistics(),
        staleTime: 1000 * 60 * 5,
    });
}

export function useAnomalyActions() {
    const queryClient = useQueryClient();

    const dismissMutation = useMutation({
        mutationFn: (id: string) => anomalyService.dismissAnomaly(id),
        onSuccess: (_, id) => {
            // Invalidate list to refetch
            queryClient.invalidateQueries({ queryKey: ANOMALY_KEYS.all });

            // Example of Optimistic update (simplified):
            // In a real app, we might update the cache manually here to remove the item immediately
        }
    });

    const reviewMutation = useMutation({
        mutationFn: (id: string) => anomalyService.reviewAnomaly(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ANOMALY_KEYS.all });
        }
    });

    return {
        dismiss: dismissMutation.mutate,
        dismissAsync: dismissMutation.mutateAsync,
        isDismissing: dismissMutation.isPending,
        review: reviewMutation.mutate,
        reviewAsync: reviewMutation.mutateAsync,
        isReviewing: reviewMutation.isPending,
    };
}
