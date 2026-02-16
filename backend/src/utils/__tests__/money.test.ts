// backend/src/utils/__tests__/money.test.ts

/**
 * Money Utilities Test Suite
 * Ensures financial calculation integrity with 100% code coverage
 * 
 * Golden Rule #1: Integer Only (Satang)
 * Golden Rule #2: Plug Method for remainder handling
 */

import {
    bahtToSatang,
    satangToBaht,
    plugSplit,
    money,
    formatTHB,
    parseMoneyInput,
    isValidMoneyInt,
    type MoneyInt,
} from '../money';

describe('Money Utils - Golden Rule #1: Integer Only', () => {
    describe('bahtToSatang()', () => {
        test('converts normal values correctly', () => {
            expect(bahtToSatang(125.5)).toBe(12550);
            expect(bahtToSatang(100)).toBe(10000);
            expect(bahtToSatang(0.5)).toBe(50);
        });

        test('handles small values', () => {
            expect(bahtToSatang(0.01)).toBe(1);
            expect(bahtToSatang(0.99)).toBe(99);
        });

        test('handles large values', () => {
            expect(bahtToSatang(999999.99)).toBe(99999999);
            expect(bahtToSatang(1000000)).toBe(100000000);
        });

        test('handles edge cases', () => {
            expect(bahtToSatang(0)).toBe(0);
        });

        test('rounds to nearest integer', () => {
            expect(bahtToSatang(125.555)).toBe(12556); // Rounds up
            expect(bahtToSatang(125.554)).toBe(12555); // Rounds down
        });
    });

    describe('satangToBaht()', () => {
        test('converts Satang to Baht with 2 decimals', () => {
            expect(satangToBaht(12550 as MoneyInt)).toBe('125.50');
            expect(satangToBaht(100 as MoneyInt)).toBe('1.00');
            expect(satangToBaht(0 as MoneyInt)).toBe('0.00');
        });

        test('handles leading zeros correctly', () => {
            expect(satangToBaht(100 as MoneyInt)).toBe('1.00');
            expect(satangToBaht(1000 as MoneyInt)).toBe('10.00');
            expect(satangToBaht(10000 as MoneyInt)).toBe('100.00');
        });

        test('handles large values', () => {
            expect(satangToBaht(99999999 as MoneyInt)).toBe('999999.99');
        });
    });

    describe('isValidMoneyInt()', () => {
        test('validates positive integers', () => {
            expect(isValidMoneyInt(100)).toBe(true);
            expect(isValidMoneyInt(0)).toBe(true);
            expect(isValidMoneyInt(999999999)).toBe(true);
        });

        test('rejects floats', () => {
            expect(isValidMoneyInt(100.5)).toBe(false);
            expect(isValidMoneyInt(0.01)).toBe(false);
        });

        test('rejects negatives', () => {
            expect(isValidMoneyInt(-100)).toBe(false);
        });

        test('rejects NaN and Infinity', () => {
            expect(isValidMoneyInt(NaN)).toBe(false);
            expect(isValidMoneyInt(Infinity)).toBe(false);
            expect(isValidMoneyInt(-Infinity)).toBe(false);
        });

        test('rejects non-numbers', () => {
            expect(isValidMoneyInt('100')).toBe(false);
            expect(isValidMoneyInt(null)).toBe(false);
            expect(isValidMoneyInt(undefined)).toBe(false);
            expect(isValidMoneyInt({})).toBe(false);
        });

        test('handles MAX_SAFE_INTEGER', () => {
            expect(isValidMoneyInt(Number.MAX_SAFE_INTEGER)).toBe(true);
        });
    });
});

