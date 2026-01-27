<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# 📘 AutoAcct Phase 2.2: REST API Layer - Comprehensive Implementation Guide

**Version:** 2.2.1 Enhanced
**Date:** January 23, 2026, 1:39 AM +07
**Phase:** Controllers \& REST API Development
**Status:** Production-Ready Blueprint
**Prerequisites:** Phase 1.1-2.1 Complete ✅

***

## 🎯 PART 1: STRATEGIC CONTEXT \& REASONING

### 1.1 Why Phase 2.2 Exists (The Big Picture)

**ปัญหาที่เราแก้:**
Phase 2.1 สร้าง **Services Layer** ที่มีความสามารถครบถ้วน (ReceiptService, TransactionService, OcrService, ExportService) แต่ยังไม่มีทางให้ผู้ใช้เข้าถึงได้ผ่าน HTTP[^1][^2]

**เป้าหมายของ Phase 2.2:**
สร้าง **REST API Layer** ที่เป็นสะพานเชื่อมระหว่าง Frontend (React/Next.js) กับ Business Logic (Services) โดยมีหลักการ:

1. **Separation of Concerns** - Controller ไม่มี business logic, เป็นแค่ adapter
2. **Standardized Responses** - ทุก endpoint ต้องส่ง response format เดียวกัน
3. **Comprehensive Validation** - Validate input ด้วย Zod ก่อนส่งเข้า service
4. **Audit Trail** - ทุก request ต้องมี correlationId สำหรับ trace
5. **Security First** - JWT authentication, role-based access control
6. **Developer Experience** - Mock APIs, dev endpoints, clear error messages

### 1.2 Architecture Philosophy: The 4-Layer Pattern

```
┌─────────────────────────────────────────────────────────┐
│  LAYER 1: HTTP ROUTES (Express Router)                 │
│  - Method mapping (GET/POST/PUT/DELETE)                │
│  - Path parameters (/receipts/:id)                     │
│  - Route grouping (/api/receipts, /api/transactions)  │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│  LAYER 2: MIDDLEWARE STACK (Sequential Processing)     │
│  1. correlationId → 2. logging → 3. auth → 4. devGuard │
│  Purpose: Cross-cutting concerns (security, audit)     │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│  LAYER 3: CONTROLLERS (Request/Response Handlers)       │
│  - Parse & validate request (Zod schemas)              │
│  - Call Service layer methods                          │
│  - Format response (DTO transformation)                │
│  - Error propagation (catch → next(error))             │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│  LAYER 4: SERVICES (Business Logic - Already Built ✅) │
│  - ReceiptService, TransactionService, etc.            │
│  - ACID transactions, retry logic, validation          │
└─────────────────────────────────────────────────────────┘
```

**ทำไมต้องแยกชัดเจน?**[^1]

- **Testability** - Test controller โดยไม่ต้อง mock service
- **Reusability** - Service เดียวกันใช้ได้ทั้ง HTTP, CLI, Cron jobs
- **Maintainability** - แก้ business logic ไม่กระทบ API contract

***

## 🏗️ PART 2: COMPREHENSIVE ARCHITECTURE OVERVIEW

### 2.1 File Structure (Complete Blueprint)

```
backend/src/
├── modules/
│   ├── receipt/
│   │   ├── controllers/
│   │   │   └── ReceiptController.ts       ✅ NEW (Task 1)
│   │   ├── routes/
│   │   │   └── receipt.routes.ts          ✅ NEW (Task 1)
│   │   ├── validators/
│   │   │   └── receipt.validators.ts      ✅ NEW (Task 1)
│   │   └── services/
│   │       └── ReceiptService.ts          ✅ ALREADY BUILT
│   │
│   ├── accounting/
│   │   ├── controllers/
│   │   │   └── TransactionController.ts   ✅ NEW (Task 2)
│   │   ├── routes/
│   │   │   └── transaction.routes.ts      ✅ NEW (Task 2)
│   │   ├── validators/
│   │   │   └── transaction.validators.ts  ✅ NEW (Task 2)
│   │   └── services/
│   │       └── TransactionService.ts      ✅ ALREADY BUILT
│   │
│   └── dev/
│       ├── controllers/
│       │   └── DevController.ts           ✅ NEW (Task 3)
│       ├── routes/
│       │   └── dev.routes.ts              ✅ NEW (Task 3)
│       └── validators/
│           └── dev.validators.ts          ✅ NEW (Task 3)
│
├── middleware/                             ✅ NEW (Task 4)
│   ├── correlationId.middleware.ts
│   ├── requestLogger.middleware.ts
│   ├── auth.middleware.ts
│   ├── devMode.middleware.ts
│   ├── errorHandler.middleware.ts
│   └── index.ts
│
├── utils/
│   └── response.ts                         ✅ NEW (Task 5)
│
└── app.ts                                  ✅ MODIFIED (Wire everything)
```


### 2.2 Data Flow: Request → Response

