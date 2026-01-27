# 📦 **SKILL 3: AutoAcct Service Layer (Antigravity Edition)**

---
name: autoaccl-service-layer
version: 2.0.0-antigravity
category: backend-development
stack: [typescript, bun, mongodb, mongoose]
project: autoaccl
last_updated: 2026-01-26T21:43:00+07:00
---

# AutoAcct Service Layer Skill

**Natural Language Triggers:**
- "create service for"
- "implement business logic"
- "add transaction handling"
- "orchestrate services"
- "process receipt/transaction"

---

## 📖 What This Skill Does

Creates **production-ready Service Layer** for AutoAcct with:
- ✅ **Pure business logic** (HTTP-agnostic)
- ✅ **ACID transactions** (MongoDB sessions)
- ✅ **CorrelationId propagation** (distributed tracing)
- ✅ **MoneyInt convention** (Integer Satang)
- ✅ **Domain errors** (not HTTP errors)
- ✅ **Service composition** (orchestrate external services)

**Philosophy:** Services are the Business Logic Hub between Controllers ↔ Database.

---

## 🎯 When to Use

**Use when:**
- Upload receipt + hash + duplicate check + drive sync
- POST ledger entry + trial balance check
- OCR processing + PaddleOCR fallback + Google Vision
- Hash & deduplicate receipts
- Calculate trial balance before/after posting

**Don't use when:**
- GET receipt by id (simple lookup - Controller → Repository)
- List receipts with pagination (no business logic)
- Format receipt for JSON response (pure function)

---

## 🚀 Quick Start (30 seconds)

```typescript
// 1. Create a Service (pure business logic – no Express)
import { Receipt } from '../models/Receipt';
import crypto from 'crypto';

export class ReceiptService {
  async uploadReceipt(
    file: Buffer,
    fileName: string,
    mimeType: string,
    clientId: string,
    correlationId: string
  ): Promise<Receipt> {
    const fileHash = this.calculateHash(file);
    await this.ensureNotDuplicate(fileHash, clientId, correlationId);

    const receipt = await this.saveReceipt({
      fileName,
      fileHash,
      mimeType,
      clientId,
    }, correlationId);

    console.log(`[${correlationId}] Receipt uploaded: ${receipt.id}`);
    return receipt;
  }

  private calculateHash(file: Buffer): string {
    return crypto.createHash('sha256').update(file).digest('hex');
  }

  private async ensureNotDuplicate(
    fileHash: string,
    clientId: string,
    correlationId: string
  ): Promise<void> {
    const existing = await Receipt.findOne({ fileHash, clientId });
    if (existing) {
      throw new DuplicateReceiptError(fileHash);
    }
  }

  private async saveReceipt(
    data: { fileName: string; fileHash: string; mimeType: string; clientId: string },
    correlationId: string
  ): Promise<Receipt> {
    const receipt = new Receipt({
      ...data,
      status: 'queued-for-ocr',
      createdAt: new Date(),
    });
    await receipt.save();
    return receipt;
  }
}

// 2. Use Service in Controller (HTTP adapter)
export class ReceiptController {
  constructor(private readonly receiptService: ReceiptService) {}

  async upload(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.file) {
        throw new ValidationError('File is required');
      }

      const receipt = await this.receiptService.uploadReceipt(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype,
        req.user.clientId,
        req.correlationId,
      );

      res.status(201).json(successResponse({
        receiptId: receipt.id,
        status: receipt.status,
      }, req.correlationId));
    } catch (err) {
      next(err);
    }
  }
}
```

**That's it! Service is reusable, testable, HTTP-agnostic.** ✅

---

## 🏗️ Core Principles (MANDATORY)

### 1. Pure Business Logic (No HTTP)

**Rule:** Services MUST NOT import Express types (Request, Response, NextFunction).

**Why:**

- 🔄 **Reusability** - Use from HTTP, CLI, Cron, Webhook
- 🧪 **Testability** - Test functions with plain parameters
- 🚀 **Portability** - Switch frameworks easily

