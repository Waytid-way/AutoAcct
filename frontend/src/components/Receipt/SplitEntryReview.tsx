"use client";

import { useState, useEffect } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
    Trash2,
    Plus,
    AlertTriangle,
    Check,
    X,
    Sparkles
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { formatCurrency, bahtToSatang } from "@/lib/utils";

// Schema for a single line item
const lineItemSchema = z.object({
    description: z.string().min(1, "Description is required"),
    quantity: z.number().min(1, "Qty must be >= 1"),
    unitPrice: z.number().min(0, "Price must be >= 0"), // In Baht for input
    totalPrice: z.number().min(0), // In Baht, derived usually
    category: z.string().optional(),
});

const splitEntrySchema = z.object({
    items: z.array(lineItemSchema).min(1, "At least one item required"),
});

type SplitEntryForm = z.infer<typeof splitEntrySchema>;

import type { LineItem } from "@/types/api.types";

interface SplitEntryReviewProps {
    initialItems?: Array<{
        description: string;
        quantity: number;
        unitPrice: number; // Satang
        totalPrice: number; // Satang
        suggestedCategory?: string;
        aiConfidence?: number;
    }>;
    receiptTotal: number; // Satang
    onConfirm: (items: LineItem[]) => void;
    onCancel: () => void;
}

export function SplitEntryReview({
    initialItems = [],
    receiptTotal,
    onConfirm,
    onCancel
}: SplitEntryReviewProps) {
    const {
        register,
        control,
        handleSubmit,
        watch,
        setValue,
        formState: { errors }
    } = useForm<SplitEntryForm>({
        resolver: zodResolver(splitEntrySchema),
        defaultValues: {
            // Convert Satang to Baht for form
            items: initialItems.length > 0
                ? initialItems.map(i => ({
                    description: i.description,
                    quantity: i.quantity,
                    unitPrice: i.unitPrice / 100,
                    totalPrice: i.totalPrice / 100,
                    category: i.suggestedCategory || ""
                }))
                : [{ description: "", quantity: 1, unitPrice: 0, totalPrice: 0, category: "" }]
        }
    });

    const { fields, append, remove } = useFieldArray({
        control,
        name: "items"
    });

    // value watcher to calculate totals
    const watchedItems = watch("items");
    const currentTotal = watchedItems.reduce((sum, item) => sum + (item.totalPrice || 0), 0);
    const targetTotal = receiptTotal / 100;
    const difference = Math.abs(currentTotal - targetTotal);
    const isBalanced = difference < 0.05; // Tolerance for floating point

    // Auto-calculate Total Price when Qty or Unit Price changes
    // Note: In a real complex form, we might use useEffect per row, 
    // but for simplicity we rely on manual entry or simple effects.
    // Let's keep it simple: User edits total directly or we verify.

    const handleSave = (data: SplitEntryForm) => {
        if (!isBalanced) {
            if (!confirm(`Total mismatch (Diff: ${difference.toFixed(2)}). Proceed anyway?`)) {
                return; // User cancelled
            }
        }

        // Convert back to Satang
        const payload = data.items.map(i => ({
            ...i,
            unitPrice: Math.round(i.unitPrice * 100),
            totalPrice: Math.round(i.totalPrice * 100),
        }));

        onConfirm(payload);
    };

    return (
        <div className="space-y-4">
            <div className="bg-bg-input/50 rounded-lg p-4 mb-4 border border-border-default">
                <div className="flex justify-between items-center text-sm mb-2">
                    <span className="text-text-secondary">Expected Total:</span>
                    <span className="font-mono font-medium text-text-primary">{formatCurrency(receiptTotal)}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                    <span className="text-text-secondary">Current Total:</span>
                    <span className={`font-mono font-medium ${isBalanced ? 'text-success' : 'text-error'}`}>
                        ฿{currentTotal.toFixed(2)}
                    </span>
                </div>
                {!isBalanced && (
                    <div className="flex items-center gap-1 mt-2 text-xs text-error bg-error/10 p-2 rounded">
                        <AlertTriangle className="h-3 w-3" />
                        <span>Mismatch of ฿{difference.toFixed(2)}</span>
                    </div>
                )}
            </div>

            <form onSubmit={handleSubmit(handleSave)} className="space-y-4">
                <div className="max-h-[300px] overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                    {fields.map((field, index) => (
                        <div key={field.id} className="grid grid-cols-12 gap-2 items-start bg-bg-app p-2 rounded border border-border-default/50 hover:border-border-default transition-colors group">

                            {/* Description & Category */}
                            <div className="col-span-12 sm:col-span-5 space-y-1">
                                <input
                                    {...register(`items.${index}.description` as const)}
                                    placeholder="Item description"
                                    className="w-full text-sm bg-transparent border-none focus:ring-0 p-0 text-text-primary placeholder:text-text-secondary/50 font-medium"
                                />
                                <div className="flex gap-2">
                                    <input
                                        {...register(`items.${index}.category` as const)}
                                        placeholder="Category"
                                        className="text-xs bg-bg-input px-2 py-1 rounded w-32 border-none focus:ring-1 text-text-secondary"
                                    />
                                    {initialItems[index]?.aiConfidence && initialItems[index].aiConfidence > 0.8 && (
                                        <Badge variant="info" className="h-5 text-[10px] px-1">
                                            <Sparkles className="w-2 h-2 mr-1" />
                                            {Math.round(initialItems[index].aiConfidence * 100)}%
                                        </Badge>
                                    )}
                                </div>
                                {errors.items?.[index]?.description && (
                                    <span className="text-[10px] text-error">{errors.items[index]?.description?.message}</span>
                                )}
                            </div>

                            {/* Qty */}
                            <div className="col-span-3 sm:col-span-2">
                                <label className="text-[10px] text-text-secondary block sm:hidden">Qty</label>
                                <input
                                    type="number"
                                    {...register(`items.${index}.quantity` as const, { valueAsNumber: true })}
                                    className="w-full text-sm bg-bg-input rounded px-2 py-1 text-right text-text-primary"
                                    placeholder="1"
                                />
                                {errors.items?.[index]?.quantity && (
                                    <span className="text-[10px] text-error block">{errors.items[index]?.quantity?.message}</span>
                                )}
                            </div>

                            {/* Total Price */}
                            <div className="col-span-4 sm:col-span-4">
                                <label className="text-[10px] text-text-secondary block sm:hidden">Total</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    {...register(`items.${index}.totalPrice` as const, { valueAsNumber: true })}
                                    className="w-full text-sm bg-bg-input rounded px-2 py-1 text-right font-mono text-text-primary"
                                />
                                {errors.items?.[index]?.totalPrice && (
                                    <span className="text-[10px] text-error block">{errors.items[index]?.totalPrice?.message}</span>
                                )}
                            </div>

                            {/* Delete */}
                            <div className="col-span-1 flex justify-end pt-1">
                                <button
                                    type="button"
                                    onClick={() => remove(index)}
                                    className="text-text-secondary hover:text-error opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="flex gap-2 justify-between pt-2">
                    <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => append({ description: "", quantity: 1, unitPrice: 0, totalPrice: 0, category: "" })}
                        className="text-xs"
                    >
                        <Plus className="h-3 w-3 mr-1" />
                        Add Line
                    </Button>

                    <div className="flex gap-2">
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={onCancel}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            variant="primary"
                            size="sm"
                        >
                            <Check className="h-3 w-3 mr-1" />
                            Confirm Split
                        </Button>
                    </div>
                </div>
            </form>
        </div>
    );
}
