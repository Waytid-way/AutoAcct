// backend/src/utils/validators/common.validators.ts

import { z } from 'zod';

/**
 * COMMON VALIDATORS
 * 
 * Base schemas used across the entire application.
 * Import and compose them in module-specific validators.
 * 
 * Reference: Skill 2 - Zod Validator Pattern
 */

// ===========================
// UUID Validation
// ===========================

export const uuidSchema = z.string()
    .uuid('Invalid UUID format')
    .describe('UUID identifier');

export type Uuid = z.infer<typeof uuidSchema>;

export const clientIdSchema = uuidSchema.describe('Client/Tenant ID');


// ===========================
// MoneyInt Validation (GOLDEN RULE #1)
// ===========================

/**
 * MoneyInt Schema - GOLDEN RULE #1
 * 
 * Validates monetary amounts as Integer Satang.
 * 
 * Rules:
 * - MUST be integer (no decimals)
 * - MUST be non-negative (no negative amounts)
 * - MUST be ≤ 1,000,000,000 Satang (10,000,000 THB max)
 * 
 * Conversion:
 * - 1 THB = 100 Satang
 * - 50.00 THB = 5,000 Satang
 * - 1,234.56 THB = 123,456 Satang
 */
export const moneyIntSchema = z.number()
    .int('Amount must be integer Satang (no decimals)')
    .nonnegative('Amount cannot be negative')
    .max(1_000_000_000, 'Maximum amount is 10,000,000 THB (1,000,000,000 Satang)')
    .describe('Monetary amount in Satang (1 THB = 100 Satang)');

export type MoneyInt = z.infer<typeof moneyIntSchema>;

// ===========================
// Pagination
// ===========================

export const paginationSchema = z.object({
    page: z.number().int().min(1, 'Page must be at least 1').default(1),
    perPage: z.number()
        .int()
        .min(1, 'Items per page must be at least 1')
        .max(100, 'Maximum 100 items per page')
        .default(20),
});

export type Pagination = z.infer<typeof paginationSchema>;

// ===========================
// Date Range
// ===========================

export const dateRangeSchema = z.object({
    from: z.coerce.date(),
    to: z.coerce.date(),
}).refine((data) => data.from <= data.to, {
    message: 'Start date must be before or equal to end date',
    path: ['from'],
});

export type DateRange = z.infer<typeof dateRangeSchema>;

// ===========================
// Status Enum (Common)
// ===========================

export const receiptStatusSchema = z.enum([
    'queued_for_ocr',
    'processing',
    'processed',
    'failed',
    'needs_review',
    'confirmed',
]);

export type ReceiptStatus = z.infer<typeof receiptStatusSchema>;

// ===========================
// Correlation ID
// ===========================

export const correlationIdSchema = z.string()
    .uuid('Invalid correlation ID format')
    .describe('Request correlation ID for tracing');

export type CorrelationId = z.infer<typeof correlationIdSchema>;