```typescript
// ❌ WRONG - Service tied to Express
import { Request } from 'express';

export class ReceiptService {
  async uploadReceipt(req: Request) {
    const file = req.file;  // ❌ Tied to Express
    // ...
  }
}

// ✅ CORRECT - Pure TypeScript
export class ReceiptService {
  async uploadReceipt(
    file: Buffer,
    fileName: string,
    mimeType: string,
    clientId: string,
    correlationId: string
  ): Promise<Receipt> {
    // Business logic here
  }
}
```


---

### 2. ACID Transactions (Critical Operations)

**Rule:** All operations affecting financial integrity MUST run in MongoDB transactions.

**Why:**

- 🔒 **Atomicity** - All steps pass or rollback
- ⚖️ **Consistency** - Trial balance = 0 before/after
- 🚫 **Isolation** - No partial state visible
- 💾 **Durability** - Committed = crash-resistant

```typescript
import mongoose, { ClientSession } from 'mongoose';

export class AccountingService {
  async postEntry(
    entryId: string,
    clientId: string,
    approvedBy: string,
    correlationId: string
  ): Promise<JournalEntry> {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Step 1: Fetch entry
      const entry = await JournalEntry.findOne({
        _id: entryId,
        clientId,
        status: 'draft',
      }).session(session);

      if (!entry) {
        throw new NotFoundError('JournalEntry', entryId);
      }

      // Step 2: Verify trial balance BEFORE
      const balanceBefore = await this.getTrialBalance(clientId, session);
      if (balanceBefore.debit !== balanceBefore.credit) {
        throw new FinancialIntegrityError(
          'Trial balance not zero before posting',
          balanceBefore
        );
      }

      // Step 3: Post to ledger (debit)
      await this.ledger.postEntry({
        account: entry.account.debit,
        amount: entry.debit,
        description: entry.description,
      }, session, correlationId);

      // Step 4: Post to ledger (credit)
      await this.ledger.postEntry({
        account: entry.account.credit,
        amount: entry.credit,
        description: entry.description,
      }, session, correlationId);

      // Step 5: Verify trial balance AFTER
      const balanceAfter = await this.getTrialBalance(clientId, session);
      if (balanceAfter.debit !== balanceAfter.credit) {
        throw new FinancialIntegrityError(
          'Trial balance not zero after posting',
          balanceAfter
        );
      }

      // Step 6: Update entry status
      entry.status = 'posted';
      entry.approvedBy = approvedBy;
      entry.approvedAt = new Date();
      await entry.save({ session });

      // Commit transaction
      await session.commitTransaction();
      console.log(`[${correlationId}] Transaction committed: ${entryId}`);

      return entry;
    } catch (err) {
      // Rollback on ANY error
      await session.abortTransaction();
      console.error(`[${correlationId}] Transaction aborted: ${err.message}`);
      throw err;
    } finally {
      session.endSession();
    }
  }

  private async getTrialBalance(
    clientId: string,
    session?: ClientSession
  ): Promise<{ debit: number; credit: number }> {
    const result = await JournalEntry.aggregate([
      { $match: { clientId, status: 'posted' } },
      {
        $group: {
          _id: null,
          debit: { $sum: '$debit' },
          credit: { $sum: '$credit' },
        },
      },
    ]).session(session || null).exec();

    return result.length === 0
      ? { debit: 0, credit: 0 }
      : { debit: result.debit, credit: result.credit };
  }
}
```


---

### 3. CorrelationId Propagation

**Rule:** All public methods doing I/O MUST accept `correlationId: string` as the LAST parameter.

**Convention:**

```typescript
// ✅ CORRECT - correlationId always last
async processFifoQueue(
  clientId: string,
  limit: number,
  correlationId: string  // ← ALWAYS last
): Promise<void> { }

async createDraftEntry(
  data: CreateEntryInput,
  clientId: string,
  correlationId: string  // ← ALWAYS last
): Promise<JournalEntry> { }
```

**Propagation Example:**