```
┌──────────────────────────────────────────────────────────────┐
│ 1. CLIENT REQUEST                                             │
│    POST /api/receipts/upload                                  │
│    Headers: Authorization, x-correlation-id                  │
│    Body: multipart/form-data (file + clientId)              │
└──────────────────────────────────────────────────────────────┘
                           ↓
┌──────────────────────────────────────────────────────────────┐
│ 2. MIDDLEWARE CHAIN (Sequential)                             │
│    → correlationIdMiddleware: Inject/extract correlationId   │
│    → requestLoggerMiddleware: Log { method, path, ip }       │
│    → authMiddleware: Verify JWT, attach req.user             │
│    → multerMiddleware: Parse file upload                     │
└──────────────────────────────────────────────────────────────┘
                           ↓
┌──────────────────────────────────────────────────────────────┐
│ 3. CONTROLLER (ReceiptController.uploadReceipt)              │
│    ✓ Validate file exists                                    │
│    ✓ Zod validation (clientId format)                        │
│    ✓ Call ReceiptService.uploadReceipt()                     │
│    ✓ Format response (DTO)                                   │
└──────────────────────────────────────────────────────────────┘
                           ↓
┌──────────────────────────────────────────────────────────────┐
│ 4. SERVICE LAYER (ReceiptService)                            │
│    ✓ Calculate file hash (SHA-256)                           │
│    ✓ Check duplicates (MongoDB query)                        │
│    ✓ Upload to storage (optional)                            │
│    ✓ Save Receipt document (status: 'queued_for_ocr')       │
└──────────────────────────────────────────────────────────────┘
                           ↓
┌──────────────────────────────────────────────────────────────┐
│ 5. RESPONSE FORMATTER (utils/response.ts)                    │
│    successResponse(receipt, correlationId) → JSON            │
└──────────────────────────────────────────────────────────────┘
                           ↓
┌──────────────────────────────────────────────────────────────┐
│ 6. CLIENT RESPONSE                                            │
│    Status: 201 Created                                        │
│    Body: {                                                    │
│      "success": true,                                         │
│      "data": { receiptId, fileName, status, queuePosition }, │
│      "meta": { correlationId, timestamp }                    │
│    }                                                          │
└──────────────────────────────────────────────────────────────┘
```


***

## 📋 PART 3: TASK BREAKDOWN WITH REASONING

### Task 1: ReceiptController (60 นาที) 🎯

#### 1.1 Why ReceiptController?

**หน้าที่หลัก:**

- เป็น **entry point** ของ workflow ทั้งหมด (user อัปโหลดรูป → OCR → บัญชี)
- จัดการ **file upload** (multipart/form-data) ซึ่งต้องใช้ multer middleware
- ให้ user **ติดตาม progress** ของ OCR queue (polling status)
- รับ **feedback** จาก user เพื่อ train ML model ต่อไป[^1]


#### 1.2 Endpoints Design Reasoning

| Method | Endpoint | Why This Endpoint? |
| :-- | :-- | :-- |
| **POST** `/upload` | User ต้องการส่งรูปเข้าระบบ → อยากให้ใช้ POST (idempotent ด้วย file hash check) |  |
| **GET** `/queue` | User ต้องการดูว่ามีรูปรออยู่กี่ใบ → ใช้ GET (read-only, cacheable) |  |
| **POST** `/process-queue` | User กดปุ่ม "Run OCR" → trigger action ต้องใช้ POST |  |
| **GET** `/:id` | User ต้องการดูรายละเอียด 1 ใบเสร็จ → GET with path parameter |  |
| **POST** `/:id/feedback` | User แก้ไขข้อมูล OCR → POST (create feedback record) |  |
| **GET** `/stats` | Frontend แสดง dashboard → GET statistics |  |

#### 1.3 Implementation Blueprint

**File: `backend/src/modules/receipt/controllers/ReceiptController.ts`**

```typescript
import { Request, Response, NextFunction } from 'express';
import { ReceiptService } from '../services/ReceiptService';
import { 
  uploadReceiptSchema, 
  feedbackSchema,
  queueQuerySchema 
} from '../validators/receipt.validators';
import { successResponse, paginatedResponse } from '@/utils/response';
import logger from '@/config/logger';
import config from '@/config/ConfigManager';

/**
 * ReceiptController
 * 
 * Reasoning:
 * - Pure HTTP adapter, no business logic
 * - All service calls pass correlationId for tracing
 * - Zod validation before service calls
 * - Dual mode logging (DEV vs PROD)
 */
export class ReceiptController {
  constructor(private receiptService: ReceiptService) {}

  /**
   * POST /api/receipts/upload
   * 
   * Flow:
   * 1. Multer middleware extracts file from multipart/form-data
   * 2. Validate file exists and clientId format
   * 3. Call ReceiptService.uploadReceipt() → file hash, duplicate check, save
   * 4. Return 201 with receipt metadata
   */
  async uploadReceipt(req: Request, res: Response, next: NextFunction) {
    try {
      // 1. Validate file (multer should have attached req.file)
      if (!req.file) {
        throw new ValidationError('File is required');
      }

      // 2. Zod validation for request body
      const validated = uploadReceiptSchema.parse({
        clientId: req.body.clientId,
      });

      // DEV mode: Log raw file metadata
      if (config.isDev()) {
        logger.debug({
          action: 'upload_receipt_start',
          fileName: req.file.originalname,
          fileSize: req.file.size,
          mimeType: req.file.mimetype,
          correlationId: req.correlationId,
        });
      }

      // 3. Call service layer
      const receipt = await this.receiptService.uploadReceipt({
        file: req.file.buffer,
        fileName: req.file.originalname,
        mimeType: req.file.mimetype,
        clientId: validated.clientId,
        correlationId: req.correlationId,
        userId: req.user?.id,
      });

      // 4. Return success response
      res.status(201).json(
        successResponse(
          {
            receiptId: receipt.id,
            fileName: receipt.fileName,
            status: receipt.status,
            queuePosition: receipt.queuePosition || 0,
          },
          req.correlationId
        )
      );
    } catch (error) {
      next(error); // Propagate to global error handler
    }
  }

  /**
   * GET /api/receipts/queue?page=1&perPage=20&clientId=xxx
   * 
   * Reasoning:
   * - Pagination prevents large payload
   * - clientId filter for multi-tenant support
   * - Returns structured pagination metadata
   */
  async getQueue(req: Request, res: Response, next: NextFunction) {
    try {
      // Parse & validate query parameters
      const query = queueQuerySchema.parse({
        page: parseInt(req.query.page as string) || 1,
        perPage: parseInt(req.query.perPage as string) || 20,
        clientId: req.query.clientId as string,
      });

      const result = await this.receiptService.getQueue(query);

      res.json(
        paginatedResponse(
          result.data,
          {
            page: query.page,
            perPage: query.perPage,
            total: result.total,
            totalPages: Math.ceil(result.total / query.perPage),
          },
          req.correlationId
        )
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/receipts/process-queue
   * 
   * Reasoning:
   * - Long-running operation (OCR processing)
   * - Return 202 Accepted immediately
   * - Client polls /queue-status for progress
   */
  async processQueue(req: Request, res: Response, next: NextFunction) {
    try {
      const clientId = req.user.clientId;
      const limit = parseInt(req.body.limit) || 5;

      // Start async processing (don't await)
      this.receiptService
        .processOcrQueue(clientId, limit, req.correlationId)
        .catch((err) => {
          logger.error({
            action: 'ocr_queue_processing_failed',
            error: err.message,
            correlationId: req.correlationId,
          });
        });

      // Immediate response
      res.status(202).json(
        successResponse(
          {
            started: true,
            message: 'OCR processing started. Poll /queue for status.',
          },
          req.correlationId
        )
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/receipts/:id
   */
  async getReceipt(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const clientId = req.user.clientId;

      const receipt = await this.receiptService.getById(id, clientId);

      res.json(successResponse(receipt, req.correlationId));
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/receipts/:id/feedback
   * 
   * Reasoning:
   * - User corrections improve ML model accuracy
   * - Saved as feedback field for future training
   */
  async submitFeedback(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const validated = feedbackSchema.parse(req.body);

      const updated = await this.receiptService.saveFeedback(
        id,
        validated,
        req.user.clientId,
        req.correlationId
      );

      res.json(
        successResponse(
          { receiptId: id, feedback: updated.feedback },
          req.correlationId
        )
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/receipts/stats
   * 
   * Reasoning:
   * - Dashboard metrics (queued, processing, completed)
   * - Real-time data for frontend polling
   */
  async getStats(req: Request, res: Response, next: NextFunction) {
    try {
      const clientId = req.user.clientId;
      const stats = await this.receiptService.getQueueStats(clientId);

      res.json(successResponse(stats, req.correlationId));
    } catch (error) {
      next(error);
    }
  }
}
```


