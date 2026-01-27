// backend/src/models/index.ts

/**
 * Centralized model exports
 *
 * Usage:
 * import { Receipt, Transaction, User } from '@models';
 */

export { default as Receipt } from './schemas/Receipt.schema';
export { default as Transaction } from './schemas/Transaction.schema';
export { default as ExportLog } from './schemas/ExportLog.schema';
export { default as SystemLog } from './schemas/SystemLog.schema';
export { default as User } from './schemas/User.schema';

// Export types
export type { IReceipt } from './schemas/Receipt.schema';
export type { ITransaction } from './schemas/Transaction.schema';
export type { IExportLog } from './schemas/ExportLog.schema';
export type { ISystemLog } from './schemas/SystemLog.schema';
export type { IUser } from './schemas/User.schema';