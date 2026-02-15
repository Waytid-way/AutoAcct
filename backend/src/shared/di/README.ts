/**
 * Dependency Injection Guide & Service Refactoring
 * 
 * This document explains how to properly implement DI in services.
 * 
 * CURRENT STATE (Before):
 * ```typescript
 * class ReceiptService {
 *   constructor(deps?: Dependencies) {
 *     this.transactionService = deps?.transactionService || new TransactionService();
 *     // Creates dependencies if not provided - BAD!
 *   }
 * }
 * ```
 * 
 * PROBLEM:
 * - Services create their own dependencies
 * - Hard to test (can't mock)
 * - Multiple instances
 * - Tight coupling
 * 
 * TARGET STATE (After):
 * ```typescript
 * class ReceiptService {
 *   constructor(
 *     private readonly transactionService: ITransactionService,
 *     private readonly accountingService: IAccountingService,
 *     // ... all deps required
 *   ) {}
 * }
 * 
 * // Create once, inject everywhere
 * const receiptService = new ReceiptService(
 *   container.resolve(TOKENS.TransactionService),
 *   container.resolve(TOKENS.AccountingService),
 * );
 * ```
 * 
 * MIGRATION STEPS:
 * 
 * 1. Create Interface for the Service
 * ```typescript
 * export interface IReceiptService {
 *   uploadReceipt(...): Promise<IReceipt>;
 *   getById(...): Promise<IReceipt>;
 *   // ... all public methods
 * }
 * ```
 * 
 * 2. Refactor Service to Use Constructor Injection Only
 * ```typescript
 * export class ReceiptService implements IReceiptService {
 *   constructor(
 *     private readonly logger: ILogger,
 *     private readonly transactionService: ITransactionService,
 *     private readonly accountingService: IAccountingService,
 *     private readonly groqService: IGroqClassificationService,
 *     private readonly anomalyService: IAnomalyDetectionService,
 *   ) {
 *     // NO default instantiations!
 *     // All deps must be provided
 *   }
 * }
 * ```
 * 
 * 3. Register Service in DI Container
 * ```typescript
 * // In container.ts or a setup file
 * container.registerSingleton(TOKENS.ReceiptService, () => 
 *   new ReceiptService(
 *     container.resolve(TOKENS.Logger),
 *     container.resolve(TOKENS.TransactionService),
 *     container.resolve(TOKENS.AccountingService),
 *     container.resolve(TOKENS.GroqClassificationService),
 *     container.resolve(TOKENS.AnomalyDetectionService),
 *   )
 * );
 * ```
 * 
 * 4. Use Container to Resolve Services
 * ```typescript
 * // In routes/controllers
 * const receiptService = container.resolve<IReceiptService>(TOKENS.ReceiptService);
 * ```
 * 
 * 5. For Testing - Mock Dependencies
 * ```typescript
 * const mockTransactionService = {
 *   createDraft: jest.fn(),
 * };
 * 
 * const receiptService = new ReceiptService(
 *   mockLogger,
 *   mockTransactionService,
 *   // ... other mocks
 * );
 * ```
 * 
 * BENEFITS:
 * - Easy to test (just pass mocks)
 * - Single instances (singletons)
 * - Loose coupling
 * - Clear dependencies
 * - Better maintainability
 * 
 * MIGRATION PRIORITY:
 * 1. High: Services with external dependencies (API calls, DB)
 * 2. Medium: Services used in multiple places
 * 3. Low: Simple utility services
 * 
 * FILES TO MIGRATE:
 * - ReceiptService.ts (HIGH)
 * - TransactionService.ts (HIGH)
 * - AccountingService.ts (MEDIUM)
 * - GroqClassificationService.ts (HIGH)
 * - AnomalyDetectionService.ts (LOW)
 * 
 * CURRENT MIGRATION STATUS:
 * - [x] DI Container created
 * - [ ] Logger migrated
 * - [ ] ReceiptService migrated
 * - [ ] TransactionService migrated
 * - [ ] AccountingService migrated
 * - [ ] GroqClassificationService migrated
 * - [ ] Routes updated to use container
 * 
 * NOTE: This is a gradual migration. Don't break existing code.
 * Keep backward compatibility until all services are migrated.
 */

export {};
