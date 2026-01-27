"use client";

import { useMutation, UseMutationResult } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { uploadReceipt } from "@/lib/api-client";
import { useToast } from "@/hooks/use-toast";
import type {
    ReceiptUploadResponse,
    ErrorResponse,
} from "@/types/api.types";

export interface UseReceiptUploadOptions {
    clientId: string;
    onSuccess?: (data: ReceiptUploadResponse) => void;
    onError?: (error: AxiosError<ErrorResponse>) => void;
}

export function useReceiptUpload({
    clientId,
    onSuccess,
    onError,
}: UseReceiptUploadOptions): UseMutationResult<
    ReceiptUploadResponse,
    AxiosError<ErrorResponse>,
    File
> {
    const { toast } = useToast();

    return useMutation({
        mutationFn: (file: File) => uploadReceipt(file, clientId),
        onSuccess: (data) => {
            toast({
                variant: "success",
                title: "Upload successful",
                description: `${data.data.fileName} is being processed`,
            });
            onSuccess?.(data);
        },
        onError: (error) => {
            const errorData = error.response?.data;
            const errorCode = errorData?.error?.code;
            const errorMessage = errorData?.error?.message;

            let title = "Upload failed";
            let description = "An unknown error occurred";

            // Handle specific error codes
            switch (errorCode) {
                case "DUPLICATE_RECEIPT":
                    title = "Duplicate receipt";
                    description = "This receipt has already been uploaded.";
                    break;
                case "VALIDATION_ERROR":
                    title = "Invalid file";
                    description = errorMessage || "Invalid file type or size.";
                    break;
                case "INTERNAL_ERROR":
                    title = "Server error";
                    description = "Please try again later.";
                    break;
                case "NETWORK_ERROR":
                    title = "Network error";
                    description = "Please check your connection and try again.";
                    break;
                default:
                    description = errorMessage || description;
            }

            toast({
                variant: "error",
                title,
                description,
            });

            onError?.(error);
        },
    });
}
