# AutoAcct Skill 4 – Error Handling & Middleware

**Version:** 1.0.0  
**Category:** Backend Development  
**Stack:** TypeScript, Node.js/Bun, Express.js, MongoDB (Mongoose)  
**Project:** AutoAcct (OCR AI Auto Accounting)  
**Skill:** `.ai/skills/backend/04-error-handling-middleware.skill.md`  
**Keywords:** error handling, middleware, global error handler, domain errors, correlationId, validation, authentication, logging, Express.js

---

## 📑 1. Quick Start (30 seconds)

**Error Handling & Middleware** = ตัวท่อ (pipes) ที่เปลี่ยนค่า request + ช่องจับ error ทั้งระบบ

```typescript
// 1. Define Domain Error Base Class
export class DomainError extends Error {
  code: string = 'UNKNOWN_ERROR';
  statusCode: number = 500;
  isOperational: boolean = true; // ❌ false = programmer bug

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

// 2. Global Error Handler (Express middleware)
export const globalErrorHandler = (
  err: any,
  req: any,
  res: any,
  next: any
) => {
  const statusCode = err.statusCode || 500;
  const code = err.code || 'INTERNAL_ERROR';
  const correlationId = req.correlationId || 'unknown';

  // Log error
  console.error(`[${correlationId}] ${code}: ${err.message}`, {
    statusCode,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });

  // Return error response
  res.status(statusCode).json({
    success: false,
    error: {
      code,
      message: err.message,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    },
    meta: {
      correlationId,
      timestamp: new Date().toISOString(),
    },
  });
};

// 3. Middleware Registration Order (CRITICAL!)
import express from 'express';

const app = express();

// ✅ 1. CorrelationId middleware (first)
app.use(correlationIdMiddleware);

// ✅ 2. Request logger
app.use(requestLoggerMiddleware);

// ✅ 3. Body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ✅ 4. Routes
app.post('/api/receipts', receiptController.upload);

// ✅ 5. Not Found handler
app.use(notFoundMiddleware);

// ✅ 6. Global Error Handler (last)
app.use(globalErrorHandler);
```

**ผลลัพธ์ error response:**

```json
{
  "success": false,
  "error": {
    "code": "DUPLICATE_RECEIPT",
    "message": "Receipt with hash abc123... already exists"
  },
  "meta": {
    "correlationId": "corr-req-12345",
    "timestamp": "2026-01-26T20:42:00.000Z"
  }
}
```

**นี่คือ Error Handling & Middleware แล้ว ✅**

---

## 📖 2. Description

**Error Handling & Middleware** = ระบบที่ตัดสินใจ:

- 🔀 **Request mapping** – เพิ่ม context (correlationId, user, logging)
- 📝 **Validation** – ตรวจสอบ input ก่อนส่งไป business logic
- 🚨 **Error catching** – จับ error จาก service/controller ทั้งหมด
- 📤 **Consistent response** – ส่ง error กลับ client ในรูปแบบเดียว

### ความสัมพันธ์กับ Skills อื่น:

```
Request
  ↓
Skill 4 (Middleware): CorrelationId, Logger, Auth, Validation
  ↓
Skill 1 (Controller): Extract input, call service
  ↓
Skill 3 (Service): Business logic, throw domain errors
  ↓
Skill 4 (Error Handler): Catch error, map to HTTP, respond
```

### ลักษณะเฉพาะใน AutoAcct:

- ✅ **Single global error handler** – ไม่ duplicate error response logic
- ✅ **Domain-first errors** – Services โยน DomainError, handler map → HTTP
- ✅ **No sensitive data in Prod** – Stack trace เฉพาะ dev mode
- ✅ **CorrelationId everywhere** – ทุก log, ทุก error response มี correlationId
- ✅ **Financial safety** – FINANCIAL_INTEGRITY_ERROR → 500 + immediate alert

---

## 🎯 3. When to Use This Skill

### ใช้ Error Handling & Middleware เมื่อ:

| Scenario | ใช้? | ทำไง |
|----------|------|------|
| Duplicate receipt upload | ✅ | ReceiptService throws DuplicateReceiptError → handler map 409 |
| Zod validation fail | ✅ | Validation middleware → throw ValidationError → 400 |
| Unauthorized access (no JWT) | ✅ | Auth middleware → throw AuthError → 401 |
| Forbidden (auth but no permission) | ✅ | Permission middleware → throw ForbiddenError → 403 |
| Medici ledger down | ✅ | MedicerAdapter throws ExternalServiceError → 502 |
| Trail balance fail | ✅ | AccountingService throws FinancialIntegrityError → 500 + alert |
| Route not found | ✅ | NotFound middleware → throw NotFoundError → 404 |
| Uncaught null pointer in service | ✅ | Global error handler → catch → INTERNAL_ERROR → 500 |

