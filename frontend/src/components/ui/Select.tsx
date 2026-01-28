import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> { }

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
    ({ className, children, ...props }, ref) => {
        return (
            <select
                ref={ref}
                className={cn(
                    'flex h-10 w-full rounded-lg border border-border-default',
                    'bg-background-app px-3 py-2 text-sm',
                    'text-text-primary',
                    'focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-0',
                    'disabled:cursor-not-allowed disabled:opacity-50',
                    'transition-colors',
                    className
                )}
                {...props}
            >
                {children}
            </select>
        );
    }
);

Select.displayName = 'Select';
