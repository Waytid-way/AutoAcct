"use client";

import { useEffect, useState } from "react";
import { FileImage, CheckCircle2, XCircle, RotateCw } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Progress } from "@/components/ui/Progress";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { cn, formatFileSize } from "@/lib/utils";

export interface UploadProgressCardProps {
    file: File;
    progress: number;
    status: "uploading" | "processing" | "success" | "error";
    error?: string;
    onRetry?: () => void;
    onRemove?: () => void;
    className?: string;
}

export function UploadProgressCard({
    file,
    progress,
    status,
    error,
    onRetry,
    onRemove,
    className,
}: UploadProgressCardProps) {
    const [shouldRemove, setShouldRemove] = useState(false);

    // Auto-remove on success after 2 seconds
    useEffect(() => {
        if (status === "success" && onRemove) {
            const timer = setTimeout(() => {
                setShouldRemove(true);
                setTimeout(onRemove, 300); // Wait for fade-out animation
            }, 2000);
            return () => clearTimeout(timer);
        }
    }, [status, onRemove]);

    const getStatusText = () => {
        switch (status) {
            case "uploading":
                return "Uploading...";
            case "processing":
                return "Extracting text...";
            case "success":
                return "Done ✓";
            case "error":
                return error || "Upload failed";
            default:
                return "";
        }
    };

    const getStatusIcon = () => {
        switch (status) {
            case "uploading":
            case "processing":
                return <Spinner size="sm" />;
            case "success":
                return <CheckCircle2 className="h-5 w-5 text-success" />;
            case "error":
                return <XCircle className="h-5 w-5 text-error" />;
            default:
                return null;
        }
    };

    return (
        <Card
            className={cn(
                "p-4 transition-all duration-300",
                shouldRemove && "opacity-0 scale-95",
                status === "error" && "border-error/20",
                status === "success" && "border-success/20",
                className
            )}
        >
            <div className="flex items-start gap-3">
                {/* File Icon */}
                <div className="flex-shrink-0 rounded bg-bg-input p-2">
                    <FileImage className="h-5 w-5 text-text-secondary" />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    {/* File Name */}
                    <p className="text-sm font-medium text-text-primary truncate mb-1">
                        {file.name}
                    </p>

                    {/* File Size & Status */}
                    <div className="flex items-center gap-2 text-xs text-text-secondary mb-2">
                        <span>{formatFileSize(file.size)}</span>
                        <span>•</span>
                        <span className={cn(
                            status === "error" && "text-error",
                            status === "success" && "text-success"
                        )}>
                            {getStatusText()}
                        </span>
                    </div>

                    {/* Progress Bar (only show during upload/processing) */}
                    {(status === "uploading" || status === "processing") && (
                        <Progress value={progress} className="h-1.5" />
                    )}

                    {/* Error Message */}
                    {status === "error" && error && (
                        <p className="text-xs text-error mt-2">{error}</p>
                    )}
                </div>

                {/* Status Icon / Retry Button */}
                <div className="flex-shrink-0">
                    {status === "error" && onRetry ? (
                        <Button
                            size="sm"
                            variant="ghost"
                            onClick={onRetry}
                            className="h-8 w-8 p-0"
                        >
                            <RotateCw className="h-4 w-4" />
                            <span className="sr-only">Retry upload</span>
                        </Button>
                    ) : (
                        <div className="flex items-center justify-center h-8 w-8">
                            {getStatusIcon()}
                        </div>
                    )}
                </div>
            </div>
        </Card>
    );
}