---

## 🔧 4. Prerequisites & Setup

### Assume ว่ามี:

- ✅ Skill 1 – REST Controller Pattern
- ✅ Skill 2 – Zod Validator Pattern
- ✅ Skill 3 – Service Layer Pattern
- ✅ Express app skeleton
- ✅ ConfigManager (dev vs prod mode)

### โครงสร้างแนะนำ:

```text
backend/src/
├── shared/
│   ├── errors/
│   │   ├── DomainError.ts          ← Base class
│   │   ├── ValidationError.ts
│   │   ├── AuthError.ts
│   │   ├── ForbiddenError.ts
│   │   ├── NotFoundError.ts
│   │   ├── DuplicateReceiptError.ts
│   │   ├── FinancialIntegrityError.ts
│   │   ├── ExternalServiceError.ts
│   │   └── index.ts                ← export all
│   └── middleware/
│       ├── correlationId.ts
│       ├── requestLogger.ts
│       ├── zodValidator.ts
│       ├── authMiddleware.ts
│       ├── permissionMiddleware.ts
│       ├── notFound.ts
│       ├── globalErrorHandler.ts
│       └── index.ts                ← export all
├── modules/
│   └── receipt/
│       ├── controllers/
│       │   └── ReceiptController.ts
│       ├── services/
│       │   └── ReceiptService.ts
│       └── validators/
│           └── receipt.validators.ts
├── app.ts                          ← Middleware registration
└── config/
    └── AppConfig.ts
```

---

## 🏗️ 5. Core Principles (MANDATORY)

### 5.1 Single Global Error Handler

**Rule:** Express ต้องมี global error handler middleware เดียว ที่อยู่ท้ายสุด

**เหตุผล:**
- 🔄 **Centralized** – error ทั้งหมดผ่านจุดเดียว
- 📊 **Consistent** – response shape เดียว ทั้งระบบ
- 📝 **Observable** – ทุก error log ที่เดียว (สำหรับ monitoring/alerting)

```typescript
// ❌ ผิด – Error handling ใน controller
export class ReceiptController {
  async upload(req, res, next) {
    try {
      const receipt = await this.receiptService.uploadReceipt(...);
      res.status(201).json({ success: true, data: receipt });
    } catch (err) {
      // ❌ Duplicate logic ถ้าเขียนแบบนี้ทุก controller
      res.status(err.statusCode || 500).json({
        success: false,
        error: { code: err.code || 'ERROR', message: err.message },
      });
    }
  }
}

// ✅ ถูก – Error ส่งต่อให้ global handler
export class ReceiptController {
  async upload(req, res, next) {
    try {
      const receipt = await this.receiptService.uploadReceipt(...);
      res.status(201).json({ success: true, data: receipt });
    } catch (err) {
      next(err); // ✅ Let global handler take care
    }
  }
}
```

### 5.2 Domain Errors First, HTTP Second

**Rule:** Business logic โยน DomainError; global handler map → HTTP status + JSON

**ทำไม:**
- Service ไม่ต้องรู้ HTTP (reusable)
- HTTP mapping เป็นหน้าที่ของ handler (ศูนย์กลางเดียว)

```typescript
// ✅ Service throws domain error
export class ReceiptService {
  async uploadReceipt(..., correlationId) {
    const existing = await Receipt.findOne({ fileHash, clientId });
    if (existing) {
      throw new DuplicateReceiptError(fileHash);
      // ☝️ ไม่รู้เลยว่า HTTP 409 อะไรพวกนี้
    }
  }
}

// ✅ Global handler maps domain → HTTP
export const globalErrorHandler = (err, req, res, next) => {
  if (err instanceof DuplicateReceiptError) {
    return res.status(err.statusCode).json({
      success: false,
      error: { code: err.code, message: err.message },
    });
  }
  // ... map other errors ...
};
```

### 5.3 No Stack Traces in Production

**Rule:**
- `NODE_ENV=development`: ส่ง stack trace + details
- `NODE_ENV=production`: เฉพาะ message (ไม่เปิดเผย internals)

```typescript
export const globalErrorHandler = (err, req, res, next) => {
  const isDev = process.env.NODE_ENV === 'development';

  const response = {
    success: false,
    error: {
      code: err.code || 'INTERNAL_ERROR',
      message: err.message,
      // ✅ Stack เฉพาะ dev
      ...(isDev && { stack: err.stack }),
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

### 5.4 Consistent Error Shape

**Rule:** ทุก error response ต้องมีลักษณะเดียว (schema):

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
```

