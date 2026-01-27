// backend/src/utils/response.ts

/**
 * STANDARDIZED RESPONSE FORMATTERS
 * 
 * All API responses follow a consistent structure for predictable client handling.
 * 
 * Reference: Skill 1 - REST Controller Pattern
 */

interface SuccessResponse<T> {
    success: true;
    data: T;
    meta: {
        correlationId: string;
        timestamp: string;
    };
}

interface PaginatedResponse<T> extends SuccessResponse<T> {
    pagination: {
        page: number;
        perPage: number;
        total: number;
        totalPages: number;
    };
}

/**
 * Success response formatter
 * 
 * @param data - Response payload
 * @param correlationId - Request correlation ID for tracing
 * @returns Standardized success response
 */
export function successResponse<T>(
    data: T,
    correlationId: string
): SuccessResponse<T> {
    return {
        success: true,
        data,
        meta: {
            correlationId,
            timestamp: new Date().toISOString(),
        },
    };
}

/**
 * Paginated response formatter
 * 
 * @param data - Array of items
 * @param pagination - Pagination metadata
 * @param correlationId - Request correlation ID for tracing
 * @returns Standardized paginated response
 */
export function paginatedResponse<T>(
    data: T[],
    pagination: {
        page: number;
        perPage: number;
        total: number;
        totalPages: number;
    },
    correlationId: string
): PaginatedResponse<T[]> {
    return {
        success: true,
        data,
        pagination,
        meta: {
            correlationId,
            timestamp: new Date().toISOString(),
        },
    };
}
