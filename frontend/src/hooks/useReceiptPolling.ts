"use client";

import { useQuery, useQueryClient, UseQueryResult } from "@tanstack/react-query";
import { useEffect, useRef, useState, useCallback } from "react";
import { getReceipt } from "@/lib/api-client";
import type { ReceiptDetailResponse } from "@/types/api.types";

const POLLING_INTERVAL = 2000; // 2 seconds
const POLLING_TIMEOUT = 60000;  // 60 seconds

export interface UseReceiptPollingOptions {
    receiptId: string;
    clientId: string;
    enabled?: boolean;
    onStatusChange?: (status: string) => void;
    onProcessed?: (data: ReceiptDetailResponse) => void;
    onError?: (data: ReceiptDetailResponse) => void;
    onTimeout?: () => void;
}

/**
 * useReceiptPolling Hook
 * 
 * Polls receipt status with proper cleanup and memory management.
 * FIXED: Memory leaks from improper cleanup and duplicate callbacks.
 * 
 * @param options - Polling configuration
 * @returns Query result with polling status
 */
export function useReceiptPolling({
    receiptId,
    clientId,
    enabled = true,
    onStatusChange,
    onProcessed,
    onError,
    onTimeout,
}: UseReceiptPollingOptions): UseQueryResult<ReceiptDetailResponse, Error> & {
    isPolling: boolean;
    hasTimedOut: boolean;
} {
    const queryClient = useQueryClient();
    const [hasTimedOut, setHasTimedOut] = useState(false);
    
    // Use refs to avoid re-renders and track state without causing effects
    const startTimeRef = useRef<number>(Date.now());
    const previousStatusRef = useRef<string | null>(null);
    const timeoutCalledRef = useRef<boolean>(false);
    const callbacksCalledRef = useRef<Set<string>>(new Set());

    // Reset refs when receiptId changes - FIX #1: Reset timer on new receipt
    useEffect(() => {
        startTimeRef.current = Date.now();
        previousStatusRef.current = null;
        timeoutCalledRef.current = false;
        callbacksCalledRef.current.clear();
        setHasTimedOut(false);

        // Cleanup function - FIX #2: Cancel in-flight requests on unmount/receipt change
        return () => {
            queryClient.cancelQueries({ queryKey: ["receipt", receiptId] });
        };
    }, [receiptId, clientId, queryClient]);

    const query = useQuery({
        queryKey: ["receipt", receiptId],
        queryFn: () => getReceipt(receiptId, clientId),
        enabled,
        refetchInterval: (query) => {
            const data = query.state.data;

            // Check timeout - only call onTimeout once
            if (Date.now() - startTimeRef.current > POLLING_TIMEOUT) {
                if (!timeoutCalledRef.current && !hasTimedOut) {
                    timeoutCalledRef.current = true;
                    setHasTimedOut(true);
                    onTimeout?.();
                }
                return false;
            }

            // Stop polling if processed or error
            if (data?.data.status === "processed" || data?.data.status === "error") {
                return false;
            }

            // Continue polling
            return POLLING_INTERVAL;
        },
        refetchIntervalInBackground: false,
        staleTime: 0,
    });

    // Watch for status changes - FIX #3: Prevent duplicate callbacks
    useEffect(() => {
        if (query.data) {
            const currentStatus = query.data.data.status;
            const receiptId = query.data.data.id;
            
            // Create unique key for this callback
            const callbackKey = `${receiptId}-${currentStatus}`;

            // Only process if status changed and callback hasn't been called
            if (currentStatus !== previousStatusRef.current && 
                !callbacksCalledRef.current.has(callbackKey)) {
                
                previousStatusRef.current = currentStatus;
                callbacksCalledRef.current.add(callbackKey);

                onStatusChange?.(currentStatus);

                if (currentStatus === "processed") {
                    onProcessed?.(query.data);
                } else if (currentStatus === "error") {
                    onError?.(query.data);
                }
            }
        }
    }, [query.data, onStatusChange, onProcessed, onError]);

    const isPolling =
        enabled &&
        !hasTimedOut &&
        query.data?.data.status !== "processed" &&
        query.data?.data.status !== "error";

    return {
        ...query,
        isPolling,
        hasTimedOut,
    };
}

/**
 * Optimized version with manual polling control
 * Use this if you need more control over the polling lifecycle
 */
export function useReceiptPollingManual({
    receiptId,
    clientId,
    enabled = true,
    onStatusChange,
    onProcessed,
    onError,
    onTimeout,
}: UseReceiptPollingOptions) {
    const queryClient = useQueryClient();
    const [hasTimedOut, setHasTimedOut] = useState(false);
    const [isPolling, setIsPolling] = useState(false);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    const startTimeRef = useRef<number>(Date.now());
    const previousStatusRef = useRef<string | null>(null);
    const abortControllerRef = useRef<AbortController | null>(null);

    const stopPolling = useCallback(() => {
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }
        setIsPolling(false);
    }, []);

    const startPolling = useCallback(() => {
        if (!enabled || hasTimedOut) return;
        
        stopPolling(); // Ensure no duplicate intervals
        
        startTimeRef.current = Date.now();
        setIsPolling(true);
        abortControllerRef.current = new AbortController();

        intervalRef.current = setInterval(async () => {
            // Check timeout
            if (Date.now() - startTimeRef.current > POLLING_TIMEOUT) {
                setHasTimedOut(true);
                stopPolling();
                onTimeout?.();
                return;
            }

            try {
                const data = await getReceipt(receiptId, clientId);
                const currentStatus = data.data.status;

                // Status changed
                if (currentStatus !== previousStatusRef.current) {
                    previousStatusRef.current = currentStatus;
                    onStatusChange?.(currentStatus);

                    if (currentStatus === "processed") {
                        onProcessed?.(data);
                        stopPolling();
                    } else if (currentStatus === "error") {
                        onError?.(data);
                        stopPolling();
                    }
                }
            } catch (error) {
                // Ignore abort errors
                if ((error as Error).name !== 'AbortError') {
                    console.error('Polling error:', error);
                }
            }
        }, POLLING_INTERVAL);
    }, [receiptId, clientId, enabled, hasTimedOut, onStatusChange, onProcessed, onError, onTimeout, stopPolling]);

    // Cleanup on unmount or receiptId change
    useEffect(() => {
        startPolling();

        return () => {
            stopPolling();
            // Clear query cache for this receipt to prevent memory buildup
            queryClient.removeQueries({ queryKey: ["receipt", receiptId] });
        };
    }, [receiptId, clientId, enabled, startPolling, stopPolling, queryClient]);

    return {
        isPolling,
        hasTimedOut,
        startPolling,
        stopPolling,
    };
}

export default useReceiptPolling;