### 5.5 Middleware Ordering is Critical

**Rule:** ลำดับนี้ห้ามเปลี่ยน!

```typescript
// ✅ Correct order
app.use(correlationIdMiddleware);        // 1. ต้อง first เพื่อให้มี correlationId สำหรับ log ทั้งหมด
app.use(requestLoggerMiddleware);        // 2. Log ทุก request
app.use(express.json());                 // 3. Parse body
app.use(authMiddleware);                 // 4. Verify JWT/session
app.use(zodValidatorMiddleware);         // 5. Validate input
app.use('/api', routes);                 // 6. Business routes
app.use(notFoundMiddleware);             // 7. Catch 404
app.use(globalErrorHandler);             // 8. Catch all errors
```

### 5.6 Operational vs Programmer Errors

**Rule:** Distinguish ระหว่าง:

- **Operational Errors** – คาดการณ์ได้ (validation fail, not found, duplicate)
  - `isOperational = true`
  - ส่งให้ client ได้
- **Programmer Errors** – bug (null dereference, logic bug)
  - `isOperational = false`
  - ไม่ส่ง client, log + alert

```typescript
export class DomainError extends Error {
  code: string = 'UNKNOWN_ERROR';
  statusCode: number = 500;
  isOperational: boolean = true;  // ✅ Known error, safe to send to client

  constructor(message: string) {
    super(message);
  }
}

// Global handler
export const globalErrorHandler = (err, req, res, next) => {
  if (err.isOperational === false) {
    // Programmer error - log severity, don't leak details
    console.error('PROGRAMMER ERROR:', err);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred. Please contact support.',
      },
    });
  }

  // Operational error - safe to send
  res.status(err.statusCode || 500).json({
    success: false,
    error: { code: err.code, message: err.message },
  });
};
```

---

## 6. Global Error Model & Error Response Schema

### 6.1 Error Response JSON Shape (EXACT)

```typescript
// Success response (for reference)
{
  "success": true,
  "data": { /* ... */ },
  "meta": {
    "correlationId": "corr-req-abc123",
    "timestamp": "2026-01-26T20:42:00.000Z"
  }
}

// Error response (what Skill 4 handles)
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",        // UPPER_SNAKE_CASE
    "message": "Field 'amount' must be > 0",
    "details": {                       // Optional, dev-only
      "fieldErrors": {
        "amount": ["Must be > 0"]
      }
    },
    "stack": "Error: ...\n    at..."  // Optional, dev-only
  },
  "meta": {
    "correlationId": "corr-req-abc123",
    "timestamp": "2026-01-26T20:42:00.000Z"
  }
}
```

### 6.2 Error Code Naming Convention

| Code | HTTP | Meaning | ใครโยน |
|------|------|---------|--------|
| `VALIDATION_ERROR` | 400 | Schema/business validation fail | Zod / service |
| `AUTH_REQUIRED` | 401 | No/invalid JWT | Auth middleware |
| `FORBIDDEN` | 403 | Authenticated but no permission | Permission middleware |
| `NOT_FOUND` | 404 | Resource not found | Service / NotFound MW |
| `DUPLICATE_RECEIPT` | 409 | Conflict (duplicate key) | Service |
| `FINANCIAL_INTEGRITY_ERROR` | 500 | Trial balance fail | AccountingService |
| `EXTERNAL_SERVICE_ERROR` | 502/503 | External API down (Medici/Groq/Teable) | Adapter |
| `INTERNAL_ERROR` | 500 | Unknown/unhandled error | Global handler |

---

## 7. Domain Error Classes (Full Implementation)

### 7.1 Base DomainError Class

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

### 7.2 Validation Error

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

### 7.3 Auth & Permission Errors

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

### 7.4 Not Found Error

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

### 7.5 Business Domain Errors

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
  isOperational = true;  // Operational error (not a bug)

  constructor(
    message: string,
    public balanceDetails?: {
      totalDebit: number;
      totalCredit: number;
    }
  ) {
    super(message, { balanceDetails });
    Object.setPrototypeOf(this, FinancialIntegrityError.prototype);
  }
}
```

### 7.6 External Service Error

```typescript
export class ExternalServiceError extends DomainError {
  code = 'EXTERNAL_SERVICE_ERROR';
  statusCode = 502; // Bad Gateway (default)