#### 1.4 Validators (Zod Schemas)

**File: `backend/src/modules/receipt/validators/receipt.validators.ts`**

```typescript
import { z } from 'zod';

/**
 * Why Zod?
 * - Type-safe validation (TypeScript inference)
 * - Clear error messages
 * - Composable schemas
 */

export const uploadReceiptSchema = z.object({
  clientId: z.string().uuid('Invalid client ID format'),
  // Note: file validated by multer middleware
});

export const queueQuerySchema = z.object({
  page: z.number().int().min(1).default(1),
  perPage: z.number().int().min(1).max(100).default(20),
  clientId: z.string().uuid().optional(),
});

export const feedbackSchema = z.object({
  corrections: z.object({
    vendor: z.string().optional(),
    amount: z.number().int().nonnegative().optional(), // Satang
    date: z.coerce.date().optional(),
    category: z.string().optional(),
  }).optional(),
  notes: z.string().max(500).optional(),
});
```


#### 1.5 Routes

**File: `backend/src/modules/receipt/routes/receipt.routes.ts`**

```typescript
import { Router } from 'express';
import multer from 'multer';
import { ReceiptController } from '../controllers/ReceiptController';
import { ReceiptService } from '../services/ReceiptService';
import { authMiddleware } from '@/middleware/auth.middleware';

const router = Router();
const receiptService = new ReceiptService();
const controller = new ReceiptController(receiptService);

// Multer config for file upload
const upload = multer({
  storage: multer.memoryStorage(), // Store in memory (Buffer)
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'application/pdf'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, PDF allowed.'));
    }
  },
});

// All routes require authentication
router.use(authMiddleware);

router.post('/upload', upload.single('file'), (req, res, next) =>
  controller.uploadReceipt(req, res, next)
);
router.get('/queue', (req, res, next) => controller.getQueue(req, res, next));
router.post('/process-queue', (req, res, next) =>
  controller.processQueue(req, res, next)
);
router.get('/stats', (req, res, next) => controller.getStats(req, res, next));
router.get('/:id', (req, res, next) => controller.getReceipt(req, res, next));
router.post('/:id/feedback', (req, res, next) =>
  controller.submitFeedback(req, res, next)
);

export default router;
```


***

### Task 2: TransactionController (60 นาที) 🎯

#### 2.1 Why TransactionController?

**หน้าที่หลัก:**

- จัดการ **journal entries** (รายการบัญชีคู่ debit/credit)
- **Approve/Void** transactions (ต้อง enforce ACID, trial balance)
- **Role-based access** - บาง endpoint ให้เฉพาะ accountant เท่านั้น
- **Reporting** - trial balance, P\&L data[^3][^1]


#### 2.2 Endpoints Design with Reasoning

| Method | Endpoint | Role Required | Why? |
| :-- | :-- | :-- | :-- |
| **POST** `/` | User | สร้าง transaction จาก receipt → ทุกคนทำได้ |  |
| **GET** `/` | User | ดู transactions ของตัวเอง → read-only |  |
| **GET** `/:id` | User | ดูรายละเอียด 1 transaction |  |
| **POST** `/:id/approve` | **Accountant** | Post to ledger → critical operation |  |
| **POST** `/:id/void` | **Accountant** | Create reversal → must verify trial balance |  |
| **GET** `/trial-balance` | **Accountant** | Financial report → sensitive data |  |
| **GET** `/reports/date-range` | **Accountant** | P\&L, balance sheet → analytical data |  |