```typescript
export class OcrService {
  constructor(
    private readonly paddleOcr: PaddleOcrAdapter,
    private readonly receiptService: ReceiptService,
    private readonly logger: Logger,
  ) {}

  async processFifoQueue(
    clientId: string,
    limit: number,
    correlationId: string
  ): Promise<void> {
    this.logger.info(`[${correlationId}] Starting OCR queue`, { clientId, limit });

    const receipts = await Receipt.find({
      clientId,
      status: 'queued-for-ocr',
    })
      .sort({ createdAt: 1 })
      .limit(limit)
      .lean();

    for (const receipt of receipts) {
      // ✅ Pass correlationId down the chain
      await this.processReceipt(receipt, clientId, correlationId);
    }
  }

  private async processReceipt(
    receipt: any,
    clientId: string,
    correlationId: string
  ): Promise<void> {
    try {
      this.logger.debug(`[${correlationId}] Processing: ${receipt._id}`);

      const ocrResult = await this.paddleOcr.extractText(
        receipt.fileBuffer,
        correlationId  // ✅ Pass to adapter
      );

      await this.receiptService.updateWithOcrResult(
        receipt._id,
        ocrResult,
        clientId,
        correlationId  // ✅ Pass to next service
      );

      this.logger.info(`[${correlationId}] Receipt processed: ${receipt._id}`);
    } catch (err) {
      this.logger.error(`[${correlationId}] Failed: ${err.message}`);
      throw err;
    }
  }
}
```


---

### 4. Return Domain Objects (Not DTOs)

**Rule:** Services return domain objects; Controllers map to DTOs.

```typescript
// ✅ Service - returns domain object
async getReceiptById(
  id: string,
  clientId: string,
  correlationId: string
): Promise<Receipt | null> {
  return Receipt.findOne({ _id: id, clientId });
}

// ✅ Controller - maps domain → DTO
async get(req: Request, res: Response, next: NextFunction) {
  try {
    const receipt = await this.receiptService.getReceiptById(
      req.params.id,
      req.user.clientId,
      req.correlationId,
    );

    if (!receipt) {
      throw new NotFoundError('Receipt', req.params.id);
    }

    // Map to DTO
    res.json(successResponse({
      id: receipt.id,
      fileName: receipt.fileName,
      amount: receipt.amount,
      status: receipt.status,
      createdAt: receipt.createdAt,
    }, req.correlationId));
  } catch (err) {
    next(err);
  }
}
```


---

### 5. Throw Domain Errors (Not HTTP Errors)

**Rule:** Services throw domain-specific errors; global handler maps to HTTP.

```typescript
// ✅ Service throws domain error
export class ReceiptService {
  async uploadReceipt(...args): Promise<Receipt> {
    const existing = await Receipt.findOne({ fileHash, clientId });
    if (existing) {
      throw new DuplicateReceiptError(fileHash);  // ← Domain error
    }
  }
}

// ✅ Global handler maps domain → HTTP
export const globalErrorHandler = (err, req, res, next) => {
  if (err instanceof DuplicateReceiptError) {
    return res.status(409).json({
      success: false,
      error: { code: 'DUPLICATE_RECEIPT', message: err.message },
    });
  }
  // ... other error mappings
};
```


---

## 📋 Service Template

