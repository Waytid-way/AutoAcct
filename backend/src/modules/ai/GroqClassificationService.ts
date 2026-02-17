import Groq from 'groq-sdk';
import { MoneyInt } from '@/utils/money';
import config from '@/config/ConfigManager';
import { ExternalServiceError } from '@/shared/errors';
import { ILogger, IGroqClassificationService, IClassificationResult } from '@/shared/di/interfaces';

export interface LineItemClassification {
    description: string;
    category: string;        // "5100-Food"
    confidence: number;      // 0.95
    reasoning: string;       // "Food and beverage"
}

/**
 * GROQ CLASSIFICATION SERVICE
 * 
 * Uses Groq AI to classify line items and vendors.
 * 
 * DEPENDENCY INJECTION:
 * - Groq client is injected via constructor (not created internally)
 * - Logger is injected via constructor
 */
export class GroqClassificationService implements IGroqClassificationService {
    private model: string;

    /**
     * Initialize Service with Dependencies
     * All dependencies are required - fail fast if missing
     * 
     * @param logger - Logger instance
     * @param groqClient - Configured Groq SDK client
     */
    constructor(
        private readonly logger: ILogger,
        private readonly groqClient: Groq
    ) {
        // Validate required dependencies
        if (!logger) throw new Error('GroqClassificationService: logger is required');
        if (!groqClient) throw new Error('GroqClassificationService: groqClient is required');
        
        this.model = config.get('GROQ_MODEL') || 'mixtral-8x7b-32768';
    }