#### 2.3 Implementation Blueprint

**File: `backend/src/modules/accounting/controllers/TransactionController.ts`**

```typescript
import { Request, Response, NextFunction } from 'express';
import { TransactionService } from '../services/TransactionService';
import {
  createTransactionSchema,
  voidTransactionSchema,
  dateRangeQuerySchema,
} from '../validators/transaction.validators';
import { successResponse, paginatedResponse } from '@/utils/response';
import logger from '@/config/logger';

/**
 * TransactionController
 * 
 * Critical Design Decisions:
 * 1. All state changes (approve, void) must pass correlationId
 * 2. Trial balance check happens in service layer, not here
 * 3. Role check enforced by middleware (req.user.role)
 */
export class TransactionController {
  constructor(private transactionService: TransactionService) {}

  /**
   * POST /api/transactions
   * 
   * Create transaction from receipt
   * - Validates double-entry equation (Dr = Cr)
   * - Creates draft entry (status: 'draft')
   * - Syncs to Teable for accountant review
   */
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = createTransactionSchema.parse(req.body);

      const transaction = await this.transactionService.createFromReceipt(
        validated.receiptId,
        validated.account,
        req.user.clientId,
        req.correlationId
      );

      res.status(201).json(successResponse(transaction, req.correlationId));
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/transactions?page=1&status=draft&dateFrom=2026-01-01
   * 
   * Query filtering:
   * - status: draft, posted, voided
   * - dateFrom/dateTo: ISO 8601 format
   * - category: 5100-Food, etc.
   */
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const filters = {
        page: parseInt(req.query.page as string) || 1,
        perPage: parseInt(req.query.perPage as string) || 20,
        status: req.query.status as string,
        dateFrom: req.query.dateFrom ? new Date(req.query.dateFrom as string) : undefined,
        dateTo: req.query.dateTo ? new Date(req.query.dateTo as string) : undefined,
        category: req.query.category as string,
        clientId: req.user.clientId,
      };

      const result = await this.transactionService.list(filters);

      res.json(
        paginatedResponse(result.data, result.pagination, req.correlationId)
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/transactions/:id
   */
  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const transaction = await this.transactionService.getById(
        id,
        req.user.clientId
      );

      res.json(successResponse(transaction, req.correlationId));
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/transactions/:id/approve
   * 
   * CRITICAL OPERATION:
   * - Posts to Medici ledger (double-entry)
   * - Verifies trial balance before & after
   * - Updates status to 'posted'
   * 
   * Role: Accountant only
   */
  async approve(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      logger.info({
        action: 'transaction_approve_start',
        transactionId: id,
        approvedBy: req.user.id,
        correlationId: req.correlationId,
      });

      const posted = await this.transactionService.approve(
        id,
        req.user.clientId,
        req.user.id,
        req.correlationId
      );

      res.json(
        successResponse(
          {
            transactionId: id,
            status: 'posted',
            postedAt: posted.postedAt,
            approvedBy: req.user.id,
          },
          req.correlationId
        )
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/transactions/:id/void
   * 
   * Creates REVERSAL entry (Dr ↔ Cr swap)
   * - Original entry marked as 'voided'
   * - Reversal entry created with status 'voided_reversal'
   * - Trial balance verified after reversal
   * 
   * Role: Accountant only
   */
  async void(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const validated = voidTransactionSchema.parse(req.body);

      const voided = await this.transactionService.void(
        id,
        validated.reason,
        req.user.clientId,
        req.correlationId
      );

      res.json(
        successResponse(
          {
            originalId: id,
            reversalId: voided.reversalId,
            status: 'voided',
          },
          req.correlationId
        )
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/transactions/trial-balance
   * 
   * Returns: { totalDebit, totalCredit, balanced: true/false }
   * - balanced should ALWAYS be true in production
   * - If false, critical alert to Discord
   * 
   * Role: Accountant only
   */
  async getTrialBalance(req: Request, res: Response, next: NextFunction) {
    try {
      const balance = await this.transactionService.getTrialBalance(
        req.user.clientId
      );

      // Alert if unbalanced
      if (!balance.balanced) {
        logger.error({
          action: 'trial_balance_unbalanced',
          balance,
          correlationId: req.correlationId,
        });
        // TODO: Send Discord alert
      }

      res.json(successResponse(balance, req.correlationId));
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/transactions/reports/date-range?from=2026-01-01&to=2026-01-31
   * 
   * Returns P&L data for specified period
   * - Groups by account category (5100-Food, 5200-Office, etc.)
   * - Calculates totals for expense/revenue
   * 
   * Role: Accountant only
   */
  async getReportByDateRange(req: Request, res: Response, next: NextFunction) {
    try {
      const query = dateRangeQuerySchema.parse(req.query);

      const report = await this.transactionService.getReportByDateRange(
        query.from,
        query.to,
        req.user.clientId
      );

      res.json(successResponse(report, req.correlationId));
    } catch (error) {
      next(error);
    }
  }
}
```


#### 2.4 Role-Based Access Control Middleware

**File: `backend/src/middleware/auth.middleware.ts` (Enhanced)**

```typescript
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import logger from '@/config/logger';

export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      throw new Error('No token provided');
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    req.user = decoded; // Attach user data to request

    next();
  } catch (error) {
    res.status(401).json({ success: false, error: 'Unauthorized' });
  }
};

/**
 * Role guard middleware
 * Usage: router.post('/approve', requireRole('accountant'), ...)
 */
export const requireRole = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      logger.warn({
        action: 'role_check_failed',
        required: roles,
        actual: req.user?.role,
        userId: req.user?.id,
        path: req.path,
      });
      return res.status(403).json({
        success: false,
        error: `Access denied. Required role: ${roles.join(' or ')}`,
      });
    }
    next();
  };
};
```

