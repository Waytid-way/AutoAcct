// backend/src/utils/money.ts

/**
 * MONEY UTILITIES - Golden Rule #1: Integer Only
 * 
 * ALL monetary values MUST be stored as integers (Satang), never floats.
 * This prevents floating-point arithmetic errors.
 * 
 * Why?
 * ❌ WRONG: 0.1 + 0.2 = 0.30000000000000004
 * ✅ CORRECT: 10 + 20 = 30 (Satang)
 * 
 * Reference: Vol 1 Section 7 - Integer Money Pattern
 */

import { z } from 'zod';





/**
 * MoneyInt - Brand type to enforce integer-only amounts
 * TypeScript will prevent assigning regular numbers without conversion
 */
export type MoneyInt = number & { readonly brand: 'MoneyInt' };

/**
 * Zod schema for strict integer validation
 */
export const MoneyIntSchema = z
    .number()
    .int('Amount must be integer (Satang)')
    .nonnegative('Amount must be non-negative')
    .refine(
        (v: number) => v <= Number.MAX_SAFE_INTEGER,
        'Amount exceeds max safe integer'
    )
    .transform((val) => val as MoneyInt);

/**
 * Convert Baht (display) → Satang (storage)
 * @param baht - Amount in Baht (e.g., 125.50)
 * @returns MoneyInt - Amount in Satang (e.g., 12550)
 * 
 * @example
 * bahtToSatang(125.50) // returns 12550
 * bahtToSatang(0.01)   // returns 1
 */
export function bahtToSatang(baht: number): MoneyInt {
    const satang = Math.round(baht * 100);
    return satang as MoneyInt;
}

/**
 * Convert Satang (storage) → Baht (display)
 * @param satang - Amount in Satang (e.g., 12550)
 * @returns string - Formatted to 2 decimals (e.g., "125.50")
 * 
 * @example
 * satangToBaht(12550 as MoneyInt) // returns "125.50"
 * satangToBaht(100 as MoneyInt)   // returns "1.00"
 */
export function satangToBaht(satang: MoneyInt): string {
    return (satang / 100).toFixed(2);
}

/**
 * Validate that value is a valid MoneyInt
 */
export function isValidMoneyInt(value: unknown): value is MoneyInt {
    return (
        typeof value === 'number' &&
        Number.isInteger(value) &&
        value >= 0 &&
        value <= Number.MAX_SAFE_INTEGER
    );
}

/**
 * Safe arithmetic operations on MoneyInt
 */
export const money = {
    /**
     * Add multiple MoneyInt values
     * @example money.add(100 as MoneyInt, 200 as MoneyInt) // returns 300
     */
    add(...amounts: MoneyInt[]): MoneyInt {
        const sum = amounts.reduce((acc, val) => acc + val, 0);
        if (!isValidMoneyInt(sum)) {
            throw new Error('Money add overflow');
        }
        return sum as MoneyInt;
    },

    /**
     * Subtract MoneyInt values
     * @example money.subtract(300 as MoneyInt, 100 as MoneyInt) // returns 200
     */
    subtract(a: MoneyInt, b: MoneyInt): MoneyInt {
        const diff = a - b;
        if (!isValidMoneyInt(diff)) {
            throw new Error('Money subtract invalid (negative result)');
        }
        return diff as MoneyInt;
    },

    /**
     * Multiply MoneyInt by a factor
     * @example money.multiply(100 as MoneyInt, 3) // returns 300
     */
    multiply(amount: MoneyInt, factor: number): MoneyInt {
        const result = Math.round(amount * factor);
        if (!isValidMoneyInt(result)) {
            throw new Error('Money multiply overflow');
        }
        return result as MoneyInt;
    },

    /**
     * Divide MoneyInt by a divisor
     * @example money.divide(300 as MoneyInt, 3) // returns 100
     */
    divide(amount: MoneyInt, divisor: number): MoneyInt {
        const result = Math.round(amount / divisor);
        if (!isValidMoneyInt(result)) {
            throw new Error('Money divide invalid');
        }
        return result as MoneyInt;
    },
};

/**
 * PLUG METHOD - Golden Rule #2: Remainder Handling
 * 
 * Split amount into N parts ensuring sum equals total.
 * 
 * Why? 100 ÷ 3 = 33.33... (floating point)
 * Solution: [34, 33, 33] = 100 (integer split)
 * 
 * @param total - Total amount to split (Satang)
 * @param parts - Number of parts to split into
 * @returns Array of MoneyInt where sum === total
 * 
 * @example
 * plugSplit(10000, 3) // returns [3334, 3333, 3333] (sum = 10000)
 * plugSplit(100, 3)   // returns [34, 33, 33] (sum = 100)
 * 
 * Reference: Vol 1 Section 3 - The Plug Method
 */
export function plugSplit(total: MoneyInt, parts: number): MoneyInt[] {
    if (parts <= 0) {
        throw new Error('Parts must be > 0');
    }

    const baseAmount = Math.floor(total / parts);
    const remainder = total % parts;
    const result = Array(parts).fill(baseAmount);

    // Add remainder to first item (could also add to largest)
    result[0] += remainder;

    // Verify sum equals total
    const sum = result.reduce((a, b) => a + b, 0);
    if (sum !== total) {
        throw new Error(`Plug method failed: sum ${sum} ≠ total ${total}`);
    }

    return result as MoneyInt[];
}

/**
 * Format MoneyInt for display with Thai Baht symbol
 * @example formatTHB(12550 as MoneyInt) // returns "฿125.50"
 */
export function formatTHB(satang: MoneyInt): string {
    return `฿${satangToBaht(satang)}`;
}

/**
 * Parse user input string to MoneyInt
 * Handles: "125.50", "125", "฿125.50"
 * @example parseMoneyInput("125.50") // returns 12550
 */
export function parseMoneyInput(input: string): MoneyInt {
    // Remove currency symbols and whitespace
    const cleaned = input.replace(/[฿,\s]/g, '');
    const baht = parseFloat(cleaned);

    if (isNaN(baht)) {
        throw new Error(`Invalid money input: ${input}`);
    }

    return bahtToSatang(baht);
}
