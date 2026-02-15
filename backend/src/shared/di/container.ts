/**
 * Dependency Injection Container
 * 
 * Simple DI container for managing service dependencies.
 * This is a stepping stone towards proper DI without breaking existing code.
 * 
 * Usage:
 * 1. Register services: container.register('ServiceName', () => new Service())
 * 2. Resolve services: const service = container.resolve<Service>('ServiceName')
 * 3. Or use the decorator/factory pattern in services
 * 
 * TODO: Migrate all services to use constructor injection only
 * TODO: Remove default instantiations from constructors
 * TODO: Add proper interfaces for all services
 */

import { Logger } from 'winston';
import logger from '@/config/logger';

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
    GroqClassificationService: 'GroqClassificationService',
    AnomalyDetectionService: 'AnomalyDetectionService',
    OCRService: 'OCRService',
} as const;

// Initialize default services
export function initializeContainer(): void {
    // Logger
    container.registerSingleton<Logger>(TOKENS.Logger, () => logger);

    // Services will be registered here as they migrate to DI
    // Example:
    // container.registerSingleton(TOKENS.ReceiptService, () => new ReceiptService(
    //     container.resolve(TOKENS.Logger),
    //     container.resolve(TOKENS.TransactionService),
    //     // ... other deps
    // ));

    logger.info({ action: 'di_container_initialized' });
}

// Service interface definitions for future use
export interface ILogger {
    info(message: string | object): void;
    warn(message: string | object): void;
    error(message: string | object): void;
    debug(message: string | object): void;
}

// Injection decorator (for future use with proper DI)
export function Inject(token: string) {
    return function (target: any, propertyKey: string) {
        Object.defineProperty(target, propertyKey, {
            get: () => container.resolve(token),
            enumerable: true,
            configurable: true,
        });
    };
}

export default container;
