import React from 'react';
import { cn } from '@/lib/utils';

type Severity = 'info' | 'warning' | 'critical';

interface AnomalyBadgeProps {
    count: number;
    severity: Severity;
}

export const AnomalyBadge: React.FC<AnomalyBadgeProps> = ({ count, severity }) => {
    return (
        <span
            className={cn(
                'inline-flex items-center justify-center',
                'min-w-[24px] h-6 px-2',
                'rounded-full',
                'text-xs font-bold',
                {
                    'bg-indigo-500/20 text-indigo-400': severity === 'info',
                    'bg-amber-500/20 text-amber-400': severity === 'warning',
                    'bg-red-500/20 text-red-400': severity === 'critical',
                }
            )}
            aria-label={`${count} ${severity} anomalies`}
        >
            {count}
        </span>
    );
};
