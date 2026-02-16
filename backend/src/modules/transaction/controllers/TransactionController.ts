// backend/src/modules/transaction/controllers/TransactionController.ts

import { Request, Response, NextFunction } from 'express';
import { ITransactionService } from '@/shared/di/interfaces';
import {
    createTransactionSchema,
    updateTransactionSchema,
    queryTransactionsSchema,
    approveTransactionSchema,
    voidTransactionSchema,
} from '../validators/transaction.validators';
import { successResponse, paginatedResponse } from '@/utils/response';
import { ValidationError } from '@/shared/errors';
import logger from '@/config/logger';

/**
 * TRANSACTION CONTROLLER
 *
 * HTTP Adapter for Transaction operations.
 * Handles request parsing, validation, and service delegation.
 *
 * Reference: Skill 1, Skill 2
 */
export class TransactionController {
    constructor(private transactionService: ITransactionService) { }

    /**
     * Create Draft
     * POST /api/transactions
     */
    createDraft = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const validated = createTransactionSchema.parse(req.body);

            const transaction = await this.transactionService.createDraft(
                validated,
                req.user?.id!,
                req.correlationId
            );

            res.status(201).json(successResponse(transaction, req.correlationId));
        } catch (error) {
            next(error);
        }
    };

    /**
     * Get Transaction by ID
     * GET /api/transactions/:id
     */
    getById = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { id } = req.params;
            const clientId = req.user?.clientId!;

            const transaction = await this.transactionService.getById(
                id,
                clientId,
                req.correlationId
            );

            res.json(successResponse(transaction, req.correlationId));
        } catch (error) {
            next(error);
        }
    };

    /**
     * Query Transactions
     * GET /api/transactions
     */
    query = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const validated = queryTransactionsSchema.parse(req.query);
            const clientId = req.user?.clientId!;

            const result = await this.transactionService.query(
                validated,
                clientId,
                req.correlationId
            );

            const totalPages = Math.ceil(result.total / validated.perPage);

            res.json(paginatedResponse(
                result.data,
                {
                    page: validated.page,
                    perPage: validated.perPage,
                    total: result.total,
                    totalPages
                },
                req.correlationId
            ));
        } catch (error) {
            next(error);
        }
    };

    /**
     * Update Draft
     * PATCH /api/transactions/:id
     */
    updateDraft = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { id } = req.params;
            const validated = updateTransactionSchema.parse(req.body);
            const clientId = req.user?.clientId!;

            const transaction = await this.transactionService.updateDraft(
                id,
                validated,
                clientId,
                req.correlationId
            );

            res.json(successResponse(transaction, req.correlationId));
        } catch (error) {
            next(error);
        }
    };

    /**
     * Delete Draft
     * DELETE /api/transactions/:id
     */
    deleteDraft = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { id } = req.params;
            const clientId = req.user?.clientId!;

            await this.transactionService.deleteDraft(
                id,
                clientId,
                req.correlationId
            );

            res.status(204).send();
        } catch (error) {
            next(error);
        }
    };

    /**
     * Approve Transaction (Post to Ledger)
     * POST /api/transactions/:id/approve
     */
    approve = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { id } = req.params;
            const clientId = req.user?.clientId!;
            const userId = req.user?.id!;

            // Optional validation for body (notes etc) if schema defines them
            approveTransactionSchema.parse(req.body);

            const transaction = await this.transactionService.approve(
                id,
                clientId,
                userId,
                req.correlationId
            );

            res.json(successResponse(transaction, req.correlationId));
        } catch (error) {
            next(error);
        }
    };

    /**
     * Void Transaction
     * POST /api/transactions/:id/void
     */
    void = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { id } = req.params;
            const validated = voidTransactionSchema.parse(req.body);
            const clientId = req.user?.clientId!;
            const userId = req.user?.id!;

            const transaction = await this.transactionService.void(
                id,
                validated,
                clientId,
                userId,
                req.correlationId
            );

            res.json(successResponse(transaction, req.correlationId));
        } catch (error) {
            next(error);
        }
    };

    /**
     * Get Trial Balance
     * GET /api/transactions/report/trial-balance
     */
    getTrialBalance = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const clientId = req.user?.clientId!;
            const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
            const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;

            const report = await this.transactionService.getTrialBalance(
                clientId,
                startDate,
                endDate,
                req.correlationId
            );

            res.json(successResponse(report, req.correlationId));
        } catch (error) {
            next(error);
        }
    };
}
