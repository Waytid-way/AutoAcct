# AutoAcct Skill 3 – Service Layer Pattern

**Version:** 1.0.0  
**Category:** Backend Development  
**Stack:** TypeScript, Node.js/Bun, MongoDB (Mongoose)  
**Project:** AutoAcct (OCR AI Auto Accounting)  
**Skill:** `.ai/skills/backend/03-service-layer.skill.md`  
**Keywords:** service layer, business logic, ACID, transaction, correlationId, MoneyInt, repository, OCR, accounting, Medici, Groq, Teable

---

## 📑 1. Quick Start (30 seconds)

**Service Layer** = ชั้น Business Logic ที่อยู่ระหว่าง Controller (HTTP) ↔ Database

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
      const err = new Error(`Duplicate receipt with hash ${fileHash}`);
      (err as any).code = 'DUPLICATE_RECEIPT';
      (err as any).statusCode = 409;
      throw err;
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
      updatedAt: new Date(),
    });
    await receipt.save();
    return receipt;
  }
}
```

```typescript
// 2. Use Service in Controller (HTTP adapter)
export class ReceiptController {
  constructor(private readonly receiptService: ReceiptService) {}

  async upload(req: any, res: any, next: any) {
    try {
      if (!req.file) {
        const err = new Error('File is required');
        (err as any).code = 'VALIDATION_ERROR';
        (err as any).statusCode = 400;
        throw err;
      }

      const receipt = await this.receiptService.uploadReceipt(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype,
        req.user.clientId,
        req.correlationId,
      );

      res.status(201).json({
        success: true,
        data: {
          receiptId: receipt.id,
          fileName: receipt.fileName,
          status: receipt.status,
        },
        meta: {
          correlationId: req.correlationId,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (err) {
      next(err); // Global error handler takes care of it
    }
  }
}
```

**นี่คือ Service Layer แล้ว: reusable, testable, HTTP-agnostic ✅**

---

## 📖 2. Description

**Service Layer** คือ "Business Logic Hub" ของ AutoAcct อยู่ตรงกลางระหว่าง **Controllers** (HTTP layer) ↔ **Data Access** (Mongoose/Repositories)

### บทบาทหลัก:

1. **รวม Business Rules** ไว้ที่เดียว (duplicate detection, MoneyInt rules, trial balance)
2. **จัดการ ACID Transactions** สำหรับการเปลี่ยนแปลงสถานะสำคัญ (posting journal, void entries)
3. **Orchestrate External Services** (OCR worker, Medici ledger, Groq, Teable)
4. **Transform & Validate Data** ที่เป็น Domain Logic (ไม่ใช่แค่ schema validation)

### ลักษณะเฉพาะของ Service Layer ใน AutoAcct:

- ✅ **Services ไม่รู้จัก HTTP** – ไม่ import Request, Response, NextFunction
- ✅ **Pure TypeScript Functions** – รับ input (primitive/object) + correlationId → คืน domain objects หรือโยน domain errors
- ✅ **ACID Transactions** – ทุก operation ที่มีผลต่อ financial integrity ใช้ MongoDB sessions
- ✅ **CorrelationId Propagation** – trace request cross-service
- ✅ **MoneyInt Convention** – ทุก amount = Satang (integer), Baht display = UI responsibility

---

## 🎯 3. When to Use This Skill

### ใช้ Service Layer เมื่อ:

| Scenario | ใช้? | เหตุผล |
|----------|------|--------|
| Upload receipt + hash + duplicate check + drive sync | ✅ | หลาย step, มี business rules |
| GET receipt by id (แค่ lookup) | ❌ | Query ธรรมดา, ไม่มี logic เพิ่ม |
| POST ledger entry + trial balance check | ✅ | ต้องมี ACID และ financial guarantees |
| List receipts with pagination | ❌ | Controller → Repository ตรง ๆ พอ |
| OCR processing + PaddleOCR fallback + Google Vision | ✅ | Orchestration หลาย external services |
| Hash & deduplicate receipts | ✅ | Business rule, reusable |
| Format receipt for JSON response | ❌ | Pure function, ไม่ใช่ domain logic |
| Calculate trial balance before/after posting | ✅ | Domain logic, financial integrity |

---

## 🔧 4. Prerequisites & Setup

### Assume ว่ามี:

- ✅ Skill 1 – REST Controller Pattern
- ✅ Skill 2 – Zod Validator Pattern
- ✅ Phase 1 Architecture (Folder structure, ConfigManager)
- ✅ Phase 2.1 Services Blueprints

### โครงสร้างแนะนำ:

```text
backend/src/
├── shared/
│   ├── errors/
│   │   ├── DomainError.ts
│   │   ├── DuplicateReceiptError.ts
│   │   ├── FinancialIntegrityError.ts
│   │   └── NotFoundError.ts
│   ├── types/
│   │   ├── correlationId.ts
│   │   └── money.ts
│   └── logger/
│       └── Logger.ts
├── modules/
│   ├── receipt/
│   │   ├── controllers/
│   │   │   └── ReceiptController.ts
│   │   ├── services/
│   │   │   └── ReceiptService.ts
│   │   ├── repositories/
│   │   │   └── ReceiptRepository.ts
│   │   ├── models/
│   │   │   └── Receipt.ts
│   │   └── validators/
│   │       └── receipt.validators.ts
│   ├── ocr/
│   │   ├── services/
│   │   │   ├── OcrService.ts
│   │   │   ├── OcrValidationService.ts
│   │   │   └── adapters/
│   │   │       ├── PaddleOcrAdapter.ts
│   │   │       ├── GoogleVisionAdapter.ts
│   │   │       └── MockOcrAdapter.ts
│   │   └── models/
│   │       └── OcrResult.ts
│   └── accounting/
│       ├── services/
│       │   ├── AccountingService.ts
│       │   └── adapters/
│       │       ├── MedicerAdapter.ts
│       │       └── MockMedicerAdapter.ts
│       └── models/
│           └── JournalEntry.ts
└── config/
    ├── ConfigManager.ts
    ├── dev.config.ts
    └── prod.config.ts
```

---

## 🏗️ 5. Core Principles (MANDATORY)

### 5.1 Pure Business Logic (No HTTP)

**Rule:** Service ห้ามผูกกับ Express โดยตรง ห้าม import Request, Response, NextFunction

**เหตุผล:**
- 🔄 **Reusability** – logic ใช้จาก HTTP, CLI, Cron, Webhook ได้
- 🧪 **Testability** – test ฟังก์ชันที่รับ parameter ธรรมดา ไม่ต้อง mock req/res
- 🚀 **Portability** – ย้ายจาก Express ไป framework อื่นได้ง่าย

**ตัวอย่างผิด/ถูก:**

```typescript
// ❌ ผิด – Service ผูกกับ Express
import { Request } from 'express';

export class ReceiptService {
  async uploadReceipt(req: Request) {
    const file = req.file;           // ผูกกับ Express ❌
    const clientId = req.user.clientId;
    // ...
  }
}

// ✅ ถูก – Service เป็น pure TypeScript
export class ReceiptService {
  async uploadReceipt(
    file: Buffer,
    fileName: string,
    mimeType: string,
    clientId: string,
    correlationId: string
  ) {
    // Business logic ทั้งหมดอยู่ที่นี่
  }
}
```

**Controller ทำหน้าที่ map HTTP → Service:**

```typescript
export class ReceiptController {
  constructor(
    private readonly receiptService: ReceiptService,
    private readonly logger: Logger,
  ) {}

  async upload(req: any, res: any, next: any) {
    try {
      if (!req.file) {
        const err = new Error('File is required');
        (err as any).code = 'VALIDATION_ERROR';
        (err as any).statusCode = 400;
        throw err;
      }

      // Map HTTP → Service input
      const receipt = await this.receiptService.uploadReceipt(
        req.file.buffer,        // ✅ Extract from req
        req.file.originalname,
        req.file.mimetype,
        req.user.clientId,
        req.correlationId,
      );

      // Map Service output → HTTP response
      res.status(201).json({
        success: true,
        data: { receiptId: receipt.id, status: receipt.status },
        meta: { correlationId: req.correlationId, timestamp: new Date() },
      });
    } catch (err) {
      next(err); // Global error handler
    }
  }
}
```

### 5.2 Transaction Management (ACID)

**Rule:** ทุก operation ที่มีผลต่อ financial integrity ต้องรันใน MongoDB transaction

**หลักการ:**
- 🔒 **Atomicity** – ทุก step ผ่าน หรือ roll back ทั้งหมด
- ⚖️ **Consistency** – Trial balance = 0 ก่อนและหลังโพสต์
- 🚫 **Isolation** – ไม่เห็นสถานะครึ่ง ๆ กลาง ๆ
- 💾 **Durability** – commit แล้วทนทานต่อ crash

**ตัวอย่าง - Posting Journal Entry with Trial Balance Check:**

```typescript
import mongoose, { ClientSession } from 'mongoose';
import { JournalEntry } from '../models/JournalEntry';

export class AccountingService {
  constructor(
    private readonly medicerService: MedicerService,
    private readonly logger: Logger,
  ) {}

  async postEntry(
    entryId: string,
    clientId: string,
    approvedBy: string,
    correlationId: string
  ): Promise<JournalEntry> {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      this.logger.info(`[${correlationId}] Starting postEntry transaction`, {
        entryId,
        clientId,
      });

      // Step 1: Fetch entry (within transaction)
      const entry = await JournalEntry.findOne({
        _id: entryId,
        clientId,
        status: 'draft',
      }).session(session);

      if (!entry) {
        const err = new Error('Draft entry not found');
        (err as any).code = 'NOT_FOUND';
        (err as any).statusCode = 404;
        throw err;
      }

      // Step 2: Verify trial balance BEFORE posting
      const balanceBefore = await this.getTrialBalance(clientId, session);
      if (balanceBefore.totalDebit !== balanceBefore.totalCredit) {
        const err = new Error(
          `Trial balance not zero before posting. Debit: ${balanceBefore.totalDebit}, Credit: ${balanceBefore.totalCredit}`
        );
        (err as any).code = 'FINANCIAL_INTEGRITY_ERROR';
        (err as any).statusCode = 500;
        throw err;
      }

      // Step 3: Post to Medici ledger (debit side)
      await this.medicerService.postEntry(
        {
          account: entry.account.debit,
          amount: entry.debit, // MoneyInt (Satang)
          description: entry.description,
          correlationId,
        },
        session,
        correlationId
      );

      // Step 4: Post to Medici ledger (credit side)
      await this.medicerService.postEntry(
        {
          account: entry.account.credit,
          amount: entry.credit, // MoneyInt (Satang)
          description: entry.description,
          correlationId,
        },
        session,
        correlationId
      );

      // Step 5: Verify trial balance AFTER posting
      const balanceAfter = await this.getTrialBalance(clientId, session);
      if (balanceAfter.totalDebit !== balanceAfter.totalCredit) {
        const err = new Error(
          `Trial balance not zero after posting. Debit: ${balanceAfter.totalDebit}, Credit: ${balanceAfter.totalCredit}`
        );
        (err as any).code = 'FINANCIAL_INTEGRITY_ERROR';
        (err as any).statusCode = 500;
        throw err;
      }

      // Step 6: Update entry status to posted
      entry.status = 'posted';
      (entry as any).approvedBy = approvedBy;
      (entry as any).approvedAt = new Date();
      await entry.save({ session });

      // Commit transaction
      await session.commitTransaction();
      this.logger.info(`[${correlationId}] postEntry transaction committed`, {
        entryId,
        status: 'posted',
      });

      return entry;
    } catch (err) {
      // Rollback on any error
      await session.abortTransaction();
      this.logger.error(
        `[${correlationId}] postEntry transaction aborted: ${err.message}`,
        { entryId, error: err }
      );
      throw err;
    } finally {
      session.endSession();
    }
  }

  private async getTrialBalance(
    clientId: string,
    session?: ClientSession
  ): Promise<{
    totalDebit: number;
    totalCredit: number;
    accounts: any[];
  }> {
    const pipeline = [
      { $match: { clientId, status: 'posted' } },
      {
        $group: {
          _id: null,
          totalDebit: { $sum: '$debit' },
          totalCredit: { $sum: '$credit' },
        },
      },
    ];

    const result = await JournalEntry.aggregate(pipeline)
      .session(session || null)
      .exec();

    if (result.length === 0) {
      return { totalDebit: 0, totalCredit: 0, accounts: [] };
    }

    return {
      totalDebit: result[0].totalDebit,
      totalCredit: result[0].totalCredit,
      accounts: [],
    };
  }
}
```

### 5.3 CorrelationId Propagation

**Rule:** ทุก public method ที่ทำ I/O ต้องรับ `correlationId: string` เป็น argument สุดท้าย และต้องส่งต่อให้ sub-service/logger

**Convention:**

```typescript
// ✅ ถูก – correlationId อยู่ท้ายสุด
async processFifoQueue(
  clientId: string,
  limit: number,
  correlationId: string
): Promise<void> { /* ... */ }

async createDraftEntry(
  data: CreateEntryInput,
  clientId: string,
  correlationId: string
): Promise<JournalEntry> { /* ... */ }

// ❌ ผิด – correlationId ไม่อยู่ท้ายสุด
async processFifoQueue(
  correlationId: string,
  clientId: string,
  limit: number
): Promise<void> { /* ... */ }
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
    this.logger.info(`[${correlationId}] Starting OCR queue processing`, {
      clientId,
      limit,
    });

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
      this.logger.debug(
        `[${correlationId}] Processing receipt: ${receipt._id}`
      );

      const ocrResult = await this.paddleOcr.extractText(
        receipt.fileBuffer,
        correlationId // ✅ Pass to adapter
      );

      await this.receiptService.updateWithOcrResult(
        receipt._id,
        ocrResult,
        clientId,
        correlationId // ✅ Pass to next service
      );

      this.logger.info(
        `[${correlationId}] Receipt processed successfully: ${receipt._id}`
      );
    } catch (err) {
      this.logger.error(
        `[${correlationId}] Failed to process receipt: ${err.message}`,
        { receiptId: receipt._id, error: err }
      );
      throw err;
    }
  }
}
```

### 5.4 Return Domain Objects (Not HTTP DTOs)

**Rule:** Service ควรคืนค่า domain objects; Controller แปลงเป็น DTO ตาม response format

```typescript
// ✅ Service – คืน domain object
async getReceiptById(
  id: string,
  clientId: string,
  correlationId: string
): Promise<Receipt | null> {
  return Receipt.findOne({ _id: id, clientId });
}

