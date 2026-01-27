import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
    "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2",
    {
        variants: {
            variant: {
                default:
                    "bg-bg-surface border border-border-default text-text-primary hover:bg-bg-surface-hover",
                success:
                    "bg-success/10 text-success border border-success/20",
                warning:
                    "bg-warning/10 text-warning border border-warning/20",
                error:
                    "bg-error/10 text-error border border-error/20",
                info:
                    "bg-info/10 text-info border border-info/20",
                primary:
                    "bg-accent-primary/10 text-accent-primary border border-accent-primary/20",
            },
        },
        defaultVariants: {
            variant: "default",
        },
    }
);

export interface BadgeProps
    extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> { }

function Badge({ className, variant, ...props }: BadgeProps) {
    return (
        <div className={cn(badgeVariants({ variant }), className)} {...props} />
    );
}

export { Badge, badgeVariants };
