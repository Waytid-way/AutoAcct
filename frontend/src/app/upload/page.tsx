"use client";

import { useState, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { v4 as uuidv4 } from "uuid";
import { ReceiptUploader } from "@/components/Receipt/ReceiptUploader";
import { UploadProgressCard } from "@/components/Receipt/UploadProgressCard";
import { OcrResultCard } from "@/components/Receipt/OcrResultCard";
import { Toaster } from "@/components/ui/Toaster";
import { useReceiptUpload } from "@/hooks/useReceiptUpload";
import { useReceiptPolling } from "@/hooks/useReceiptPolling";
import { confirmReceipt, deleteReceipt } from "@/lib/api-client";
import { useToast } from "@/hooks/use-toast";
import { authService, MOCK_USER } from "@/lib/auth";
import type { ReceiptDetailResponse, LineItem } from "@/types/api.types";

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            retry: 1,
            refetchOnWindowFocus: false,
        },
    },
});

interface UploadingFile {
    id: string; // internal tracking ID
    file: File;
    progress: number;
    status: "uploading" | "processing" | "success" | "error";
    error?: string;
    receiptId?: string; // Set after upload success
}

// -- Polling Component --
function ReceiptPoller({
    receiptId,
    clientId,
    onProcessed,
    onError
}: {
    receiptId: string;
    clientId: string;
    onProcessed: (data: ReceiptDetailResponse) => void;
    onError: (data: ReceiptDetailResponse) => void;
}) {
    useReceiptPolling({
        receiptId,
        clientId,
        onProcessed,
        onError,
    });
    return null;
}

