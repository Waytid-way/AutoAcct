'use client';

import { useState } from 'react';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Select';
import { ConfidenceBadge } from './ConfidenceBadge';
import { formatCurrency } from '@/lib/utils';
import { ChevronDown, ChevronRight, Sparkles } from 'lucide-react';
import type { Receipt, LineItem } from '@/types/api.types';

interface SplitEntryReviewCardProps {
    receipt: Receipt;
    lineItems: LineItem[];
    onApprove: (items: LineItem[]) => Promise<void>;
    onReject: () => void;
}

export function SplitEntryReviewCard({
    receipt,
    lineItems: initialItems,
    onApprove,
    onReject
}: SplitEntryReviewCardProps) {
    const [expanded, setExpanded] = useState(false);
    const [items, setItems] = useState<LineItem[]>(initialItems);
    const [loading, setLoading] = useState(false);

    const handleCategoryChange = (itemIndex: number, category: string) => {
        setItems(prev =>
            prev.map((item, idx) =>
                idx === itemIndex
                    ? { ...item, category }
                    : item
            )
        );
    };

    const handleReset = () => {
        setItems(initialItems);
    };

    const handleApprove = async () => {
        setLoading(true);
        try {
            await onApprove(items);
        } catch (error) {
            console.error('Failed to approve split:', error);
        } finally {
            setLoading(false);
        }
    };

    const totalAmount = items.reduce(
        (sum, item) => sum + item.totalPrice,
        0
    );

    return (
        <Card className="border border-border-default hover:border-border-strong transition-colors">
            <CardHeader className="flex flex-row justify-between items-center">
                <div className="flex-1">
                    <div className="flex items-center gap-2">
                        <h3 className="text-lg font-semibold text-text-primary">
                            {receipt.extractedFields?.vendor || 'Unknown Vendor'}
                        </h3>
                        <Badge variant="default" className="bg-accent/10 text-accent">
                            <Sparkles className="w-3 h-3 mr-1" />
                            AI Classified
                        </Badge>
                    </div>
                    <p className="text-sm text-text-secondary mt-1">
                        Total: <span className="font-mono font-semibold text-text-primary">
                            {formatCurrency(totalAmount)}
                        </span>
                    </p>
                </div>

                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setExpanded(!expanded)}
                    className="flex items-center gap-2"
                >
                    {expanded ? (
                        <ChevronDown className="w-4 h-4" />
                    ) : (
                        <ChevronRight className="w-4 h-4" />
                    )}
                    <span className="text-sm">{items.length} items</span>
                </Button>
            </CardHeader>

            {expanded && (
                <CardContent className="space-y-4 pt-0">
                    {/* Line Items List */}
                    <div className="space-y-3">
                        {items.map((item, idx) => (
                            <div
                                key={idx}
                                className="flex flex-col gap-2 p-3 rounded-lg bg-surface-subtle border border-border-subtle"
                            >
                                {/* Item Header */}
                                <div className="flex justify-between items-start">
                                    <div className="flex-1">
                                        <p className="font-medium text-text-primary">
                                            {idx + 1}. {item.description}
                                        </p>
                                        <p className="text-sm text-text-tertiary">
                                            Qty: {item.quantity} × {formatCurrency(item.unitPrice)}
                                        </p>
                                    </div>
                                    <span className="font-mono text-base font-semibold text-text-primary">
                                        {formatCurrency(item.totalPrice)}
                                    </span>
                                </div>

                                {/* Category Selection */}
                                <div className="flex items-center gap-3">
                                    <label className="text-sm text-text-secondary w-20">
                                        Category:
                                    </label>

                                    <Select
                                        value={item.category || item.suggestedCategory || 'PENDING_REVIEW'}
                                        onChange={(e) => handleCategoryChange(idx, e.target.value)}
                                        className="flex-1 bg-background-app border-border-default"
                                    >
                                        <option value="5100-Food">🍔 Food & Beverage</option>
                                        <option value="5200-Office">📎 Office Supplies</option>
                                        <option value="5300-Utilities">⚡ Utilities</option>
                                        <option value="5400-Salary">👥 Salary</option>
                                        <option value="5500-Rent">🏢 Rent</option>
                                        <option value="5600-Transportation">🚕 Transportation</option>
                                        <option value="5700-Marketing">📢 Marketing</option>
                                        <option value="5800-IT">💻 IT Equipment</option>
                                        <option value="5900-Miscellaneous">📦 Miscellaneous</option>
                                        <option value="PENDING_REVIEW">⚠️ Pending Review</option>
                                    </Select>

                                    {/* Confidence Badge */}
                                    {item.aiConfidence !== undefined && (
                                        <ConfidenceBadge
                                            confidence={item.aiConfidence}
                                        />
                                    )}
                                </div>

                                {/* AI Reasoning (if available) */}
                                {item.aiReasoning && (
                                    <p className="text-xs text-text-tertiary italic">
                                        💡 {item.aiReasoning}
                                    </p>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex justify-between items-center pt-4 border-t border-border-subtle">
                        <Button
                            variant="ghost"
                            onClick={handleReset}
                            disabled={loading}
                        >
                            Reset to AI Suggestions
                        </Button>

                        <div className="flex gap-2">
                            <Button
                                variant="secondary"
                                onClick={onReject}
                                disabled={loading}
                            >
                                Reject
                            </Button>
                            <Button
                                variant="primary"
                                onClick={handleApprove}
                                disabled={loading}
                            >
                                {loading ? 'Processing...' : `Approve Split (${items.length} entries)`}
                            </Button>
                        </div>
                    </div>
                </CardContent>
            )}
        </Card>
    );
}