  constructor(
    public serviceName: string,
    message: string,
    public originalStatusCode?: number,
    public rawResponse?: any
  ) {
    super(`${serviceName} error: ${message}`);
    // Adjust statusCode based on external response
    if (originalStatusCode === 503) this.statusCode = 503; // Service Unavailable
    if (originalStatusCode === 504) this.statusCode = 504; // Gateway Timeout
    Object.setPrototypeOf(this, ExternalServiceError.prototype);
  }
}
```

### 7.7 Export All (index.ts)

```typescript
// shared/errors/index.ts
export {
  DomainError,
  ValidationError,
  AuthError,
  ForbiddenError,
  NotFoundError,
  DuplicateReceiptError,
  FinancialIntegrityError,
  ExternalServiceError,
};
```

---

## 8. Express Middleware – Full Implementation

### 8.1 CorrelationId Middleware

```typescript
// shared/middleware/correlationId.ts
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

export const correlationIdMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // ✅ Read from header atau generate baru
  const correlationId =
    (req.get('X-Correlation-Id') as string) || uuidv4();

  // ✅ Attach ke request
  (req as any).correlationId = correlationId;

  // ✅ Attach ke response locals (สำหรับ service access)
  res.locals.correlationId = correlationId;

  // ✅ Include di response headers
  res.setHeader('X-Correlation-Id', correlationId);

  next();
};
```

### 8.2 Request Logger Middleware

```typescript
// shared/middleware/requestLogger.ts
import { Request, Response, NextFunction } from 'express';
import winston from 'winston'; // or your logger

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format:
    process.env.NODE_ENV === 'production'
      ? winston.format.json()
      : winston.format.simple(),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/app.log' }),
  ],
});

export const requestLoggerMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const startTime = Date.now();
  const correlationId = (req as any).correlationId;

  // ✅ Log incoming request
  logger.info(`[${correlationId}] ${req.method} ${req.path}`, {
    correlationId,
    method: req.method,
    path: req.path,
    query: req.query,
    body: req.body, // ⚠️ Mask sensitive fields (password, token)
  });

  // ✅ Intercept response to log on completion
  const originalJson = res.json.bind(res);
  res.json = function (data: any) {
    const duration = Date.now() - startTime;

    logger.info(`[${correlationId}] Response sent`, {
      correlationId,
      statusCode: res.statusCode,
      duration,
      method: req.method,
      path: req.path,
    });

    return originalJson(data);
  };

  next();
};
```

### 8.3 Zod Validator Middleware

```typescript
// shared/middleware/zodValidator.ts
import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { ValidationError } from '../errors';

export const zodValidator =
  (schema: ZodSchema, source: 'body' | 'params' | 'query' = 'body') =>
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = req[source];
      const validated = schema.parse(data);

      // ✅ Attach validated data back
      if (source === 'body') req.body = validated;
      if (source === 'params') req.params = validated as any;
      if (source === 'query') req.query = validated as any;

      next();
    } catch (err) {
      if (err instanceof ZodError) {
        // ✅ Format Zod errors
        const fieldErrors: Record<string, string[]> = {};
        err.errors.forEach((error) => {
          const path = error.path.join('.');
          if (!fieldErrors[path]) fieldErrors[path] = [];
          fieldErrors[path].push(error.message);
        });

        // ✅ Throw ValidationError (caught by global handler)
        throw new ValidationError('Validation failed', fieldErrors);
      }

      throw err;
    }
  };

// Usage in controller:
// router.post(
//   '/receipts',
//   zodValidator(uploadReceiptSchema, 'body'),
//   receiptController.upload
// );
```

### 8.4 Auth Middleware

```typescript
// shared/middleware/authMiddleware.ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthError } from '../errors';

export const authMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const correlationId = (req as any).correlationId;
    const authHeader = req.get('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AuthError('Missing or invalid Authorization header');
    }

    const token = authHeader.slice(7);

    // ✅ Verify JWT
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET!
    ) as any;

    // ✅ Attach user info
    (req as any).user = {
      id: decoded.sub,
      clientId: decoded.clientId,
      role: decoded.role,
    };

    next();
  } catch (err) {
    if (err instanceof jwt.JsonWebTokenError) {
      throw new AuthError('Invalid token');
    }
    throw err;
  }
};
```

### 8.5 Not Found Middleware

```typescript
// shared/middleware/notFound.ts
import { Request, Response, NextFunction } from 'express';
import { NotFoundError } from '../errors';

export const notFoundMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  throw new NotFoundError('Route', `${req.method} ${req.path}`);
};
```

### 8.6 Global Error Handler (THE MAIN EVENT)

```typescript
// shared/middleware/globalErrorHandler.ts
import { Request, Response, NextFunction } from 'express';
import {
  DomainError,
  ValidationError,
  FinancialIntegrityError,
  ExternalServiceError,
} from '../errors';
import winston from 'winston';

const logger = winston.createLogger({
  level: 'error',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'logs/errors.log' }),
  ],
});