describe('Money Operations', () => {
    describe('money.add()', () => {
        test('adds multiple MoneyInt values', () => {
            expect(money.add(100 as MoneyInt, 200 as MoneyInt)).toBe(300);
            expect(money.add(100 as MoneyInt, 200 as MoneyInt, 300 as MoneyInt)).toBe(600);
        });

        test('handles single value', () => {
            expect(money.add(500 as MoneyInt)).toBe(500);
        });

        test('handles zero', () => {
            const result = money.add(0 as MoneyInt, 100 as MoneyInt);
            expect(result).toBe(100);
        });

        test('throws on overflow', () => {
            // Create a value close to MAX_SAFE_INTEGER
            const large = Math.floor(Number.MAX_SAFE_INTEGER * 0.9) as MoneyInt;
            const addAmount = Math.floor(Number.MAX_SAFE_INTEGER * 0.2) as MoneyInt;
            expect(() => money.add(large, addAmount)).toThrow('Money add overflow');
        });
    });

    describe('money.subtract()', () => {
        test('subtracts MoneyInt values', () => {
            const result = money.subtract(300 as MoneyInt, 100 as MoneyInt);
            expect(result).toBe(200);
        });

        test('handles result = 0', () => {
            const result = money.subtract(100 as MoneyInt, 100 as MoneyInt);
            expect(result).toBe(0);
        });

        test('throws for negative result', () => {
            expect(() => money.subtract(100 as MoneyInt, 200 as MoneyInt)).toThrow(
                'Money subtract invalid'
            );
        });
    });

    describe('money.multiply()', () => {
        test('multiplies by integer', () => {
            const result = money.multiply(100 as MoneyInt, 3);
            expect(result).toBe(300);
        });

        test('multiplies by float', () => {
            const result = money.multiply(100 as MoneyInt, 1.5);
            expect(result).toBe(150);
        });

        test('multiplies by zero', () => {
            const result = money.multiply(100 as MoneyInt, 0);
            expect(result).toBe(0);
        });

        test('rounds to nearest integer', () => {
            expect(money.multiply(100 as MoneyInt, 2.5)).toBe(250);
            expect(money.multiply(100 as MoneyInt, 2.55)).toBe(255);
        });
    });

    describe('money.divide()', () => {
        test('divides evenly', () => {
            const result = money.divide(300 as MoneyInt, 3);
            expect(result).toBe(100);
        });

        test('rounds to nearest integer', () => {
            const result = money.divide(100 as MoneyInt, 3);
            expect(result).toBe(33); // 33.33... → 33
        });

        test('handles larger remainders', () => {
            expect(money.divide(100 as MoneyInt, 6)).toBe(17); // 16.66... → 17
        });
    });
});

describe('Plug Method - Golden Rule #2', () => {
    describe('plugSplit()', () => {
        test('ensures sum equals total (100 ÷ 3)', () => {
            const split = plugSplit(100 as MoneyInt, 3);
            expect(split).toEqual([34, 33, 33]);
            const sum = split.reduce((a, b) => a + b, 0);
            expect(sum).toBe(100);
        });

        test('handles large amounts (10000 ÷ 3)', () => {
            const split = plugSplit(10000 as MoneyInt, 3);
            expect(split).toEqual([3334, 3333, 3333]);
            const sum = split.reduce((a, b) => a + b, 0);
            expect(sum).toBe(10000);
        });

        test('handles even splits', () => {
            const split = plugSplit(300 as MoneyInt, 3);
            expect(split).toEqual([100, 100, 100]);
        });

        test('handles 100 ÷ 2 = [50, 50]', () => {
            const split = plugSplit(100 as MoneyInt, 2);
            expect(split).toEqual([50, 50]);
        });

        test('handles single part', () => {
            const split = plugSplit(100 as MoneyInt, 1);
            expect(split).toEqual([100]);
        });

        test('throws error for parts <= 0', () => {
            expect(() => plugSplit(100 as MoneyInt, 0)).toThrow('Parts must be > 0');
            expect(() => plugSplit(100 as MoneyInt, -1)).toThrow('Parts must be > 0');
        });

        test('handles large number of parts', () => {
            const split = plugSplit(100 as MoneyInt, 10);
            expect(split.length).toBe(10);
            expect(split[0]).toBe(10); // Remainder 0
            expect(split.reduce((a, b) => a + b, 0)).toBe(100);
        });

        test('handles prime number splits', () => {
            // 101 ÷ 7 = 14 remainder 3
            const split = plugSplit(101 as MoneyInt, 7);
            expect(split[0]).toBe(17); // 14 + 3 = 17
            expect(split.slice(1).every(v => v === 14)).toBe(true);
            expect(split.reduce((a, b) => a + b, 0)).toBe(101);
        });
    });
});

