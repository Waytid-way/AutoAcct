// backend/src/models/schemas/SystemLog.schema.ts

import mongoose, { Schema, Document } from 'mongoose';

/**
 * SYSTEM LOG SCHEMA
 *
 * Purpose:
 * - Persist critical system events from Winston logger
 * - Centralized audit trail (queryable, searchable)
 * - Enable monitoring and alerting
 * - Support debugging with correlationId
 *
 * Log Levels (Winston):
 * - error   → System failures, exceptions
 * - warn    → Unexpected behavior, degraded service
 * - info    → Normal operations (e.g., user actions)
 * - debug   → Development/troubleshooting
 *
 * References:
 * - Vol1 Section 11 - Error Handling & Logging
 * - Vol2C Section 15.2 - Structured Logging
 */

export interface ISystemLog extends Document {
  // ===========================
  // LOG METADATA
  // ===========================
  level: 'error' | 'warn' | 'info' | 'debug';

  message: string;                     // Human-readable message

  action?: string;                     // Action being performed (e.g., "ocr_processing")

  // ===========================
  // ERROR DETAILS
  // ===========================
  errorCode?: string;                  // Application error code
  errorStack?: string;                 // Stack trace (for errors)

  // ===========================
  // CONTEXT
  // ===========================
  correlationId?: string;              // Request/workflow ID
  userId?: mongoose.Types.ObjectId;    // User who triggered (if applicable)
  clientId?: mongoose.Types.ObjectId;  // Client context

  // Additional metadata (JSON)
  metadata?: Record<string, any>;

  // ===========================
  // HTTP CONTEXT (if from API request)
  // ===========================
  httpMethod?: string;                 // e.g., "POST"
  httpPath?: string;                   // e.g., "/api/ocr/queue-upload"
  httpStatusCode?: number;
  ipAddress?: string;
  userAgent?: string;

  // ===========================
  // TIMING
  // ===========================
  timestamp: Date;                     // When event occurred

  // ===========================
  // ENVIRONMENT
  // ===========================
  environment?: 'development' | 'staging' | 'production';
  hostname?: string;                   // Server hostname

  // ===========================
  // ALERTING
  // ===========================
  alertSent?: boolean;                 // Was Discord alert sent?
  alertedAt?: Date;
}

const SystemLogSchema = new Schema<ISystemLog>(
  {
    // METADATA
    level: {
      type: String,
      enum: ['error', 'warn', 'info', 'debug'],
      required: true,
      index: true,
    },

    message: {
      type: String,
      required: true,
      maxlength: 2000,
    },

    action: {
      type: String,
      index: true,
    },

    // ERROR
    errorCode: String,
    errorStack: {
      type: String,
      maxlength: 10000,
    },

    // CONTEXT
    correlationId: {
      type: String,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    clientId: {
      type: Schema.Types.ObjectId,
      ref: 'Client',
      index: true,
    },

    metadata: Schema.Types.Mixed,

    // HTTP
    httpMethod: String,
    httpPath: String,
    httpStatusCode: Number,
    ipAddress: String,
    userAgent: String,

    // TIMING
    timestamp: {
      type: Date,
      default: Date.now,
      required: true,
      index: true,
    },

    // ENVIRONMENT
    environment: {
      type: String,
      enum: ['development', 'staging', 'production'],
    },
    hostname: String,

    // ALERTING
    alertSent: Boolean,
    alertedAt: Date,
  },
  {
    timestamps: false,  // We use custom 'timestamp' field
    collection: 'systemlogs',
  }
);

// ===========================
// INDEXES
// ===========================

// Query by level + timestamp (most recent errors)
SystemLogSchema.index({ level: 1, timestamp: -1 });

// CorrelationId lookup (trace requests)
SystemLogSchema.index({ correlationId: 1, timestamp: 1 });

// Client logs
SystemLogSchema.index({ clientId: 1, timestamp: -1 });

// Action-based queries
SystemLogSchema.index({ action: 1, timestamp: -1 });

// TTL index: Auto-delete logs older than 90 days
SystemLogSchema.index(
  { timestamp: 1 },
  { expireAfterSeconds: 90 * 24 * 60 * 60 }  // 90 days
);

// ===========================
// STATIC METHODS
// ===========================

/**
 * Create log from Winston log object
 */
SystemLogSchema.statics.createFromWinston = async function(
  logObject: any
): Promise<ISystemLog> {
  const SystemLog = this as mongoose.Model<ISystemLog>;

  return await SystemLog.create({
    level: logObject.level,
    message: logObject.message,
    action: logObject.action,
    errorCode: logObject.errorCode,
    errorStack: logObject.stack,
    correlationId: logObject.correlationId,
    userId: logObject.userId,
    clientId: logObject.clientId,
    metadata: logObject.metadata,
    httpMethod: logObject.httpMethod,
    httpPath: logObject.httpPath,
    httpStatusCode: logObject.httpStatusCode,
    timestamp: new Date(logObject.timestamp),
    environment: process.env.NODE_ENV as any,
    hostname: require('os').hostname(),
  });
};

export default mongoose.model<ISystemLog>('SystemLog', SystemLogSchema);