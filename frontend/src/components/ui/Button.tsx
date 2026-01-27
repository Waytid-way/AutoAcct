import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg-app disabled:pointer-events-none disabled:opacity-50",
    {
        variants: {
            variant: {
                primary:
                    "bg-accent-primary text-white hover:bg-accent-primary/90 active:scale-[0.98]",
                secondary:
                    "bg-bg-surface border border-border-default text-text-primary hover:bg-bg-surface-hover",
                ghost:
                    "hover:bg-bg-surface-hover text-text-primary",
                danger:
                    "bg-error text-white hover:bg-error/90",
                success:
                    "bg-success text-white hover:bg-success/90",
            },
            size: {
                sm: "h-8 px-3 text-sm",
                md: "h-10 px-4 text-base",
                lg: "h-12 px-6 text-lg",
                icon: "h-10 w-10",
            },
        },
        defaultVariants: {
            variant: "primary",
            size: "md",
        },
    }
);

export interface ButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
    asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant, size, ...props }, ref) => {
        return (
            <button
                className={cn(buttonVariants({ variant, size, className }))}
                ref={ref}
                {...props}
            />
        );
    }
);
Button.displayName = "Button";

export { Button, buttonVariants };
