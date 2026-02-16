import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { JournalEntry } from '../models/JournalEntry';
import Receipt from '@/models/Receipt.model'; // Updated import path
import { MedicerService } from './MedicerService';
import { MoneyInt } from '@/utils/money';
import { FinancialIntegrityError, NotFoundError } from '@/utils/errors';
import { ILogger, IAccountingService, IMedicerService } from '@/shared/di/interfaces';

interface SplitEntryItem {
    debitAccount: string;    // "5100-Food"
    amount: MoneyInt;        // 9000 Satang
    description: string;     // "Coffee Latte x2"
}

export class AccountingService implements IAccountingService {
    /**
     * Initialize Service with Dependencies
     * All dependencies are required - fail fast if missing
     * 
     * @param logger - Logger instance
     * @param medicerService - Medicer ledger service
     */
    constructor(
        private readonly logger: ILogger,
        private readonly medicerService: IMedicerService
    ) {
        // Validate required dependencies
        if (!logger) throw new Error('AccountingService: logger is required');
        if (!medicerService) throw new Error('AccountingService: medicerService is required');
    }

    /**
     * Create split entries from line items
     * 
     * @param receiptId - Receipt containing line items
     * @param lineItems - Array of debit entries (one per item)
     * @param creditAccount - Payment account (e.g., "1101-Checking")
     * @param clientId - Client identifier
     * @param correlationId - Trace ID
     * 
     * @returns Array of created JournalEntry documents
     * 
     * @throws {NotFoundError} If receipt not found
     * @throws {FinancialIntegrityError} If trial balance fails
     */
    async createSplitEntry(
        receiptId: string,
        lineItems: SplitEntryItem[],
        creditAccount: string,
        clientId: string,
        correlationId: string
    ): Promise<Array<Record<string, unknown>>> {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            this.logger.info({
                correlationId,
                action: 'create_split_entry_start',
                receiptId,
                itemCount: lineItems.length,
                creditAccount
            });

            // ✅ Step 1: Verify receipt exists
            const receipt = await Receipt.findOne({
                _id: receiptId,
                clientId
            }).session(session);

            if (!receipt) {
                throw new NotFoundError(`Receipt ${receiptId} not found`);
            }

            // ✅ Step 2: Validate total amount matches
            const totalAmount = lineItems.reduce(
                (sum, item) => sum + item.amount,
                0
            );

            if (receipt.extractedFields?.amountSatang &&
                totalAmount !== receipt.extractedFields.amountSatang) {
                throw new FinancialIntegrityError(
                    'Line items total does not match receipt amount',
                    {
                        receiptAmount: receipt.extractedFields.amountSatang,
                        lineItemsTotal: totalAmount
                    }
                );
            }

            // ✅ Step 3: Generate split group ID
            const splitGroupId = uuidv4();
            const entries: Array<Record<string, unknown>> = [];

            // ✅ Step 4: Create entry for each line item
            for (let i = 0; i < lineItems.length; i++) {
                const item = lineItems[i];

                // Validate amount is positive integer
                if (!Number.isInteger(item.amount) || item.amount <= 0) {
                    throw new FinancialIntegrityError(
                        `Invalid amount for item ${i}: ${item.amount}`,
                        { itemIndex: i, amount: item.amount }
                    );
                }

                // Create journal entry
                const entry = new JournalEntry({
                    account: {
                        debit: item.debitAccount,
                        credit: creditAccount
                    },
                    debit: item.amount,
                    credit: item.amount,
                    description: item.description,
                    parentReceiptId: receiptId,
                    isSplitEntry: true,
                    splitIndex: i,
                    splitGroupId,
                    clientId,
                    status: 'draft',
                    createdAt: new Date(),
                    updatedAt: new Date()
                });

                await entry.save({ session });

                this.logger.debug({
                    correlationId,
                    action: 'split_entry_created',
                    entryId: entry._id,
                    splitIndex: i,
                    debitAccount: item.debitAccount,
                    amount: item.amount
                });

                // ✅ Step 5: Post to Medici ledger
                // Use postEntryWithClient to include clientId
                await this.medicerService.postEntryWithClient(
                    clientId,
                    item.debitAccount,
                    creditAccount,
                    item.amount,
                    item.description,
                    session
                );

                entries.push(entry.toObject());
            }

            // ✅ Step 6: Verify trial balance
            const balance = await this.medicerService.getTrialBalance(
                clientId,
                session
            );

            if (balance !== 0) {
                throw new FinancialIntegrityError(
                    'Trial balance not zero after split entry',
                    {
                        balance,
                        splitGroupId,
                        itemCount: lineItems.length
                    }
                );
            }

            // ✅ Step 7: Update receipt status
            receipt.splitTransactionEnabled = true;
            await receipt.save({ session });

            // ✅ Step 8: Commit transaction
            await session.commitTransaction();

            this.logger.info({
                correlationId,
                action: 'split_entry_complete',
                receiptId,
                splitGroupId,
                entriesCreated: entries.length,
                totalAmount
            });

            return entries;

        } catch (error: unknown) {
            await session.abortTransaction();

            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            this.logger.error({
                correlationId,
                action: 'split_entry_failed',
                receiptId,
                error: errorMessage,
                stack: error instanceof Error ? error.stack : undefined
            });

            throw error;
        } finally {
            await session.endSession();
        }
    }

    /**
     * Get all entries in a split group
     */
    async getSplitEntries(
        splitGroupId: string,
        clientId: string
    ): Promise<Array<Record<string, unknown>>> {
        const entries = await JournalEntry.find({
            splitGroupId,
            clientId
        }).sort({ splitIndex: 1 }).lean();
        return entries as Array<Record<string, unknown>>;
    }
}
