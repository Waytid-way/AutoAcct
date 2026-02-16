import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from "axios";
import { v4 as uuidv4 } from "uuid";
import type {
    ReceiptUploadResponse,
    ReceiptDetailResponse,
    ConfirmReceiptRequest,
    ConfirmReceiptResponse,
    ErrorResponse,
    LineItem,
} from "@/types/api.types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3001/api";
const API_TIMEOUT = parseInt(process.env.NEXT_PUBLIC_API_TIMEOUT || "30000");

/**
 * Axios instance with interceptors
 */
const apiClient: AxiosInstance = axios.create({
    baseURL: API_BASE_URL,
    timeout: API_TIMEOUT,
    headers: {
        "Content-Type": "application/json",
    },
});

/**
 * Request Interceptor
 * Adds Authorization header and correlationId to all requests
 */
apiClient.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
        // Generate correlationId for request tracing
        const correlationId = uuidv4();
        config.headers.set("x-correlation-id", correlationId);

        // Add Authorization header if token exists
        // TODO: Replace with actual auth token from context/storage
        const token = getAuthToken();
        if (token) {
            config.headers.set("Authorization", `Bearer ${token}`);
        }

        // Log request in dev mode
        if (process.env.NODE_ENV === "development") {
            console.log(`[${correlationId}] ${config.method?.toUpperCase()} ${config.url}`, {
                data: config.data,
                params: config.params,
            });
        }

        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

/**
 * Response Interceptor
 * Handles errors and logs responses
 */
apiClient.interceptors.response.use(
    (response) => {
        // Log response in dev mode
        if (process.env.NODE_ENV === "development") {
            const correlationId = response.config.headers.get("x-correlation-id");
            console.log(`[${correlationId}] Response ${response.status}`, response.data);
        }
        return response;
    },
    (error: AxiosError<ErrorResponse>) => {
        const correlationId = error.config?.headers.get("x-correlation-id") || "unknown";

        // Log error with correlationId
        console.error(`[${correlationId}] API Error:`, {
            status: error.response?.status,
            code: error.response?.data?.error?.code,
            message: error.response?.data?.error?.message || error.message,
        });

        return Promise.reject(error);
    }
);

import { authService } from "./auth";

/**
 * Get auth token (mock implementation)
 */
function getAuthToken(): string | null {
    return authService.getToken();
}

/**
 * Upload receipt file
 */
export async function uploadReceipt(
    file: File,
    clientId: string
): Promise<ReceiptUploadResponse> {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("clientId", clientId);

    const response = await apiClient.post<ReceiptUploadResponse>(
        "/receipts/upload",
        formData,
        {
            headers: {
                "Content-Type": "multipart/form-data",
            },
        }
    );

    return response.data;
}

/**
 * Get receipt details by ID
 */
export async function getReceipt(
    receiptId: string,
    clientId: string
): Promise<ReceiptDetailResponse> {
    const response = await apiClient.get<ReceiptDetailResponse>(
        `/receipts/${receiptId}`,
        {
            params: { clientId },
        }
    );

    return response.data;
}

/**
 * Confirm OCR result and create draft transaction
 */
export async function confirmReceipt(
    receiptId: string,
    data: ConfirmReceiptRequest
): Promise<ConfirmReceiptResponse> {
    const response = await apiClient.post<ConfirmReceiptResponse>(
        `/receipts/${receiptId}/confirm`,
        data
    );

    return response.data;
}

/**
 * Confirm Split Receipt
 */
export async function confirmSplitReceipt(
    receiptId: string,
    lineItems: LineItem[],
    creditAccount: string = '1101-Checking'
): Promise<ConfirmReceiptResponse> {
    const response = await apiClient.post<ConfirmReceiptResponse>(
        `/receipts/${receiptId}/confirm`,
        {
            lineItems: lineItems.map(item => ({
                description: item.description,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                totalPrice: item.totalPrice,
                category: item.category || item.suggestedCategory || 'PENDING_REVIEW'
            })),
            corrections: {
                creditAccount
            }
        }
    );

    return response.data;
}

/**
 * Delete receipt
 */
export async function deleteReceipt(receiptId: string): Promise<void> {
    await apiClient.delete(`/receipts/${receiptId}`);
}

export default apiClient;
