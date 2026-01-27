// backend/src/modules/ocr/__tests__/GroqOCRService.test.ts

import { describe, it, expect, mock, beforeEach } from 'bun:test';
import { GroqOCRService } from '../services/GroqOCRService';

// Mock Config
mock.module('@/config/ConfigManager', () => ({
    default: {
        get: (key: string) => {
            if (key === 'GROQ_MODEL') return 'test-model';
            return undefined;
        }
    }
}));

// Mock Groq SDK
const mockCreateChat = mock(() => Promise.resolve({
    choices: [{
        message: { content: 'MOCK RAW TEXT' }
    }]
}));

mock.module('groq-sdk', () => {
    return {
        default: class Groq {
            chat = {
                completions: {
                    create: mockCreateChat
                }
            }
        }
    };
});

// Mock GroqPromptService to avoid second API call in unit test
const mockParse = mock(() => Promise.resolve({
    vendor: 'TEST VENDOR',
    amount: '100.00',
    date: '2026-01-01'
}));

mock.module('@/modules/ocr/services/GroqPromptService', () => ({
    GroqPromptService: class {
        parseReceiptText = mockParse;
    }
}));


describe('GroqOCRService', () => {
    let service: GroqOCRService;

    beforeEach(() => {
        service = new GroqOCRService('fake-api-key');
    });

    it('should process image through full pipeline', async () => {
        const result = await service.processImage('http://example.com/image.jpg', 'corr-id');

        expect(result.vendor).toBe('TEST VENDOR');
        expect(result.amount).toBe(10000); // 100.00 * 100 satang
        expect(result.rawText).toBe('MOCK RAW TEXT');
        expect(result.confidenceScores?.overall).toBeGreaterThan(0);
    });
});
