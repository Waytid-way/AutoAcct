// backend/src/modules/receipt/controllers/ReceiptController.ts

import { Request, Response, NextFunction } from 'express';
import { IReceiptService } from '@/shared/di/interfaces';
import {
    uploadReceiptSchema,
    queueQuerySchema,
    processQueueSchema,
    feedbackSchema,
    confirmReceiptSchema,
} from '../validators/receipt.validators';
import { successResponse, paginatedResponse } from '@/utils/response';
import { ValidationError } from '@/shared/errors';
import logger from '@/config/logger';
import config from '@/config/ConfigManager';

/**
 * RECEIPT CONTROLLER
 *
 * Pure HTTP adapter for Receipt operations.
 * Follows AutoAcct REST Controller Pattern.
 *
 * Responsibilities:
 * - Parse & validate HTTP requests
 * - Call ReceiptService methods
 * - Format standardized responses
 * - Pass correlationId for tracing
 *
 * NOT responsible for:
 * - Business logic
 * - Data transformation
 * - Database access
 *
 * Reference: Skill 1 - REST Controller Pattern
 * Reference: Phase 2.2 Guide - Task 1
 */
export class ReceiptController {
    constructor(private receiptService: IReceiptService) { }

    /**
     * POST /api/receipts/upload
     * 
     * Upload receipt file and queue for OCR processing.
     * Uses Multer middleware for file upload handling.
     * 
     * @returns 201 Created + receipt metadata
     */
    async uploadReceipt(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            // 1. Validate file exists (Multer should have attached req.file)
            if (!req.file) {
                throw new ValidationError('File is required');
            }

            // 2. Zod validation for request body
            const validated = uploadReceiptSchema.parse({
                clientId: req.body.clientId,
            });

            // 3. DEV mode logging
            if (config.isDev()) {
                logger.debug({
                    action: 'upload_receipt_start',
                    fileName: req.file.originalname,
                    fileSize: req.file.size,
                    mimeType: req.file.mimetype,
                    correlationId: req.correlationId,
                });
            }

            // 4. Call service layer
            const receipt = await this.receiptService.uploadReceipt(
                req.file.buffer,
                req.file.originalname,
                req.file.mimetype,
                validated.clientId,
                req.correlationId,
                req.user?.id
            );

            // 5. Format response
            res.status(201).json(
                successResponse(
                    {
                        receiptId: receipt._id,
                        fileName: receipt.fileName,
                        status: receipt.status,
                        queuePosition: receipt.queuePosition || 0,
                    },
                    req.correlationId
                )
            );
        } catch (error) {
            next(error); // Propagate to global error handler
        }
    }

    /**
   * GET /api/receipts/queue?page=1&perPage=20&clientId=xxx&status=queued_for_ocr
   * 
   * Get receipts in OCR queue with pagination.
   * 
   * @returns 200 OK + paginated queue data
   */
    async getQueue(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            // Parse & validate query parameters
            const query = queueQuerySchema.parse({
                page: req.query.page ? parseInt(req.query.page as string) : 1,
                perPage: req.query.perPage ? parseInt(req.query.perPage as string) : 20,
                clientId: req.query.clientId as string,
                status: req.query.status as string,
            });

            // Get clientId from authenticated user if not provided
            const clientId = query.clientId || req.user?.clientId;

            if (!clientId) {
                throw new ValidationError('Client ID is required');
            }

            // Call service to get queue with pagination
            const result = await this.receiptService.getQueue(
                query,
                clientId,
                req.correlationId
            );

            // Return paginated response
            res.json(
                paginatedResponse(
                    result.data,
                    {
                        page: query.page,
                        perPage: query.perPage,
                        total: result.total,
                        totalPages: Math.ceil(result.total / query.perPage),
                    },
                    req.correlationId
                )
            );
        } catch (error) {
            next(error);
        }
    }

    /**
     * POST /api/receipts/process-queue
     * 
     * Trigger OCR processing for queued receipts (async operation).
     * Returns 202 Accepted immediately, client polls /queue for status.
     * 
     * @returns 202 Accepted + processing started message
     */
    async processQueue(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const clientId = req.user?.clientId;

            if (!clientId) {
                throw new ValidationError('Client ID is required');
            }

            const validated = processQueueSchema.parse({
                limit: req.body.limit ? parseInt(req.body.limit) : 5,
            });

            // DEV mode logging
            if (config.isDev()) {
                logger.debug({
                    action: 'process_queue_start',
                    limit: validated.limit,
                    clientId,
                    correlationId: req.correlationId,
                });
            }

            // Start async processing (don't await)
            this.receiptService
                .processQueue(clientId, {
                    maxBatch: validated.limit,
                    stopOnError: false,
                })
                .catch((err) => {
                    logger.error({
                        action: 'ocr_queue_processing_failed',
                        error: err.message,
                        correlationId: req.correlationId,
                    });
                });

            // Immediate response
            res.status(202).json(
                successResponse(
                    {
                        started: true,
                        message: 'OCR processing started. Poll /queue for status.',
                        limit: validated.limit,
                    },
                    req.correlationId
                )
            );
        } catch (error) {
            next(error);
        }
    }

    /**
     * GET /api/receipts/:id
     * 
     * Get a single receipt by ID.
     * 
     * @returns 200 OK + receipt data
     */
    async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const { id } = req.params;
            const clientId = req.user?.clientId;

            if (!clientId) {
                throw new ValidationError('Client ID is required');
            }

            // Get receipt by ID from service
            const receipt = await this.receiptService.getById(
                id,
                clientId,
                req.correlationId
            );

            res.json(successResponse(receipt, req.correlationId));
        } catch (error) {
            next(error);
        }
    }

    /**
     * POST /api/receipts/:id/feedback
     * 
     * Submit user corrections for OCR results (feedback loop for ML training).
     * 
     * @returns 200 OK + updated receipt
     */
    async submitFeedback(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const { id } = req.params;
            const userId = req.user?.id;
            const clientId = req.user?.clientId; // Added clientId

            if (!userId) {
                throw new ValidationError('User ID is required');
            }
            if (!clientId) { // Added validation for clientId
                throw new ValidationError('Client ID is required');
            }

            // Validate feedback data
            const validated = feedbackSchema.parse(req.body);

            // DEV mode logging
            if (config.isDev()) {
                logger.debug({
                    action: 'submit_feedback',
                    receiptId: id,
                    userId,
                    hasCorrectedVendor: !!validated.corrections?.vendor,
                    hasCorrectedAmount: !!validated.corrections?.amount,
                    correlationId: req.correlationId,
                });
            }

            // Call service
            const updated = await this.receiptService.submitFeedback(
                id,
                validated,
                clientId,
                req.correlationId,
                userId
            );

            res.json(
                successResponse(
                    {
                        receiptId: id,
                        feedback: updated.feedback,
                    },
                    req.correlationId
                )
            );
        } catch (error) {
            next(error);
        }
    }

    /**
     * GET /api/receipts/stats
     * 
     * Get queue statistics for dashboard.
     * 
     * @returns 200 OK + queue statistics
     */
    async getStats(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const clientId = req.user?.clientId;

            if (!clientId) {
                throw new ValidationError('Client ID is required');
            }

            const stats = await this.receiptService.getQueueStats(
                clientId,
                req.correlationId
            );

            res.json(successResponse(stats, req.correlationId));
        } catch (error) {
            next(error);
        }
    }

    /**
     * POST /api/receipts/:id/confirm
     * 
     * Confirm OCR result and create draft transaction.
     * This endpoint validates the extracted data and creates a draft
     * transaction in the accounting system.
     * 
     * @returns 200 OK + confirmation result (receiptId, transactionId)
     */
    async confirmReceipt(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const receiptId = req.params.id;

            // Validate request body
            const validated = confirmReceiptSchema.parse(req.body);

            logger.info(`[${req.correlationId}] Confirming receipt ${receiptId}`);

            const result = await this.receiptService.confirmReceipt(
                receiptId,
                validated,
                req.correlationId
            );

            res.json(successResponse(result, req.correlationId));
        } catch (error) {
            next(error);
        }
    }

    /**
     * DELETE /api/receipts/:id
     * 
     * Reject and delete receipt.
     * This removes the receipt from the database and optionally
     * deletes the associated file from storage.
     * 
     * @returns 204 No Content
     */
    async deleteReceipt(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const receiptId = req.params.id;

            logger.info(`[${req.correlationId}] Deleting receipt ${receiptId}`);

            await this.receiptService.deleteReceipt(
                receiptId,
                req.correlationId
            );

            res.status(204).send(); // No content
        } catch (error) {
            next(error);
        }
    }
}
