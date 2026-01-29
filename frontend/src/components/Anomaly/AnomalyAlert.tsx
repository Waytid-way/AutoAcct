import React from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { cn } from '@/lib/utils';

type Severity = 'info' | 'warning' | 'critical';

interface AnomalyAlertProps {
    /** Severity level of the anomaly */
    severity: Severity;
    /** Alert title */
    title: string;
    /** Detailed message */
    message: string;
    /** Optional action text */
    action?: string;
    /** Dismiss handler */
    onDismiss?: () => void;
    /** Action handler */
    onAction?: () => void;
}

/**
 * Alert component for displaying anomaly detection results
 * 
 * @example
 * ```tsx
 * <AnomalyAlert
 *   severity="warning"
 *   title="Price Outlier Detected"
 *   message="Receipt amount is 200% above average"
 *   action="Review"
 *   onAction={() => console.log('Review clicked')}
 *   onDismiss={() => console.log('Dismissed')}
 * />
 * ```
 */
export const AnomalyAlert: React.FC<AnomalyAlertProps> = ({
    severity,
    title,
    message,
    action,
    onDismiss,
    onAction,
}) => {
    return (
        <div
            className={cn(
                'rounded-xl p-4 border-2 flex items-start gap-3',
                'transition-all duration-150',
                {
                    'border-status-info bg-status-info/10': severity === 'info',
                    'border-status-warning bg-status-warning/10': severity === 'warning',
                    'border-status-error bg-status-error/10': severity === 'critical',
                }
            )}
            role="alert"
        >
            {/* Icon */}
            <AlertTriangle
                className={cn('w-5 h-5 mt-0.5 flex-shrink-0', {
                    'text-status-info': severity === 'info',
                    'text-status-warning': severity === 'warning',
                    'text-status-error': severity === 'critical',
                })}
                aria-hidden="true"
            />

            {/* Content */}
            <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-text-primary mb-1">{title}</h4>
                <p className="text-sm text-text-secondary">{message}</p>

                {/* Action Button */}
                {action && onAction && (
                    <button
                        onClick={onAction}
                        className="mt-2 text-sm font-medium text-accent hover:underline focus:outline-none focus:ring-2 focus:ring-accent rounded"
                    >
                        {action} →
                    </button>
                )}
            </div>

            {/* Dismiss Button */}
            {onDismiss && (
                <button
                    onClick={onDismiss}
                    className="flex-shrink-0 text-text-tertiary hover:text-text-primary transition-colors focus:outline-none focus:ring-2 focus:ring-accent rounded"
                    aria-label="Dismiss alert"
                >
                    <X className="w-5 h-5" />
                    <span className="sr-only">Dismiss</span>
                </button>
            )}
        </div>
    );
};