**Routes with Role Guard:**

```typescript
// File: backend/src/modules/accounting/routes/transaction.routes.ts
import { requireRole } from '@/middleware/auth.middleware';

router.post('/', controller.create); // All authenticated users
router.get('/', controller.list);
router.get('/:id', controller.getById);

// Accountant-only endpoints
router.post('/:id/approve', requireRole('accountant'), controller.approve);
router.post('/:id/void', requireRole('accountant'), controller.void);
router.get('/trial-balance', requireRole('accountant'), controller.getTrialBalance);
router.get('/reports/date-range', requireRole('accountant'), controller.getReportByDateRange);
```


***

### Task 3: DevController (45 นาที) 🎯

#### 3.1 Why DevController?

**ปัญหาที่แก้:**

- ขณะพัฒนา ต้องการ **test data** (mock receipts) โดยไม่ต้อง upload รูปจริง
- ต้องการ **reset state** (clear queue, clear cache) ระหว่างทดสอบ
- ต้องการ **inspect system health** (check adapters, view logs)

**Security Consideration:**

- Endpoints เหล่านี้ **อันตรายมาก** (ลบข้อมูล, bypass validation)
- ต้อง guard ด้วย 2 layers:

1. `NODE_ENV !== 'production'` check
2. `X-Dev-Token` header authentication[^2]


#### 3.2 Endpoints Design

| Method | Endpoint | Purpose | Danger Level |
| :-- | :-- | :-- | :-- |
| **POST** `/receipts/mock` | สร้าง mock receipts (JSON) | ⚠️ Medium (bypasses OCR) |  |
| **DELETE** `/receipts/queue` | ล้างคิวทั้งหมด | 🔴 High (data loss) |  |
| **DELETE** `/ocr/cache` | ล้าง OCR cache | ⚠️ Medium (performance impact) |  |
| **POST** `/health/adapters` | Check all adapters | ✅ Safe (read-only) |  |
| **POST** `/export/retry-queue` | Force retry queue | ⚠️ Medium (trigger jobs) |  |

#### 3.3 Implementation Blueprint

**File: `backend/src/modules/dev/controllers/DevController.ts`**

```typescript
import { Request, Response, NextFunction } from 'express';
import { ReceiptService } from '@/modules/receipt/services/ReceiptService';
import { OcrService } from '@/modules/ocr/services/OcrService';
import { ExportService } from '@/modules/export/services/ExportService';
import { mockReceiptsSchema } from '../validators/dev.validators';
import { successResponse } from '@/utils/response';
import logger from '@/config/logger';
import config from '@/config/ConfigManager';

/**
 * DevController
 * 
 * SECURITY CRITICAL:
 * - All methods check config.isDev() first
 * - Logs warnings for destructive operations
 * - Returns detailed debug information
 */
export class DevController {
  constructor(
    private receiptService: ReceiptService,
    private ocrService: OcrService,
    private exportService: ExportService
  ) {}

  /**
   * POST /api/dev/receipts/mock
   * 
   * Upload mock receipts (JSON format)
   * - Bypasses file upload & OCR
   * - Useful for testing accounting logic
   */
  async uploadMockReceipts(req: Request, res: Response, next: NextFunction) {
    try {
      // Security check
      if (!config.isDev()) {
        throw new Error('Dev mode not enabled');
      }

      const validated = mockReceiptsSchema.parse(req.body);

      logger.warn({
        action: 'dev_mock_receipts_upload',
        count: validated.receipts.length,
        correlationId: req.correlationId,
      });

      const inserted = await this.receiptService.insertMockReceipts(
        validated.receipts,
        {
          insertMode: validated.options?.insertMode || 'processed',
          autoRunValidation: validated.options?.autoRunValidation || false,
        },
        req.correlationId
      );

      res.status(201).json(
        successResponse(
          {
            created: inserted.length,
            receipts: inserted,
            warning: 'Mock data inserted (DEV mode only)',
          },
          req.correlationId
        )
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/dev/receipts/queue
   * 
   * Clear entire queue (DANGEROUS)
   * - Soft delete by default (status reset)
   * - Hard delete if ?hardDelete=true
   */
  async clearQueue(req: Request, res: Response, next: NextFunction) {
    try {
      if (!config.isDev()) {
        throw new Error('Dev mode not enabled');
      }

      const hardDelete = req.query.hardDelete === 'true';

      logger.warn({
        action: 'dev_clear_queue',
        hardDelete,
        correlationId: req.correlationId,
      });

      const affected = await this.receiptService.clearQueue(
        hardDelete,
        req.correlationId
      );

      res.json(
        successResponse(
          {
            affected,
            mode: hardDelete ? 'hard_delete' : 'soft_reset',
            warning: `Cleared ${affected} receipts (DEV mode only)`,
          },
          req.correlationId
        )
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/dev/ocr/cache
   * 
   * Clear OCR cache (affects performance)
   */
  async clearOcrCache(req: Request, res: Response, next: NextFunction) {
    try {
      if (!config.isDev()) {
        throw new Error('Dev mode not enabled');
      }

      const deleted = await this.ocrService.clearCache(req.correlationId);

      res.json(
        successResponse(
          {
            deleted,
            warning: 'OCR cache cleared. Next requests will be slower.',
          },
          req.correlationId
        )
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/dev/health/adapters
   * 
   * Check health of all adapters
   * - OCR adapter (PaddleOCR, Google Vision)
   * - Accounting adapter (Express API)
   * - Storage adapter (Google Drive)
   */
  async checkAdapters(req: Request, res: Response, next: NextFunction) {
    try {
      if (!config.isDev()) {
        throw new Error('Dev mode not enabled');
      }

      const health = {
        ocr: await this.ocrService.healthCheck(),
        export: await this.exportService.healthCheck(),
        // Add more adapters as needed
      };

      res.json(
        successResponse(
          {
            adapters: health,
            timestamp: new Date().toISOString(),
          },
          req.correlationId
        )
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/dev/export/retry-queue
   * 
   * Force retry queue processing
   * - Picks up failed exports
   * - Applies exponential backoff logic
   */
  async forceRetryQueue(req: Request, res: Response, next: NextFunction) {
    try {
      if (!config.isDev()) {
        throw new Error('Dev mode not enabled');
      }

      logger.warn({
        action: 'dev_force_retry_queue',
        correlationId: req.correlationId,
      });

      const retried = await this.exportService.retryFailedExports(
        req.correlationId
      );

      res.json(
        successResponse(
          {
            retried: retried.length,
            exports: retried,
          },
          req.correlationId
        )
      );
    } catch (error) {
      next(error);
    }
  }
}
```


