# 📦 **SKILL 4: AutoAcct Error Handling \& Middleware (Antigravity Edition)**

name: autoaccl-error-handling-middleware
version: 2.0.0-antigravity
category: backend-development
stack: [typescript, express, bun, mongodb]
project: autoaccl
last_updated: 2026-01-26T21:46:00+07:00
---

# AutoAcct Error Handling & Middleware Skill

**Natural Language Triggers:**
- "handle errors globally"
- "create error middleware"
- "add request middleware"
- "implement correlation id"
- "setup error handler"

---

## 📖 What This Skill Does

Creates **production-ready Error Handling & Middleware** for AutoAcct with:
- ✅ **Single global error handler** (centralized error mapping)
- ✅ **Domain-first errors** (Services throw domain errors → handler maps to HTTP)
- ✅ **CorrelationId middleware** (distributed tracing)
- ✅ **Request logging** (audit trail)
- ✅ **No sensitive data in Prod** (stack traces in dev only)
- ✅ **Consistent error response** (standardized JSON shape)

**Philosophy:** Errors flow through one central handler; middleware adds context to requests.

---

## 🎯 When to Use

**Use when:**
- Duplicate receipt upload → 409 Conflict
- Zod validation fails → 400 Bad Request
- Unauthorized access → 401 Unauthorized
- Forbidden (no permission) → 403 Forbidden
- Route not found → 404 Not Found
- Medici ledger down → 502 Bad Gateway
- Trial balance fails → 500 Internal Error
- Uncaught null pointer → 500 Internal Error

---

## 🚀 Quick Start (30 seconds)

```typescript
// 1. Define Domain Error Base Class
export class DomainError extends Error {
  code: string = 'UNKNOWN_ERROR';
  statusCode: number = 500;
  isOperational: boolean = true;

  constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, DomainError.prototype);
  }
}

export class DuplicateReceiptError extends DomainError {
  code = 'DUPLICATE_RECEIPT';
  statusCode = 409;

  constructor(fileHash: string) {
    super(`Receipt with hash ${fileHash} already exists`);
    Object.setPrototypeOf(this, DuplicateReceiptError.prototype);
  }
}

// 2. Global Error Handler
export const globalErrorHandler = (
  err: any,
  req: any,
  res: any,
  next: any
) => {
  const statusCode = err.statusCode || 500;
  const code = err.code || 'INTERNAL_ERROR';
  const correlationId = req.correlationId || 'unknown';
  const isDev = process.env.NODE_ENV === 'development';

  // Log error
  console.error(`[${correlationId}] ${code}: ${err.message}`, {
    statusCode,
    stack: isDev ? err.stack : undefined,
  });

  // Return error response
  res.status(statusCode).json({
    success: false,
    error: {
      code,
      message: err.message,
      ...(isDev && { stack: err.stack }),
    },
    meta: {
      correlationId,
      timestamp: new Date().toISOString(),
    },
  });
};

// 3. Middleware Registration (CRITICAL ORDER!)
import express from 'express';

const app = express();

// ✅ 1. CorrelationId (MUST be first)
app.use(correlationIdMiddleware);

// ✅ 2. Request logger
app.use(requestLoggerMiddleware);

// ✅ 3. Body parser
app.use(express.json());

// ✅ 4. Routes
app.post('/api/receipts', receiptController.upload);

// ✅ 5. Not Found handler
app.use(notFoundMiddleware);

// ✅ 6. Global Error Handler (MUST be last)
app.use(globalErrorHandler);
```

**That's it! All errors flow through one handler.** ✅

---

## 🏗️ Core Principles (MANDATORY)

### 1. Single Global Error Handler

**Rule:** Express MUST have ONE global error handler middleware at the end.

**Why:**

- 🔄 **Centralized** - All errors pass through one point
- 📊 **Consistent** - Same response shape everywhere
- 📝 **Observable** - All errors logged in one place

```typescript
// ❌ WRONG - Error handling in controller
export class ReceiptController {
  async upload(req, res, next) {
    try {
      const receipt = await this.service.uploadReceipt(...);
      res.status(201).json({ success: true, data: receipt });
    } catch (err) {
      // ❌ Duplicate logic if done in every controller
      res.status(err.statusCode || 500).json({
        success: false,
        error: { code: err.code || 'ERROR', message: err.message },
      });
    }
  }
}

// ✅ CORRECT - Propagate to global handler
export class ReceiptController {
  async upload(req, res, next) {
    try {
      const receipt = await this.service.uploadReceipt(...);
      res.status(201).json({ success: true, data: receipt });
    } catch (err) {
      next(err);  // ✅ Let global handler take care
    }
  }
}
```


---

### 2. Domain Errors First, HTTP Second

**Rule:** Services throw DomainError; global handler maps to HTTP status.

