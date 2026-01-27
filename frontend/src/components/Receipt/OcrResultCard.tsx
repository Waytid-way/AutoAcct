"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
    FileImage,
    Calendar,
    Building2,
    DollarSign,
    Check,
    X,
    Edit2,
    Trash2,
    Sparkles,
} from "lucide-react";
import { Card, CardContent, CardFooter } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConfidenceBadge } from "./ConfidenceBadge";
import { SplitEntryReview } from "./SplitEntryReview";
import { cn, formatCurrency, formatDate, bahtToSatang } from "@/lib/utils";
import type { ReceiptDetailResponse } from "@/types/api.types";

const editFormSchema = z.object({
    vendor: z.string().min(3, "Vendor name must be at least 3 characters").max(100),
    amount: z.number().min(0.01, "Amount must be at least ฿0.01").max(10_000_000, "Amount cannot exceed ฿10,000,000"),
    date: z.string().refine((val) => {
        const date = new Date(val);
        return !isNaN(date.getTime()) && date <= new Date();
    }, "Invalid date or future date"),
    category: z.string().optional(),
});

type EditFormData = z.infer<typeof editFormSchema>;

export interface OcrResultCardProps {
    receipt: ReceiptDetailResponse["data"];
    onConfirm: (data: any) => void;
    onReject: () => void;
    isConfirming?: boolean;
    className?: string;
}