#### 3.4 Dev Mode Middleware

**File: `backend/src/middleware/devMode.middleware.ts`**

```typescript
import { Request, Response, NextFunction } from 'express';
import config from '@/config/ConfigManager';
import logger from '@/config/logger';

/**
 * devModeGuard
 * 
 * Two-layer security:
 * 1. Check NODE_ENV !== 'production'
 * 2. Verify X-Dev-Token header matches .env
 */
export const devModeGuard = (req: Request, res: Response, next: NextFunction) => {
  // Layer 1: Environment check
  if (!config.isDev()) {
    logger.warn({
      action: 'dev_endpoint_blocked',
      reason: 'Not in dev mode',
      path: req.path,
      ip: req.ip,
    });
    return res.status(403).json({
      success: false,
      error: 'Dev endpoints are disabled in production',
    });
  }

  // Layer 2: Token check
  const devToken = req.headers['x-dev-token'];
  const expectedToken = process.env.DEV_TOKEN;

  if (!devToken || devToken !== expectedToken) {
    logger.warn({
      action: 'dev_token_invalid',
      path: req.path,
      ip: req.ip,
    });
    return res.status(401).json({
      success: false,
      error: 'Invalid dev token',
    });
  }

  next();
};
```


***

### Task 4: Middleware Stack (45 นาที) 🎯

#### 4.1 Why Middleware Architecture?

**หลักการ:**

- **Cross-cutting concerns** - Logic ที่ทุก endpoint ต้องใช้ (logging, auth, correlation ID)
- **Sequential processing** - Middleware ทำงานตามลำดับ (order matters!)
- **Single responsibility** - แต่ละ middleware ทำงานเดียว[^2]


#### 4.2 Middleware Execution Order (Critical!)

```
Request
   ↓
1. CORS                       ← Allow cross-origin requests
   ↓
2. express.json()             ← Parse JSON body
   ↓
3. correlationIdMiddleware    ← Inject/extract correlationId
   ↓
4. requestLoggerMiddleware    ← Log request metadata
   ↓
5. authMiddleware             ← Verify JWT, attach req.user
   ↓
6. ROUTES                     ← /api/receipts, /api/transactions, etc.
   ↓
7. devModeGuard               ← Only for /api/dev routes
   ↓
8. notFoundHandler            ← 404 if no route matched
   ↓
9. validationErrorHandler     ← Zod errors → 400
   ↓
10. globalErrorHandler        ← All other errors → 500
   ↓
Response
```

**ทำไมต้องเรียงแบบนี้?**

- `correlationId` ต้องมาก่อน `logger` (เพื่อให้ log มี correlationId)
- `auth` ต้องมาก่อน routes (เพื่อให้ controller ใช้ `req.user` ได้)
- Error handlers ต้องมาทีหลังสุด (Express error middleware signature)[^1]


#### 4.3 Implementation: All Middleware Files

**File 1: `backend/src/middleware/correlationId.middleware.ts`**

```typescript
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

/**
 * correlationIdMiddleware
 * 
 * Purpose: Trace requests across microservices
 * - Extract from header if client provides it
 * - Generate new UUID if not provided
 * - Add to response headers
 * - Attach to req.correlationId for controllers
 */
export const correlationIdMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const correlationId =
    (req.headers['x-correlation-id'] as string) || uuidv4();

  req.correlationId = correlationId;
  res.setHeader('X-Correlation-Id', correlationId);

  next();
};
```

**File 2: `backend/src/middleware/requestLogger.middleware.ts`**

```typescript
import { Request, Response, NextFunction } from 'express';
import logger from '@/config/logger';

/**
 * requestLoggerMiddleware
 * 
 * Logs all incoming requests
 * - DEV mode: Verbose (body, query, headers)
 * - PROD mode: Minimal (method, path, ip)
 */
export const requestLoggerMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const startTime = Date.now();

  // Log request
  logger.info({
    action: 'http_request',
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
    correlationId: req.correlationId,
  });

  // Log response when finished
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    logger.info({
      action: 'http_response',
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration,
      correlationId: req.correlationId,
    });
  });

  next();
};
```

**File 3: `backend/src/middleware/errorHandler.middleware.ts`**

```typescript
import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import logger from '@/config/logger';
import config from '@/config/ConfigManager';
import {
  ValidationError,
  NotFoundError,
  FinancialIntegrityError,
} from '@/utils/errors';

/**
 * validationErrorHandler
 * 
 * Handles Zod validation errors
 * - Extracts field-level errors
 * - Returns 400 with details
 */
export const validationErrorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (err instanceof ZodError) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request data',
        details: err.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        })),
        correlationId: req.correlationId,
      },
    });
  }
  next(err);
};

/**
 * notFoundHandler
 * 
 * Handles 404 (no route matched)
 */
export const notFoundHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.path} not found`,
      correlationId: req.correlationId,
    },
  });
};

