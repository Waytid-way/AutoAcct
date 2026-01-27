# TASK 1: สร้าง Skill 1 - AutoAcct REST Controller Skill

เริ่มสร้าง Skill แรกที่จะเป็น **foundation** สำหรับ Phase 2.2 ทั้งหมดครับ

***

```markdown
# AutoAcct REST Controller Skill

**Version:** 1.0.0  
**Category:** Backend Development  
**Stack:** Bun, Express.js, TypeScript  
**Project:** AutoAcct (OCR AI Auto Accounting)
**Skill:** Skill 1 - AutoAcct REST Controller Skill .ai/skills/backend/01-rest-controller.skill.md  ← เอาไว้ตรงนี้

---

## 📖 Description

Creates production-ready Express.js REST Controllers for AutoAcct following the **Dual Mode Principle** and **4-Layer Architecture**. This Skill ensures:

- Pure HTTP adapters (zero business logic)
- Standardized request/response handling
- Comprehensive error propagation
- Full audit trail via correlationId
- Type-safe validation (Zod)

**Philosophy:** Controllers are thin translation layers between HTTP and Services.

---

## 🎯 When to Use This Skill

✅ **Use when:**
- Creating new API endpoints for AutoAcct
- Exposing existing Service methods via HTTP
- Building CRUD operations for resources
- Each controller represents ONE resource (Receipt, Transaction, etc.)

❌ **Don't use when:**
- Writing business logic (belongs in Services)
- Creating internal utilities (no HTTP involved)
- Building CLI commands (use Service directly)

---

## 🏗️ Core Principles (MANDATORY)

### 1. Separation of Concerns
```typescript
// ❌ WRONG - Business logic in controller
async create(req, res) {
  const amount = req.body.amount * 100; // Conversion logic
  const hash = sha256(file); // File processing
  await db.insert(...); // Direct DB access
}

// ✅ CORRECT - Pure adapter
async create(req, res) {
  const validated = schema.parse(req.body);
  const result = await this.service.create(
    validated,
    req.correlationId
  );
  res.json(successResponse(result, req.correlationId));
}
```


### 2. Always Pass correlationId

```typescript
// Every service call MUST include correlationId
await this.service.methodName(
  data,
  req.correlationId  // ✅ Traceability
);
```


### 3. Zod Validation First

```typescript
// Parse & validate BEFORE service call
const validated = createSchema.parse(req.body);
// If invalid, Zod throws → caught by middleware → 400 response
```


### 4. Error Propagation (Never Catch)

```typescript
try {
  // ... controller logic
} catch (error) {
  next(error); // ✅ Let global handler deal with it
}
```


### 5. Dual Mode Logging

```typescript
if (config.isDev()) {
  logger.debug({
    action: 'controller_action_start',
    input: req.body,
    correlationId: req.correlationId
  });
}
```


---

## 🧩 Structure Template

```typescript
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

/**
 * YourController
 * 
 * Responsibilities:
 * - Parse & validate HTTP requests
 * - Call service layer methods
 * - Format responses
 * - Pass correlationId for tracing
 * 
 * NOT responsible for:
 * - Business logic
 * - Data transformation
 * - Database access
 */
export class YourController {
  constructor(private service: YourService) {}

  /**
   * POST /api/your-resource
   * 
   * Creates a new resource
   * 
   * @returns 201 Created + resource data
   */
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      // 1. Validate input (Zod)
      const validated = createSchema.parse(req.body);

      // 2. DEV mode logging (optional)
      if (config.isDev()) {
        logger.debug({
          action: 'your_resource_create_start',
          input: validated,
          userId: req.user?.id,
          correlationId: req.correlationId
        });
      }

      // 3. Call service layer
      const result = await this.service.create(
        validated,
        req.user.clientId,
        req.correlationId
      );