```typescript
// ✅ Service throws domain error
export class ReceiptService {
  async uploadReceipt(...) {
    const existing = await Receipt.findOne({ fileHash, clientId });
    if (existing) {
      throw new DuplicateReceiptError(fileHash);  // ← No HTTP knowledge
    }
  }
}

// ✅ Global handler maps domain → HTTP
export const globalErrorHandler = (err, req, res, next) => {
  if (err instanceof DuplicateReceiptError) {
    return res.status(409).json({
      success: false,
      error: { code: 'DUPLICATE_RECEIPT', message: err.message },
      meta: { correlationId: req.correlationId, timestamp: new Date() },
    });
  }
  
  if (err instanceof NotFoundError) {
    return res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: err.message },
      meta: { correlationId: req.correlationId, timestamp: new Date() },
    });
  }
  
  // Default 500
  res.status(500).json({
    success: false,
    error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
    meta: { correlationId: req.correlationId, timestamp: new Date() },
  });
};
```


---

### 3. No Stack Traces in Production

**Rule:**

- `NODE_ENV=development` → send stack trace + details
- `NODE_ENV=production` → message only (no internals)

```typescript
export const globalErrorHandler = (err, req, res, next) => {
  const isDev = process.env.NODE_ENV === 'development';

  const response = {
    success: false,
    error: {
      code: err.code || 'INTERNAL_ERROR',
      message: err.message,
      ...(isDev && { stack: err.stack }),  // ✅ Stack in dev only
      ...(isDev && err.details && { details: err.details }),
    },
    meta: {
      correlationId: req.correlationId,
      timestamp: new Date().toISOString(),
    },
  };

  res.status(err.statusCode || 500).json(response);
};
```


---

### 4. Consistent Error Response Shape

**Rule:** All error responses MUST follow this exact schema:

```typescript
type ErrorResponse = {
  success: false;
  error: {
    code: string;           // 'VALIDATION_ERROR' | 'NOT_FOUND' | etc
    message: string;        // Human-readable
    details?: any;          // Optional, dev-only
    stack?: string;         // Optional, dev-only
  };
  meta: {
    correlationId: string;
    timestamp: string;
  };
};

// Example error response
{
  "success": false,
  "error": {
    "code": "DUPLICATE_RECEIPT",
    "message": "Receipt with hash abc123... already exists"
  },
  "meta": {
    "correlationId": "corr-req-12345",
    "timestamp": "2026-01-26T21:46:00.000Z"
  }
}
```


---

### 5. Middleware Ordering is CRITICAL

**Rule:** This order MUST NOT change!

```typescript
// ✅ CORRECT ORDER (NEVER CHANGE!)
app.use(correlationIdMiddleware);    // 1. MUST be first (adds correlationId)
app.use(requestLoggerMiddleware);    // 2. Log all requests
app.use(express.json());             // 3. Parse body
app.use(authMiddleware);             // 4. Verify JWT (optional)
app.use('/api', routes);             // 5. Business routes
app.use(notFoundMiddleware);         // 6. Catch 404
app.use(globalErrorHandler);         // 7. MUST be last (catch all errors)
```


---

## 📋 Domain Error Classes (Full Implementation)

### Base DomainError

```typescript
// shared/errors/DomainError.ts
export class DomainError extends Error {
  code: string = 'UNKNOWN_ERROR';
  statusCode: number = 500;
  isOperational: boolean = true;
  details?: any;

  constructor(message: string, details?: any) {
    super(message);
    Object.setPrototypeOf(this, DomainError.prototype);
    this.details = details;
  }
}
```


### Validation Error

```typescript
export class ValidationError extends DomainError {
  code = 'VALIDATION_ERROR';
  statusCode = 400;

  constructor(
    message: string,
    public fieldErrors?: Record<string, string[]>
  ) {
    super(message, { fieldErrors });
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}
```


### Auth \& Permission Errors

```typescript
export class AuthError extends DomainError {
  code = 'AUTH_REQUIRED';
  statusCode = 401;

  constructor(message: string = 'Authentication required') {
    super(message);
    Object.setPrototypeOf(this, AuthError.prototype);
  }
}

export class ForbiddenError extends DomainError {
  code = 'FORBIDDEN';
  statusCode = 403;

  constructor(message: string = 'Access forbidden') {
    super(message);
    Object.setPrototypeOf(this, ForbiddenError.prototype);
  }
}
```


### Not Found Error

```typescript
export class NotFoundError extends DomainError {
  code = 'NOT_FOUND';
  statusCode = 404;

  constructor(resource: string, id: string) {
    super(`${resource} with id '${id}' not found`);
    Object.setPrototypeOf(this, NotFoundError.prototype);
  }
}
```