export const globalErrorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const correlationId = (req as any).correlationId || 'unknown';
  const isDev = process.env.NODE_ENV === 'development';

  // ❌ Programmer error (not operational)
  if (err.isOperational === false) {
    logger.error(`[${correlationId}] PROGRAMMER ERROR`, {
      correlationId,
      message: err.message,
      stack: err.stack,
      url: req.originalUrl,
      method: req.method,
    });

    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred. Please contact support.',
      },
      meta: {
        correlationId,
        timestamp: new Date().toISOString(),
      },
    });
  }

  // ✅ Operational errors

  let statusCode = 500;
  let code = 'INTERNAL_ERROR';
  let message = 'An error occurred';
  let details: any = undefined;

  // Map specific domain errors
  if (err instanceof ValidationError) {
    statusCode = 400;
    code = 'VALIDATION_ERROR';
    message = err.message;
    details = err.fieldErrors;
  } else if (err instanceof FinancialIntegrityError) {
    statusCode = 500;
    code = 'FINANCIAL_INTEGRITY_ERROR';
    message = err.message;
    details = err.balanceDetails;

    // ⚠️ Alert on financial integrity error
    logger.error(`[${correlationId}] FINANCIAL INTEGRITY VIOLATION`, {
      correlationId,
      message,
      details,
    });
  } else if (err instanceof ExternalServiceError) {
    statusCode = err.statusCode;
    code = 'EXTERNAL_SERVICE_ERROR';
    message = err.message;
  } else if (err instanceof DomainError) {
    statusCode = err.statusCode;
    code = err.code;
    message = err.message;
    details = err.details;
  }

  // Log error
  const logLevel =
    statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';
  logger[logLevel](`[${correlationId}] ${code}: ${message}`, {
    correlationId,
    statusCode,
    code,
    url: req.originalUrl,
    method: req.method,
    userId: (req as any).user?.id,
    stack: isDev ? err.stack : undefined,
  });

  // Build response
  const response: any = {
    success: false,
    error: {
      code,
      message,
      ...(isDev && details && { details }),
      ...(isDev && { stack: err.stack }),
    },
    meta: {
      correlationId,
      timestamp: new Date().toISOString(),
    },
  };

  res.status(statusCode).json(response);
};

