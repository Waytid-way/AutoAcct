"use client";

import { useQuery, UseQueryResult } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
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
    const [hasTimedOut, setHasTimedOut] = useState(false);
    const startTimeRef = useRef<number>(Date.now());
    const previousStatusRef = useRef<string | null>(null);

    const query = useQuery({
        queryKey: ["receipt", receiptId],
        queryFn: () => getReceipt(receiptId, clientId),
        enabled,
        refetchInterval: (query) => {
            const data = query.state.data;

            // Check timeout
            if (Date.now() - startTimeRef.current > POLLING_TIMEOUT) {
                if (!hasTimedOut) {
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

    // Watch for status changes
    useEffect(() => {
        if (query.data) {
            const currentStatus = query.data.data.status;

            if (currentStatus !== previousStatusRef.current) {
                previousStatusRef.current = currentStatus;
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
