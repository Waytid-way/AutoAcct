"use client";

import React, { useState } from 'react';
import { useAnomalies, useAnomalyStatistics, useAnomalyActions } from '@/hooks/useAnomalies';
import { AnomalyList } from '@/components/Anomaly/AnomalyList';
import { Button } from '@/components/ui/Button';
import { AnomalyStatistics } from '@/types/anomaly.types';
import { AlertTriangle, TrendingUp, CheckCircle, RefreshCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/utils';

export default function AnomalyDashboardPage() {
    const { data: anomalies = [], isLoading: isLoadingList, refetch } = useAnomalies({ severity: 'all' });
    const { data: stats, isLoading: isLoadingStats } = useAnomalyStatistics();
    const { dismiss, review } = useAnomalyActions();

    const handleDismiss = (id: string) => {
        dismiss(id);
    };

    const handleReview = (id: string) => {
        review(id);
        alert(`Redirecting to review transaction ${id}...`);
    };

    return (
        <div className="container mx-auto p-6 max-w-7xl space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-zinc-100 tracking-tight flex items-center gap-2">
                        <AlertTriangle className="w-8 h-8 text-blue-500" />
                        Anomaly Detection
                    </h1>
                    <p className="text-zinc-400 mt-1">
                        Monitor and resolve accounting discrepancies detected by AI.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="secondary" size="sm" onClick={() => refetch()} className="bg-zinc-800 text-zinc-200 hover:bg-zinc-700">
                        <RefreshCcw className="w-4 h-4 mr-2" />
                        Refresh
                    </Button>
                </div>
            </div>

            {/* Statistics Section */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <StatCard
                    title="Total Anomalies"
                    value={stats?.total || 0}
                    icon={AlertTriangle}
                    color="text-blue-500"
                    isLoading={isLoadingStats}
                />
                <StatCard
                    title="Critical"
                    value={stats?.bySeverity.critical || 0}
                    icon={AlertTriangle}
                    color="text-red-500"
                    bg="bg-red-500/10"
                    isLoading={isLoadingStats}
                />
                <StatCard
                    title="Warnings"
                    value={stats?.bySeverity.warning || 0}
                    icon={AlertTriangle}
                    color="text-amber-500"
                    bg="bg-amber-500/10"
                    isLoading={isLoadingStats}
                />
                <StatCard
                    title="Resolved Today"
                    value={12} // Mock for now
                    icon={CheckCircle}
                    color="text-green-500"
                    bg="bg-green-500/10"
                    isLoading={isLoadingStats}
                />
            </div>

            {/* Main Content Area */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[600px]">
                {/* Left: List */}
                <div className="lg:col-span-2 h-full flex flex-col">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-t-xl p-4 border-b-0">
                        <h3 className="font-semibold text-zinc-100">Detected Issues</h3>
                    </div>
                    <div className="flex-1 min-h-0 border border-t-0 border-zinc-800 rounded-b-xl overflow-hidden bg-black">
                        {isLoadingList ? (
                            <div className="flex items-center justify-center h-full">
                                <span className="text-zinc-500 animate-pulse">Loading anomalies...</span>
                            </div>
                        ) : (
                            <AnomalyList
                                anomalies={anomalies}
                                onDismiss={handleDismiss}
                                onReview={handleReview}
                            />
                        )}
                    </div>
                </div>

                {/* Right: Details / Hints (Mock Placeholder for Widget) */}
                <div className="space-y-4">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
                        <h3 className="font-semibold text-zinc-100 mb-4 flex items-center">
                            <TrendingUp className="w-4 h-4 mr-2 text-blue-500" />
                            Trend Analysis
                        </h3>
                        <div className="text-sm text-zinc-400 space-y-4">
                            <p>Most anomalies this week are related to <span className="text-zinc-200 font-medium">VAT Mismatch</span>.</p>

                            <div className="h-32 bg-black rounded flex items-center justify-center border border-zinc-800 border-dashed">
                                <span className="text-xs text-zinc-600">Chart Placeholder</span>
                            </div>

                            <div className="p-3 bg-blue-500/5 rounded border border-blue-500/20">
                                <p className="text-xs text-blue-400 font-medium mb-1">AI Insight</p>
                                <p className="text-xs text-zinc-400">
                                    Recurring price variance detected for "Office Supplies" vendor. Consider updating base cost in master data.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// Simple internal component for stats
interface StatCardProps {
    title: string;
    value: number | string;
    icon: React.ComponentType<{ className?: string }>;
    color: string;
    bg?: string;
    isLoading?: boolean;
}

function StatCard({ title, value, icon: Icon, color, bg, isLoading }: StatCardProps) {
    return (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex items-center justify-between hover:border-zinc-700 transition-colors">
            <div>
                <p className="text-sm text-zinc-400 font-medium">{title}</p>
                {isLoading ? (
                    <div className="h-8 w-16 bg-zinc-800 animate-pulse rounded mt-1" />
                ) : (
                    <p className="text-2xl font-bold text-zinc-100 mt-1">{value}</p>
                )}
            </div>
            <div className={cn("p-2.5 rounded-lg", bg || "bg-zinc-800")}>
                <Icon className={cn("w-5 h-5", color)} />
            </div>
        </div>
    );
}