// ✅ Controller – map domain → DTO
async get(req: any, res: any, next: any) {
  try {
    const receipt = await this.receiptService.getReceiptById(
      req.params.id,
      req.user.clientId,
      req.correlationId,
    );

    if (!receipt) {
      const err = new Error('Receipt not found');
      (err as any).code = 'NOT_FOUND';
      (err as any).statusCode = 404;
      throw err;
    }

    // ✅ Map domain object → API response DTO
    res.json({
      success: true,
      data: {
        id: receipt.id,
        fileName: receipt.fileName,
        status: receipt.status,
        fileHash: receipt.fileHash,
        createdAt: receipt.createdAt,
      },
      meta: {
        correlationId: req.correlationId,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (err) {
    next(err);
  }
}
```

### 5.5 No Direct HTTP or UI Side Effects

**Rule:** Service ห้าม:
- ❌ เขียน response
- ❌ อ่าน headers/cookies
- ❌ รู้เรื่อง HTTP status code
- ❌ สร้าง side effect ที่เป็น UI (formatting for toast)

**Service ทำแค่:**
- ✅ ทำงานตาม domain rules
- ✅ เขียน log (ผ่าน logger ที่ inject ได้)
- ✅ โยน error ที่ meaningful

### 5.6 Error Handling Strategy

**Rule:** Service โยน domain errors ให้ controller/global error handler แปลงเป็น HTTP response

```typescript
// ✅ Define Domain Errors
export class DuplicateReceiptError extends Error {
  code = 'DUPLICATE_RECEIPT';
  statusCode = 409;
  constructor(public fileHash: string) {
    super(`Receipt with hash ${fileHash} already exists`);
  }
}

export class FinancialIntegrityError extends Error {
  code = 'FINANCIAL_INTEGRITY_ERROR';
  statusCode = 500;
  constructor(public message: string) {
    super(message);
  }
}

export class NotFoundError extends Error {
  code = 'NOT_FOUND';
  statusCode = 404;
  constructor(public resource: string, public id: string) {
    super(`${resource} with id ${id} not found`);
  }
}

// ✅ Use in Service
export class ReceiptService {
  async uploadReceipt(
    file: Buffer,
    fileName: string,
    mimeType: string,
    clientId: string,
    correlationId: string
  ): Promise<Receipt> {
    const fileHash = this.calculateHash(file);
    
    const existing = await Receipt.findOne({ fileHash, clientId });
    if (existing) {
      throw new DuplicateReceiptError(fileHash);
    }

    // ... rest of logic
  }
}

// ✅ Global Error Handler maps statusCode
export const globalErrorHandler = (err: any, req: any, res: any, next: any) => {
  const statusCode = err.statusCode || 500;
  const code = err.code || 'INTERNAL_ERROR';
  const correlationId = req.correlationId;

  console.error(`[${correlationId}] Error: ${err.message}`, err);

  res.status(statusCode).json({
    success: false,
    error: {
      code,
      message: err.message,
    },
    meta: {
      correlationId,
      timestamp: new Date().toISOString(),
    },
  });
};
```

---

## 🧩 6. Common Service Patterns

### Pattern 1: Orchestration Service
**ประสงค์:** Coordinate หลาย repository/services

```typescript
export class OcrService {
  constructor(
    private readonly receiptRepo: ReceiptRepository,
    private readonly paddleOcr: PaddleOcrAdapter,
    private readonly logger: Logger,
  ) {}

  async processFifoQueue(
    clientId: string,
    limit: number,
    correlationId: string
  ): Promise<number> {
    const receipts = await this.receiptRepo.findQueued(clientId, limit);
    
    let processed = 0;
    for (const receipt of receipts) {
      try {
        await this.processReceipt(receipt, clientId, correlationId);
        processed++;
      } catch (err) {
        this.logger.error(`[${correlationId}] Failed: ${err.message}`);
      }
    }
    
    return processed;
  }

  private async processReceipt(
    receipt: any,
    clientId: string,
    correlationId: string
  ): Promise<void> {
    const ocrResult = await this.paddleOcr.extractText(
      receipt.fileBuffer,
      correlationId
    );
    await this.receiptRepo.updateStatus(
      receipt._id,
      'processed',
      { ocrResult },
    );
  }
}
```

### Pattern 2: Delegating Service
**ประสงค์:** Thin wrapper over external API

```typescript
export class MedicerService {
  constructor(private readonly httpClient: HttpClient) {}

  async postEntry(
    data: {
      account: string;
      amount: number; // MoneyInt (Satang)
      description: string;
    },
    session?: ClientSession,
    correlationId?: string
  ): Promise<void> {
    // Convert Satang → Baht for external API
    const amountBaht = data.amount / 100;

    const response = await this.httpClient.post(
      '/api/entries',
      {
        account: data.account,
        amount: amountBaht,
        description: data.description,
      },
      {
        headers: {
          'X-Correlation-Id': correlationId,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Medici error: ${response.statusCode}`);
    }
  }
}
```

### Pattern 3: Validation Service
**ประสงค์:** Encapsulate business validation

```typescript
export class OcrValidationService {
  async validateOcrResult(
    ocrResult: OcrResult,
    receiptType: 'invoice' | 'receipt',
    correlationId: string
  ): Promise<ValidationResult> {
    const errors: string[] = [];

    if (!ocrResult.date) {
      errors.push('Date not detected');
    }

    if (!ocrResult.amount || ocrResult.amount <= 0) {
      errors.push('Amount must be > 0');
    }

    if (receiptType === 'invoice' && !ocrResult.invoiceNumber) {
      errors.push('Invoice number required for invoice type');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}
```

---

## 💰 7. AutoAcct-Specific Services

### 7.1 ReceiptService

**Responsibility:**
- Upload & queue receipts
- Duplicate detection (SHA-256 hash)
- Optional Google Drive upload
- Queue status aggregation

```typescript
export class ReceiptService {
  constructor(
    private readonly receiptRepo: ReceiptRepository,
    private readonly driveAdapter: GoogleDriveAdapter,
    private readonly logger: Logger,
  ) {}

  async uploadReceipt(
    file: Buffer,
    fileName: string,
    mimeType: string,
    clientId: string,
    correlationId: string
  ): Promise<Receipt> {
    this.logger.info(`[${correlationId}] uploadReceipt started`, {
      clientId,
      fileName,
    });

    const fileHash = this.calculateHash(file);
    await this.ensureNotDuplicate(fileHash, clientId, correlationId);

    // Optional: Upload to Google Drive
    let driveFileId: string | undefined;
    if (process.env.ENABLE_DRIVE_BACKUP === 'true') {
      try {
        driveFileId = await this.driveAdapter.uploadFile(
          file,
          fileName,
          correlationId
        );
        this.logger.debug(`[${correlationId}] File backed up to Drive`, {
          driveFileId,
        });
      } catch (err) {
        this.logger.warn(`[${correlationId}] Drive backup failed`, {
          error: err.message,
        });
        // Don't fail upload if drive fails
      }
    }

    const receipt = await this.receiptRepo.create({
      fileName,
      fileHash,
      mimeType,
      clientId,
      driveFileId,
      status: 'queued-for-ocr',
      createdAt: new Date(),
    });

    this.logger.info(`[${correlationId}] Receipt queued for OCR`, {
      receiptId: receipt.id,
    });

    return receipt;
  }

  async getQueueStatus(
    clientId: string,
    correlationId: string
  ): Promise<{
    queued: number;
    processing: number;
    completed: number;
  }> {
    const stats = await this.receiptRepo.getStatusStats(clientId);
    return {
      queued: stats['queued-for-ocr'] || 0,
      processing: stats['processing'] || 0,
      completed: stats['processed'] || 0,
    };
  }

  async confirmReceipts(
    receiptIds: string[],
    clientId: string,
    correlationId: string
  ): Promise<void> {
    await this.receiptRepo.updateStatus(
      { _id: { $in: receiptIds }, clientId },
      'confirmed'
    );
    this.logger.info(`[${correlationId}] Receipts confirmed`, {
      count: receiptIds.length,
    });
  }

  private calculateHash(file: Buffer): string {
    return crypto.createHash('sha256').update(file).digest('hex');
  }

  private async ensureNotDuplicate(
    fileHash: string,
    clientId: string,
    correlationId: string
  ): Promise<void> {
    const existing = await this.receiptRepo.findByHash(fileHash, clientId);
    if (existing) {
      throw new DuplicateReceiptError(fileHash);
    }
  }
}
```

### 7.2 OcrService

**Responsibility:**
- FIFO OCR processing
- Cache lookup & save
- PaddleOCR + fallback
- Update receipts with OCR result

```typescript
export class OcrService {
  constructor(
    private readonly receiptRepo: ReceiptRepository,
    private readonly paddleOcr: PaddleOcrAdapter,
    private readonly googleVision: GoogleVisionAdapter,
    private readonly cache: CacheAdapter,
    private readonly logger: Logger,
  ) {}

  async processFifoQueue(
    clientId: string,
    limit: number,
    correlationId: string
  ): Promise<number> {
    this.logger.info(`[${correlationId}] Starting OCR queue`, {
      clientId,
      limit,
    });

    const receipts = await this.receiptRepo.findQueued(clientId, limit);
    
    let processed = 0;
    for (const receipt of receipts) {
      try {
        await this.processReceipt(receipt, clientId, correlationId);
        processed++;
      } catch (err) {
        this.logger.error(
          `[${correlationId}] Failed to process receipt: ${err.message}`,
          { receiptId: receipt._id }
        );
      }
    }

    this.logger.info(`[${correlationId}] OCR queue completed`, {
      processed,
      failed: receipts.length - processed,
    });

    return processed;
  }

  private async processReceipt(
    receipt: any,
    clientId: string,
    correlationId: string
  ): Promise<void> {
    // Check cache first
    let ocrResult = await this.getFromCache(receipt.fileHash);
    if (ocrResult) {
      this.logger.debug(`[${correlationId}] Cache hit: ${receipt.fileHash}`);
      await this.receiptRepo.updateStatus(receipt._id, 'processed', {
        ocrResult,
        processedAt: new Date(),
      });
      return;
    }

    // Try PaddleOCR first
    try {
      ocrResult = await this.paddleOcr.extractText(
        receipt.fileBuffer,
        correlationId
      );
      this.logger.debug(`[${correlationId}] PaddleOCR success`);
    } catch (err) {
      // Fallback to Google Vision
      this.logger.warn(
        `[${correlationId}] PaddleOCR failed, trying Google Vision`,
        { error: err.message }
      );
      ocrResult = await this.googleVision.extractText(
        receipt.fileBuffer,
        correlationId
      );
    }

    // Validate OCR result
    const validation = await this.validateOcrResult(
      ocrResult,
      correlationId
    );
    const status = validation.isValid ? 'processed' : 'manual-review';

    // Save to cache
    await this.saveToCache(receipt.fileHash, ocrResult);

    // Update receipt
    await this.receiptRepo.updateStatus(receipt._id, status, {
      ocrResult,
      validationErrors: validation.errors,
      processedAt: new Date(),
    });

    this.logger.info(`[${correlationId}] Receipt processed`, {
      receiptId: receipt._id,
      status,
    });
  }

  private async validateOcrResult(
    ocrResult: OcrResult,
    correlationId: string
  ): Promise<{ isValid: boolean; errors: string[] }> {
    const errors: string[] = [];

    if (!ocrResult.date) errors.push('Date not found');
    if (!ocrResult.amount || ocrResult.amount <= 0) {
      errors.push('Amount invalid');
    }
    if (!ocrResult.vendor) errors.push('Vendor not found');

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  private async getFromCache(fileHash: string): Promise<OcrResult | null> {
    const cached = await this.cache.get(`ocr:${fileHash}`);
    return cached ? JSON.parse(cached) : null;
  }

  private async saveToCache(
    fileHash: string,
    ocrResult: OcrResult
  ): Promise<void> {
    await this.cache.set(
      `ocr:${fileHash}`,
      JSON.stringify(ocrResult),
      3600 * 24 // 24 hours
    );
  }
}
```

### 7.3 AccountingService

**Responsibility:**
- Create draft journal entries
- Post entries with trial balance check
- Void entries via reversal
- Compute trial balance

```typescript
export class AccountingService {
  constructor(
    private readonly journalRepo: JournalEntryRepository,
    private readonly medicerService: MedicerService,
    private readonly logger: Logger,
  ) {}

  async createDraftEntry(
    data: {
      date: Date;
      description: string;
      debitAccount: string;
      creditAccount: string;
      amount: number; // MoneyInt (Satang)
    },
    clientId: string,
    createdBy: string,
    correlationId: string
  ): Promise<JournalEntry> {
    this.logger.info(`[${correlationId}] Creating draft entry`, {
      clientId,
      amount: data.amount,
    });

    const entry = await this.journalRepo.create({
      clientId,
      date: data.date,
      description: data.description,
      debit: data.amount,
      debitAccount: data.debitAccount,
      credit: data.amount,
      creditAccount: data.creditAccount,
      status: 'draft',
      createdBy,
      createdAt: new Date(),
    });

    this.logger.debug(`[${correlationId}] Draft entry created`, {
      entryId: entry._id,
    });

    return entry;
  }

  async postEntry(
    entryId: string,
    clientId: string,
    approvedBy: string,
    correlationId: string
  ): Promise<JournalEntry> {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      this.logger.info(`[${correlationId}] Starting postEntry transaction`, {
        entryId,
      });

      // Fetch entry
      const entry = await this.journalRepo.findOne(entryId, clientId, session);
      if (!entry || entry.status !== 'draft') {
        throw new NotFoundError('JournalEntry', entryId);
      }

      // Check trial balance BEFORE
      const before = await this.getTrialBalance(clientId, session);
      if (before.debit !== before.credit) {
        throw new FinancialIntegrityError(
          `Trial balance not zero before posting. Debit: ${before.debit}, Credit: ${before.credit}`
        );
      }

      // Post to Medici
      await this.medicerService.postEntry(
        {
          account: entry.debitAccount,
          amount: entry.debit,
          description: entry.description,
        },
        session,
        correlationId
      );

      await this.medicerService.postEntry(
        {
          account: entry.creditAccount,
          amount: entry.credit,
          description: entry.description,
        },
        session,
        correlationId
      );

      // Check trial balance AFTER
      const after = await this.getTrialBalance(clientId, session);
      if (after.debit !== after.credit) {
        throw new FinancialIntegrityError(
          `Trial balance not zero after posting. Debit: ${after.debit}, Credit: ${after.credit}`
        );
      }

      // Update status
      entry.status = 'posted';
      (entry as any).approvedBy = approvedBy;
      (entry as any).approvedAt = new Date();
      await entry.save({ session });

      await session.commitTransaction();
      this.logger.info(`[${correlationId}] Entry posted successfully`, {
        entryId,
      });

      return entry;
    } catch (err) {
      await session.abortTransaction();
      this.logger.error(
        `[${correlationId}] postEntry failed: ${err.message}`,
        { entryId, error: err }
      );
      throw err;
    } finally {
      session.endSession();
    }
  }

  async voidEntry(
    entryId: string,
    reason: string,
    clientId: string,
    approvedBy: string,
    correlationId: string
  ): Promise<JournalEntry> {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      this.logger.info(`[${correlationId}] Starting voidEntry transaction`, {
        entryId,
      });

      const entry = await this.journalRepo.findOne(entryId, clientId, session);
      if (!entry || entry.status !== 'posted') {
        throw new Error('Only posted entries can be voided');
      }

      // Create reversing entry
      const reversal = await this.journalRepo.create({
        clientId,
        date: new Date(),
        description: `REVERSAL: ${entry.description} (Reason: ${reason})`,
        debit: entry.credit, // Swap debit/credit
        debitAccount: entry.creditAccount,
        credit: entry.debit,
        creditAccount: entry.debitAccount,
        status: 'draft',
        voidingEntryFor: entry._id,
        createdBy: approvedBy,
        createdAt: new Date(),
      });

      // Post the reversal entry
      const reversalPosted = await this.postEntry(
        reversal._id,
        clientId,
        approvedBy,
        correlationId
      );

      // Mark original as voided
      entry.status = 'voided';
      (entry as any).voidedAt = new Date();
      (entry as any).voidReason = reason;
      await entry.save({ session });

      await session.commitTransaction();
      this.logger.info(`[${correlationId}] Entry voided successfully`, {
        entryId,
        reversalId: reversal._id,
      });

      return entry;
    } catch (err) {
      await session.abortTransaction();
      this.logger.error(`[${correlationId}] voidEntry failed: ${err.message}`, {
        entryId,
        error: err,
      });
      throw err;
    } finally {
      session.endSession();
    }
  }

  async getTrialBalance(
    clientId: string,
    session?: ClientSession
  ): Promise<{
    debit: number;
    credit: number;
    balanced: boolean;
  }> {
    const result = await this.journalRepo.aggregate(
      [
        { $match: { clientId, status: 'posted' } },
        {
          $group: {
            _id: null,
            debit: { $sum: '$debit' },
            credit: { $sum: '$credit' },
          },
        },
      ],
      session
    );

    if (result.length === 0) {
      return { debit: 0, credit: 0, balanced: true };
    }

    const { debit, credit } = result[0];
    return {
      debit,
      credit,
      balanced: debit === credit,
    };
  }
}
```

---

## 📚 8. Repository Pattern Integration

**Optional แต่แนะนำ** สำหรับ production:

```typescript
export class ReceiptRepository {
  async create(data: {
    fileName: string;
    fileHash: string;
    mimeType: string;
    clientId: string;
    driveFileId?: string;
    status: string;
    createdAt: Date;
  }): Promise<Receipt> {
    const receipt = new Receipt(data);
    await receipt.save();
    return receipt;
  }

  async findQueued(
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

  async findByHash(
    fileHash: string,
    clientId: string
  ): Promise<Receipt | null> {
    return Receipt.findOne({ fileHash, clientId });
  }

  async updateStatus(
    filter: any,
    status: string,
    metadata?: any
  ): Promise<void> {
    await Receipt.updateMany(
      filter,
      {
        $set: {
          status,
          ...metadata,
          updatedAt: new Date(),
        },
      }
    );
  }

  async getStatusStats(clientId: string): Promise<Record<string, number>> {
    const result = await Receipt.aggregate([
      { $match: { clientId } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    const stats: Record<string, number> = {};
    result.forEach((row) => {
      stats[row._id] = row.count;
    });
    return stats;
  }
}
```

---

## 🔄 9. Service Composition

```typescript
// OcrService เรียก ReceiptService
export class OcrService {
  constructor(
    private readonly receiptService: ReceiptService,
    private readonly paddleOcr: PaddleOcrAdapter,
  ) {}

  async processFifoQueue(
    clientId: string,
    limit: number,
    correlationId: string
  ): Promise<void> {
    const receipts = await this.getQueuedReceipts(clientId, limit);

    for (const receipt of receipts) {
      const ocrResult = await this.paddleOcr.extractText(
        receipt.fileBuffer,
        correlationId
      );

      // ✅ Call ReceiptService to update
      await this.receiptService.updateWithOcrResult(
        receipt._id,
        ocrResult,
        clientId,
        correlationId
      );
    }
  }
}

// AccountingService เรียก MedicerService
export class AccountingService {
  constructor(
    private readonly medicerService: MedicerService,
    private readonly journalRepo: JournalEntryRepository,
  ) {}

  async postEntry(
    entryId: string,
    clientId: string,
    approvedBy: string,
    correlationId: string
  ): Promise<JournalEntry> {
    const entry = await this.journalRepo.findOne(entryId, clientId);
    
    // ✅ Call MedicerService to post
    await this.medicerService.postEntry(
      {
        account: entry.debitAccount,
        amount: entry.debit,
        description: entry.description,
      },
      undefined,
      correlationId
    );
    // ... rest
  }
}
```

**Convention: correlationId propagate ตลอด chain เสมอ**

---

## 🔒 10. Transaction Management (Deep Dive)

### Sharing Sessions Between Services

```typescript
// Services ต้อง support optional session parameter
export class MedicerService {
  async postEntry(
    data: EntryData,
    session?: ClientSession,
    correlationId?: string
  ): Promise<void> {
    // If session provided, use it (within transaction)
    // Otherwise, execute standalone
    if (session) {
      // Operations within transaction
      await SomeModel.updateOne({ ... }, { ... }).session(session);
    } else {
      // Standalone operation
      await SomeModel.updateOne({ ... }, { ... });
    }
  }
}

// AccountingService starts transaction and passes session
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
      // Pass session to all nested operations
      await this.medicerService.postEntry(data, session, correlationId);
      // ... more operations with session

      await session.commitTransaction();
      return entry;
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  }
}
```

---

## 🚨 11. Error Handling in Services

```typescript
// Custom Domain Errors
export class DuplicateReceiptError extends Error {
  code = 'DUPLICATE_RECEIPT';
  statusCode = 409;
  
  constructor(fileHash: string) {
    super(`Receipt with hash ${fileHash} already exists`);
  }
}

export class FinancialIntegrityError extends Error {
  code = 'FINANCIAL_INTEGRITY_ERROR';
  statusCode = 500;
  
  constructor(details: string) {
    super(`Financial integrity violation: ${details}`);
  }
}

export class NotFoundError extends Error {
  code = 'NOT_FOUND';
  statusCode = 404;
  
  constructor(resource: string, id: string) {
    super(`${resource} ${id} not found`);
  }
}

// Global Error Handler (middleware)
export const globalErrorHandler = (
  err: any,
  req: any,
  res: any,
  next: any
) => {
  const statusCode = err.statusCode || 500;
  const code = err.code || 'INTERNAL_ERROR';
  const correlationId = req.correlationId || 'unknown';

  console.error(`[${correlationId}] Error [${code}]: ${err.message}`);

  res.status(statusCode).json({
    success: false,
    error: {
      code,
      message: err.message,
    },
    meta: {
      correlationId,
      timestamp: new Date().toISOString(),
    },
  });
};

// Register in Express
app.use(globalErrorHandler);
```

---

## 🧪 12. Testing Services

```typescript
describe('ReceiptService', () => {
  let service: ReceiptService;
  let mockRepo: jest.Mocked<ReceiptRepository>;
  let mockDrive: jest.Mocked<GoogleDriveAdapter>;

  beforeEach(() => {
    mockRepo = {
      create: jest.fn(),
      findByHash: jest.fn(),
      // ...
    } as any;

    mockDrive = {
      uploadFile: jest.fn(),
    } as any;

    service = new ReceiptService(mockRepo, mockDrive, mockLogger);
  });

  describe('uploadReceipt', () => {
    it('should throw DuplicateReceiptError on duplicate file', async () => {
      const fileHash = 'abc123';
      const file = Buffer.from('test');

      mockRepo.findByHash.mockResolvedValue({
        _id: 'existing-id',
      } as any);

      await expect(
        service.uploadReceipt(
          file,
          'test.pdf',
          'application/pdf',
          'client1',
          'corr-123'
        )
      ).rejects.toThrow(DuplicateReceiptError);
    });

    it('should create receipt on unique file', async () => {
      const file = Buffer.from('test');
      mockRepo.findByHash.mockResolvedValue(null);
      mockRepo.create.mockResolvedValue({
        _id: 'new-receipt-id',
      } as any);

      const result = await service.uploadReceipt(
        file,
        'test.pdf',
        'application/pdf',
        'client1',
        'corr-123'
      );

      expect(result._id).toBe('new-receipt-id');
      expect(mockRepo.create).toHaveBeenCalled();
    });
  });
});
```

---

## 🚫 13. Common Anti-Patterns (AVOID!)

| ❌ Anti-Pattern | ✅ ทำอย่างไร |
|------------------|-------------|
| Business logic ใน controller | Move to service |
| Service import Express types | Remove Request/Response/NextFunction |
| ไม่ใช้ transaction ในการโพสต์ | Always use `startSession()` + `startTransaction()` |
| ไม่ propagate correlationId | Pass ตลอด chain |
| Service ทำ HTTP call ตรง ๆ | Use adapter pattern |
| Promise.all() ใน transaction | Sequential operations เพื่อ safety |
| Hardcode API URLs ใน service | Use dependency injection |
| Log ไม่มี correlationId | Include correlationId ทุก log |

---

## 📊 14. Performance Optimization

```typescript
// Batch Operations
export class OcrService {
  async processFifoQueueOptimized(
    clientId: string,
    limit: number,
    correlationId: string
  ): Promise<void> {
    // Use lean() for read-only queries
    const receipts = await Receipt.find({
      clientId,
      status: 'queued-for-ocr',
    })
      .sort({ createdAt: 1 })
      .limit(limit)
      .lean(); // ✅ Faster, no Mongoose overhead

    // Batch update instead of individual updates
    const receiptIds = receipts.map((r) => r._id);
    const processed = [];

    for (const receipt of receipts) {
      const ocrResult = await this.paddleOcr.extractText(
        receipt.fileBuffer,
        correlationId
      );
      processed.push({
        _id: receipt._id,
        ocrResult,
      });
    }

    // ✅ Batch update
    await Receipt.bulkWrite(
      processed.map((p) => ({
        updateOne: {
          filter: { _id: p._id },
          update: {
            $set: {
              status: 'processed',
              ocrResult: p.ocrResult,
              updatedAt: new Date(),
            },
          },
        },
      }))
    );
  }
}

// Cache layer
export class OcrService {
  private cache = new Map<string, any>();

  async getFromCache(key: string): Promise<any> {
    return this.cache.get(key);
  }

  async saveToCache(key: string, value: any, ttl: number): Promise<void> {
    this.cache.set(key, value);
    // Expire after TTL
    setTimeout(() => this.cache.delete(key), ttl);
  }
}
```

---

## ✅ 15. Review Checklist

ก่อน merge PR ให้ถาม:

- [ ] ฟังก์ชัน service ใด ๆ import Express หรือไม่? ❌
- [ ] ทุก method สำคัญรับ `correlationId` เป็น argument สุดท้าย? ✅
- [ ] มี operation ด้านบัญชีที่ข้าม transaction หรือไม่? ❌
- [ ] Service คืน domain objects ไม่ใช่ HTTP DTO? ✅
- [ ] Error ทุกตัว map ได้ใน global error handler? ✅
- [ ] ทุก I/O operations มี try-catch + logging? ✅
- [ ] CorrelationId propagated ตลอด sub-service calls? ✅
- [ ] Transactions ใช้ ClientSession สำหรับ multi-operation? ✅
- [ ] Repository/Adapter ถูก injected ไม่ hardcoded? ✅
- [ ] Unit tests cover happy path + error cases? ✅

---

## 🔗 16. Related Skills

- **Skill 1** – REST Controller Pattern
- **Skill 2** – Zod Validator Pattern
- **Skill 4** – Error Handling & Middleware
- **Phase 2A** – Controllers & Services
- **Phase 2B** – Integrations (Medici, Groq, Teable)
- **Phase 2C** – DevOps & Deployment

---

## 🔐 21. Mock Services for Dev Mode

**Purpose:** Test logic locally without hitting external APIs

```typescript
// config/AppConfig.ts
export interface AppConfig {
  appMode: 'development' | 'production';
  enableMockAdapters: boolean;
  database: {
    uri: string;
  };
  // ...
}

export const loadConfig = (): AppConfig => {
  return {
    appMode: process.env.APP_MODE === 'production' ? 'production' : 'development',
    enableMockAdapters: process.env.ENABLE_MOCK_ADAPTERS === 'true',
    database: {
      uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/auto-acct-dev',
    },
  };
};

// Mock OCR Adapter
export class MockOcrAdapter implements IOcrAdapter {
  async extractText(
    fileBuffer: Buffer,
    correlationId: string
  ): Promise<OcrResult> {
    console.log(`[${correlationId}] [MOCK] Extracting text from file`);

    // Return mock data
    return {
      date: new Date(),
      amount: 99900, // 999 Baht in Satang
      vendor: 'Mock Vendor Inc.',
      description: 'Mock receipt',
      invoiceNumber: 'MOCK-001',
      raw: 'mock ocr text',
    };
  }
}

// Mock Medici Adapter
export class MockMedicerAdapter implements IMedicerAdapter {
  private ledger: any[] = [];

  async postEntry(
    data: {
      account: string;
      amount: number;
      description: string;
    },
    session?: ClientSession,
    correlationId?: string
  ): Promise<void> {
    console.log(
      `[${correlationId}] [MOCK] Posting to Medici: ${data.account} = ${data.amount} Satang`
    );
    this.ledger.push({
      ...data,
      postedAt: new Date(),
      correlationId,
    });
  }

  async getBalance(account: string): Promise<number> {
    const balance = this.ledger
      .filter((e) => e.account === account)
      .reduce((sum, e) => sum + e.amount, 0);
    return balance;
  }

  async getTrialBalance(): Promise<{
    debit: number;
    credit: number;
  }> {
    const debit = this.ledger
      .filter((e) => e.type === 'debit')
      .reduce((sum, e) => sum + e.amount, 0);
    const credit = this.ledger
      .filter((e) => e.type === 'credit')
      .reduce((sum, e) => sum + e.amount, 0);
    return { debit, credit };
  }

  getLedger() {
    return this.ledger;
  }

  clearLedger() {
    this.ledger = [];
  }
}

// Dependency Injection Factory
export class ServiceFactory {
  static createReceiptService(config: AppConfig): ReceiptService {
    const repo = new ReceiptRepository();
    const driveAdapter = config.enableMockAdapters
      ? new MockGoogleDriveAdapter()
      : new GoogleDriveAdapter(process.env.GOOGLE_DRIVE_API_KEY!);
    const logger = new Logger('ReceiptService');

    return new ReceiptService(repo, driveAdapter, logger);
  }

  static createOcrService(config: AppConfig): OcrService {
    const receiptRepo = new ReceiptRepository();
    const paddleOcr = config.enableMockAdapters
      ? new MockOcrAdapter()
      : new PaddleOcrAdapter();
    const googleVision = config.enableMockAdapters
      ? new MockOcrAdapter()
      : new GoogleVisionAdapter(process.env.GOOGLE_VISION_API_KEY!);
    const cache = new InMemoryCache();
    const logger = new Logger('OcrService');

    return new OcrService(
      receiptRepo,
      paddleOcr,
      googleVision,
      cache,
      logger
    );
  }

  static createAccountingService(config: AppConfig): AccountingService {
    const journalRepo = new JournalEntryRepository();
    const medicerService = config.enableMockAdapters
      ? new MockMedicerAdapter()
      : new MedicerAdapter(process.env.MEDICI_API_URL!);
    const logger = new Logger('AccountingService');

    return new AccountingService(journalRepo, medicerService, logger);
  }
}

// Usage in main.ts
const config = loadConfig();
const receiptService = ServiceFactory.createReceiptService(config);
const ocrService = ServiceFactory.createOcrService(config);
const accountingService = ServiceFactory.createAccountingService(config);
```

---

## 🔴 22. Real Adapters for Production

```typescript
// Real OCR Adapter
export class PaddleOcrAdapter implements IOcrAdapter {
  constructor(private readonly httpClient: HttpClient) {}

  async extractText(
    fileBuffer: Buffer,
    correlationId: string
  ): Promise<OcrResult> {
    console.log(`[${correlationId}] Calling PaddleOCR API`);

    const formData = new FormData();
    formData.append('file', new Blob([fileBuffer]));

    try {
      const response = await this.httpClient.post(
        'http://localhost:9000/api/ocr/extract',
        formData,
        {
          headers: {
            'X-Correlation-Id': correlationId,
          },
          timeout: 30000,
        }
      );

      return response.data as OcrResult;
    } catch (err) {
      console.error(`[${correlationId}] PaddleOCR error: ${err.message}`);
      throw err;
    }
  }
}

// Real Medici Adapter
export class MedicerAdapter implements IMedicerAdapter {
  constructor(
    private readonly httpClient: HttpClient,
    private readonly apiUrl: string,
    private readonly apiKey: string
  ) {}

  async postEntry(
    data: {
      account: string;
      amount: number;
      description: string;
    },
    session?: ClientSession,
    correlationId?: string
  ): Promise<void> {
    console.log(
      `[${correlationId}] Posting to Medici: ${data.account}`
    );

    try {
      // Convert Satang → Baht for Medici API
      const amountBaht = data.amount / 100;

      const response = await this.httpClient.post(
        `${this.apiUrl}/api/entries`,
        {
          account: data.account,
          amount: amountBaht,
          description: data.description,
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'X-Correlation-Id': correlationId,
          },
        }
      );

      if (!response.ok) {
        throw new Error(
          `Medici error: ${response.statusCode} ${response.statusText}`
        );
      }
    } catch (err) {
      console.error(
        `[${correlationId}] Medici error: ${err.message}`
      );
      throw err;
    }
  }

  async getTrialBalance(): Promise<{
    debit: number;
    credit: number;
  }> {
    const response = await this.httpClient.get(
      `${this.apiUrl}/api/trial-balance`,
      {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
      }
    );

    // Convert Baht back to Satang
    return {
      debit: Math.floor(response.data.debit * 100),
      credit: Math.floor(response.data.credit * 100),
    };
  }
}

// Real Google Drive Adapter
export class GoogleDriveAdapter {
  constructor(private readonly driveClient: GoogleDriveClient) {}

  async uploadFile(
    fileBuffer: Buffer,
    fileName: string,
    correlationId: string
  ): Promise<string> {
    console.log(
      `[${correlationId}] Uploading file to Google Drive: ${fileName}`
    );

    try {
      const file = await this.driveClient.files.create({
        requestBody: {
          name: fileName,
          mimeType: 'application/pdf',
        },
        media: {
          mimeType: 'application/pdf',
          body: Readable.from(fileBuffer),
        },
      });

      return file.data.id!;
    } catch (err) {
      console.error(
        `[${correlationId}] Google Drive error: ${err.message}`
      );
      throw err;
    }
  }
}
```

---

## 📝 23. Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-01-26 | Initial Service Layer Skill (20 + 3 sections) |

---

## 📚 18. Glossary

- **Service Layer** – ชั้น business logic ระหว่าง controller ↔ repository
- **Domain Service** – Service ที่ implement rule ของ domain จริง ๆ
- **Repository** – Abstraction รอบ data access
- **ACID** – Atomicity, Consistency, Isolation, Durability
- **CorrelationId** – ไอดีใช้ trace request end-to-end
- **MoneyInt** – จำนวนเงินในหน่วย Satang (integer)
- **Medici** – Double-entry ledger system
- **OCR** – Optical Character Recognition
- **PaddleOCR** – Open-source OCR library
- **Adapter Pattern** – Wrap external APIs แบบ pluggable
- **Dual Mode** – Dev (mock) vs Production (real)

---

**🎯 Ready to implement AutoAcct Service Layer! ✅**
