# **SKILL 2: AutoAcct Zod Validator (Antigravity Edition)**

name: autoaccl-zod-validator
version: 2.0.0-antigravity
category: backend-development
stack: [zod, typescript, bun]
project: autoaccl
last_updated: 2026-01-26T21:38:00+07:00
---

# AutoAcct Zod Validator Skill

**Natural Language Triggers:**
- "create validator for"
- "add zod schema"
- "validate input"
- "type-safe schema"
- "MoneyInt validation"

---

## 📖 What This Skill Does

Creates **production-ready Zod schemas** for AutoAcct with:
- ✅ **MoneyInt validation** (Integer Satang - Golden Rule #1)
- ✅ **Type inference** (TypeScript types from schemas)
- ✅ **Composable patterns** (reuse via .extend(), .pick(), .omit())
- ✅ **Clear error messages** (user-friendly, actionable)
- ✅ **AutoAcct-specific validators** (UUID, Thai Tax ID, Date Range)

**Philosophy:** Validators are the first line of defense against invalid data.

**Currency Note:** AutoAcct v1.0 is **THB-only** (Thai Baht). All monetary values use **Satang** (1 THB = 100 Satang).

---

## 🎯 When to Use

**Use when:**
- Creating API endpoints that accept user input
- Building forms (frontend & backend validation)
- Processing external data (OCR results, webhooks, CSV imports)
- Need TypeScript type inference from runtime validation

**Don't use when:**
- Simple compile-time type checks (use plain TypeScript interfaces)
- Performance-critical hot paths (validate once, cache result)
- Runtime data transformations (use Service layer)
- Complex business rules (use Service layer with domain logic)

---

## 🚀 Quick Start (30 seconds)

```typescript
// 1. Install Zod
bun add zod

// 2. Create your first schema
import { z } from 'zod';

const userSchema = z.object({
  name: z.string().min(3, 'Name must be at least 3 characters'),
  email: z.string().email('Please enter a valid email'),
  age: z.number().int().min(18, 'You must be 18 or older'),
});

// 3. Validate data
const result = userSchema.parse({
  name: "John Doe",
  email: "john@example.com",
  age: 25
});

// 4. Get TypeScript types for FREE
type User = z.infer<typeof userSchema>;
// = { name: string; email: string; age: number; }
```

**That's it! You're ready to use Zod in AutoAcct.** ✅

---

## 🏗️ Core Principles (MANDATORY)

### 1. MoneyInt Validation (Golden Rule \#1) ⚠️

**THE CRITICAL RULE:** All monetary values MUST be stored and validated as **Integer Satang**, never as floating-point numbers.

#### Why This Exists (First Principles)

**The Problem:**

```javascript
// ❌ Floating point arithmetic is UNRELIABLE
0.1 + 0.2  // = 0.30000000000000004 (not 0.3!)

// Real AutoAcct scenario:
let itemPrice = 10.1;      // 10.10 THB
let quantity = 3;
let total = itemPrice * quantity;  // 30.299999999999997 THB ❌ WRONG!
```

**The Solution:**

```typescript
// ✅ CORRECT - Use integer Satang
const itemPrice = 1010;        // 10.10 THB as 1010 Satang
const quantity = 3;
const total = itemPrice * quantity;  // 3030 Satang = 30.30 THB ✓ PERFECT!
```


#### MoneyInt Schema (MANDATORY)

```typescript
/**
 * MoneyInt Schema - GOLDEN RULE #1
 * 
 * Validates monetary amounts as Integer Satang.
 * 
 * Conversion:
 * - 1 THB = 100 Satang
 * - 50.00 THB = 5,000 Satang
 * - 1,234.56 THB = 123,456 Satang
 */
export const moneyIntSchema = z.number()
  .int('Amount must be integer Satang (no decimals)')
  .nonnegative('Amount cannot be negative')
  .max(1_000_000_000, 'Maximum amount is 10,000,000 THB')
  .describe('Monetary amount in Satang (1 THB = 100 Satang)');

export type MoneyInt = z.infer<typeof moneyIntSchema>;

// Usage
const receiptSchema = z.object({
  amount: moneyIntSchema,  // ← ALWAYS use this for money
});
```


#### Display Conversion (Frontend)

```typescript
/** Convert Satang → Baht for display */
function satangToBaht(satang: number): string {
  return (satang / 100).toFixed(2);
}

satangToBaht(5000);     // "50.00"
satangToBaht(123456);   // "1234.56"

/** Convert Baht → Satang for API submission */
function bahtToSatang(baht: number): number {
  const satang = baht * 100;
  
  // Check for more than 2 decimal places
  if (satang !== Math.floor(satang)) {
    throw new Error('Amount has more than 2 decimal places');
  }
  
  return satang;
}

bahtToSatang(50.00);    // 5000
bahtToSatang(10.999);   // ❌ Error: more than 2 decimal places
```


---

### 2. Type Inference First

**Always export TypeScript types from schemas** using `z.infer<typeof schema>`.

```typescript
// ✅ CORRECT - Define schema, then infer type
export const createUserSchema = z.object({
  name: z.string().min(3),
  email: z.string().email(),
  age: z.number().int().min(18),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;

// Type is automatically:
// {
//   name: string;
//   email: string;
//   age: number;
// }

// ❌ WRONG - Defining types separately leads to drift
interface CreateUserInput {  // ← Can get out of sync with validation
  name: string;
  email: string;
  age: number;
}
```


---

### 3. Composition Over Duplication

**Reuse base schemas** using `.extend()`, `.pick()`, `.omit()`, `.merge()`.

```typescript
// Base schema
const baseReceiptSchema = z.object({
  clientId: z.string().uuid(),
  fileName: z.string(),
  amount: moneyIntSchema,
  vendor: z.string(),
  date: z.coerce.date(),
});

// ✅ CORRECT - Extend for CREATE (all required)
export const createReceiptSchema = baseReceiptSchema;

// ✅ CORRECT - Extend for UPDATE (all optional)
export const updateReceiptSchema = baseReceiptSchema.partial();

// ✅ CORRECT - Pick specific fields
export const receiptSummarySchema = baseReceiptSchema.pick({
  fileName: true,
  amount: true,
  vendor: true,
});

// ✅ CORRECT - Omit sensitive fields
export const publicReceiptSchema = baseReceiptSchema.omit({
  fileHash: true,
});
```


---

### 4. Clear Error Messages

**Always provide custom error messages** for user-facing validations.

```typescript
// ❌ BAD - Generic error message
z.string().min(3)
// Error: "String must contain at least 3 character(s)"

// ✅ GOOD - Clear, actionable error message
z.string().min(3, 'Vendor name must be at least 3 characters')
// Error: "Vendor name must be at least 3 characters"

// ❌ BAD - No context
z.number().max(100)
// Error: "Number must be less than or equal to 100"

// ✅ GOOD - Explains the business rule
z.number().max(100, 'Receipt amount cannot exceed 100 THB per transaction')
// Error: "Receipt amount cannot exceed 100 THB per transaction"
```


---

### 5. Cross-Field Validation

Use `.refine()` for custom validation logic.

```typescript
/**
 * Transaction Schema with Double-Entry Validation
 * 
 * CRITICAL: Enforces accounting equation (Debit = Credit)
 */
export const createTransactionSchema = z.object({
  receiptId: z.string().uuid(),
  debit: moneyIntSchema,
  credit: moneyIntSchema,
  description: z.string().max(500),
}).refine(
  (data) => data.debit === data.credit,
  {
    message: 'Debit must equal Credit (double-entry accounting)',
    path: ['credit'],  // Show error on credit field
  }
);

// Date range validation
export const dateRangeSchema = z.object({
  from: z.coerce.date(),
  to: z.coerce.date(),
}).refine(
  (data) => data.from <= data.to,
  {
    message: 'Start date must be before or equal to end date',
    path: ['from'],
  }
);
```


---

## 💰 AutoAcct-Specific Validators

### 1. MoneyInt Schema

```typescript
export const moneyIntSchema = z.number()
  .int('Amount must be integer Satang (no decimals)')
  .nonnegative('Amount cannot be negative')
  .max(1_000_000_000, 'Maximum amount is 10,000,000 THB')
  .describe('Monetary amount in Satang (1 THB = 100 Satang)');

export type MoneyInt = z.infer<typeof moneyIntSchema>;
```


### 2. ClientId Schema (UUID)

```typescript
export const clientIdSchema = z.string()
  .uuid('Invalid client ID format')
  .describe('Tenant/Client identifier (UUID v4)');

export type ClientId = z.infer<typeof clientIdSchema>;
```


### 3. CorrelationId Schema (UUID)

```typescript
export const correlationIdSchema = z.string()
  .uuid('Invalid correlation ID format')
  .describe('Request tracing identifier (UUID v4)');

export type CorrelationId = z.infer<typeof correlationIdSchema>;
```


### 4. Thai Tax ID Schema (Advanced)

```typescript
// Checksum validation function
function validateThaiTaxIdChecksum(taxId: string): boolean {
  if (taxId.length !== 13) return false;
  
  const digits = taxId.split('').map(Number);
  const checkDigit = digits;[^1]
  
  // Calculate checksum using modulus 11
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += digits[i] * (13 - i);
  }
  
  const calculatedCheckDigit = (11 - (sum % 11)) % 10;
  
  return checkDigit === calculatedCheckDigit;
}

export const thaiTaxIdSchema = z.string()
  .length(13, 'Tax ID must be exactly 13 digits')
  .regex(/^\d{13}$/, 'Tax ID must contain only digits')
  .refine(validateThaiTaxIdChecksum, {
    message: 'Invalid Tax ID checksum',
  })
  .describe('Thai Tax Identification Number (13 digits with checksum)');

export type ThaiTaxId = z.infer<typeof thaiTaxIdSchema>;
```


### 5. Date Range Schema

```typescript
export const safeDateSchema = z.coerce.date()
  .refine((d) => !isNaN(d.getTime()), {
    message: 'Invalid date format',
  })
  .refine((d) => {
    const minDate = new Date('1900-01-01');
    const maxDate = new Date('2100-12-31');
    return d >= minDate && d <= maxDate;
  }, {
    message: 'Date must be between 1900 and 2100',
  });

export const dateRangeSchema = z.object({
  from: safeDateSchema,
  to: safeDateSchema,
}).refine(
  (data) => data.from <= data.to,
  {
    message: 'Start date must be before or equal to end date',
    path: ['from'],
  }
);

export type DateRange = z.infer<typeof dateRangeSchema>;
```


### 6. Pagination Schema

```typescript
export const paginationSchema = z.object({
  page: z.number().int().min(1, 'Page must be at least 1').default(1),
  perPage: z.number()
    .int()
    .min(1, 'Per page must be at least 1')
    .max(100, 'Per page cannot exceed 100 (prevent large payloads)')
    .default(20),
});

export type Pagination = z.infer<typeof paginationSchema>;
```


### 7. File Upload Schema

```typescript
export const uploadFileSchema = z.object({
  clientId: clientIdSchema,
  description: z.string().max(500).optional(),
  tags: z.array(z.string()).max(10).optional(),
});

export type UploadFileInput = z.infer<typeof uploadFileSchema>;
```


---

## 📋 Common Patterns

### Pattern 1: CRUD Schemas

```typescript
// Base schema
const baseSchema = z.object({
  name: z.string().min(3),
  email: z.string().email(),
  age: z.number().int().min(18),
});

// CREATE - all required
export const createSchema = baseSchema;

// UPDATE - all optional
export const updateSchema = baseSchema.partial();

// QUERY - pagination + filters
export const querySchema = paginationSchema.extend({
  status: z.enum(['active', 'inactive']).optional(),
  search: z.string().optional(),
});
```


### Pattern 2: Receipt Upload

```typescript
export const uploadReceiptSchema = z.object({
  clientId: clientIdSchema,
  // File handled by Multer middleware, not in schema
});

export const receiptResponseSchema = z.object({
  id: z.string().uuid(),
  fileName: z.string(),
  fileHash: z.string(),
  amount: moneyIntSchema.nullable(),
  vendor: z.string().nullable(),
  status: z.enum(['queued', 'processing', 'processed', 'error']),
  createdAt: z.date(),
});

export type ReceiptResponse = z.infer<typeof receiptResponseSchema>;
```


### Pattern 3: Transaction with Double-Entry

```typescript
export const createTransactionSchema = z.object({
  receiptId: z.string().uuid(),
  account: z.object({
    debit: z.string().regex(/^\d{4}-/, 'Account code must start with 4 digits'),
    credit: z.string().regex(/^\d{4}-/, 'Account code must start with 4 digits'),
  }),
  debit: moneyIntSchema,
  credit: moneyIntSchema,
  description: z.string().max(500),
  attachments: z.array(z.string().url()).max(5).optional(),
}).refine(
  (data) => data.debit === data.credit,
  {
    message: 'Debit must equal Credit (double-entry accounting)',
    path: ['credit'],
  }
);

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
```


---

## ✅ Review Checklist

Before committing, verify:

- [ ] **MoneyInt used** for all monetary amounts (Integer Satang)
- [ ] **Types exported** via `z.infer<typeof schema>`
- [ ] **Custom error messages** for all validations
- [ ] **Composition used** (not duplication)
- [ ] **Cross-field validation** via `.refine()` where needed
- [ ] **UUID validation** for clientId, correlationId
- [ ] **Max constraints** on strings (prevent abuse)
- [ ] **Max constraints** on arrays (prevent large payloads)
- [ ] **Enum constraints** for status fields
- [ ] **Safe date ranges** (1900-2100)

---

## 🔄 Feedback \& Improvement

**If validation fails:**

1. Check MoneyInt constraint (must be integer Satang)
2. Verify cross-field validation logic (e.g., debit = credit)
3. Ensure date ranges are valid (from <= to)
4. Check custom error messages are clear

**To improve this skill:**

- Add more AutoAcct-specific validators (Bank Account, etc.)
- Include performance optimization tips
- Update based on team feedback

---

## 🧪 Testing Validators

```typescript
import { describe, it, expect } from 'bun:test';
import { createTransactionSchema } from './transaction.validators';

describe('createTransactionSchema', () => {
  it('should validate correct transaction', () => {
    const validData = {
      receiptId: '123e4567-e89b-12d3-a456-426614174000',
      account: {
        debit: '1100-Cash',
        credit: '4100-Revenue',
      },
      debit: 10000,   // 100.00 THB
      credit: 10000,  // 100.00 THB
      description: 'Sale invoice #001',
    };

    const result = createTransactionSchema.parse(validData);
    expect(result.debit).toBe(10000);
  });

  it('should fail when debit != credit', () => {
    const invalidData = {
      receiptId: '123e4567-e89b-12d3-a456-426614174000',
      account: {
        debit: '1100-Cash',
        credit: '4100-Revenue',
      },
      debit: 10000,   // 100.00 THB
      credit: 9000,   // 90.00 THB ❌ WRONG!
      description: 'Sale invoice #001',
    };

    expect(() => createTransactionSchema.parse(invalidData)).toThrow(
      'Debit must equal Credit'
    );
  });

  it('should fail when amount is not integer', () => {
    const invalidData = {
      receiptId: '123e4567-e89b-12d3-a456-426614174000',
      account: {
        debit: '1100-Cash',
        credit: '4100-Revenue',
      },
      debit: 100.5,   // ❌ NOT integer Satang!
      credit: 100.5,
      description: 'Sale invoice #001',
    };

    expect(() => createTransactionSchema.parse(invalidData)).toThrow(
      'Amount must be integer Satang'
    );
  });
});
```


---

## 🔗 Common Anti-Patterns (AVOID!)

### ❌ Anti-Pattern 1: Using Floating Point for Money

```typescript
// ❌ WRONG
const schema = z.object({
  amount: z.number().min(0),  // Allows decimals!
});

// ✅ CORRECT
const schema = z.object({
  amount: moneyIntSchema,  // Integer Satang only
});
```


### ❌ Anti-Pattern 2: Duplicating Schemas

```typescript
// ❌ WRONG - Duplicated
const createSchema = z.object({
  name: z.string().min(3),
  email: z.string().email(),
});

const updateSchema = z.object({
  name: z.string().min(3),
  email: z.string().email(),
});

// ✅ CORRECT - Composed
const baseSchema = z.object({
  name: z.string().min(3),
  email: z.string().email(),
});

const createSchema = baseSchema;
const updateSchema = baseSchema.partial();
```


### ❌ Anti-Pattern 3: No Custom Error Messages

```typescript
// ❌ WRONG
z.string().min(3)

// ✅ CORRECT
z.string().min(3, 'Vendor name must be at least 3 characters')
```


---

## 📚 Related Skills

- **autoaccl-rest-controller** - For using validators in controllers
- **autoaccl-service-layer** - For business logic validation
- **autoaccl-error-handling** - For validation error handling

---

**Skill Maintainer:** AutoAcct Development Team
**Last Updated:** 2026-01-26T21:38:00+07:00
**Version:** 2.0.0-antigravity