describe('Formatting Functions', () => {
    describe('formatTHB()', () => {
        test('formats with Baht symbol', () => {
            expect(formatTHB(12550 as MoneyInt)).toBe('฿125.50');
            expect(formatTHB(100 as MoneyInt)).toBe('฿1.00');
            expect(formatTHB(0 as MoneyInt)).toBe('฿0.00');
        });

        test('handles large amounts', () => {
            expect(formatTHB(99999999 as MoneyInt)).toBe('฿999999.99');
        });
    });

    describe('parseMoneyInput()', () => {
        test('parses decimal strings', () => {
            expect(parseMoneyInput('125.50')).toBe(12550);
            expect(parseMoneyInput('1.00')).toBe(100);
        });

        test('parses whole numbers', () => {
            expect(parseMoneyInput('125')).toBe(12500);
        });

        test('parses with Baht symbol', () => {
            expect(parseMoneyInput('฿125.50')).toBe(12550);
            expect(parseMoneyInput('฿100')).toBe(10000);
        });

        test('parses with commas', () => {
            expect(parseMoneyInput('1,000.00')).toBe(100000);
            expect(parseMoneyInput('1,000,000')).toBe(100000000);
        });

        test('handles whitespace', () => {
            expect(parseMoneyInput(' 125.50 ')).toBe(12550);
            expect(parseMoneyInput(' ฿ 125 ')).toBe(12500);
        });

        test('throws error for invalid input', () => {
            expect(() => parseMoneyInput('abc')).toThrow('Invalid money input');
            expect(() => parseMoneyInput('')).toThrow('Invalid money input');
            expect(() => parseMoneyInput('   ')).toThrow('Invalid money input');
        });
    });
});

describe('Edge Cases & Stress Tests', () => {
    test('demonstrates floating point error prevention', () => {
        // ❌ WRONG - Floating point error
        const floatResult = 0.1 + 0.2;
        expect(floatResult).not.toBe(0.3); // FAILS! (0.30000000000000004)

        // ✅ CORRECT - Integer arithmetic
        const satangResult = money.add(10 as MoneyInt, 20 as MoneyInt);
        expect(satangResult).toBe(30); // PASSES!
    });

    test('handles very small amounts (0.01 Baht)', () => {
        expect(bahtToSatang(0.01)).toBe(1);
        expect(parseMoneyInput('0.01')).toBe(1);
        expect(formatTHB(1 as MoneyInt)).toBe('฿0.01');
    });

    test('handles very large amounts (millions)', () => {
        expect(bahtToSatang(1000000)).toBe(100000000);
        expect(formatTHB(100000000 as MoneyInt)).toBe('฿1000000.00');
    });

    test('handles MAX_SAFE_INTEGER boundary', () => {
        const maxBaht = Math.floor(Number.MAX_SAFE_INTEGER / 100);
        const satang = bahtToSatang(maxBaht);
        expect(satang).toBeLessThanOrEqual(Number.MAX_SAFE_INTEGER);
    });

    test('complex operation chain', () => {
        // Simulate: Start with 1000, add 500, subtract 200, multiply by 1.1, divide by 3
        let amount = 100000 as MoneyInt; // 1000.00 Baht
        amount = money.add(amount, 50000 as MoneyInt); // + 500 = 1500
        amount = money.subtract(amount, 20000 as MoneyInt); // - 200 = 1300
        amount = money.multiply(amount, 1.1); // × 1.1 = 1430 (143000)
        const split = plugSplit(amount, 3); // ÷ 3 = [47668, 47666, 47666] (remainder 2 added to first)
        
        expect(split).toEqual([47668, 47666, 47666]);
        expect(split.reduce((a, b) => a + b, 0)).toBe(143000);
    });
});