function UploadPageContent() {
    const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
    const [processedReceipts, setProcessedReceipts] = useState<ReceiptDetailResponse["data"][]>([]);
    const { toast } = useToast();
    const [clientId, setClientId] = useState<string>(MOCK_USER.id);

    // Initialize auth
    useEffect(() => {
        authService.init();
        const user = authService.getUser();
        if (user) {
            setClientId(user.id);
        }
    }, []);

    const uploadMutation = useReceiptUpload({
        clientId,
    });

    const handleFilesSelected = (files: File[]) => {
        files.forEach((file) => {
            const uploadId = uuidv4();

            // Add to uploading files
            setUploadingFiles((prev) => [
                ...prev,
                {
                    id: uploadId,
                    file,
                    progress: 0,
                    status: "uploading",
                },
            ]);

            // Start upload
            uploadMutation.mutate(file, {
                onSuccess: (data) => {
                    // Upload success - transition to processing (polling)
                    setUploadingFiles((prev) =>
                        prev.map((f) =>
                            f.id === uploadId
                                ? { ...f, status: "processing", receiptId: data.data.receiptId, progress: 100 }
                                : f
                        )
                    );
                },
                onError: (error) => {
                    setUploadingFiles((prev) =>
                        prev.map((f) =>
                            f.id === uploadId
                                ? { ...f, status: "error", error: error.message }
                                : f
                        )
                    );
                }
            });
        });
    };

    const handleRetryUpload = (uploadId: string) => {
        const fileToRetry = uploadingFiles.find((f) => f.id === uploadId);
        if (fileToRetry) {
            setUploadingFiles((prev) =>
                prev.map((f) =>
                    f.id === uploadId
                        ? { ...f, status: "uploading", progress: 0, error: undefined }
                        : f
                )
            );

            uploadMutation.mutate(fileToRetry.file, {
                onSuccess: (data) => {
                    setUploadingFiles((prev) =>
                        prev.map((f) =>
                            f.id === uploadId
                                ? { ...f, status: "processing", receiptId: data.data.receiptId, progress: 100 }
                                : f
                        )
                    );
                },
                onError: (error) => {
                    setUploadingFiles((prev) =>
                        prev.map((f) =>
                            f.id === uploadId
                                ? { ...f, status: "error", error: error.message }
                                : f
                        )
                    );
                }
            });
        }
    };

    const handleRemoveUploadingFile = (uploadId: string) => {
        setUploadingFiles((prev) => prev.filter((f) => f.id !== uploadId));
    };

    const handleProcessingComplete = (uploadId: string, response: ReceiptDetailResponse) => {
        // Remove from uploading/processing list
        setUploadingFiles((prev) => prev.filter((f) => f.id !== uploadId));

        // Add to processed list for review
        setProcessedReceipts((prev) => [...prev, response.data]);

        toast({
            variant: "success",
            title: "Processing complete",
            description: `${response.data.fileName} is ready for review.`,
        });
    };

    const handleProcessingError = (uploadId: string, response: ReceiptDetailResponse) => {
        setUploadingFiles((prev) =>
            prev.map((f) =>
                f.id === uploadId
                    ? { ...f, status: "error", error: "OCR processing failed" }
                    : f
            )
        );
    };

    const handleConfirm = async (
        receipt: ReceiptDetailResponse["data"],
        data: { vendor: string | null; amount: number | null; date: string | null; category?: string | null; lineItems?: LineItem[] }
    ) => {
        try {
            await confirmReceipt(receipt.id, {
                vendor: data.vendor || 'Unknown Vendor',
                amount: data.amount || 0,
                date: data.date || new Date().toISOString(),
                category: data.category || undefined,
                // notes: receipt.feedback?.reason // Removed notes as it's not in ConfirmReceiptRequest yet
            });
            // Task 5 will add actual line item saving API call here: 
            // if (data.lineItems) await saveSplitTransaction(...)

            toast({
                variant: "success",
                title: "Receipt confirmed",
                description: "Draft transaction created successfully",
            });
            // Remove from processed receipts
            setProcessedReceipts((prev) => prev.filter((r) => r.id !== receipt.id));
        } catch (error) {
            console.error(error);
            toast({
                variant: "error",
                title: "Confirmation failed",
                description: "Could not create draft transaction",
            });
        }
    };

    const handleReject = async (receiptId: string) => {
        try {
            await deleteReceipt(receiptId);
            toast({
                variant: "success",
                title: "Receipt rejected",
                description: "Receipt has been deleted",
            });
            setProcessedReceipts((prev) => prev.filter((r) => r.id !== receiptId));
        } catch (error) {
            console.error(error);
            toast({
                variant: "error",
                title: "Rejection failed",
                description: "Could not delete receipt",
            });
        }
    };

    return (
        <div className="min-h-screen bg-bg-app px-4 py-8">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-xl font-semibold text-text-primary mb-2">
                        Upload Receipts
                    </h1>
                    <p className="text-sm text-text-secondary">
                        Drag and drop your receipts to automatically extract transaction data
                    </p>
                </div>

                {/* Upload Zone */}
                <div className="mb-8">
                    <ReceiptUploader
                        onFilesSelected={handleFilesSelected}
                        disabled={uploadMutation.isPending}
                    />
                </div>

                {/* Upload Progress Cards */}
                {uploadingFiles.length > 0 && (
                    <div className="mb-8 space-y-3">
                        <h2 className="text-base font-semibold text-text-primary mb-4">
                            Uploading ({uploadingFiles.length})
                        </h2>
                        {uploadingFiles.map((file) => (
                            <div key={file.id}>
                                <UploadProgressCard
                                    file={file.file}
                                    progress={file.progress}
                                    status={file.status}
                                    error={file.error}
                                    onRetry={() => handleRetryUpload(file.id)}
                                    onRemove={() => handleRemoveUploadingFile(file.id)}
                                />
                                {file.status === 'processing' && file.receiptId && (
                                    <ReceiptPoller
                                        receiptId={file.receiptId}
                                        clientId={clientId}
                                        onProcessed={(data) => handleProcessingComplete(file.id, data)}
                                        onError={(data) => handleProcessingError(file.id, data)}
                                    />
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {/* OCR Result Cards */}
                {processedReceipts.length > 0 && (
                    <div>
                        <h2 className="text-base font-semibold text-text-primary mb-4">
                            Review Results ({processedReceipts.length})
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {processedReceipts.map((receipt) => (
                                <OcrResultCard
                                    key={receipt.id}
                                    receipt={receipt}
                                    onConfirm={(data) => handleConfirm(receipt, data)}
                                    onReject={() => handleReject(receipt.id)}
                                />
                            ))}
                        </div>
                    </div>
                )}

                {/* Empty State */}
                {uploadingFiles.length === 0 && processedReceipts.length === 0 && (
                    <div className="text-center py-12">
                        <p className="text-text-secondary text-sm">
                            No receipts uploaded yet. Drop files above to get started.
                        </p>
                    </div>
                )}
            </div>

            <Toaster />
        </div>
    );
}

export default function UploadPage() {
    return (
        <QueryClientProvider client={queryClient}>
            <UploadPageContent />
        </QueryClientProvider>
    );
}