/**
 * globalErrorHandler
 * 
 * Handles all other errors
 * - Maps custom errors to status codes
 * - Logs 5xx errors
 * - Hides stack traces in production
 */
export const globalErrorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Map custom errors to status codes
  let statusCode = 500;
  let code = 'INTERNAL_SERVER_ERROR';

  if (err instanceof ValidationError) {
    statusCode = 400;
    code = 'VALIDATION_ERROR';
  } else if (err instanceof NotFoundError) {
    statusCode = 404;
    code = 'NOT_FOUND';
  } else if (err instanceof FinancialIntegrityError) {
    statusCode = 500;
    code = 'FINANCIAL_INTEGRITY_ERROR';
  }

  // Log error
  logger.error({
    action: 'error_handled',
    code,
    message: err.message,
    stack: err.stack,
    path: req.path,
    correlationId: req.correlationId,
  });

  // Send Discord alert for 5xx errors
  if (statusCode >= 500) {
    // TODO: Implement Discord webhook
  }

  // Response
  res.status(statusCode).json({
    success: false,
    error: {
      code,
      message: err.message || 'An error occurred',
      ...(config.isDev() && { stack: err.stack }), // Only in DEV
      correlationId: req.correlationId,
    },
  });
};
```

**File 4: `backend/src/middleware/index.ts` (Barrel Export)**

```typescript
export { correlationIdMiddleware } from './correlationId.middleware';
export { requestLoggerMiddleware } from './requestLogger.middleware';
export { authMiddleware, requireRole } from './auth.middleware';
export { devModeGuard } from './devMode.middleware';
export {
  validationErrorHandler,
  notFoundHandler,
  globalErrorHandler,
} from './errorHandler.middleware';
```


***

### Task 5: Response Formatting Utilities (30 นาที) 🎯

#### 5.1 Why Standard Response Format?

**ปัญหา:**

- Frontend ต้อง handle response ที่ format ต่างกันในแต่ละ endpoint
- ยากต่อการ type-check (TypeScript inference)
- ไม่มีมาตรฐานสำหรับ pagination, error messages

**Solution:**

- สร้าง **utility functions** ที่ return consistent format
- Frontend สามารถ type-check ได้ (TypeScript generics)
- ลด boilerplate code ใน controllers[^2]


#### 5.2 Response Interfaces

**File: `backend/src/utils/response.ts`**

```typescript
/**
 * Standard Response Formats
 * 
 * Design Principles:
 * 1. Consistent structure across all endpoints
 * 2. TypeScript-friendly (generics)
 * 3. Include metadata (correlationId, timestamp)
 */

// Success response
export interface SuccessResponse<T> {
  success: true;
  data: T;
  meta?: {
    correlationId: string;
    timestamp: string;
  };
}

// Error response
export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
    correlationId?: string;
  };
}

// Paginated response
export interface PaginatedResponse<T> {
  success: true;
  data: T[];
  pagination: {
    page: number;
    perPage: number;
    total: number;
    totalPages: number;
  };
  meta?: {
    correlationId: string;
    timestamp: string;
  };
}

/**
 * Utility function: successResponse
 * 
 * Usage:
 * res.json(successResponse(receipt, req.correlationId))
 */
export function successResponse<T>(
  data: T,
  correlationId?: string
): SuccessResponse<T> {
  return {
    success: true,
    data,
    ...(correlationId && {
      meta: {
        correlationId,
        timestamp: new Date().toISOString(),
      },
    }),
  };
}

/**
 * Utility function: errorResponse
 * 
 * Usage:
 * res.status(400).json(errorResponse(error, req.correlationId))
 */
export function errorResponse(
  error: Error,
  correlationId?: string
): ErrorResponse {
  return {
    success: false,
    error: {
      code: (error as any).code || 'UNKNOWN_ERROR',
      message: error.message,
      ...(correlationId && { correlationId }),
    },
  };
}

/**
 * Utility function: paginatedResponse
 * 
 * Usage:
 * res.json(paginatedResponse(receipts, { page, perPage, total }, req.correlationId))
 */
export function paginatedResponse<T>(
  data: T[],
  pagination: {
    page: number;
    perPage: number;
    total: number;
    totalPages: number;
  },
  correlationId?: string
): PaginatedResponse<T> {
  return {
    success: true,
    data,
    pagination,
    ...(correlationId && {
      meta: {
        correlationId,
        timestamp: new Date().toISOString(),
      },
    }),
  };
}
```


***

## 🚀 PART 4: INTEGRATION \& TESTING

### 4.1 Wire Everything in `app.ts`

**File: `backend/src/app.ts`**

```typescript
import express from 'express';
import cors from 'cors';
import {
  correlationIdMiddleware,
  requestLoggerMiddleware,
  authMiddleware,
  devModeGuard,
  validationErrorHandler,
  notFoundHandler,
  globalErrorHandler,
} from './middleware';

// Routes
import receiptRoutes from './modules/receipt/routes/receipt.routes';
import transactionRoutes from './modules/accounting/routes/transaction.routes';
import devRoutes from './modules/dev/routes/dev.routes';

const app = express();

// Global middleware
app.use(cors());
app.use(express.json());
app.use(correlationIdMiddleware);      // 1. Inject correlationId
app.use(requestLoggerMiddleware);      // 2. Log all requests

// Routes
app.use('/api/receipts', authMiddleware, receiptRoutes);
app.use('/api/transactions', authMiddleware, transactionRoutes);
app.use('/api/dev', devModeGuard, devRoutes); // Dev guard before routes

// Error handling (MUST be last)
app.use(validationErrorHandler);       // Zod errors → 400
app.use(notFoundHandler);              // 404
app.use(globalErrorHandler);           // All others → 500