### Business Domain Errors

```typescript
export class DuplicateReceiptError extends DomainError {
  code = 'DUPLICATE_RECEIPT';
  statusCode = 409;

  constructor(fileHash: string) {
    super(`Receipt with hash ${fileHash} already exists`);
    Object.setPrototypeOf(this, DuplicateReceiptError.prototype);
  }
}

export class FinancialIntegrityError extends DomainError {
  code = 'FINANCIAL_INTEGRITY_ERROR';
  statusCode = 500;

  constructor(
    message: string,
    public balanceDetails?: { totalDebit: number; totalCredit: number }
  ) {
    super(message, { balanceDetails });
    Object.setPrototypeOf(this, FinancialIntegrityError.prototype);
  }
}
```


### External Service Error

```typescript
export class ExternalServiceError extends DomainError {
  code = 'EXTERNAL_SERVICE_ERROR';
  statusCode = 502;

  constructor(
    public serviceName: string,
    message: string,
    public originalStatusCode?: number
  ) {
    super(`${serviceName} error: ${message}`);
    if (originalStatusCode === 503) this.statusCode = 503;
    if (originalStatusCode === 504) this.statusCode = 504;
    Object.setPrototypeOf(this, ExternalServiceError.prototype);
  }
}
```


### Export All

```typescript
// shared/errors/index.ts
export * from './DomainError';
export * from './ValidationError';
export * from './AuthError';
export * from './ForbiddenError';
export * from './NotFoundError';
export * from './DuplicateReceiptError';
export * from './FinancialIntegrityError';
export * from './ExternalServiceError';
```


---

## 🔧 Middleware Implementation

### 1. CorrelationId Middleware (MUST BE FIRST)

```typescript
// shared/middleware/correlationId.ts
import { v4 as uuidv4 } from 'uuid';
import { Request, Response, NextFunction } from 'express';

export const correlationIdMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Use existing correlationId from header, or generate new one
  const correlationId = 
    (req.headers['x-correlation-id'] as string) || 
    uuidv4();

  // Attach to request
  (req as any).correlationId = correlationId;

  // Return in response header
  res.setHeader('x-correlation-id', correlationId);

  next();
};
```


### 2. Request Logger Middleware

```typescript
// shared/middleware/requestLogger.ts
import { Request, Response, NextFunction } from 'express';

export const requestLoggerMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const correlationId = (req as any).correlationId || 'unknown';
  const start = Date.now();

  // Log request start
  console.log(`[${correlationId}] ${req.method} ${req.path}`, {
    method: req.method,
    path: req.path,
    query: req.query,
    ip: req.ip,
  });

  // Log response when finished
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[${correlationId}] ${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
  });

  next();
};
```


### 3. Auth Middleware

```typescript
// shared/middleware/auth.ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthError } from '@/shared/errors';

export const authMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      throw new AuthError('No token provided');
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;

    // Attach user to request
    (req as any).user = {
      id: decoded.userId,
      clientId: decoded.clientId,
      role: decoded.role,
    };

    next();
  } catch (err) {
    next(new AuthError('Invalid or expired token'));
  }
};

export const requireRole = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    
    if (!user || !roles.includes(user.role)) {
      return next(new ForbiddenError('Insufficient permissions'));
    }
    
    next();
  };
};
```


### 4. Not Found Middleware

```typescript
// shared/middleware/notFound.ts
import { Request, Response, NextFunction } from 'express';
import { NotFoundError } from '@/shared/errors';

export const notFoundMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  next(new NotFoundError('Route', req.path));
};
```


### 5. Global Error Handler (MUST BE LAST)

```typescript
// shared/middleware/globalErrorHandler.ts
import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { DomainError } from '@/shared/errors';

export const globalErrorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const correlationId = (req as any).correlationId || 'unknown';
  const isDev = process.env.NODE_ENV === 'development';

  // Handle Zod validation errors
  if (err instanceof ZodError) {
    const fieldErrors: Record<string, string[]> = {};
    err.errors.forEach((e) => {
      const field = e.path.join('.');
      if (!fieldErrors[field]) fieldErrors[field] = [];
      fieldErrors[field].push(e.message);
    });

    console.error(`[${correlationId}] VALIDATION_ERROR`, { fieldErrors });

    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        ...(isDev && { details: { fieldErrors } }),
      },
      meta: { correlationId, timestamp: new Date().toISOString() },
    });
  }

  // Handle domain errors
  if (err instanceof DomainError) {
    console.error(`[${correlationId}] ${err.code}: ${err.message}`, {
      statusCode: err.statusCode,
      details: err.details,
    });

    return res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        ...(isDev && err.details && { details: err.details }),
      },
      meta: { correlationId, timestamp: new Date().toISOString() },
    });
  }

  // Handle unknown errors (programmer bugs)
  console.error(`[${correlationId}] INTERNAL_ERROR:`, {
    message: err.message,
    stack: err.stack,
  });

  return res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: isDev ? err.message : 'An unexpected error occurred',
      ...(isDev && { stack: err.stack }),
    },
    meta: { correlationId, timestamp: new Date().toISOString() },
  });
};
```


