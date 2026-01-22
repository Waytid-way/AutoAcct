// backend/src/config/logger.ts

import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';

/**
 * WINSTON LOGGER with CorrelationId Support
 * 
 * Features:
 * - Structured JSON logs
 * - CorrelationId tracing
 * - Dual mode: Verbose (DEV) | Silent (PROD)
 * - Daily rotating files
 * 
 * Reference: Vol 2C Section 15.2 - Structured Logging
 */

// Custom log format
const logFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.json()
);

// Console format (colorized for DEV)
const consoleFormat = winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp({ format: 'HH:mm:ss' }),
    winston.format.printf(({ timestamp, level, message, correlationId, ...meta }) => {
        const metaStr = Object.keys(meta).length > 0 ? JSON.stringify(meta) : '';
        return `${timestamp} [${correlationId || 'system'}] ${level}: ${message} ${metaStr}`;
    })
);

/**
 * Create logger instance
 */
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: logFormat,
    defaultMeta: {
        service: 'autoacct-backend',
        environment: process.env.NODE_ENV || 'development',
    },
    transports: [
        // Console output
        new winston.transports.Console({
            format: consoleFormat,
            level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
        }),

        // Daily rotating file - All logs
        new DailyRotateFile({
            filename: 'logs/app-%DATE%.log',
            datePattern: 'YYYY-MM-DD',
            maxSize: '20m',
            maxFiles: '30d',
            auditFile: 'logs/.audit.json',
        }),

        // Daily rotating file - Error logs only
        new DailyRotateFile({
            filename: 'logs/error-%DATE%.log',
            datePattern: 'YYYY-MM-DD',
            level: 'error',
            maxSize: '20m',
            maxFiles: '90d',
        }),
    ],
});

/**
 * Export logger
 */
export default logger;

/**
 * Helper function to send critical alerts
 * (Discord webhook for production errors)
 */
export async function sendCriticalAlert(
    correlationId: string,
    error: string,
    details?: unknown
): Promise<void> {
    const webhookUrl = process.env.DISCORD_WEBHOOK_URL;

    if (!webhookUrl) {
        logger.warn({ action: 'discord_webhook_not_configured' });
        return;
    }

    try {
        await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                content: `🚨 **Critical Error**`,
                embeds: [
                    {
                        title: 'AutoAcct Backend Error',
                        description: error,
                        color: 0xff0000,
                        fields: [
                            { name: 'Correlation ID', value: correlationId, inline: true },
                            { name: 'Environment', value: process.env.NODE_ENV, inline: true },
                            { name: 'Timestamp', value: new Date().toISOString(), inline: true },
                            { name: 'Details', value: JSON.stringify(details, null, 2) },
                        ],
                    },
                ],
            }),
        });
    } catch (err) {
        logger.error({ action: 'discord_alert_failed', error: (err as Error).message });
    }
}
