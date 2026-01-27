# 📦 **SKILL 1: AutoAcct REST Controller (Antigravity Edition)**
name: autoaccl-rest-controller
version: 2.0.0-antigravity
category: backend-development
stack: [bun, express, typescript]
project: autoaccl
last_updated: 2026-01-26T21:32:00+07:00
---

# AutoAcct REST Controller Skill

**Natural Language Triggers:**
- "create controller for"
- "build API endpoint"
- "implement REST handler"
- "add HTTP route"
- "expose service via API"

---

## 📖 What This Skill Does

Creates **production-ready Express.js REST Controllers** for AutoAcct following:
- ✅ Pure HTTP adapters (zero business logic)
- ✅ Type-safe Zod validation
- ✅ Dual Mode logging (DEV vs PROD)
- ✅ MoneyInt validation (Integer Satang)
- ✅ CorrelationId propagation

**Philosophy:** Controllers are thin translation layers: HTTP → Service → HTTP

---

## 🎯 When to Use

**Use when:**
- Creating new API endpoints (GET/POST/PUT/DELETE)
- Exposing Service layer methods via REST
- Building CRUD for resources (Receipt, Transaction, etc.)

**Don't use when:**
- Writing business logic (use Service Layer Skill)
- Building CLI commands (call Service directly)
- Internal utilities (no HTTP needed)

---

## 🚀 Quick Start (30 seconds)

```typescript
// 1. Create Controller
import { Request, Response, NextFunction } from 'express';
import { YourService } from '../services/YourService';
import { createSchema } from '../validators/your.validators';
import { successResponse } from '@/utils/response';

export class YourController {
  constructor(private service: YourService) {}

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = createSchema.parse(req.body);
      
      const result = await this.service.create(
        validated,
        req.user.clientId,
        req.correlationId  // ← ALWAYS last
      );
      
      res.status(201).json(successResponse(result, req.correlationId));
    } catch (error) {
      next(error);  // ← MANDATORY: Let global handler catch
    }
  }
}

// 2. Create Routes
import { Router } from 'express';
import { authMiddleware } from '@/middleware';

const router = Router();
const service = new YourService();
const controller = new YourController(service);

router.use(authMiddleware);  // ← All routes require auth
router.post('/', (req, res, next) => controller.create(req, res, next));

export default router;
```

**That's it! You have a working controller.** ✅

---

## 🏗️ Core Principles (MANDATORY)

### 1. Pure HTTP Adapter (No Business Logic)

```typescript
// ❌ WRONG - Business logic in controller
async create(req, res) {
  const amount = req.body.amount * 100;  // ← Conversion logic
  const hash = sha256(file);             // ← File processing
  await db.insert(...);                   // ← Direct DB access
}

// ✅ CORRECT - Pure adapter
async create(req, res) {
  const validated = schema.parse(req.body);
  const result = await this.service.create(validated, req.correlationId);
  res.json(successResponse(result, req.correlationId));
}
```


### 2. Service Parameter Order (STRICT)

**ALWAYS follow this order:**

1. **Data/ID** - Primary input
2. **Context** - clientId, userId (optional)
3. **Trace** - correlationId (MANDATORY, always last)
```typescript
// ✅ Correct Order
await this.service.methodName(
  data,               // 1. Data
  req.user.clientId,  // 2. Context
  req.correlationId   // 3. Trace (ALWAYS last)
);
```


### 3. Error Propagation (Never Catch-Return)

```typescript
try {
  // ... controller logic
} catch (error) {
  next(error);  // ✅ ALWAYS propagate to global handler
}
```


### 4. MoneyInt Validation (Golden Rule \#1)

```typescript
// ⚠️ ALL monetary values MUST be Integer Satang
const schema = z.object({
  amount: z.number()
    .int('Amount must be integer Satang')
    .nonnegative()
    .max(1_000_000_000, 'Max 10M THB'),
});
```


---

## 📋 Full Implementation Template

