// backend/src/modules/receipt/validators/receipt.validators.ts

import { z } from 'zod';
import {
    uuidSchema,
    moneyIntSchema,
    paginationSchema,
    receiptStatusSchema,
} from '@/utils/validators/common.validators';

/**
 * RECEIPT VALIDATORS
 * 
 * Zod schemas for Receipt module with MoneyInt validation.
 * 
 * Reference: Skill 2 - Zod Validator Pattern
 * Reference: Phase 2.2 Guide - Task 1
 */

// ===========================
// Upload Receipt Schema
// ===========================

export const uploadReceiptSchema = z.object({
    clientId: uuidSchema,
});

export type UploadReceiptInput = z.infer<typeof uploadReceiptSchema>;

// ===========================
// Queue Query Schema
// ===========================

export const queueQuerySchema = paginationSchema.extend({
    clientId: uuidSchema.optional(),
    status: receiptStatusSchema.optional(),
});

export type QueueQueryInput = z.infer<typeof queueQuerySchema>;

// ===========================
// Process Queue Schema
// ===========================

export const processQueueSchema = z.object({
    limit: z.number()
        .int('Limit must be an integer')
        .min(1, 'Minimum 1 receipt')
        .max(50, 'Maximum 50 receipts per batch')
        .default(5),
});

export type ProcessQueueInput = z.infer<typeof processQueueSchema>;

// ===========================
// Feedback Schema
// ===========================

export const feedbackSchema = z.object({
    corrections: z.object({
        vendor: z.string()
            .min(1, 'Vendor name cannot be empty')
            .max(200, 'Vendor name too long')
            .optional(),
        amount: moneyIntSchema.optional(),
        date: z.coerce.date().optional(),
        category: z.string()
            .min(1, 'Category cannot be empty')
            .max(100, 'Category too long')
            .optional(),
    }).optional(),
    notes: z.string()
        .max(500, 'Notes cannot exceed 500 characters')
        .optional(),
});

export type FeedbackInput = z.infer<typeof feedbackSchema>;

// ===========================
// Confirm Receipt Schema
// ===========================

export const confirmReceiptSchema = z.object({
    vendor: z.string()
        .min(3, 'Vendor name must be at least 3 characters')
        .max(100, 'Vendor name cannot exceed 100 characters'),
    amount: moneyIntSchema, // Satang (integer)
    date: z.string()
        .refine((val) => {
            const date = new Date(val);
            return !isNaN(date.getTime()) && date <= new Date();
        }, 'Invalid date or future date'),
    category: z.string()
        .min(1, 'Category cannot be empty')
        .max(100, 'Category too long')
        .optional(),
    lineItems: z.array(z.object({
        description: z.string().min(1, 'Description required'),
        quantity: z.number().min(1),
        unitPrice: moneyIntSchema, // Satang
        totalPrice: moneyIntSchema, // Satang
        category: z.string().optional(),
    })).optional(),
});

export type ConfirmReceiptInput = z.infer<typeof confirmReceiptSchema>;
