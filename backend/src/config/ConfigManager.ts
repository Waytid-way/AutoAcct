// backend/src/config/ConfigManager.ts

import { z } from 'zod';
import * as dotenv from 'dotenv';
import logger from './logger';

// Load environment variables
dotenv.config({ path: '.env.local' });

/**
 * CONFIG SCHEMA (Zod Validation)
 * Enforces type safety and validation for all environment variables
 * 
 * Reference: Vol 1 Section 5 - Environment Configuration
 */
const ConfigSchema = z.object({
    // ===========================
    // DUAL MODE SETTINGS
    // ===========================
    APP_MODE: z.enum(['dev', 'staging', 'production']).default('dev'),
    IS_DEBUG: z
        .string()
        .optional()
        .transform((val) => val === 'true')
        .default('false'),
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

    // ===========================
    // DATABASE
    // ===========================
    MONGODB_URI: z.string().url('Invalid MongoDB URI'),
    MONGODB_REPLICA_SET: z.string().default('rs0'),

    // ===========================
    // AUTHENTICATION
    // ===========================
    JWT_SECRET: z.string().min(32, 'JWT Secret must be at least 32 chars'),
    JWT_EXPIRY: z.string().default('24h'),

    // ===========================
    // EXTERNAL SERVICES (Adapters)
    // ===========================
    OCR_WORKER_URL: z.string().url().default('http://localhost:8000'),

    EXPRESS_MODE: z.enum(['debug', 'staging', 'production']).default('debug'),
    EXPRESS_API_URL: z.string().url().default('http://localhost:9000'),
    EXPRESS_API_KEY: z.string().optional(),

    GROQ_API_KEY: z.string().min(1, 'Groq API Key required'),
    GROQ_MODEL: z.string().default('llama-3.3-70b-versatile'),

    TEABLE_API_URL: z.string().url().default('https://app.teable.io/api'),
    TEABLE_API_KEY: z.string().optional(),
    TEABLE_BASE_ID: z.string().optional(),
    TEABLE_RECEIPT_TABLE_ID: z.string().optional(),

    // ===========================
    // LOGGING
    // ===========================
    LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
    DISCORD_WEBHOOK_URL: z.string().url().optional(),

    // ===========================
    // RETRY LOGIC
    // ===========================
    RETRY_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(10).default(3),
    RETRY_INITIAL_INTERVAL_MS: z.coerce.number().int().default(300000), // 5 min
    RETRY_MAX_INTERVAL_MS: z.coerce.number().int().default(3600000), // 1 hour
    RETRY_BACKOFF_MULTIPLIER: z.coerce.number().default(1.5),

    // ===========================
    // ENCRYPTION
    // ===========================
    ENCRYPTION_KEY: z.string().length(64, 'Must be 32-byte hex (64 chars)'),

    // ===========================
    // SERVER
    // ===========================
    PORT: z.coerce.number().int().default(3000),
    HOST: z.string().default('0.0.0.0'),
});

type Config = z.infer<typeof ConfigSchema>;

/**
 * ConfigManager
 * Centralized configuration with validation and mode-aware defaults
 */
class ConfigManager {
    private config: Config;
    private static instance: ConfigManager;

    private constructor() {
        try {
            // Parse and validate environment variables
            this.config = ConfigSchema.parse(process.env);

            // Log initialization (with sensitive data redacted)
            logger.info({
                action: 'config_initialized',
                appMode: this.config.APP_MODE,
                isDebug: this.config.IS_DEBUG,
                expressMode: this.config.EXPRESS_MODE,
                nodeEnv: this.config.NODE_ENV,
            });

            // Warn if production mode with debug settings
            if (this.config.APP_MODE === 'production' && this.config.IS_DEBUG) {
                logger.warn({
                    action: 'config_warning',
                    message: 'IS_DEBUG=true in production mode - this will impact performance!',
                });
            }
        } catch (error) {
            if (error instanceof z.ZodError) {
                console.error('❌ Configuration validation failed:');
                error.errors.forEach((err) => {
                    console.error(`  - ${err.path.join('.')}: ${err.message}`);
                });
                process.exit(1);
            }
            throw error;
        }
    }

    /**
     * Singleton pattern - only one instance
     */
    public static getInstance(): ConfigManager {
        if (!ConfigManager.instance) {
            ConfigManager.instance = new ConfigManager();
        }
        return ConfigManager.instance;
    }

    /**
     * Get configuration value
     */
    public get<K extends keyof Config>(key: K): Config[K] {
        return this.config[key];
    }

    /**
     * Check if running in DEV mode
     */
    public isDev(): boolean {
        return this.config.APP_MODE === 'dev' || this.config.IS_DEBUG;
    }

    /**
     * Check if running in PRODUCTION mode
     */
    public isProduction(): boolean {
        return this.config.APP_MODE === 'production' && !this.config.IS_DEBUG;
    }

    /**
     * Get Retry Configuration
     */
    public getRetryConfig() {
        return {
            maxAttempts: this.config.RETRY_MAX_ATTEMPTS,
            initialInterval: this.config.RETRY_INITIAL_INTERVAL_MS,
            maxInterval: this.config.RETRY_MAX_INTERVAL_MS,
            multiplier: this.config.RETRY_BACKOFF_MULTIPLIER,
        };
    }

    /**
     * Get all config (for debugging only)
     * ⚠️ Redacts sensitive keys
     */
    public getAll(): Partial<Config> {
        const sensitiveKeys: (keyof Config)[] = [
            'JWT_SECRET',
            'GROQ_API_KEY',
            'EXPRESS_API_KEY',
            'TEABLE_API_KEY',
            'ENCRYPTION_KEY',
        ];

        const redacted = { ...this.config };
        sensitiveKeys.forEach((key) => {
            if (redacted[key]) {
                redacted[key] = '***REDACTED***' as any;
            }
        });

        return redacted;
    }
}

// Export singleton instance
export default ConfigManager.getInstance();