---

## 📦 App Registration (Full Example)

```typescript
// app.ts
import express from 'express';
import {
  correlationIdMiddleware,
  requestLoggerMiddleware,
  authMiddleware,
  notFoundMiddleware,
  globalErrorHandler,
} from './shared/middleware';
import receiptRoutes from './modules/receipt/routes';
import journalRoutes from './modules/journal/routes';

const app = express();

// ============================================
// ✅ MIDDLEWARE REGISTRATION ORDER (CRITICAL)
// ============================================

// 1️⃣ CorrelationId (MUST be first)
app.use(correlationIdMiddleware);

// 2️⃣ Request logger
app.use(requestLoggerMiddleware);

// 3️⃣ Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 4️⃣ Business Routes
app.use('/api/receipts', receiptRoutes);
app.use('/api/journals', journalRoutes);
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// 5️⃣ Not Found (catch unmapped routes)
app.use(notFoundMiddleware);

// 6️⃣ Global Error Handler (MUST be last)
app.use(globalErrorHandler);

export default app;
```


---

## ✅ Review Checklist

Before committing, verify:

- [ ] **Global error handler** registered last in middleware chain
- [ ] **CorrelationId middleware** registered first
- [ ] **All controllers** propagate errors via `next(error)`
- [ ] **Domain errors** used in services (not HTTP errors)
- [ ] **Error response shape** consistent everywhere
- [ ] **Stack traces** hidden in production
- [ ] **Error logging** includes correlationId
- [ ] **Zod errors** handled separately (field-level errors)
- [ ] **Auth middleware** throws AuthError (not direct response)
- [ ] **Not Found middleware** before global error handler

---

## 🔄 Feedback \& Improvement

**If error handling fails:**

1. Check middleware order (correlationId first, error handler last)
2. Verify all controllers use `next(error)` (not try-catch-return)
3. Ensure domain errors extend DomainError class
4. Validate error response shape matches standard

**To improve this skill:**

- Add error rate limiting (prevent abuse)
- Include error alerting patterns (Slack/PagerDuty)
- Add error categorization (operational vs programmer)
- Update based on team feedback

---

## 🧪 Testing Error Handling

```typescript
import { describe, it, expect } from 'bun:test';
import request from 'supertest';
import app from './app';

describe('Error Handling', () => {
  it('should return 404 for unknown route', async () => {
    const response = await request(app)
      .get('/api/unknown-route')
      .expect(404);

    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('NOT_FOUND');
    expect(response.body.meta.correlationId).toBeDefined();
  });

  it('should return 400 for validation error', async () => {
    const response = await request(app)
      .post('/api/receipts')
      .send({ invalid: 'data' })
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('should return 409 for duplicate receipt', async () => {
    // Upload first time
    await request(app)
      .post('/api/receipts')
      .attach('file', Buffer.from('test'), 'test.pdf')
      .expect(201);

    // Upload same file again
    const response = await request(app)
      .post('/api/receipts')
      .attach('file', Buffer.from('test'), 'test.pdf')
      .expect(409);

    expect(response.body.error.code).toBe('DUPLICATE_RECEIPT');
  });
});
```


---

## 📚 Error Code Reference

| Code | HTTP | Meaning | Who Throws |
| :-- | :-- | :-- | :-- |
| `VALIDATION_ERROR` | 400 | Schema/business validation fail | Zod / Service |
| `AUTH_REQUIRED` | 401 | No/invalid JWT | Auth middleware |
| `FORBIDDEN` | 403 | Authenticated but no permission | Permission middleware |
| `NOT_FOUND` | 404 | Resource not found | Service / NotFound MW |
| `DUPLICATE_RECEIPT` | 409 | Conflict (duplicate key) | Service |
| `FINANCIAL_INTEGRITY_ERROR` | 500 | Trial balance fail | AccountingService |
| `EXTERNAL_SERVICE_ERROR` | 502/503 | External API down | Adapter |
| `INTERNAL_ERROR` | 500 | Unknown/unhandled error | Global handler |


---

## 📚 Related Skills

- **autoaccl-rest-controller** - For error propagation in controllers
- **autoaccl-service-layer** - For throwing domain errors
- **autoaccl-zod-validator** - For validation error handling

---

**Skill Maintainer:** AutoAcct Development Team
**Last Updated:** 2026-01-26T21:46:00+07:00
**Version:** 2.0.0-antigravity