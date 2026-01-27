// backend/src/modules/transaction/validators/transaction.validators.ts

import { z } from 'zod';
import { moneyIntSchema, clientIdSchema, paginationSchema, uuidSchema } from '@/utils/validators/common.validators';

/**
 * Account Code Schema
 */
const accountCodeSchema = z.string()
    .regex(/^\d{4}-.+$/, 'Account code must start with 4 digits followed by dash and name')
    .min(6, 'Account code too short')
    .max(50, 'Account code too long');

/**
 * Base Transaction Schema (Without refinements)
 */
const baseTransactionSchema = z.object({
    clientId: clientIdSchema,
    receiptId: uuidSchema.optional(),

    account: z.object({
        debit: accountCodeSchema,
        credit: accountCodeSchema,
    }),

    debit: moneyIntSchema,
    credit: moneyIntSchema,

    description: z.string()
        .min(10, 'Description must be at least 10 characters')
        .max(500, 'Description cannot exceed 500 characters'),

    reference: z.string().max(100).optional(),

    date: z.coerce.date()
        .refine((d) => {
            const minDate = new Date('1900-01-01');
            const maxDate = new Date();
            maxDate.setDate(maxDate.getDate() + 1); // Allow tomorrow
            return d >= minDate && d <= maxDate;
        }, {
            message: 'Date must be between 1900 and tomorrow',
        }),
});

/**
 * Create Transaction Schema
 * Enforces Double-Entry Rule
 */
export const createTransactionSchema = baseTransactionSchema.refine(
    (data) => data.debit === data.credit,
    {
        message: 'Debit must equal Credit (double-entry accounting)',
        path: ['credit'],
    }
);

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;

/**
 * Update Transaction Schema
 * Only used for Drafts.
 */
export const updateTransactionSchema = baseTransactionSchema
    .partial()
    .omit({ clientId: true })
    .refine(
        (data) => {
            // If both debit and credit provided, they must match
            if (data.debit !== undefined && data.credit !== undefined) {
                return data.debit === data.credit;
            }
            return true;
        },
        {
            message: 'If updating amounts, Debit must equal Credit',
            path: ['credit'],
        }
    );

export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>;

/**
 * Query Transactions Schema
 */
export const queryTransactionsSchema = paginationSchema.extend({
    status: z.enum(['draft', 'posted', 'voided']).optional(),
    receiptId: uuidSchema.optional(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
});

export type QueryTransactionsInput = z.infer<typeof queryTransactionsSchema>;

/**
 * Approve Transaction Schema
 */
export const approveTransactionSchema = z.object({
    notes: z.string().max(500).optional(),
});

export type ApproveTransactionInput = z.infer<typeof approveTransactionSchema>;

/**
 * Void Transaction Schema
 */
export const voidTransactionSchema = z.object({
    reason: z.string()
        .min(10, 'Void reason must be at least 10 characters')
        .max(500, 'Void reason cannot exceed 500 characters'),
});

export type VoidTransactionInput = z.infer<typeof voidTransactionSchema>;