export default app;
```


### 4.2 Testing Strategy

**Unit Tests (Controllers):**

```bash
bun test tests/unit/controllers/ReceiptController.test.ts
```

**Integration Tests (Full Stack):**

```bash
bun test tests/integration/receipt-upload.test.ts
```

**Example Integration Test:**

```typescript
import request from 'supertest';
import app from '@/app';
import { generateAuthToken } from '@/utils/auth';

describe('POST /api/receipts/upload', () => {
  it('should upload receipt and return 201', async () => {
    const token = generateAuthToken({ id: 'user123', role: 'user' });

    const response = await request(app)
      .post('/api/receipts/upload')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', 'tests/fixtures/receipt.jpg')
      .field('clientId', '550e8400-e29b-41d4-a716-446655440000');

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.receiptId).toBeDefined();
  });
});
```


***

## ✅ PART 5: SUCCESS CRITERIA \& CHECKLIST

### 5.1 Deliverables Checklist

```
Phase 2.2 Complete When:

[ ] Task 1: ReceiptController (60 min)
    [ ] 6 endpoints implemented
    [ ] Multer file upload working
    [ ] Zod validation on all inputs
    [ ] Pagination working
    [ ] Routes file created

[ ] Task 2: TransactionController (60 min)
    [ ] 7 endpoints implemented
    [ ] Role-based access control (requireRole middleware)
    [ ] Date range filtering working
    [ ] Trial balance endpoint returns correct data

[ ] Task 3: DevController (45 min)
    [ ] 5 dev endpoints implemented
    [ ] devModeGuard blocks in production
    [ ] X-Dev-Token authentication working
    [ ] Mock data insertion working

[ ] Task 4: Middleware Stack (45 min)
    [ ] correlationId middleware
    [ ] requestLogger middleware
    [ ] authMiddleware with role check
    [ ] Error handlers (Zod, 404, global)
    [ ] Middleware order correct in app.ts

[ ] Task 5: Response Utils (30 min)
    [ ] successResponse() utility
    [ ] errorResponse() utility
    [ ] paginatedResponse() utility
    [ ] TypeScript types exported

[ ] Integration
    [ ] All routes mounted in app.ts
    [ ] Postman collection created
    [ ] Integration tests pass
    [ ] Error handling returns correct status codes
    [ ] CorrelationId in all logs and responses
```


### 5.2 Testing Checklist

```bash
# 1. Start mock servers
cd backend
PORT=9000 bun src/mock-servers/express-mock.ts  # Express API mock
PORT=8000 bun src/mock-servers/ocr-mock.ts      # OCR mock

# 2. Start backend
bun run dev

# 3. Test endpoints
curl -X POST http://localhost:3000/api/receipts/upload \
  -H "Authorization: Bearer <TOKEN>" \
  -F "file=@test.jpg" \
  -F "clientId=550e8400-e29b-41d4-a716-446655440000"

# 4. Run tests
bun test
```


***

## 🎓 PART 6: KEY LEARNINGS \& BEST PRACTICES

### 6.1 Critical Design Decisions

| Decision | Reasoning |
| :-- | :-- |
| **Zod for validation** | Type-safe, composable, clear error messages |
| **correlationId everywhere** | Essential for debugging distributed systems |
| **Middleware order matters** | correlationId → logging → auth → routes → errors |
| **Services don't know about HTTP** | Can reuse for CLI, cron jobs, webhooks |
| **Dual mode logging** | DEV = verbose, PROD = minimal (performance) |
| **Role-based middleware** | Centralized authorization logic |

### 6.2 Common Pitfalls

❌ **Don't:** Put business logic in controllers
✅ **Do:** Controllers only validate, call service, format response

❌ **Don't:** Return 200 for errors
✅ **Do:** Use correct HTTP status codes (400, 404, 500)

❌ **Don't:** Expose stack traces in production
✅ **Do:** Check `config.isDev()` before including sensitive data

❌ **Don't:** Forget correlationId
✅ **Do:** Pass it to every service method

***

## 📚 APPENDIX: Quick Reference

### A. HTTP Status Codes

| Code | Meaning | When to Use |
| :-- | :-- | :-- |
| 200 | OK | Successful GET, PUT, DELETE |
| 201 | Created | Successful POST (resource created) |
| 202 | Accepted | Async operation started |
| 400 | Bad Request | Validation error (Zod) |
| 401 | Unauthorized | Missing/invalid JWT |
| 403 | Forbidden | Valid JWT but insufficient permissions |
| 404 | Not Found | Resource doesn't exist |
| 500 | Internal Server Error | Unexpected error |

### B. TypeScript Augmentation

**File: `backend/src/types/express.d.ts`**

```typescript
import { Request } from 'express';

declare global {
  namespace Express {
    interface Request {
      correlationId: string;
      user?: {
        id: string;
        clientId: string;
        role: 'user' | 'accountant' | 'admin';
      };
    }
  }
}
```


***

**🎯 Phase 2.2 Status: COMPREHENSIVE BLUEPRINT COMPLETE**

**พร้อมเริ่มเขียนโค้ดได้เลยครับ!** 🚀
มี reasoning ชัดเจนทุก decision, architecture well-structured, และ checklist ครบทุกข้อ
<span style="display:none">[^4][^5][^6][^7]</span>

<div align="center">⁂</div>

[^1]: Auto_Acct_Vol2_Implementation.md

[^2]: AutoAcct-Phase-2.2-Master-Prompt.md

[^3]: Auto_Acct_Vol2B_Integrations.md

[^4]: Criteria-LocalhostTunnel-Hybrid-FullCloud.csv

[^5]: Vol2C_Enhanced.md

[^6]: Phase3D_Summary.md

[^7]: Auto_Acct_Vol1_Architecture.md

