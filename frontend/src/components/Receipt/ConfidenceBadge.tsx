import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";

export interface ConfidenceBadgeProps {
    confidence: number; // 0-1
    className?: string;
}

export function ConfidenceBadge({ confidence, className }: ConfidenceBadgeProps) {
    const percentage = Math.round(confidence * 100);

    const getVariant = (): "success" | "warning" | "error" => {
        if (confidence >= 0.95) return "success";
        if (confidence >= 0.80) return "warning";
        return "error";
    };

    const getLabel = (): string => {
        if (confidence >= 0.95) return "Excellent";
        if (confidence >= 0.80) return "Good";
        return "Review Required";
    };

    return (
        <Badge
            variant={getVariant()}
            className={cn("text-xs font-medium", className)}
        >
            {percentage}% • {getLabel()}
        </Badge>
    );
}
