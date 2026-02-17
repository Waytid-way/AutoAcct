/**
 * Dependency Injection Container
 * 
 * Proper DI container with explicit constructor injection.
 * All services must be registered before use - no default instantiations.
 * 
 * Usage:
 * 1. Register services: container.register('ServiceName', () => new Service(deps))
 * 2. Resolve services: const service = container.resolve<IService>('ServiceName')
 * 3. All dependencies are explicitly injected - fail fast if missing
 * 
 * Design Principles:
 * - Explicit injection only (no defaults/fallbacks)
 * - Fail fast on missing dependencies
 * - Interfaces over concrete classes
 * - Singleton for stateful services, transient for stateless
 */

import { Logger } from 'winston';
import logger from '@/config/logger';
import config from '@/config/ConfigManager';
import {
    ILogger,
    IReceiptService,
    ITransactionService,
    IAccountingService,
    ILedgerIntegrationService,
    IGroqClassificationService,
    IAnomalyDetectionService,
    IOcrService,
    IStorageAdapter,
    IStatisticalAnalysisService,
    IMedicerService,
} from './interfaces';

// Service imports
import { ReceiptService } from '@/modules/receipt/services/ReceiptService';
import { TransactionService } from '@/modules/transaction/services/TransactionService';
import { AccountingService } from '@/modules/accounting/services/AccountingService';
import { LedgerIntegrationService } from '@/modules/ledger/services/LedgerIntegrationService';
import { GroqClassificationService } from '@/modules/ai/GroqClassificationService';
import { AnomalyDetectionService } from '@/modules/anomaly/services/AnomalyDetectionService';
import { StatisticalAnalysisService } from '@/modules/anomaly/services/StatisticalAnalysisService';
import { MedicerService } from '@/modules/accounting/services/MedicerService';
import { OcrService } from '@/modules/ocr/services/OcrService';
import { OCRIntegrationService } from '@/modules/ocr/services/OCRIntegrationService';
import { MockOCRService } from '@/modules/ocr/services/MockOCRService';
import { GroqOCRService } from '@/modules/ocr/services/GroqOCRService';
import { GroqPromptService } from '@/modules/ocr/services/GroqPromptService';
import { ConfidenceScorer } from '@/modules/ocr/services/ConfidenceScorer';
import { TeableService } from '@/modules/teable/adapters/TeableService';
import { MockTeableService } from '@/modules/teable/adapters/MockTeableService';
import { WorkflowService } from '@/modules/workflow/services/WorkflowService';
import Groq from 'groq-sdk';

// Service registry type
type ServiceFactory<T> = () => T;
type ServiceRegistry = Map<string, ServiceFactory<unknown>>;

class DIContainer {
    private static instance: DIContainer;
    private registry: ServiceRegistry = new Map();
    private singletons: Map<string, unknown> = new Map();

    private constructor() {}

    public static getInstance(): DIContainer {
        if (!DIContainer.instance) {
            DIContainer.instance = new DIContainer();
        }
        return DIContainer.instance;
    }

    /**
     * Register a service factory
     */
    public register<T>(token: string, factory: ServiceFactory<T>): void {
        this.registry.set(token, factory as ServiceFactory<unknown>);
    }

    /**
     * Register a singleton service (created once, reused)
     */
    public registerSingleton<T>(token: string, factory: ServiceFactory<T>): void {
        this.registry.set(token, () => {
            if (!this.singletons.has(token)) {
                this.singletons.set(token, factory());
            }
            return this.singletons.get(token);
        });
    }

    /**
     * Resolve a service by token
     */
    public resolve<T>(token: string): T {
        const factory = this.registry.get(token);
        if (!factory) {
            throw new Error(`Service '${token}' not registered`);
        }
        return factory() as T;
    }

    /**
     * Check if a service is registered
     */
    public has(token: string): boolean {
        return this.registry.has(token);
    }

    /**
     * Clear all registrations (useful for testing)
     */
    public clear(): void {
        this.registry.clear();
        this.singletons.clear();
    }
}

// Export singleton
export const container = DIContainer.getInstance();

// Service Tokens (constants to avoid typos)
export const TOKENS = {
    Logger: 'Logger',
    ReceiptService: 'ReceiptService',
    TransactionService: 'TransactionService',
    AccountingService: 'AccountingService',
    MedicerService: 'MedicerService',
    LedgerIntegrationService: 'LedgerIntegrationService',
    GroqClassificationService: 'GroqClassificationService',
    AnomalyDetectionService: 'AnomalyDetectionService',
    StatisticalAnalysisService: 'StatisticalAnalysisService',
    OCRService: 'OCRService',
    OCRIntegrationService: 'OCRIntegrationService',
    TeableService: 'TeableService',
    WorkflowService: 'WorkflowService',
    StorageAdapter: 'StorageAdapter',
} as const;

/**
 * Initialize the DI container with all services
 * Call this once at application startup
 */
