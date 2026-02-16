// backend/tests/unit/money.test.ts

import { describe, test, expect } from 'bun:test';
import {
    bahtToSatang,
    satangToBaht,
    plugSplit,
    money,
    formatTHB,
    parseMoneyInput,
    isValidMoneyInt,
    type MoneyInt,
} from '../../src/utils/money';

describe('Money Utils - Golden Rule #1: Integer Only', () => {
    describe('bahtToSatang()', () => {
        test('converts Baht to Satang correctly', () => {
            expect(bahtToSatang(125.5)).toBe(12550 as MoneyInt);
            expect(bahtToSatang(0.01)).toBe(1 as MoneyInt);
            expect(bahtToSatang(0)).toBe(0 as MoneyInt);
            expect(bahtToSatang(1000)).toBe(100000 as MoneyInt);
        });

        test('rounds to nearest integer', () => {
            expect(bahtToSatang(125.555)).toBe(12556 as MoneyInt); // Rounds up
            expect(bahtToSatang(125.554)).toBe(12555 as MoneyInt); // Rounds down
        });
    });

    describe('satangToBaht()', () => {
        test('converts Satang to Baht with 2 decimals', () => {
            expect(satangToBaht(12550 as MoneyInt)).toBe('125.50');
            expect(satangToBaht(100 as MoneyInt)).toBe('1.00');
            expect(satangToBaht(0 as MoneyInt)).toBe('0.00');
        });
    });

    describe('plugSplit() - Golden Rule #2', () => {
        test('ensures sum equals total', () => {
            const split = plugSplit(10000 as MoneyInt, 3);
            const sum = split.reduce((a, b) => a + b, 0);
            expect(sum).toBe(10000);
            expect(split.length).toBe(3);
        });

        test('handles remainder correctly', () => {
            const split = plugSplit(100 as MoneyInt, 3);
            // 100 ÷ 3 = 33.33... → [34, 33, 33]
            expect(split[0]).toBe(34 as MoneyInt); // Remainder added to first
            expect(split[1]).toBe(33 as MoneyInt);
            expect(split[2]).toBe(33 as MoneyInt);
        });

        test('works with even splits', () => {
            const split = plugSplit(300 as MoneyInt, 3);
            expect(split).toEqual([100 as MoneyInt, 100 as MoneyInt, 100 as MoneyInt]);
        });

        test('throws error for invalid parts', () => {
            expect(() => plugSplit(100 as MoneyInt, 0)).toThrow('Parts must be > 0');
        });
    });

    describe('money.add()', () => {
        test('adds MoneyInt values', () => {
            const result = money.add(100 as MoneyInt, 200 as MoneyInt, 300 as MoneyInt);
            expect(result).toBe(600 as MoneyInt);
        });

        test('handles zero', () => {
            const result = money.add(0 as MoneyInt, 100 as MoneyInt);
            expect(result).toBe(100 as MoneyInt);
        });
    });

    describe('money.subtract()', () => {
        test('subtracts MoneyInt values', () => {
            const result = money.subtract(300 as MoneyInt, 100 as MoneyInt);
            expect(result).toBe(200 as MoneyInt);
        });

        test('throws error for negative result', () => {
            expect(() => money.subtract(100 as MoneyInt, 200 as MoneyInt)).toThrow(
                'Money subtract invalid'
            );
        });
    });

    describe('money.multiply()', () => {
        test('multiplies MoneyInt by factor', () => {
            const result = money.multiply(100 as MoneyInt, 3);
            expect(result).toBe(300 as MoneyInt);
        });

        test('rounds to nearest integer', () => {
            const result = money.multiply(100 as MoneyInt, 2.5);
            expect(result).toBe(250 as MoneyInt);
        });
    });

    describe('money.divide()', () => {
        test('divides MoneyInt by divisor', () => {
            const result = money.divide(300 as MoneyInt, 3);
            expect(result).toBe(100 as MoneyInt);
        });

        test('rounds to nearest integer', () => {
            const result = money.divide(100 as MoneyInt, 3);
            expect(result).toBe(33 as MoneyInt); // 33.33... → 33
        });
    });

    describe('formatTHB()', () => {
        test('formats with Baht symbol', () => {
            expect(formatTHB(12550 as MoneyInt)).toBe('฿125.50');
            expect(formatTHB(0 as MoneyInt)).toBe('฿0.00');
        });
    });

    describe('parseMoneyInput()', () => {
        test('parses various input formats', () => {
            expect(parseMoneyInput('125.50')).toBe(12550 as MoneyInt);
            expect(parseMoneyInput('125')).toBe(12500 as MoneyInt);
            expect(parseMoneyInput('฿125.50')).toBe(12550 as MoneyInt);
            expect(parseMoneyInput('1,000.00')).toBe(100000 as MoneyInt);
        });

        test('throws error for invalid input', () => {
            expect(() => parseMoneyInput('abc')).toThrow('Invalid money input');
            expect(() => parseMoneyInput('')).toThrow('Invalid money input');
        });
    });

    describe('isValidMoneyInt()', () => {
        test('validates MoneyInt', () => {
            expect(isValidMoneyInt(100)).toBe(true);
            expect(isValidMoneyInt(0)).toBe(true);
            expect(isValidMoneyInt(-100)).toBe(false); // Negative
            expect(isValidMoneyInt(100.5)).toBe(false); // Float
            expect(isValidMoneyInt('100')).toBe(false); // String
        });
    });

    describe('Floating Point Comparison', () => {
        test('demonstrates why we use integers', () => {
            // ❌ WRONG - Floating point error
            const floatResult = 0.1 + 0.2;
            expect(floatResult).not.toBe(0.3); // FAILS! (0.30000000000000004)

            // ✅ CORRECT - Integer arithmetic
            const satangResult = money.add(10 as MoneyInt, 20 as MoneyInt);
            expect(satangResult).toBe(30 as MoneyInt); // PASSES!
        });
    });
});
