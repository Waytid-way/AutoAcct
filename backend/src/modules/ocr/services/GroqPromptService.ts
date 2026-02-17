// backend/src/modules/ocr/services/GroqPromptService.ts

import Groq from 'groq-sdk';
import { ParsedOCRFields } from '../types/ocr.types';
import { ExternalServiceError } from '@/shared/errors';
import logger from '@/config/logger';
import { ILogger, IGroqPromptService } from '@/shared/di/interfaces';

/**
 * GROQ PROMPT SERVICE
 * 
 * Step 2 of Pipeline: Text -> Structured Data
 * Uses Llama 3/Mixtral to parse receipt text.
 * 
 * DEPENDENCY INJECTION:
 * - Groq client is injected via constructor (not created internally)
 * - Logger is injected via constructor
 */
export class GroqPromptService implements IGroqPromptService {
    private groqClient: Groq;

    /**
     * Initialize Service with Dependencies
     * All dependencies are required - fail fast if missing
     * 
     * @param groqClient - Configured Groq SDK client
     * @param logger - Logger instance
     */
    constructor(
        groqClient: Groq,
        private readonly logger: ILogger
    ) {
        // Validate required dependencies
        if (!groqClient) throw new Error('GroqPromptService: groqClient is required');
        if (!logger) throw new Error('GroqPromptService: logger is required');
        
        this.groqClient = groqClient;
    }

    /**
     * Parse raw OCR text using specific receipt parsing prompt.
     */
    async parseReceiptText(
        rawText: string,
        correlationId: string
    ): Promise<ParsedOCRFields> {
        try {
            const systemPrompt = `You are an expert at parsing Thai receipts/invoices.
Your task is to extract structured data from OCR text.

Instructions:
1. Extract vendor_name: Business name from the receipt
2. Extract total_amount_baht: Total amount in Thai Baht (numeric only, e.g., "125.50")
3. Extract receipt_date: Date in YYYY-MM-DD format
4. Extract tax_id: Thai tax ID if visible (13 digits, format: XXXXXXXXX)
5. Extract items: Array of line items with:
   - description: Item name
   - quantity: Item count (default 1 if not specified)
   - total_price: Price for this line item (string format "50.00")

Important:
- If a field is not visible or unclear, OMIT it from the response
- amount_baht should be a number string without currency symbol
- Return ONLY valid JSON, no explanation or extra text
- Handle 7-Eleven, Cafe Amazon, Starbucks formats specifically.`;

            const userPrompt = `Parse this Thai receipt OCR text:\n\n${rawText}`;

            const response = await this.groqClient.chat.completions.create({
                model: 'llama-3.3-70b-versatile', // Spec suggested mixtral, but config default is llama-3.3-70b. Using Config preferred or spec hardcode? Spec code sample used 'mixtral'. I'll stick to 'mixtral' or robust model. Llama 3 is good too. Let's use config default usually, but here hardcoded for stability?
                // Let's use a known variable model.
                messages: [
                    {
                        role: 'system',
                        content: systemPrompt
                    },
                    {
                        role: 'user',
                        content: userPrompt,
                    },
                ],
                max_tokens: 1024,
                temperature: 0.1, // Low temp for extraction
                response_format: { type: 'json_object' } // Groq supports JSON mode
            });

            // Extract JSON
            const content = response.choices[0]?.message?.content;
            if (!content) {
                throw new Error('Empty response from Groq');
            }

            let parsed: any;
            try {
                parsed = JSON.parse(content);
            } catch (e) {
                // Fallback regex if json mode fails or partial
                const jsonMatch = content.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    parsed = JSON.parse(jsonMatch[0]);
                } else {
                    throw new Error('Invalid JSON format');
                }
            }

            const result: ParsedOCRFields = {
                vendor: parsed.vendor_name,
                amount: parsed.amount_baht?.toString(),
                date: parsed.receipt_date,
                taxId: parsed.tax_id,
                items: Array.isArray(parsed.items) ? parsed.items.map((item: any) => ({
                    description: item.description || "Unknown Item",
                    quantity: typeof item.quantity === 'number' ? item.quantity : 1,
                    total_price: item.total_price?.toString() || "0"
                })) : []
            };

            this.logger.debug({
                action: 'groq_parse_success',
                correlationId,
                result
            });

            return result;

        } catch (err: any) {
            this.logger.error({
                action: 'groq_parse_failed',
                correlationId,
                error: err.message
            });
            throw new ExternalServiceError(
                'GroqPromptService',
                `Failed to parse OCR text: ${err.message}`,
                502
            );
        }
    }
}
