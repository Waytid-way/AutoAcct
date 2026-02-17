// backend/src/modules/ocr/services/ConfidenceScorer.ts

import { ParsedOCRFields } from '../types/ocr.types';
import { IConfidenceScorer } from '@/shared/di/interfaces';

/**
 * CONFIDENCE SCORER
 * 
 * Calculates 0-1 confidence scores for extracted fields using heuristics.
 * Step 3 of OCR Pipeline.
 */
export class ConfidenceScorer implements IConfidenceScorer {
    /**
     * Calculate confidence scores for each field.
     */
    scoreFields(
        parsedFields: ParsedOCRFields,
        rawText: string
    ): {
        vendor?: number;
        amount?: number;
        date?: number;
        overall?: number;
    } {
        const scores = {
            vendor: this.scoreVendor(parsedFields.vendor, rawText),
            amount: this.scoreAmount(parsedFields.amount, rawText),
            date: this.scoreDate(parsedFields.date, rawText),
        };

        // Calculate overall confidence (average of non-null scores)
        const validScores = Object.values(scores).filter((s) => s !== undefined) as number[];
        const overall = validScores.length > 0
            ? validScores.reduce((a, b) => a + b, 0) / validScores.length
            : 0;

        return { ...scores, overall };
    }

    /**
     * Score vendor name confidence (0-1)
     */
    private scoreVendor(vendor?: string, rawText?: string): number | undefined {
        if (!vendor) return undefined;

        let score = 0.5;  // Base score

        // Length check
        if (vendor.length >= 3 && vendor.length <= 100) score += 0.15;

        // Contains letters (not just numbers)
        if (/[a-zA-Zก-ฮ]/.test(vendor)) score += 0.1;

        // Not overly uppercase
        if (!/^[A-Z\s0-9]+$/.test(vendor)) score += 0.1;

        // Appears in rawText (not hallucinated)
        if (rawText && rawText.toUpperCase().includes(vendor.toUpperCase())) {
            score += 0.2;
        } else {
            score -= 0.1;  // Penalize if not found in raw text
        }

        return Math.max(0, Math.min(1, score));
    }

    /**
     * Score amount confidence (0-1)
     */
    private scoreAmount(amount?: string, rawText?: string): number | undefined {
        if (!amount) return undefined;

        let score = 0.5;  // Base score

        // Parse as number
        const amountStr = amount.replace(/,/g, ''); // Remove commas
        const amountNum = parseFloat(amountStr);

        if (isNaN(amountNum)) return 0;  // Invalid number = 0 confidence

        // Reasonable range (0.01 - 999,999 Baht)
        if (amountNum >= 0.01 && amountNum <= 999999) score += 0.15;
        if (amountNum < 0.01 || amountNum > 999999) score -= 0.2;

        // Decimal places (usually 0-2 for Thai currency)
        const decimalPlaces = (amountStr.split('.')[1] || '').length;
        if (decimalPlaces <= 2) score += 0.1;
        if (decimalPlaces > 2) score -= 0.1;

        // Appears in rawText with currency symbol
        if (rawText) {
            const patterns = [
                `฿\\s*${amount}`,  // ฿125.50
                `${amount}\\s*฿`,  // 125.50฿
                amount,            // 125.50 (bare number)
            ];
            // Escape for regex
            const safeAmount = amount.replace('.', '\\.');
            if (patterns.some((p) => new RegExp(p.replace(amount, safeAmount)).test(rawText))) {
                score += 0.2;
            } else {
                score -= 0.1;
            }
        }

        return Math.max(0, Math.min(1, score));
    }

    /**
     * Score date confidence (0-1)
     */
    private scoreDate(date?: string, rawText?: string): number | undefined {
        if (!date) return undefined;

        let score = 0.5;

        // Check format YYYY-MM-DD
        if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            score += 0.2;

            // Basic date validity
            const d = new Date(date);
            if (d instanceof Date && !isNaN(d.getTime())) {
                const now = new Date();
                // Not in future
                if (d <= now) score += 0.1;
                // Not too old (> 2 years)
                const twoYearsAgo = new Date();
                twoYearsAgo.setFullYear(now.getFullYear() - 2);
                if (d > twoYearsAgo) score += 0.1;
            } else {
                return 0; // Invalid date object
            }
        }

        return Math.max(0, Math.min(1, score));
    }
}
