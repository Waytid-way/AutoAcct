// backend/src/modules/ocr/services/GroqOCRService.ts

import Groq from 'groq-sdk';
import { ConfidenceScorer } from './ConfidenceScorer';
import { GroqPromptService } from './GroqPromptService';
import { OCRResult } from '../types/ocr.types';
import { ExternalServiceError } from '@/shared/errors';
import config from '@/config/ConfigManager';
import logger from '@/config/logger';

/**
 * GROQ OCR SERVICE
 * 
 * Orchestrates the full AI OCR Pipeline:
 * 1. Groq Vision API (Image -> Raw Text)
 * 2. Groq Prompt Service (Raw Text -> Structured Data)
 * 3. Confidence Scorer (Structured Data -> Confidence)
 */
export class GroqOCRService {
    private groqClient: Groq;
    private promptService: GroqPromptService;
    private scorer: ConfidenceScorer;
    private model: string;

    // Circuit Breaker / Retry State managed via simple internal logic or external wrapper.
    // We'll implement basic retry here for the API calls.

    constructor(apiKey: string) {
        this.groqClient = new Groq({ apiKey });
        this.promptService = new GroqPromptService(apiKey);
        this.scorer = new ConfidenceScorer();
        this.model = config.get('GROQ_MODEL') || 'llama-3.2-90b-vision-preview'; // Default to a vision model
    }

    /**
     * Process a receipt image
     * @param imageUrl Public URL or Data URI of the image
     */
    async processImage(
        imageUrl: string,
        correlationId: string
    ): Promise<OCRResult> {
        const startTime = Date.now();

        try {
            // Step 1: Vision API (Get Raw Text)
            const rawText = await this.extractRawText(imageUrl, correlationId);

            // Step 2: Parse Fields
            const parsedFields = await this.promptService.parseReceiptText(rawText, correlationId);

            // Step 3: Score Confidence
            const confidence = this.scorer.scoreFields(parsedFields, rawText);

            // Assemble Result
            // Convert Amount string to MoneyInt (Number)
            let amountSatang: number | undefined;
            if (parsedFields.amount) {
                const cleanAmount = parsedFields.amount.replace(/,/g, '');
                const val = parseFloat(cleanAmount);
                if (!isNaN(val)) {
                    amountSatang = Math.round(val * 100); // Convert to Satang
                }
            }

            // Task 3E: Map Line Items
            const lineItems = parsedFields.items?.map(item => {
                const cleanPrice = (item.total_price || "0").replace(/,/g, '');
                const priceVal = parseFloat(cleanPrice);
                const totalSatang = !isNaN(priceVal) ? Math.round(priceVal * 100) : 0;
                const quantity = item.quantity || 1;

                return {
                    description: item.description,
                    quantity: quantity,
                    totalPrice: totalSatang,
                    unitPrice: Math.round(totalSatang / quantity) // Derive unit price
                };
            });

            const result: OCRResult = {
                vendor: parsedFields.vendor,
                amount: amountSatang,
                date: parsedFields.date ? new Date(parsedFields.date) : undefined,
                taxId: parsedFields.taxId,
                rawText,
                extractionDuration: Date.now() - startTime,
                confidenceScores: confidence,
                lineItems
            };

            logger.info({
                action: 'ocr_pipeline_complete',
                correlationId,
                duration: result.extractionDuration,
                overallConfidence: confidence.overall
            });

            return result;

        } catch (err: any) {
            logger.error({
                action: 'ocr_pipeline_failed',
                correlationId,
                error: err.message
            });
            // Wrap if not already wrapped
            if (err instanceof ExternalServiceError) throw err;
            throw new ExternalServiceError('GroqOCRService', `Pipeline failed: ${err.message}`);
        }
    }

    /**
     * Step 1: Extract Raw Text from Image using Vision Model
     */
    private async extractRawText(
        imageUrl: string,
        correlationId: string
    ): Promise<string> {
        try {
            const response = await this.groqClient.chat.completions.create({
                model: this.model,
                messages: [
                    {
                        role: 'user',
                        content: [
                            { type: 'text', text: 'Transcribe ALL text from this receipt image. Do not summarize. Just list the text line by line.' },
                            { type: 'image_url', image_url: { url: imageUrl } },
                        ],
                    },
                ],
                max_tokens: 1024,
            });

            const text = response.choices[0]?.message?.content;
            if (!text) throw new Error('Empty response from Vision API');

            return text;
        } catch (err: any) {
            throw new ExternalServiceError('GroqVisionAPI', `Vision extraction failed: ${err.message}`, 502);
        }
    }
}