// ✅ Export middleware factory
export const setupErrorHandling = (app: any) => {
  app.use(globalErrorHandler);
};
```

---

## 9. App Initialization & Middleware Registration

### 9.1 Correct Registration Order

```typescript
// app.ts
import express, { Request, Response, NextFunction } from 'express';
import { Logger } from './shared/logger';
import {
  correlationIdMiddleware,
  requestLoggerMiddleware,
  zodValidator,
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

// 1️⃣ CorrelationId (must be first)
app.use(correlationIdMiddleware);

// 2️⃣ Request logger
app.use(requestLoggerMiddleware);

// 3️⃣ Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 4️⃣ Authentication (optional, depends on routes)
app.use((req: Request, res: Response, next: NextFunction) => {
  // Some routes are public, some require auth
  // Better approach: use route-level middleware
  next();
});

// 5️⃣ Business Routes
app.use('/api/receipts', receiptRoutes);
app.use('/api/journals', journalRoutes);
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// 6️⃣ Not Found (catch unmapped routes)
app.use(notFoundMiddleware);

// 7️⃣ Global Error Handler (MUST be last)
app.use(globalErrorHandler);

export default app;
```

### 9.2 Route-Level Middleware Registration

```typescript
// modules/receipt/routes.ts
import { Router } from 'express';
import { authMiddleware } from '../../shared/middleware';
import { zodValidator } from '../../shared/middleware';
import { uploadReceiptSchema } from './validators';
import { ReceiptController } from './controllers/ReceiptController';

const router = Router();
const controller = new ReceiptController();

// ✅ Only authenticated users can upload receipts
router.post(
  '/upload',
  authMiddleware,
  zodValidator(uploadReceiptSchema, 'body'),
  (req, res, next) => controller.upload(req, res, next)
);

// ✅ Only authenticated users can list receipts
router.get(
  '/',
  authMiddleware,
  (req, res, next) => controller.list(req, res, next)
);

// ✅ Public health check (no auth)
router.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

export default router;
```

---

## 10. How Controllers Use Error Handling

```typescript
// modules/receipt/controllers/ReceiptController.ts
import { Request, Response, NextFunction } from 'express';
import { ReceiptService } from '../services/ReceiptService';
import { Logger } from '../../../shared/logger';

export class ReceiptController {
  constructor(
    private receiptService: ReceiptService,
    private logger: Logger
  ) {}

  async upload(req: Request, res: Response, next: NextFunction) {
    try {
      // ✅ All input already validated by middleware
      const correlationId = (req as any).correlationId;
      const clientId = (req as any).user.clientId;
      const file = req.file;

      this.logger.info(`[${correlationId}] Uploading receipt`, {
        clientId,
        fileName: file?.originalname,
      });

      // ✅ Call service (may throw DomainError)
      const receipt = await this.receiptService.uploadReceipt(
        file!.buffer,
        file!.originalname,
        file!.mimetype,
        clientId,
        correlationId
      );

      // ✅ Return success
      res.status(201).json({
        success: true,
        data: {
          receiptId: receipt.id,
          status: receipt.status,
        },
        meta: {
          correlationId,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (err) {
      // ✅ ALL ERRORS go to global handler
      next(err);
    }
  }

  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const correlationId = (req as any).correlationId;
      const clientId = (req as any).user.clientId;
      const limit = Number(req.query.limit) || 10;
      const offset = Number(req.query.offset) || 0;

      const receipts = await this.receiptService.listReceipts(
        clientId,
        limit,
        offset,
        correlationId
      );

      res.json({
        success: true,
        data: {
          receipts,
          pagination: { limit, offset },
        },
        meta: {
          correlationId,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (err) {
      next(err);
    }
  }
}
```

---

## 11. Dev vs Prod Error Behavior

### 11.1 Development Mode (NODE_ENV=development)

**Goal:** Maximum visibility for debugging

```json
{
  "success": false,
  "error": {
    "code": "FINANCIAL_INTEGRITY_ERROR",
    "message": "Trial balance not zero before posting. Debit: 50000, Credit: 45000",
    "details": {
      "totalDebit": 50000,
      "totalCredit": 45000
    },
    "stack": "Error: Trial balance not zero before posting...\n    at AccountingService.postEntry (src/modules/accounting/services/AccountingService.ts:123:15)\n    at async AccountingController.post (src/modules/accounting/controllers/..."
  },
  "meta": {
    "correlationId": "corr-req-12345",
    "timestamp": "2026-01-26T20:42:00.000Z"
  }
}
```

### 11.2 Production Mode (NODE_ENV=production)

**Goal:** Security + minimal info leakage

```json
{
  "success": false,
  "error": {
    "code": "FINANCIAL_INTEGRITY_ERROR",
    "message": "Financial integrity violation. Please contact support."
  },
  "meta": {
    "correlationId": "corr-req-12345",
    "timestamp": "2026-01-26T20:42:00.000Z"
  }
}
```

### 11.3 Implementation

```typescript
export const globalErrorHandler = (err, req, res, next) => {
  const isDev = process.env.NODE_ENV === 'development';
  const correlationId = (req as any).correlationId;

  let message = err.message;

  // ✅ Prod: sanitize sensitive messages
  if (!isDev) {
    if (
      message.includes('password') ||
      message.includes('token') ||
      message.includes('secret')
    ) {
      message = 'Authentication error';
    }
  }

  const response = {
    success: false,
    error: {
      code: err.code || 'INTERNAL_ERROR',
      message,
      ...(isDev && err.details && { details: err.details }),
      ...(isDev && { stack: err.stack }),
    },
    meta: {
      correlationId,
      timestamp: new Date().toISOString(),
    },
  };

  res.status(err.statusCode || 500).json(response);
};
```

---

## 12. Monitoring & Alerting

### 12.1 Error Aggregation for Observability

```typescript
export const globalErrorHandler = (err, req, res, next) => {
  const correlationId = (req as any).correlationId;
  const code = err.code || 'INTERNAL_ERROR';

  // ✅ Log to structured logging system (Loki, CloudWatch, etc)
  const errorLog = {
    level: 'error',
    timestamp: new Date().toISOString(),
    correlationId,
    errorCode: code,
    message: err.message,
    service: 'auto-acct-backend',
    module: req.baseUrl,
    userId: (req as any).user?.id,
    statusCode: err.statusCode || 500,
  };

  // Send to logging service
  sendToLoggingService(errorLog);

  // ... rest of error handling
};
```

### 12.2 Critical Error Alerting Rules

```typescript
// Critical: FinancialIntegrityError → immediate alert
if (code === 'FINANCIAL_INTEGRITY_ERROR') {
  alerting.critical(
    `Financial integrity violation detected [${correlationId}]`,
    {
      details: err.details,
      userId: (req as any).user?.id,
    }
  );
}

// Warning: ExternalServiceError on Medici
if (code === 'EXTERNAL_SERVICE_ERROR' && err.serviceName === 'Medici') {
  alerting.warning(`Medici ledger connection failed`, {
    correlationId,
    statusCode: err.originalStatusCode,
  });
}

// Error: Multiple validation errors from single user
// (could indicate attack)
if (code === 'VALIDATION_ERROR') {
  incrementErrorMetric(`validation_error_${(req as any).user?.id}`);
  if (getErrorMetric() > 10) {
    alerting.warning(`High validation error rate detected`);
  }
}
```

---

## 13. Testing Error Handling

```typescript
import request from 'supertest';
import app from '../app';
import { DuplicateReceiptError } from '../shared/errors';

describe('Error Handling & Middleware', () => {
  describe('CorrelationId', () => {
    it('should generate correlationId if not provided', async () => {
      const res = await request(app)
        .post('/api/receipts/upload')
        .expect(401); // Auth required

      expect(res.headers['x-correlation-id']).toBeDefined();
      expect(res.body.meta.correlationId).toBeDefined();
    });

    it('should use provided correlationId', async () => {
      const customId = 'custom-corr-123';
      const res = await request(app)
        .post('/api/receipts/upload')
        .set('X-Correlation-Id', customId)
        .expect(401);

      expect(res.headers['x-correlation-id']).toBe(customId);
      expect(res.body.meta.correlationId).toBe(customId);
    });
  });

  describe('Validation Error', () => {
    it('should return 400 on validation failure', async () => {
      const res = await request(app)
        .post('/api/receipts/upload')
        .set('Authorization', `Bearer ${validJwt}`)
        .field('amount', 'not-a-number') // Invalid
        .expect(400);

      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.details.fieldErrors).toBeDefined();
    });
  });

  describe('Not Found', () => {
    it('should return 404 for unmapped routes', async () => {
      const res = await request(app)
        .get('/api/unknown-route')
        .expect(404);

      expect(res.body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('Domain Errors', () => {
    it('should return 409 on duplicate receipt', async () => {
      // First upload
      await request(app)
        .post('/api/receipts/upload')
        .set('Authorization', `Bearer ${validJwt}`)
        .attach('file', testFilePath)
        .expect(201);

      // Second upload (same file)
      const res = await request(app)
        .post('/api/receipts/upload')
        .set('Authorization', `Bearer ${validJwt}`)
        .attach('file', testFilePath)
        .expect(409);

      expect(res.body.error.code).toBe('DUPLICATE_RECEIPT');
    });
  });

  describe('Global Error Handler', () => {
    it('should catch unhandled errors', async () => {
      // Mock service to throw unknown error
      jest
        .spyOn(receiptService, 'uploadReceipt')
        .mockRejectedValue(new Error('Unknown error'));

      const res = await request(app)
        .post('/api/receipts/upload')
        .set('Authorization', `Bearer ${validJwt}`)
        .attach('file', testFilePath)
        .expect(500);

      expect(res.body.error.code).toBe('INTERNAL_ERROR');
      expect(res.body.error.message).toBe(
        'An unexpected error occurred. Please contact support.'
      );
    });

    it('should not include stack trace in production', async () => {
      process.env.NODE_ENV = 'production';

      const res = await request(app)
        .get('/api/unknown')
        .expect(404);

      expect(res.body.error.stack).toBeUndefined();

      process.env.NODE_ENV = 'development';
    });

    it('should include stack trace in development', async () => {
      process.env.NODE_ENV = 'development';

      const res = await request(app)
        .get('/api/unknown')
        .expect(404);

      expect(res.body.error.stack).toBeDefined();
    });
  });
});
```

---

## 14. Common Anti-Patterns (AVOID!)

| ❌ Anti-Pattern | ✅ Solution |
|------------------|------------|
| `res.status(...).json(...)` ใน controller ทุกที่ | Use global error handler via `next(err)` |
| `console.log()` error ไม่มี correlationId | Always include `[${correlationId}]` ใน log |
| Throw string (`throw 'error'`) | Throw DomainError instance |
| ส่ง stack trace ใน production | Check `NODE_ENV !== 'production'` before sending |
| Middleware order สุ่ม | Use exact order: correlationId → logger → body → auth → validation → routes → 404 → error handler |
| Gullible error handling ใน middleware | Use try-catch, call `next(err)` consistently |
| Multiple global error handlers | Use ONE handler at the end |

---

## 15. Review Checklist

ก่อน merge PR ให้ถาม:

- [ ] มี global error handler middleware เดียวที่ท้าย app.ts ไหม?
- [ ] ทุก error response มี success: false + error.code + correlationId ไหม?
- [ ] ทุก error ที่ throw มาจาก service เป็น DomainError ไหม?
- [ ] Middleware order ตรง: correlationId → logger → body → auth → routes → 404 → error handler?
- [ ] Validation errors ใช้ ValidationError (ไม่ใช้ 500)?
- [ ] Financial errors ใช้ FinancialIntegrityError + alert?
- [ ] Prod ไม่มี stack trace / sensitive info ไหม?
- [ ] Test coverage สำหรับ 3+ error scenarios?
- [ ] Error code naming ใช้ UPPER_SNAKE_CASE ทั้งหมด?

---

## 16. Glossary

- **DomainError** – Base class สำหรับ business logic errors
- **Global Error Handler** – Middleware ตัวเดียวที่จับ error ทั้งระบบ
- **Operational Error** – คาดการณ์ได้, safe to send to client
- **Programmer Error** – Bug, ไม่ควรส่ง client
- **CorrelationId** – Request ID สำหรับ tracing
- **Middleware** – Function 3 args (req, res, next) หรือ 4 args error handler
- **Error Mapping** – Map domain error → HTTP status + JSON shape

---

## 17. Related Skills & Docs

- **Skill 1** – REST Controller Pattern
- **Skill 2** – Zod Validator Pattern
- **Skill 3** – Service Layer Pattern
- **Vol 2A** – Controllers & Services
- **Vol 2B** – Integrations (Medici/Groq/Teable errors)
- **Vol 2C** – DevOps & Deployment (logging/monitoring setup)

---

## 21. Mock Error Handlers for Dev Mode

**Purpose:** Test error paths locally without hitting production errors

```typescript
// shared/middleware/mockErrorMiddleware.ts
export const mockErrorMiddleware = (
  req: any,
  res: any,
  next: any
) => {
  const correlationId = req.correlationId;

  // ✅ Trigger specific errors via query param (dev-only)
  if (process.env.NODE_ENV === 'development') {
    if (req.query.triggerDuplicate === 'true') {
      throw new DuplicateReceiptError('mock-hash-123');
    }

    if (req.query.triggerValidation === 'true') {
      throw new ValidationError('Mock validation error', {
        amount: ['Must be > 0'],
      });
    }

    if (req.query.triggerFinancial === 'true') {
      throw new FinancialIntegrityError('Mock trial balance fail', {
        totalDebit: 50000,
        totalCredit: 45000,
      });
    }

    if (req.query.triggerExternal === 'true') {
      throw new ExternalServiceError(
        'MockMedici',
        'Service unavailable',
        503
      );
    }
  }

  next();
};

// Usage in app.ts (dev-only):
// if (process.env.NODE_ENV === 'development') {
//   app.use(mockErrorMiddleware);
// }
```

---

## 22. Real Error Handlers for Production

**Purpose:** Production-grade error handling with monitoring integration

```typescript
// shared/middleware/productionErrorHandler.ts
import { Request, Response, NextFunction } from 'express';
import { DomainError } from '../errors';
import axios from 'axios';

const SLACK_WEBHOOK = process.env.SLACK_WEBHOOK_URL;
const DATADOG_API_KEY = process.env.DATADOG_API_KEY;

export const productionErrorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const correlationId = (req as any).correlationId;
  const code = err.code || 'INTERNAL_ERROR';
  const statusCode = err.statusCode || 500;

  // ✅ Log to centralized system (Datadog)
  const payload = {
    timestamp: Date.now(),
    correlationId,
    errorCode: code,
    statusCode,
    message: err.message,
    service: 'auto-acct-backend',
    environment: 'production',
    userId: (req as any).user?.id,
    endpoint: req.originalUrl,
  };

  // Send to Datadog
  axios.post(`https://api.datadoghq.com/api/v2/logs`, payload, {
    headers: { 'DD-API-KEY': DATADOG_API_KEY },
  }).catch(console.error);

  // ✅ Alert on critical errors
  if (code === 'FINANCIAL_INTEGRITY_ERROR') {
    axios.post(SLACK_WEBHOOK!, {
      text: `🚨 CRITICAL: Financial integrity violation [${correlationId}]`,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Financial Integrity Error*\n\`${err.message}\`\n<https://monitoring.example.com/?corr=${correlationId}|View Details>`,
          },
        },
      ],
    }).catch(console.error);
  }

  // ✅ Return sanitized response (no stack/details)
  res.status(statusCode).json({
    success: false,
    error: {
      code,
      message:
        statusCode >= 500
          ? 'An unexpected error occurred. Please contact support.'
          : err.message,
    },
    meta: {
      correlationId,
      timestamp: new Date().toISOString(),
    },
  });
};
```

---

## 📝 23. Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-01-26 | Initial Error Handling & Middleware Skill (23 sections) |

---

**🎯 Error Handling & Middleware ตั้งไว้สำเร็จ! ✅**