```typescript
// ReceiptService.ts
import { Receipt } from '../models/Receipt';
import crypto from 'crypto';
import { DuplicateReceiptError, NotFoundError } from '@/shared/errors';
import { Logger } from '@/shared/logger';

export class ReceiptService {
  constructor(
    private readonly logger: Logger,
    private readonly driveService?: DriveService  // Optional dependency
  ) {}

  /**
   * Upload receipt with duplicate detection
   * 
   * @throws DuplicateReceiptError if fileHash exists
   */
  async uploadReceipt(
    file: Buffer,
    fileName: string,
    mimeType: string,
    clientId: string,
    correlationId: string,
    userId?: string
  ): Promise<Receipt> {
    this.logger.info(`[${correlationId}] Uploading receipt`, { fileName, clientId });

    // Step 1: Calculate hash
    const fileHash = this.calculateHash(file);

    // Step 2: Check for duplicates
    await this.ensureNotDuplicate(fileHash, clientId, correlationId);

    // Step 3: Save to database
    const receipt = await this.saveReceipt({
      fileName,
      fileHash,
      mimeType,
      clientId,
      uploadedBy: userId,
    }, correlationId);

    // Step 4: Upload to Drive (optional, async)
    if (this.driveService) {
      this.driveService.uploadFile(file, fileName, correlationId)
        .catch((err) => {
          this.logger.error(`[${correlationId}] Drive upload failed: ${err.message}`);
        });
    }

    return receipt;
  }

  /**
   * Update receipt with OCR results
   */
  async updateWithOcrResult(
    receiptId: string,
    ocrResult: OcrResult,
    clientId: string,
    correlationId: string
  ): Promise<Receipt> {
    this.logger.info(`[${correlationId}] Updating receipt with OCR`, { receiptId });

    const receipt = await Receipt.findOne({ _id: receiptId, clientId });
    if (!receipt) {
      throw new NotFoundError('Receipt', receiptId);
    }

    receipt.amount = ocrResult.amount;  // MoneyInt (Satang)
    receipt.vendor = ocrResult.vendor;
    receipt.date = ocrResult.date;
    receipt.status = 'processed';
    receipt.ocrConfidence = ocrResult.confidence;
    receipt.updatedAt = new Date();

    await receipt.save();

    return receipt;
  }

  /**
   * Calculate SHA-256 hash of file
   */
  private calculateHash(file: Buffer): string {
    return crypto.createHash('sha256').update(file).digest('hex');
  }

  /**
   * Ensure no duplicate receipt exists
   * 
   * @throws DuplicateReceiptError if duplicate found
   */
  private async ensureNotDuplicate(
    fileHash: string,
    clientId: string,
    correlationId: string
  ): Promise<void> {
    const existing = await Receipt.findOne({ fileHash, clientId });
    if (existing) {
      this.logger.warn(`[${correlationId}] Duplicate receipt detected`, { fileHash });
      throw new DuplicateReceiptError(fileHash);
    }
  }

  /**
   * Save receipt to database
   */
  private async saveReceipt(
    data: {
      fileName: string;
      fileHash: string;
      mimeType: string;
      clientId: string;
      uploadedBy?: string;
    },
    correlationId: string
  ): Promise<Receipt> {
    const receipt = new Receipt({
      ...data,
      status: 'queued-for-ocr',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await receipt.save();

    this.logger.info(`[${correlationId}] Receipt saved`, { receiptId: receipt.id });

    return receipt;
  }
}
```


---

## 🔄 Service Composition Pattern

```typescript
// OcrService calls ReceiptService
export class OcrService {
  constructor(
    private readonly receiptService: ReceiptService,
    private readonly paddleOcr: PaddleOcrAdapter,
    private readonly googleVision: GoogleVisionAdapter,
    private readonly logger: Logger,
  ) {}

  async processFifoQueue(
    clientId: string,
    limit: number,
    correlationId: string
  ): Promise<void> {
    const receipts = await this.getQueuedReceipts(clientId, limit);

    for (const receipt of receipts) {
      try {
        // Try PaddleOCR first
        let ocrResult = await this.paddleOcr.extractText(
          receipt.fileBuffer,
          correlationId
        );

        // Fallback to Google Vision if confidence low
        if (ocrResult.confidence < 0.7) {
          this.logger.info(`[${correlationId}] Low confidence, trying Google Vision`);
          ocrResult = await this.googleVision.extractText(
            receipt.fileBuffer,
            correlationId
          );
        }

        // ✅ Call ReceiptService to update
        await this.receiptService.updateWithOcrResult(
          receipt._id,
          ocrResult,
          clientId,
          correlationId
        );
      } catch (err) {
        this.logger.error(`[${correlationId}] OCR failed: ${err.message}`);
        // Update receipt status to error
        await Receipt.updateOne(
          { _id: receipt._id },
          { status: 'error', errorMessage: err.message }
        );
      }
    }
  }

  private async getQueuedReceipts(
    clientId: string,
    limit: number
  ): Promise<Receipt[]> {
    return Receipt.find({
      clientId,
      status: 'queued-for-ocr',
    })
      .sort({ createdAt: 1 })
      .limit(limit)
      .lean();
  }
}
```


---

## ✅ Review Checklist

Before committing, verify:

