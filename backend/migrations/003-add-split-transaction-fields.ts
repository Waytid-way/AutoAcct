import mongoose from 'mongoose';
import Receipt from '../src/models/Receipt.model';
import { JournalEntry } from '../src/modules/accounting/models/JournalEntry';

export async function up() {
    console.log('[Migration 003] Adding split transaction fields...');

    // Update existing receipts
    const receiptResult = await Receipt.updateMany(
        { splitTransactionEnabled: { $exists: false } }, // Only update if field missing
        {
            $set: {
                splitTransactionEnabled: false,
                lineItems: []
            }
        }
    );
    console.log(`Updated ${receiptResult.modifiedCount} receipts`);

    // Update existing journal entries
    const journalResult = await JournalEntry.updateMany(
        { isSplitEntry: { $exists: false } },
        {
            $set: {
                isSplitEntry: false
            }
        }
    );
    console.log(`Updated ${journalResult.modifiedCount} journal entries`);

    console.log('[Migration 003] Complete ✅');
}

export async function down() {
    console.log('[Migration 003] Rolling back...');

    await Receipt.updateMany(
        {},
        {
            $unset: {
                splitTransactionEnabled: 1,
                lineItems: 1
            }
        }
    );

    await JournalEntry.updateMany(
        {},
        {
            $unset: {
                parentReceiptId: 1,
                isSplitEntry: 1,
                splitIndex: 1,
                splitGroupId: 1
            }
        }
    );

    console.log('[Migration 003] Rollback complete');
}
