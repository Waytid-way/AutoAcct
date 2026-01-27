import Groq from 'groq-sdk';
import { MoneyInt } from '@/utils/money';
import logger from '@/config/logger';
import config from '@/config/ConfigManager'; // Ensure config manager is used
// Assuming ExternalServiceError is exported from shared/errors
// If not found, we might need to adjust import path or check shared/errors/index.ts
import { ExternalServiceError } from '@/shared/errors';

export interface LineItemClassification {
    description: string;
    category: string;        // "5100-Food"
    confidence: number;      // 0.95
    reasoning: string;       // "Food and beverage"
}

export class GroqClassificationService {
    private client: Groq;
    private model: string;

    constructor(apiKey: string) {
        this.client = new Groq({ apiKey });
        this.model = config.get('GROQ_MODEL') || 'mixtral-8x7b-32768'; // Default to a strong text model
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
    ): Promise<LineItemClassification[]> {
        try {
            const prompt = this.buildLineItemPrompt(lineItems);

            logger.debug({
                correlationId,
                action: 'groq_classify_line_items_start',
                itemCount: lineItems.length
            });

            const startTime = Date.now();

            const completion = await this.client.chat.completions.create({
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

            logger.info({
                correlationId,
                action: 'groq_classify_line_items_success',
                itemCount: result.length,
                avgConfidence: avgConfidence.toFixed(2),
                duration
            });

            return result;

        } catch (error: any) {
            logger.error({
                correlationId,
                action: 'groq_classify_line_items_failed',
                error: error.message,
                stack: error.stack
            });

            // ✅ Fallback: Return "PENDING_REVIEW" for all items
            return lineItems.map(item => ({
                description: item.description,
                category: 'PENDING_REVIEW',
                confidence: 0.0,
                reasoning: `AI classification failed: ${error.message}`
            }));
        }
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

            return parsed.items.map((item: any) => ({
                description: item.description || 'Unknown',
                category: item.category || 'PENDING_REVIEW',
                confidence: typeof item.confidence === 'number' ? item.confidence : 0.0,
                reasoning: item.reasoning || 'No reasoning provided'
            }));

        } catch (error: any) {
            logger.warn({
                action: 'groq_parse_failed',
                rawResponse,
                error: error.message
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