- [ ] **No Express imports** (Request, Response, NextFunction)
- [ ] **correlationId parameter** on all public methods (always last)
- [ ] **Domain errors thrown** (not HTTP errors)
- [ ] **MongoDB transactions** for financial operations
- [ ] **Trial balance checks** before/after posting
- [ ] **MoneyInt used** for all monetary values
- [ ] **Logger injected** via constructor
- [ ] **Dependencies injected** via constructor (testability)
- [ ] **Private methods** for internal logic
- [ ] **JSDoc comments** on public methods
- [ ] **Error propagation** (no silent failures)

---

## 🔄 Feedback \& Improvement

**If service fails:**

1. Check correlationId propagation (passed to all sub-calls)
2. Verify transaction commit/rollback logic
3. Ensure trial balance checks are correct
4. Validate domain errors are thrown (not HTTP errors)

**To improve this skill:**

- Add more real-world AutoAcct examples
- Include retry patterns (exponential backoff)
- Add circuit breaker patterns
- Update based on team feedback

---

## 🧪 Testing Services

```typescript
import { describe, it, expect, mock } from 'bun:test';
import { ReceiptService } from './ReceiptService';
import { DuplicateReceiptError } from '@/shared/errors';

describe('ReceiptService', () => {
  it('should upload receipt successfully', async () => {
    const mockLogger = {
      info: mock(),
      error: mock(),
    };

    const service = new ReceiptService(mockLogger as any);

    const receipt = await service.uploadReceipt(
      Buffer.from('test'),
      'test.pdf',
      'application/pdf',
      'client-123',
      'corr-123'
    );

    expect(receipt.fileName).toBe('test.pdf');
    expect(receipt.status).toBe('queued-for-ocr');
    expect(mockLogger.info).toHaveBeenCalled();
  });

  it('should throw DuplicateReceiptError for duplicate hash', async () => {
    const mockLogger = { info: mock(), error: mock() };
    const service = new ReceiptService(mockLogger as any);

    // Upload first time
    await service.uploadReceipt(
      Buffer.from('test'),
      'test.pdf',
      'application/pdf',
      'client-123',
      'corr-123'
    );

    // Try upload same file again
    await expect(
      service.uploadReceipt(
        Buffer.from('test'),
        'test.pdf',
        'application/pdf',
        'client-123',
        'corr-456'
      )
    ).rejects.toThrow(DuplicateReceiptError);
  });
});
```


---

## 📚 Advanced Patterns

### Pattern 1: Sharing Sessions Between Services

```typescript
export class AccountingService {
  async postEntry(
    entryId: string,
    clientId: string,
    approvedBy: string,
    correlationId: string
  ): Promise<JournalEntry> {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Call sub-service with session
      await this.ledger.postEntry({
        account: '1100-Cash',
        amount: 10000,
        description: 'Sale',
      }, session, correlationId);  // ← Pass session

      await session.commitTransaction();
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  }
}

export class LedgerService {
  async postEntry(
    data: EntryData,
    session?: ClientSession,  // ← Optional session
    correlationId?: string
  ): Promise<void> {
    if (session) {
      // Within transaction
      await Entry.create([data], { session });
    } else {
      // Standalone
      await Entry.create(data);
    }
  }
}
```


### Pattern 2: Retry with Exponential Backoff

```typescript
export class ExternalService {
  async callWithRetry<T>(
    fn: () => Promise<T>,
    correlationId: string,
    maxRetries: number = 3
  ): Promise<T> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (err) {
        if (attempt === maxRetries) {
          this.logger.error(`[${correlationId}] Max retries reached`);
          throw err;
        }

        const delay = Math.pow(2, attempt) * 1000;  // 2s, 4s, 8s
        this.logger.warn(`[${correlationId}] Retry ${attempt}/${maxRetries} after ${delay}ms`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    throw new Error('Unexpected retry failure');
  }
}
```


---

## 📚 Related Skills

- **autoaccl-rest-controller** - For HTTP layer using services
- **autoaccl-zod-validator** - For input validation before services
- **autoaccl-error-handling** - For domain error handling

---

**Skill Maintainer:** AutoAcct Development Team
**Last Updated:** 2026-01-26T21:43:00+07:00
**Version:** 2.0.0-antigravity