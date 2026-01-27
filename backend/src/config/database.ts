// backend/src/config/database.ts

import mongoose from 'mongoose';
import config from './ConfigManager';
import logger from './logger';

/**
 * Connect to MongoDB with retry logic
 *
 * Requirements:
 * - Replica set (for transactions support)
 * - Connection pooling
 * - Auto-reconnect
 */
export async function connectDatabase(): Promise<void> {
  const mongoUri = config.get('MONGODB_URI');
  const maxRetries = 5;
  let retryCount = 0;

  while (retryCount < maxRetries) {
    try {
      await mongoose.connect(mongoUri, {
        // Replica set name (required for transactions)
        replicaSet: config.get('MONGODB_REPLICA_SET'),

        // Connection pool
        maxPoolSize: 10,
        minPoolSize: 2,

        // Timeouts
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      });

      logger.info({
        action: 'database_connected',
        uri: mongoUri.replace(/\/\/.*@/, '//<credentials>@'),  // Redact password
        replicaSet: config.get('MONGODB_REPLICA_SET'),
      });

      // Test replica set status (if needed)
      if (config.isProduction()) {
        await verifyReplicaSet();
      }

      return;
    } catch (error) {
      retryCount++;
      logger.error({
        action: 'database_connection_failed',
        attempt: retryCount,
        maxRetries,
        error: (error as Error).message,
      });

      if (retryCount >= maxRetries) {
        throw new Error(`Failed to connect to MongoDB after ${maxRetries} attempts`);
      }

      // Wait before retry (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, 2000 * retryCount));
    }
  }
}

/**
 * Verify replica set is healthy
 */
async function verifyReplicaSet(): Promise<void> {
  if (!mongoose.connection.db) {
    throw new Error('Database connection not established');
  }

  const admin = mongoose.connection.db.admin();
  const status = await admin.command({ replSetGetStatus: 1 });

  logger.info({
    action: 'replica_set_verified',
    set: status.set,
    members: status.members.length,
  });
}

/**
 * Graceful shutdown
 */
export async function disconnectDatabase(): Promise<void> {
  await mongoose.connection.close();
  logger.info({ action: 'database_disconnected' });
}