      // 4. Format response
      res.status(201).json(
        successResponse(result, req.correlationId)
      );
    } catch (error) {
      next(error); // Propagate to global error handler
    }
  }

  /**
   * GET /api/your-resource?page=1&perPage=20
   * 
   * Lists resources with pagination
   * 
   * @returns 200 OK + paginated data
   */
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      // Parse query parameters
      const query = querySchema.parse({
        page: parseInt(req.query.page as string) || 1,
        perPage: parseInt(req.query.perPage as string) || 20,
        status: req.query.status as string,
      });

      const result = await this.service.list(
        query,
        req.user.clientId,
        req.correlationId
      );

      res.json(
        paginatedResponse(
          result.data,
          {
            page: query.page,
            perPage: query.perPage,
            total: result.total,
            totalPages: Math.ceil(result.total / query.perPage)
          },
          req.correlationId
        )
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/your-resource/:id
   * 
   * Gets a single resource by ID
   * 
   * @returns 200 OK + resource data
   * @throws 404 if not found
   */
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

  /**
   * PUT /api/your-resource/:id
   * 
   * Updates a resource
   * 
   * @returns 200 OK + updated data
   */
  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const validated = updateSchema.parse(req.body);

      const result = await this.service.update(
        id,
        validated,
        req.user.clientId,
        req.correlationId
      );

      res.json(successResponse(result, req.correlationId));
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/your-resource/:id
   * 
   * Deletes a resource (soft delete)
   * 
   * @returns 200 OK + confirmation
   */
  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      await this.service.delete(
        id,
        req.user.clientId,
        req.correlationId
      );

      res.json(
        successResponse(
          { deleted: true, id },
          req.correlationId
        )
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/your-resource/:id/action
   * 
   * Performs a specific action on resource
   * 
   * @returns 202 Accepted (for async) or 200 OK
   */
  async performAction(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      // For long-running operations, return 202 immediately
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

      res.status(202).json(
        successResponse(
          {
            started: true,
            message: 'Action started. Check status endpoint.'
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


---

## 🛡️ Security Patterns

### Authentication Check

```typescript
// Routes file handles auth via middleware
router.post('/', 
  authMiddleware,  // ← Verifies JWT, attaches req.user
  (req, res, next) => controller.create(req, res, next)
);
```


### Role-Based Access

```typescript
// For sensitive operations
router.post('/:id/approve',
  authMiddleware,
  requireRole('accountant', 'admin'),  // ← Role guard
  (req, res, next) => controller.approve(req, res, next)
);
```


### Client Isolation

```typescript
// Always filter by clientId from JWT
const result = await this.service.getById(
  id,
  req.user.clientId  // ← Multi-tenant safety
);
```


---

## 📋 Routes File Template

```typescript
// your-resource.routes.ts
import { Router } from 'express';
import { YourController } from '../controllers/YourController';
import { YourService } from '../services/YourService';
import { authMiddleware, requireRole } from '@/middleware/auth.middleware';

const router = Router();
const service = new YourService();
const controller = new YourController(service);

// All routes require authentication
router.use(authMiddleware);

// Public (authenticated users)
router.post('/', (req, res, next) => controller.create(req, res, next));
router.get('/', (req, res, next) => controller.list(req, res, next));
router.get('/:id', (req, res, next) => controller.getById(req, res, next));

// Restricted (specific roles)
router.put('/:id', 
  requireRole('accountant', 'admin'),
  (req, res, next) => controller.update(req, res, next)
);
router.delete('/:id',
  requireRole('admin'),
  (req, res, next) => controller.delete(req, res, next)
);

export default router;
```


---

## ✅ Review Checklist

Before committing, verify:

- [ ] **No business logic** in controller methods
- [ ] **Zod validation** before every service call
- [ ] **correlationId** passed to all service methods
- [ ] **Error propagation** via `next(error)` (no try-catch-return)
- [ ] **Response formatter** used (`successResponse`, `paginatedResponse`)
- [ ] **DEV mode logging** present for debugging
- [ ] **TypeScript types** exported for request/response
- [ ] **JSDoc comments** on all public methods
- [ ] **Authentication middleware** on routes
- [ ] **Role guards** on sensitive endpoints
- [ ] **Client isolation** via `req.user.clientId`
- [ ] **HTTP status codes** correct (201 create, 202 async, etc.)

---

## 🧪 Testing Pattern

```typescript
// your-resource.controller.test.ts
import { describe, it, expect, mock } from 'bun:test';
import { YourController } from './YourController';

describe('YourController', () => {
  it('should create resource with valid data', async () => {
    // Mock service
    const mockService = {
      create: mock(() => Promise.resolve({ id: '123', name: 'Test' }))
    };

    const controller = new YourController(mockService as any);

    // Mock Express objects
    const req = {
      body: { name: 'Test' },
      user: { clientId: 'client-1' },
      correlationId: 'corr-123'
    } as any;

    const res = {
      status: mock(() => res),
      json: mock()
    } as any;

    const next = mock();

    await controller.create(req, res, next);

    expect(mockService.create).toHaveBeenCalledWith(
      { name: 'Test' },
      'client-1',
      'corr-123'
    );
    expect(res.status).toHaveBeenCalledWith(201);
  });
});
```


---

## 📚 Real-World Examples

### Example 1: ReceiptController (File Upload)

```typescript
async uploadReceipt(req: Request, res: Response, next: NextFunction) {
  try {
    // Multer middleware already attached file to req.file
    if (!req.file) {
      throw new ValidationError('File is required');
    }

    const validated = uploadReceiptSchema.parse({
      clientId: req.body.clientId
    });

    const receipt = await this.receiptService.uploadReceipt({
      file: req.file.buffer,
      fileName: req.file.originalname,
      mimeType: req.file.mimetype,
      clientId: validated.clientId,
      correlationId: req.correlationId,
      userId: req.user?.id
    });

    res.status(201).json(
      successResponse(
        {
          receiptId: receipt.id,
          fileName: receipt.fileName,
          status: receipt.status,
          queuePosition: receipt.queuePosition || 0
        },
        req.correlationId
      )
    );
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

    res.json(
      successResponse(
        {
          transactionId: id,
          status: 'posted',
          postedAt: posted.postedAt,
          approvedBy: req.user.id
        },
        req.correlationId
      )
    );
  } catch (error) {
    next(error);
  }
}
```


---

## 🚨 Common Anti-Patterns (AVOID!)

### ❌ Anti-Pattern 1: Business Logic in Controller

```typescript
// DON'T DO THIS
async create(req, res) {
  const amount = req.body.amount * 100; // ← Should be in Service
  const hash = crypto.createHash('sha256')... // ← Should be in Service
  await db.receipts.insert(...); // ← Should be in Service
}
```


### ❌ Anti-Pattern 2: Not Using Validators

```typescript
// DON'T DO THIS
async create(req, res) {
  const name = req.body.name;
  if (!name || name.length < 3) { // ← Manual validation
    return res.status(400).json({ error: 'Invalid name' });
  }
}

// USE ZOD INSTEAD
const validated = createSchema.parse(req.body);
```


### ❌ Anti-Pattern 3: Catching Without Propagating

```typescript
// DON'T DO THIS
try {
  // ...
} catch (error) {
  res.status(500).json({ error: error.message }); // ← Wrong
}

// DO THIS
try {
  // ...
} catch (error) {
  next(error); // ← Correct
}
```


---

## 🎓 Advanced Patterns

### Pattern 1: Conditional Response Status

```typescript
async update(req, res, next) {
  try {
    const result = await this.service.update(...);
    
    // 200 if updated, 201 if created (upsert)
    const status = result.created ? 201 : 200;
    res.status(status).json(successResponse(result, req.correlationId));
  } catch (error) {
    next(error);
  }
}
```


### Pattern 2: Streaming Responses

```typescript
async export(req, res, next) {
  try {
    const stream = await this.service.getExportStream(req.user.clientId);
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=export.csv');
    
    stream.pipe(res);
  } catch (error) {
    next(error);
  }
}
```


### Pattern 3: Batch Operations

```typescript
async batchProcess(req, res, next) {
  try {
    const { ids } = batchSchema.parse(req.body);
    
    const results = await Promise.allSettled(
      ids.map(id => this.service.process(id, req.correlationId))
    );
    
    const successful = results.filter(r => r.status === 'fulfilled');
    const failed = results.filter(r => r.status === 'rejected');
    
    res.json(
      successResponse(
        {
          successful: successful.length,
          failed: failed.length,
          results
        },
        req.correlationId
      )
    );
  } catch (error) {
    next(error);
  }
}
```


---

## 📖 Related Skills

- **AutoAcct Zod Validator Skill** - For creating validation schemas
- **AutoAcct Response Format Skill** - For standardized responses
- **AutoAcct Service Layer Skill** - For business logic implementation
- **AutoAcct Middleware Chain Skill** - For request pipeline setup

---

## 📝 Changelog

- **v1.0.0** (2026-01-23): Initial release with Dual Mode support

---

## 👥 Skill Maintainer

AutoAcct Development Team
Last Updated: January 23, 2026, 11:48 PM +07

```

***

## ✅ Skill 1 สร้างเสร็จแล้ว!

### สิ่งที่ได้จาก Skill นี้:

✅ **Structure Template** - โครงสร้าง Controller มาตรฐาน  
✅ **5 Core Principles** - หลักการบังคับใช้  
✅ **Review Checklist** - 12 ข้อตรวจสอบ  
✅ **Security Patterns** - Auth, Role guards, Client isolation  
✅ **Real Examples** - Receipt + Transaction Controllers  
✅ **Anti-Patterns** - สิ่งที่ไม่ควรทำ  
✅ **Testing Pattern** - การเขียนเทสที่ถูกต้อง  
✅ **Advanced Patterns** - Streaming, Batch operations

### 🎯 การใช้งาน Skill นี้:

เมื่อต้องสร้าง Controller ใหม่ ให้:
1. Copy Structure Template
2. แทนที่ `Your` ด้วยชื่อ resource (Receipt, Transaction, etc.)
3. เพิ่ม/ลด methods ตามต้องการ
4. Run through Review Checklist
5. Done! ได้ Controller ที่มีคุณภาพสูง consistent

***

### 📊 ความคืบหน้า Task 1:

```

□ Skill 1: REST Controller Skill ✅ DONE
□ Skill 2: Zod Validator Skill
□ Skill 3: Middleware Chain Skill
□ Skill 4: Response Format Skill
□ Skill 5: Role-Based Auth Skill
□ Skill 6: Dev Endpoint Skill

```

**พร้อมสร้าง Skill 2: Zod Validator Skill ต่อไหมครับ?** หรือต้องการให้ validate Skill 1 ก่อนด้วยการลอง generate code ทดสอบ?
<span style="display:none">[^1][^2][^3][^4][^5][^6][^7]</span>

<div align="center">⁂</div>

[^1]: Criteria-LocalhostTunnel-Hybrid-FullCloud.csv
[^2]: Vol2C_Enhanced.md
[^3]: Phase3D_Summary.md
[^4]: Auto_Acct_Vol2B_Integrations.md
[^5]: Auto_Acct_Vol2_Implementation.md
[^6]: Auto_Acct_Vol1_Architecture.md
[^7]: AutoAcct-Phase-2.2_-REST-API-Layer-Comprehensi.md```