```typescript
// YourController.ts
import { Request, Response, NextFunction } from 'express';
import { YourService } from '../services/YourService';
import { 
  createSchema, 
  updateSchema,
  querySchema 
} from '../validators/your.validators';
import { successResponse, paginatedResponse } from '@/utils/response';
import logger from '@/config/logger';
import config from '@/config/ConfigManager';

export class YourController {
  constructor(private service: YourService) {}

  // POST /api/your-resource
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      // 1. Validate input
      const validated = createSchema.parse(req.body);

      // 2. DEV logging (optional)
      if (config.isDev()) {
        logger.debug({
          action: 'create_start',
          input: validated,
          correlationId: req.correlationId
        });
      }

      // 3. Call service (CORRECT parameter order)
      const result = await this.service.create(
        validated,
        req.user.clientId,
        req.correlationId
      );

      // 4. Format response
      res.status(201).json(successResponse(result, req.correlationId));
    } catch (error) {
      next(error);
    }
  }

  // GET /api/your-resource?page=1&perPage=20
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const query = querySchema.parse({
        page: parseInt(req.query.page as string) || 1,
        perPage: parseInt(req.query.perPage as string) || 20,
      });

      const result = await this.service.list(
        query,
        req.user.clientId,
        req.correlationId
      );

      res.json(paginatedResponse(
        result.data,
        {
          page: query.page,
          perPage: query.perPage,
          total: result.total,
          totalPages: Math.ceil(result.total / query.perPage)
        },
        req.correlationId
      ));
    } catch (error) {
      next(error);
    }
  }

  // GET /api/your-resource/:id
  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const result = await this.service.getById(
        id,
        req.user.clientId,
        req.correlationId
      );
      res.json(successResponse(result, req.correlationId));
    } catch (error) {
      next(error);
    }
  }

  // POST /api/your-resource/:id/action (Async operation)
  async performAction(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      
      // Start async operation (don't await)
      this.service
        .performAsyncAction(id, req.correlationId)
        .catch((err) => {
          logger.error({
            action: 'async_action_failed',
            resourceId: id,
            error: err.message,
            correlationId: req.correlationId
          });
        });

      // Return 202 Accepted immediately
      res.status(202).json(successResponse({
        started: true,
        message: 'Action started. Check status endpoint.'
      }, req.correlationId));
    } catch (error) {
      next(error);
    }
  }
}
```


---

## 🛣️ Routes Template

```typescript
// your-resource.routes.ts
import { Router } from 'express';
import { YourController } from '../controllers/YourController';
import { YourService } from '../services/YourService';
import { authMiddleware, requireRole } from '@/middleware';

const router = Router();
const service = new YourService();
const controller = new YourController(service);

// All routes require authentication
router.use(authMiddleware);

// Public (authenticated users)
router.post('/', (req, res, next) => controller.create(req, res, next));
router.get('/', (req, res, next) => controller.list(req, res, next));
router.get('/:id', (req, res, next) => controller.getById(req, res, next));

// Restricted (role-based)
router.put('/:id', 
  requireRole('accountant', 'admin'),
  (req, res, next) => controller.update(req, res, next)
);

export default router;
```


---

## ✅ Review Checklist

Before committing, verify:

- [ ] **No business logic** in controller methods
- [ ] **Zod validation** before every service call
- [ ] **correlationId** passed to all service methods (always last)
- [ ] **Error propagation** via `next(error)` (no try-catch-return)
- [ ] **Response formatter** used (`successResponse`/`paginatedResponse`)
- [ ] **DEV mode logging** present for debugging
- [ ] **TypeScript types** exported for request/response
- [ ] **Authentication middleware** on routes
- [ ] **Role guards** on sensitive endpoints
- [ ] **Client isolation** via `req.user.clientId`
- [ ] **HTTP status codes** correct (201=create, 202=async, etc.)
- [ ] **MoneyInt** used for all monetary amounts

---

## 🔄 Feedback \& Improvement

**If controller fails:**

1. Check service parameter order (data, clientId, correlationId)
2. Verify Zod schema matches service input type
3. Ensure error propagation (not catching)
4. Validate response format

**To improve this skill:**

- Add more AutoAcct-specific examples
- Include performance optimization patterns
- Update based on team feedback

---

## 📚 Real-World Examples

### Example 1: ReceiptController (File Upload)

```typescript
async uploadReceipt(req: Request, res: Response, next: NextFunction) {
  try {
    // Multer already attached file
    if (!req.file) {
      throw new ValidationError('File is required');
    }

    const validated = uploadReceiptSchema.parse(req.body);

    const receipt = await this.receiptService.uploadReceipt(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype,
      validated.clientId,
      req.correlationId,
      req.user?.id
    );

    res.status(201).json(successResponse({
      receiptId: receipt.id,
      fileName: receipt.fileName,
      status: receipt.status,
      queuePosition: receipt.queuePosition || 0
    }, req.correlationId));
  } catch (error) {
    next(error);
  }
}
```


### Example 2: TransactionController (Role-Restricted)

```typescript
async approve(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;

    // Critical operation logging
    logger.info({
      action: 'transaction_approve_start',
      transactionId: id,
      approvedBy: req.user.id,
      correlationId: req.correlationId
    });

    const posted = await this.transactionService.approve(
      id,
      req.user.clientId,
      req.user.id,  // Audit trail
      req.correlationId
    );

    res.json(successResponse({
      transactionId: id,
      status: 'posted',
      postedAt: posted.postedAt,
      approvedBy: req.user.id
    }, req.correlationId));
  } catch (error) {
    next(error);
  }
}
```


---

## 🔗 Required TypeScript Types

Add to `types/express.d.ts`:

```typescript
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


---

## 📚 Related Skills

- **autoaccl-zod-validator** - For creating validation schemas
- **autoaccl-service-layer** - For business logic implementation
- **autoaccl-error-handling** - For middleware \& error handlers

---

**Skill Maintainer:** AutoAcct Development Team
**Last Updated:** 2026-01-26T21:32:00+07:00
**Version:** 2.0.0-antigravity