export function OcrResultCard({
    receipt,
    onConfirm,
    onReject,
    isConfirming = false,
    className,
}: OcrResultCardProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [isSplitMode, setIsSplitMode] = useState(false);

    const {
        register,
        handleSubmit,
        formState: { errors },
        reset,
    } = useForm<EditFormData>({
        resolver: zodResolver(editFormSchema),
        defaultValues: {
            vendor: receipt.extractedFields.vendor || "",
            amount: receipt.extractedFields.amount ? receipt.extractedFields.amount / 100 : 0,
            date: receipt.extractedFields.date || new Date().toISOString().split("T")[0],
            category: receipt.classification?.category || "",
        },
    });

    const handleSave = (data: EditFormData) => {
        onConfirm({
            vendor: data.vendor,
            amount: bahtToSatang(data.amount),
            date: data.date,
            category: data.category,
        });
        setIsEditing(false);
    };

    const handleSplitConfirm = (items: any[]) => {
        // When confirming split, we pass the items along with the main receipt data
        // We assume the main receipt totals are valid or drawn from the split totals if needed.
        // For now, we keep the main receipt data as is, but attach line items.
        onConfirm({
            vendor: receipt.extractedFields.vendor,
            amount: receipt.extractedFields.amount,
            date: receipt.extractedFields.date,
            lineItems: items
        });
        setIsSplitMode(false);
    };

    const handleCancel = () => {
        reset();
        setIsEditing(false);
        setIsSplitMode(false);
    };

    if (isSplitMode) {
        return (
            <Card className={cn("overflow-hidden", className)}>
                <CardContent className="p-6">
                    <h3 className="text-base font-semibold text-text-primary mb-4">Review Split Items</h3>
                    <SplitEntryReview
                        initialItems={receipt.lineItems}
                        receiptTotal={receipt.extractedFields.amount || 0}
                        onConfirm={handleSplitConfirm}
                        onCancel={() => setIsSplitMode(false)}
                    />
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className={cn("overflow-hidden", className)}>
            <CardContent className="p-6">
                <div className="flex gap-4">
                    {/* Receipt Thumbnail */}
                    <div className="flex-shrink-0 w-20 h-20 rounded bg-bg-input flex items-center justify-center">
                        <FileImage className="h-10 w-10 text-text-secondary" />
                    </div>

                    {/* Receipt Details */}
                    <div className="flex-1 min-w-0">
                        {/* File Name */}
                        <h3 className="text-base font-semibold text-text-primary truncate mb-3">
                            {receipt.fileName}
                        </h3>

                        {isEditing ? (
                            /* Edit Form */
                            <form onSubmit={handleSubmit(handleSave)} className="space-y-3">
                                {/* Vendor */}
                                <div>
                                    <label className="block text-xs text-text-secondary mb-1">
                                        Vendor
                                    </label>
                                    <input
                                        {...register("vendor")}
                                        className="w-full px-3 py-2 rounded bg-bg-input border border-border-default text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-accent-primary"
                                    />
                                    {errors.vendor && (
                                        <p className="text-xs text-error mt-1">{errors.vendor.message}</p>
                                    )}
                                </div>

                                {/* Amount */}
                                <div>
                                    <label className="block text-xs text-text-secondary mb-1">
                                        Amount (Baht)
                                    </label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        {...register("amount", { valueAsNumber: true })}
                                        className="w-full px-3 py-2 rounded bg-bg-input border border-border-default text-text-primary text-sm mono focus:outline-none focus:ring-2 focus:ring-accent-primary"
                                    />
                                    {errors.amount && (
                                        <p className="text-xs text-error mt-1">{errors.amount.message}</p>
                                    )}
                                </div>

                                {/* Date */}
                                <div>
                                    <label className="block text-xs text-text-secondary mb-1">
                                        Date
                                    </label>
                                    <input
                                        type="date"
                                        {...register("date")}
                                        className="w-full px-3 py-2 rounded bg-bg-input border border-border-default text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-accent-primary"
                                    />
                                    {errors.date && (
                                        <p className="text-xs text-error mt-1">{errors.date.message}</p>
                                    )}
                                </div>

                                {/* Category (optional) */}
                                <div>
                                    <label className="block text-xs text-text-secondary mb-1">
                                        Category (Optional)
                                    </label>
                                    <input
                                        {...register("category")}
                                        className="w-full px-3 py-2 rounded bg-bg-input border border-border-default text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-accent-primary"
                                    />
                                </div>

                                {/* Form Actions */}
                                <div className="flex gap-2 pt-2">
                                    <Button type="submit" size="sm" variant="primary">
                                        Save
                                    </Button>
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="ghost"
                                        onClick={handleCancel}
                                    >
                                        Cancel
                                    </Button>
                                </div>
                            </form>
                        ) : (
                            /* Display Mode */
                            <div className="space-y-3">
                                {/* Vendor */}
                                <div className="flex items-start gap-2">
                                    <Building2 className="h-4 w-4 text-text-secondary mt-0.5 flex-shrink-0" />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm text-text-primary font-medium truncate">
                                            {receipt.extractedFields.vendor || "Unknown vendor"}
                                        </p>
                                        <ConfidenceBadge
                                            confidence={receipt.confidenceScores.vendor}
                                            className="mt-1"
                                        />
                                    </div>
                                </div>

                                {/* Amount */}
                                <div className="flex items-start gap-2">
                                    <DollarSign className="h-4 w-4 text-text-secondary mt-0.5 flex-shrink-0" />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm text-text-primary font-medium mono">
                                            {receipt.extractedFields.amount !== null
                                                ? formatCurrency(receipt.extractedFields.amount)
                                                : "฿0.00"}
                                        </p>
                                        <ConfidenceBadge
                                            confidence={receipt.confidenceScores.amount}
                                            className="mt-1"
                                        />
                                    </div>
                                </div>

                                {/* Date */}
                                <div className="flex items-start gap-2">
                                    <Calendar className="h-4 w-4 text-text-secondary mt-0.5 flex-shrink-0" />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm text-text-primary">
                                            {receipt.extractedFields.date
                                                ? formatDate(receipt.extractedFields.date)
                                                : "Unknown date"}
                                        </p>
                                    </div>
                                </div>

                                {/* AI Category Suggestion */}
                                {receipt.classification?.category && (
                                    <div className="flex items-start gap-2">
                                        <Sparkles className="h-4 w-4 text-info mt-0.5 flex-shrink-0" />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs text-text-secondary mb-1">
                                                AI Suggested Category
                                            </p>
                                            <Badge variant="info">
                                                {receipt.classification.category} •{" "}
                                                {Math.round(receipt.classification.confidence * 100)}%
                                            </Badge>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </CardContent>

            {!isEditing && (
                <CardFooter className="justify-between">
                    <div className="flex gap-2">
                        <Button
                            onClick={() => {
                                const data = {
                                    vendor: receipt.extractedFields.vendor || "",
                                    amount: receipt.extractedFields.amount || 0,
                                    date: receipt.extractedFields.date || new Date().toISOString(),
                                    category: receipt.classification?.category || undefined,
                                };
                                onConfirm(data);
                            }}
                            disabled={isConfirming}
                            size="sm"
                            variant="primary"
                        >
                            <Check className="h-4 w-4 mr-1" />
                            Confirm
                        </Button>
                        <Button
                            onClick={() => setIsEditing(true)}
                            size="sm"
                            variant="secondary"
                        >
                            <Edit2 className="h-4 w-4 mr-1" />
                            Edit
                        </Button>
                        {(receipt.lineItems && receipt.lineItems.length > 0) ? (
                            <Button
                                onClick={() => setIsSplitMode(true)}
                                size="sm"
                                variant="secondary"
                            >
                                <Sparkles className="h-4 w-4 mr-1" />
                                Check Items ({receipt.lineItems.length})
                            </Button>
                        ) : null}
                    </div>

                    <Button
                        onClick={onReject}
                        size="sm"
                        variant="ghost"
                        className="text-error hover:bg-error/10"
                    >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Reject
                    </Button>
                </CardFooter>
            )}
        </Card>
    );
}
