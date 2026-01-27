// backend/src/modules/ocr/__tests__/ConfidenceScorer.test.ts

import { describe, it, expect } from 'bun:test';
import { ConfidenceScorer } from '../services/ConfidenceScorer';

describe('ConfidenceScorer', () => {
    const scorer = new ConfidenceScorer();

    it('should score precise matches highly', () => {
        const parsed = {
            vendor: 'STARBUCKS',
            amount: '125.50',
            date: '2026-01-26',
        };
        const rawText = 'STARBUCKS COFFEE 2026-01-26 ฿125.50';

        const result = scorer.scoreFields(parsed, rawText);

        expect(result.vendor).toBeGreaterThan(0.7);
        expect(result.amount).toBeGreaterThan(0.7);
        expect(result.date).toBeGreaterThan(0.7);
        expect(result.overall).toBeGreaterThan(0.7);
    });

    it('should penalize hallucinations (text not in raw)', () => {
        const parsed = {
            vendor: 'FAKE SHOP',
        };
        const rawText = 'REAL SHOP ONLY';

        const result = scorer.scoreFields(parsed, rawText);
        expect(result.vendor).toBeLessThan(0.7); // Base 0.5 + 0.15 + 0.1 - 0.1 = 0.65
    });

    it('should validate amount format', () => {
        const parsed = { amount: 'invalid-amount' };
        const result = scorer.scoreFields(parsed, '');
        expect(result.amount).toBe(0);
    });
});