    /**
     * Classify multiple line items from a receipt
     * 
     * @param lineItems - Array of items to classify
     * @param correlationId - Trace ID
     * @returns Classification for each item
     */
    async classifyLineItems(
        lineItems: Array<{
            description: string;
            quantity: number;
            totalPrice: MoneyInt;
        }>,
        correlationId: string
    ): Promise<IClassificationResult[]> {
        try {
            const prompt = this.buildLineItemPrompt(lineItems);

            this.logger.debug({
                correlationId,
                action: 'groq_classify_line_items_start',
                itemCount: lineItems.length
            });

            const startTime = Date.now();

            const completion = await this.groqClient.chat.completions.create({
                model: this.model,
                messages: [
                    {
                        role: 'system',
                        content: LINE_ITEM_SYSTEM_PROMPT
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                temperature: 0.1,  // Lower = more deterministic
                max_tokens: 1024,
                response_format: { type: 'json_object' }
            });

            const duration = Date.now() - startTime;
            const rawResponse = completion.choices[0]?.message?.content || '{}';
            const result = this.parseLineItemResponse(rawResponse);

            const avgConfidence = result.reduce(
                (sum, r) => sum + r.confidence, 0
            ) / (result.length || 1);

            this.logger.info({
                correlationId,
                action: 'groq_classify_line_items_success',
                itemCount: result.length,
                avgConfidence: avgConfidence.toFixed(2),
                duration
            });

            return result.map(r => ({
                category: r.category,
                confidence: r.confidence
            }));

        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            this.logger.error({
                correlationId,
                action: 'groq_classify_line_items_failed',
                error: errorMessage,
                stack: error instanceof Error ? error.stack : undefined
            });

            // ✅ Fallback: Return "PENDING_REVIEW" for all items
            return lineItems.map(() => ({
                category: 'PENDING_REVIEW',
                confidence: 0.0
            }));
        }
    }

    /**
     * Classify vendor
     */
    async classifyVendor(
        vendorName: string,
        correlationId: string
    ): Promise<IClassificationResult> {
        // For now, return a simple classification based on vendor name
        // This can be expanded to use Groq API for classification
        this.logger.debug({
            correlationId,
            action: 'classify_vendor',
            vendorName
        });

        // Simple heuristic-based classification
        const vendorLower = vendorName.toLowerCase();
        
        if (vendorLower.includes('7-eleven') || vendorLower.includes('familymart') || vendorLower.includes('tesco')) {
            return { category: '5100-Food', confidence: 0.9 };
        }
        if (vendorLower.includes('grab') || vendorLower.includes('taxi') || vendorLower.includes('uber')) {
            return { category: '5600-Transportation', confidence: 0.9 };
        }
        if (vendorLower.includes('shopee') || vendorLower.includes('lazada') || vendorLower.includes('amazon')) {
            return { category: '5900-Miscellaneous', confidence: 0.7 };
        }
        
        return { category: 'PENDING_REVIEW', confidence: 0.0 };
    }

    /**
     * Build prompt for line item classification
     */
    private buildLineItemPrompt(
        lineItems: Array<{
            description: string;
            quantity: number;
            totalPrice: MoneyInt;
        }>
    ): string {
        const itemsText = lineItems.map((item, idx) =>
            `${idx + 1}. ${item.description} (Qty: ${item.quantity}, Total: ฿${(item.totalPrice / 100).toFixed(2)})`
        ).join('\n');

        return `
Classify EACH line item below into Thai accounting categories:

LINE ITEMS:
${itemsText}

OUTPUT FORMAT (JSON):
{
  "items": [
    {
      "description": "Coffee Latte",
      "category": "5100-Food",
      "confidence": 0.95,
      "reasoning": "Food and beverage purchase"
    }
  ]
}
`.trim();
    }

    /**
     * Parse Groq's JSON response
     */
    private parseLineItemResponse(rawResponse: string): LineItemClassification[] {
        try {
            // Remove markdown code blocks if present (Groq sometimes adds them even with json_object)
            const cleaned = rawResponse
                .replace(/```json\n?/g, '')
                .replace(/```\n?/g, '')
                .trim();

            const parsed = JSON.parse(cleaned);

            if (!parsed.items || !Array.isArray(parsed.items)) {
                throw new Error('Invalid response format: missing "items" array');
            }

            return parsed.items.map((item: Record<string, unknown>) => ({
                description: (item.description as string) || 'Unknown',
                category: (item.category as string) || 'PENDING_REVIEW',
                confidence: typeof item.confidence === 'number' ? item.confidence : 0.0,
                reasoning: (item.reasoning as string) || 'No reasoning provided'
            }));

        } catch (error: unknown) {
            this.logger.warn({
                action: 'groq_parse_failed',
                rawResponse,
                error: error instanceof Error ? error.message : 'Unknown error'
            });

            return [{
                description: 'Unknown',
                category: 'PENDING_REVIEW',
                confidence: 0.0,
                reasoning: 'Failed to parse AI response'
            }];
        }
    }
}

/**
 * Enhanced System Prompt for Line Items
 */
const LINE_ITEM_SYSTEM_PROMPT = `
You are a Thai accounting expert. Classify EACH line item separately into expense categories.

CATEGORIES (IAS 9 Thai Standards):
- 5100-Food: Food, beverages, restaurants, cafes
- 5200-Office: Stationery, office supplies, paper
- 5300-Utilities: Electricity, water, internet, phone
- 5400-Salary: Wages, bonuses, employee benefits
- 5500-Rent: Office rent, coworking space
- 5600-Transportation: Taxi, fuel, parking, Grab
- 5700-Marketing: Ads, promotional materials
- 5800-IT: Laptops, software licenses, cloud services
- 5900-Miscellaneous: Items that don't fit above categories

CONFIDENCE SCORING:
- 0.95-1.0: Very certain (e.g., "7-Eleven Coffee" → Food)
- 0.80-0.94: Confident (e.g., "Grab" → Transportation)
- 0.60-0.79: Moderate (e.g., "Amazon" could be books or electronics)
- <0.60: Low confidence → suggest PENDING_REVIEW

RULES:
1. One category per item
2. Confidence score must be 0.0-1.0
3. Reasoning should be brief (5-10 words max)
4. If unclear → use "PENDING_REVIEW" category with low confidence
5. ALWAYS output valid JSON interface with "items" array.

OUTPUT FORMAT EXAMPLE:
{
  "items": [
    {
      "description": "Coffee Latte",
      "category": "5100-Food",
      "confidence": 0.95,
      "reasoning": "Food and beverage"
    }
  ]
}
`.trim();