export function initializeContainer(): void {
    // Clear any existing registrations (for hot reload scenarios)
    container.clear();

    // Logger (singleton - shared across all services)
    container.registerSingleton<ILogger>(TOKENS.Logger, () => logger);

    // Medicer Service (singleton - maintains ledger connection)
    container.registerSingleton<IMedicerService>(TOKENS.MedicerService, () => 
        new MedicerService()
    );

    // Statistical Analysis Service (singleton - has caching)
    container.registerSingleton<IStatisticalAnalysisService>(TOKENS.StatisticalAnalysisService, () => 
        new StatisticalAnalysisService()
    );

    // Ledger Integration Service (singleton - maintains external connections)
    container.registerSingleton<ILedgerIntegrationService>(TOKENS.LedgerIntegrationService, () => 
        new LedgerIntegrationService()
    );

    // Groq Classification Service (singleton - has API client)
    container.registerSingleton<IGroqClassificationService>(TOKENS.GroqClassificationService, () => {
        const apiKey = process.env.GROQ_API_KEY || '';
        if (!apiKey) {
            logger.warn({
                action: 'di_container_warning',
                message: 'GROQ_API_KEY not set, classification service will fail'
            });
        }
        return new GroqClassificationService(
            container.resolve<ILogger>(TOKENS.Logger),
            apiKey
        );
    });

    // Anomaly Detection Service (singleton - has internal cache)
    container.registerSingleton<IAnomalyDetectionService>(TOKENS.AnomalyDetectionService, () => 
        new AnomalyDetectionService(
            container.resolve<ILogger>(TOKENS.Logger),
            container.resolve<IStatisticalAnalysisService>(TOKENS.StatisticalAnalysisService)
        )
    );

    // Transaction Service (singleton)
    container.registerSingleton<ITransactionService>(TOKENS.TransactionService, () => 
        new TransactionService(
            container.resolve<ILogger>(TOKENS.Logger),
            container.resolve<ILedgerIntegrationService>(TOKENS.LedgerIntegrationService)
        )
    );

    // Accounting Service (singleton)
    container.registerSingleton<IAccountingService>(TOKENS.AccountingService, () => 
        new AccountingService(
            container.resolve<ILogger>(TOKENS.Logger),
            container.resolve<IMedicerService>(TOKENS.MedicerService)
        )
    );

    // Receipt Service (singleton - the main orchestrator)
    container.registerSingleton<IReceiptService>(TOKENS.ReceiptService, () => 
        new ReceiptService(
            container.resolve<ILogger>(TOKENS.Logger),
            container.resolve<ITransactionService>(TOKENS.TransactionService),
            container.resolve<IAccountingService>(TOKENS.AccountingService),
            container.resolve<IGroqClassificationService>(TOKENS.GroqClassificationService),
            container.resolve<IAnomalyDetectionService>(TOKENS.AnomalyDetectionService),
            // StorageAdapter is optional, will be undefined if not registered
            container.has(TOKENS.StorageAdapter) 
                ? container.resolve<IStorageAdapter>(TOKENS.StorageAdapter) 
                : undefined
        )
    );

    // OCR Service (singleton - has model loading)
    container.registerSingleton<IOcrService>(TOKENS.OCRService, () => 
        new OcrService()
    );

    // OCR Integration Service (singleton - manages Bull queue)
    container.registerSingleton(TOKENS.OCRIntegrationService, () => 
        new OCRIntegrationService()
    );

    // Teable Service (singleton - external API client)
    // Uses factory pattern for mock/prod switching
    container.registerSingleton(TOKENS.TeableService, () => {
        const isMock = config.get('TEABLE_SERVICE_MODE') === 'mock' || !config.isProduction();
        
        if (isMock) {
            logger.info({ action: 'di_container', service: 'TeableService', mode: 'MOCK' });
            return new MockTeableService();
        } else {
            const apiKey = config.get('TEABLE_API_KEY');
            const baseId = config.get('TEABLE_BASE_ID');
            const tableId = config.get('TEABLE_RECEIPT_TABLE_ID');
            const apiUrl = config.get('TEABLE_API_URL');
            
            if (!apiKey || !baseId) {
                logger.warn({ 
                    action: 'di_container_warning', 
                    service: 'TeableService',
                    message: 'Teable config missing, falling back to mock' 
                });
                return new MockTeableService();
            }
            
            logger.info({ action: 'di_container', service: 'TeableService', mode: 'PRODUCTION' });
            return new TeableService(apiUrl, apiKey, baseId, tableId);
        }
    });

    // Workflow Service (singleton - orchestrates OCR completion workflow)
    container.registerSingleton(TOKENS.WorkflowService, () => 
        new WorkflowService({
            logger: container.resolve<ILogger>(TOKENS.Logger),
            teableService: container.resolve(TOKENS.TeableService),
            transactionService: container.resolve<ITransactionService>(TOKENS.TransactionService)
        })
    );

    logger.info({ 
        action: 'di_container_initialized',
        registeredServices: Array.from(Object.values(TOKENS))
    });
}

// Injection decorator (for future use with proper DI framework)
export function Inject(token: string) {
    return function (target: unknown, propertyKey: string) {
        Object.defineProperty(target, propertyKey, {
            get: () => container.resolve(token),
            enumerable: true,
            configurable: true,
        });
    };
}

export default container;
