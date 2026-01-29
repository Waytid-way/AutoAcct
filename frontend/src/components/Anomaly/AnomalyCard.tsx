import React, { useState } from 'react';
import {
    AlertTriangle,
    Info,
    AlertOctagon,
    ChevronDown,
    ChevronUp,
    Clock,
    X,
    CheckCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { AnomalyBadge } from './AnomalyBadge';

import { Anomaly } from '@/types/anomaly.types';

interface AnomalyCardProps {
    anomaly: Anomaly;
    onDismiss: (id: string) => void;
    onReview: (id: string) => void;
    className?: string;
}

const severityIcons = {
    info: Info,
    warning: AlertTriangle,
    critical: AlertOctagon,
};

// Use standard Tailwind colors (red/amber/indigo) instead of custom tokens to ensure rendering
const severityStyles = {
    info: 'border-indigo-500/20 bg-indigo-500/5',
    warning: 'border-amber-500/20 bg-amber-500/5',
    critical: 'border-red-500/20 bg-red-500/5',
};

export const AnomalyCard: React.FC<AnomalyCardProps> = ({
    anomaly,
    onDismiss,
    onReview,
    className
}) => {
    const [isExpanded, setIsExpanded] = useState(false);

    // Date formatting (Client-side safe to avoid hydration mismatch, though static data helps)
    const formattedDate = new Date(anomaly.detectedAt).toLocaleString('en-US', {
        month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
    });

    const Icon = severityIcons[anomaly.severity];

    return (
        <div
            className={cn(
                "rounded-xl border transition-all duration-300",
                "bg-zinc-900 border-zinc-800 hover:bg-zinc-800/80", // Standard Dark Colors
                severityStyles[anomaly.severity],
                className
            )}
        >
            {/* Header / Summary */}
            <div className="p-4 flex items-start gap-4">
                {/* Icon */}
                <div className={cn(
                    "mt-1 p-2 rounded-lg flex-shrink-0",
                    {
                        'bg-indigo-500/10 text-indigo-400': anomaly.severity === 'info',
                        'bg-amber-500/10 text-amber-400': anomaly.severity === 'warning',
                        'bg-red-500/10 text-red-400': anomaly.severity === 'critical',
                    }
                )}>
                    <Icon className="w-5 h-5" aria-hidden="true" />
                </div>

                {/* Main Content */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                            <h4 className="font-semibold text-zinc-100 truncate">
                                {anomaly.title}
                            </h4>
                            <AnomalyBadge count={1} severity={anomaly.severity} />
                        </div>
                        <span className="flex items-center text-xs text-zinc-500 gap-1">
                            <Clock className="w-3 h-3" />
                            {formattedDate}
                        </span>
                    </div>

                    <p className="text-sm text-zinc-400 line-clamp-1">
                        {anomaly.message}
                    </p>

                    {/* Details (Expanded) */}
                    {isExpanded && (
                        <div className="mt-4 space-y-3 pt-3 border-t border-zinc-800 animate-in fade-in slide-in-from-top-1">
                            <div className="text-sm text-zinc-400">
                                <span className="font-medium text-zinc-200 block mb-1">Detailed Analysis:</span>
                                {anomaly.message}
                            </div>

                            {anomaly.suggestion && (
                                <div className="bg-black/40 rounded-lg p-3 text-sm border border-zinc-800">
                                    <span className="font-medium text-blue-400 block mb-1">Suggestion:</span>
                                    <span className="text-zinc-400">{anomaly.suggestion}</span>
                                </div>
                            )}

                            <div className="text-xs text-zinc-600 font-mono">
                                ID: {anomaly.id} • Type: {anomaly.type}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Actions Footer */}
            <div className="px-4 pb-4 flex items-center justify-between gap-4">
                <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="flex items-center text-xs font-medium text-zinc-400 hover:text-zinc-200 transition-colors focus:outline-none"
                >
                    {isExpanded ? (
                        <>
                            <ChevronUp className="w-4 h-4 mr-1" /> Less details
                        </>
                    ) : (
                        <>
                            <ChevronDown className="w-4 h-4 mr-1" /> More details
                        </>
                    )}
                </button>

                <div className="flex items-center gap-2">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDismiss(anomaly.id)}
                        className="text-zinc-400 hover:text-zinc-100"
                    >
                        Dismiss
                    </Button>
                    <Button
                        variant="primary"
                        size="sm"
                        onClick={() => onReview(anomaly.id)}
                        className="bg-blue-600 hover:bg-blue-500 text-white border-none"
                    >
                        Review
                    </Button>
                </div>
            </div>
        </div>
    );
};
