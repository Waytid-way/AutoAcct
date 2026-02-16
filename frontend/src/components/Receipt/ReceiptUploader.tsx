"use client";

import { useCallback, useState } from "react";
import { useDropzone, type FileRejection } from "react-dropzone";
import { Upload, FileImage, AlertCircle } from "lucide-react";
import { cn, formatFileSize } from "@/lib/utils";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_FILES = 10;
const ACCEPTED_TYPES = {
    "image/png": [".png"],
    "image/jpeg": [".jpg", ".jpeg"],
};

export interface ReceiptUploaderProps {
    onFilesSelected: (files: File[]) => void;
    disabled?: boolean;
    className?: string;
}

export function ReceiptUploader({
    onFilesSelected,
    disabled = false,
    className,
}: ReceiptUploaderProps) {
    const [validationError, setValidationError] = useState<string | null>(null);

    const onDrop = useCallback(
        (acceptedFiles: File[], rejectedFiles: FileRejection[]) => {
            setValidationError(null);

            // Handle rejected files
            if (rejectedFiles.length > 0) {
                const firstError = rejectedFiles[0].errors[0];
                if (firstError.code === "file-too-large") {
                    setValidationError(`File size exceeds ${formatFileSize(MAX_FILE_SIZE)}`);
                } else if (firstError.code === "file-invalid-type") {
                    setValidationError("Only PNG and JPG files are allowed");
                } else if (firstError.code === "too-many-files") {
                    setValidationError(`Maximum ${MAX_FILES} files allowed per batch`);
                } else {
                    setValidationError(firstError.message);
                }
                return;
            }

            // Validate total files
            if (acceptedFiles.length > MAX_FILES) {
                setValidationError(`Maximum ${MAX_FILES} files allowed per batch`);
                return;
            }

            if (acceptedFiles.length > 0) {
                onFilesSelected(acceptedFiles);
            }
        },
        [onFilesSelected]
    );

    const {
        getRootProps,
        getInputProps,
        isDragActive,
        isDragReject,
    } = useDropzone({
        onDrop,
        accept: ACCEPTED_TYPES,
        maxSize: MAX_FILE_SIZE,
        maxFiles: MAX_FILES,
        disabled,
        multiple: true,
    });

    return (
        <div
            {...getRootProps()}
            className={cn(
                "group relative flex flex-col items-center justify-center",
                "rounded border-2 border-dashed transition-all duration-200",
                "cursor-pointer outline-none",
                "h-80 sm:h-64", // 320px desktop, 240px mobile
                isDragActive && !isDragReject && "border-accent-primary bg-accent-primary/5",
                isDragReject && "border-error bg-error/5",
                !isDragActive && !isDragReject && "border-border-default hover:border-border-active hover:bg-bg-surface-hover",
                disabled && "cursor-not-allowed opacity-50",
                className
            )}
        >
            <input {...getInputProps()} />

            {/* Icon */}
            <div
                className={cn(
                    "mb-4 rounded-full p-4 transition-colors",
                    "bg-bg-surface group-hover:bg-bg-surface-hover",
                    isDragActive && "bg-accent-primary/10",
                    isDragReject && "bg-error/10"
                )}
            >
                {isDragReject ? (
                    <AlertCircle className="h-8 w-8 text-error" />
                ) : (
                    <Upload
                        className={cn(
                            "h-8 w-8 transition-colors",
                            isDragActive ? "text-accent-primary" : "text-text-secondary"
                        )}
                    />
                )}
            </div>

            {/* Text */}
            <div className="text-center px-4">
                {isDragActive && !isDragReject ? (
                    <p className="text-base font-medium text-accent-primary">
                        Drop files here...
                    </p>
                ) : isDragReject ? (
                    <p className="text-base font-medium text-error">Invalid file type</p>
                ) : (
                    <>
                        <p className="text-base font-medium text-text-primary mb-1">
                            Drag & drop receipts here
                        </p>
                        <p className="text-sm text-text-secondary">
                            or click to browse
                        </p>
                    </>
                )}
            </div>

            {/* Requirements */}
            {!isDragActive && (
                <div className="mt-4 flex flex-wrap items-center justify-center gap-3 text-text-tertiary text-xs">
                    <div className="flex items-center gap-1">
                        <FileImage className="h-3 w-3" />
                        <span>PNG, JPG</span>
                    </div>
                    <span>•</span>
                    <span>Max {formatFileSize(MAX_FILE_SIZE)}</span>
                    <span>•</span>
                    <span>Up to {MAX_FILES} files</span>
                </div>
            )}

            {/* Validation Error */}
            {validationError && (
                <div className="absolute bottom-4 left-4 right-4">
                    <div className="flex items-start gap-2 rounded bg-error/10 border border-error/20 px-3 py-2 text-sm text-error">
                        <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                        <span>{validationError}</span>
                    </div>
                </div>
            )}
        </div>
    );
}
