# 📘 AUTO-ACCT-001 GUIDE BOOK: VOLUME 1
## Architecture, Setup & Core Patterns

**Version**: 1.0 (January 2026)  
**Target Audience**: Backend/Full-Stack Engineers, Financial System Architects  
**Status**: Production-Ready Guide  

---

## TABLE OF CONTENTS

1. [Executive Summary](#1-executive-summary)
2. [Technology Stack & Philosophy](#2-technology-stack--philosophy)
3. [Core Financial Principles (Golden Rules)](#3-core-financial-principles-golden-rules)
4. [Project Structure & Modules](#4-project-structure--modules)
5. [Installation & Development Setup](#5-installation--development-setup)
6. [The Double-Entry Ledger Pattern](#6-the-double-entry-ledger-pattern)
7. [Integer Money Pattern (Satang/Cents)](#7-integer-money-pattern-satangcents)
8. [Security & Encryption Strategy](#8-security--encryption-strategy)
9. [Database Design (MongoDB + Mongoose)](#9-database-design-mongodb--mongoose)
10. [Common Workflows & Patterns](#10-common-workflows--patterns)
11. [Error Handling & Logging](#11-error-handling--logging)
12. [Testing Strategy](#12-testing-strategy)
13. [Troubleshooting & FAQ](#13-troubleshooting--faq)

---

## 1. EXECUTIVE SUMMARY

### What is Auto-Acct-001?

**Auto-Acct-001** is a **self-hosted, zero-budget automated accounting system** that:
- Ingests receipts/invoices via OCR (PaddleOCR + Google Vision)
- Uses AI (Groq LLM) to classify transactions & auto-categorize
- Records double-entry journal entries with **strict financial integrity**
- Syncs drafts to Teable for accountant review & approval
- Generates financial reports (P&L, Balance Sheet, Audit Trail)

### Why This Architecture?

| Problem | Solution |
|---------|----------|
| Floating-point errors in financial systems | Integer-only storage (Satang/Cents) |
| Accidental transaction deletion | Immutable ledger (Void/Reversal entries only) |
| Unbalanced entries | Medici library + Trial Balance check |
| Manual categorization burden | Groq AI classification + feedback loop |
| No audit trail | MongoDB timestamps + structured logging |
| Expensive cloud | Self-hosted on commodity hardware + Google Drive (free tier) |

---

## 2. TECHNOLOGY STACK & PHILOSOPHY

### The Stack (Non-Negotiable)

```
┌─────────────────────────────────────────┐
│ FRONTEND: Next.js + Tailwind + React   │
│ (Custom UI + Teable No-code Integration)│
└─────────────────────────────────────────┘
           ↓
┌─────────────────────────────────────────┐
│ BACKEND: Bun + Express.js               │
│ (Modular Monolith, Strict TypeScript)  │
└─────────────────────────────────────────┘
           ↓
┌─────────────────────────────────────────┐
│ DATABASE: MongoDB v7+ (Mongoose ORM)    │
│ (Document-based, Transactions support)  │
└─────────────────────────────────────────┘
           ↓
┌─────────────────────────────────────────┐
│ ACCOUNTING: Medici (Double-entry ledger)│
│ (T-accounts, Trial Balance, Audit logs) │
└─────────────────────────────────────────┘
           ↓
┌─────────────────────────────────────────┐
│ STORAGE: Google Drive API (Hybrid Enc)  │
│ (Free tier, AES-256-GCM for sensitive)  │
└─────────────────────────────────────────┘
           ↓
┌─────────────────────────────────────────┐
│ ML/OCR: Python (PaddleOCR + Groq API)   │
│ (Worker process, DVC for versioning)    │
└─────────────────────────────────────────┘
```

### Key Design Decisions

**1. Bun Runtime**
- ✅ Fast startup (< 50ms vs Node.js ~100ms)
- ✅ Built-in TypeScript compiler
- ✅ Native bundles for deployment
- ✅ Drop-in Node.js compat for Express
- ❌ No docker-compose exec; use `bun run` in container

**2. Modular Monolith** (not microservices)
- ✅ Single deployment unit (easier to maintain)
- ✅ ACID transactions across business logic
- ✅ Synchronous request/response for financial flows
- ❌ Not event-driven (no Kafka); async via WebSocket + polling for long-running tasks

**3. MongoDB + Transactions**
- ✅ Flexible schema for different receipt formats
- ✅ Session transactions (4.0+) for ACID guarantees
- ✅ Mongoose for type safety
- ⚠️ Requires replica set (even single-node replica set for dev)

**4. Medici Library**
- ✅ Industry-standard double-entry ledger
- ✅ T-account abstractions (debit/credit)
- ✅ Built-in journal + chart of accounts
- ✅ Trial balance validation
- ❌ Single-tenant per database (so multi-tenant via collections/namespace)

---

## 3. CORE FINANCIAL PRINCIPLES (GOLDEN RULES)

### Rule 1: Integer Only (No Floats)

**Law**: ALL monetary values are stored as **integers** (Satang/Cents), never floats.

**Why**?
```typescript
// ❌ WRONG - Floating point error
const total = 0.1 + 0.2;  // 0.30000000000000004
const result = total === 0.3;  // false!

// ✅ CORRECT - Integer (Satang: 1/100 of Baht)
const total = 10 + 20;  // 30 (Satang)
const baht = total / 100;  // 0.30 (display only)
```

**Implementation**:
```typescript
// backend/src/utils/money.ts
export type MoneyInt = number & { readonly __brand: 'MoneyInt' };

export function bahtToSatang(baht: number): MoneyInt {
  const satang = Math.round(baht * 100);
  return satang as MoneyInt;
}

export function satangToBaht(satang: MoneyInt): string {
  return (satang / 100).toFixed(2);
}

export function validateMoneyInt(value: any): value is MoneyInt {
  return Number.isInteger(value) && value >= 0;
}
```

**Database Storage**:
```typescript
// src/models/Receipt.ts
interface Receipt {
  extractedFields: {
    amount: MoneyInt;  // e.g., 12500 = 125.00 THB
  };
}

// src/models/JournalEntry.ts
interface JournalEntry {
  debit: MoneyInt;   // e.g., 12500
  credit: MoneyInt;  // e.g., 12500
}
```

---

### Rule 2: The Plug Method (Remainder Handling)

**Law**: When splitting transactions, use the **plug method** to ensure sum equals total.

**Scenario**: Invoice 100 Satang split 3 ways (e.g., tax allocation, expense split)

```typescript
// ❌ WRONG - Floating point split
const parts = [100/3, 100/3, 100/3];  // [33.33..., 33.33..., 33.33...]
const sum = parts.reduce((a, b) => a + b, 0);  // !== 100

// ✅ CORRECT - Plug Method
function plugMethodSplit(total: MoneyInt, parts: number): MoneyInt[] {
  const baseAmount = Math.floor(total / parts);
  const remainder = total % parts;
  
  const result = Array(parts).fill(baseAmount);
  result[0] += remainder;  // Add remainder to first item (or largest)
  
  console.assert(
    result.reduce((a, b) => a + b, 0) === total,
    'Plug method failed'
  );
  
  return result as MoneyInt[];
}

// Usage
const invoiceTotal: MoneyInt = 100 as MoneyInt;
const split = plugMethodSplit(invoiceTotal, 3);
// split = [34, 33, 33]
// sum = 100 ✓
```

**Rule of Thumb**: Always verify `sum(parts) === total` before writing to database.

---

### Rule 3: ACID Transactions (MongoDB Sessions)

**Law**: Every write operation involving the **ledger MUST be wrapped in a MongoDB Session Transaction**.

**Pattern**:
```typescript
// backend/src/services/AccountingService.ts
async createJournalEntry(
  entries: JournalEntry[],
  session: ClientSession
): Promise<void> {
  try {
    // 1. Validate double-entry equation
    for (const entry of entries) {
      if (entry.debit !== entry.credit) {
        throw new FinancialIntegrityError(
          `Debit (${entry.debit}) != Credit (${entry.credit})`
        );
      }
    }
    
    // 2. Insert into MongoDB within transaction
    const createdEntries = await JournalEntry.insertMany(entries, {
      session,
    });
    
    // 3. Commit to Medici ledger (also within session)
    for (const entry of createdEntries) {
      await this.medicer.debit(
        entry.account.debit,
        entry.debit,
        entry.description,
        session
      );
      await this.medicer.credit(
        entry.account.credit,
        entry.credit,
        entry.description,
        session
      );
    }
    
    // 4. Trial Balance check (must balance)
    const trialBalance = await this.medicer.balance({}, session);
    if (!this.isTrialBalanced(trialBalance)) {
      throw new FinancialIntegrityError('Trial balance failed');
    }
    
    // 5. If any step fails → automatic rollback by MongoDB
  } catch (error) {
    throw error;  // Caller must abort session on error
  }
}
```

**Caller Pattern**:
```typescript
const session = await mongoose.startSession();
session.startTransaction();

try {
  await accountingService.createJournalEntry(entries, session);
  await session.commitTransaction();
} catch (error) {
  await session.abortTransaction();
  throw error;
} finally {
  await session.endSession();
}
```

---

### Rule 4: Immutability (No Delete, Only Void/Reversal)

**Law**: NEVER delete a posted transaction. Use **Void or Reversal entries** only.

**Pattern**:
```typescript
// ❌ WRONG - DELETE
await JournalEntry.deleteOne({ id: entryId });

// ✅ CORRECT - Void (using reversal entry)
async voidJournalEntry(entryId: ObjectId, reason: string): Promise<void> {
  const original = await JournalEntry.findById(entryId);
  if (!original) throw new NotFoundError('Entry not found');
  
  if (original.status === 'voided') {
    throw new BusinessLogicError('Entry already voided');
  }
  
  // Create reversal entry (opposite debit/credit)
  const reversal: JournalEntry = {
    originalEntryId: entryId,
    account: {
      debit: original.account.credit,  // Swap
      credit: original.account.debit,
    },
    debit: original.credit,
    credit: original.debit,
    description: `VOID: ${original.description} (Reason: ${reason})`,
    status: 'voided_reversal',
    voidReason: reason,
    voidedAt: new Date(),
  };
  
  // Post reversal as normal entry
  await this.createJournalEntry([reversal], session);
  
  // Mark original as voided
  await JournalEntry.updateOne(
    { _id: entryId },
    { status: 'voided', voidedAt: new Date(), voidReason: reason },
    { session }
  );
}
```

**Benefits**:
- ✅ Full audit trail preserved
- ✅ Can reconstruct financials at any point in time
- ✅ Regulator compliance (immutable records)
- ✅ No cascading deletes

---

## 4. PROJECT STRUCTURE & MODULES

### Directory Layout (Modular Monolith)

```
backend/
├── src/
│   ├── config/
│   │   ├── database.ts           # MongoDB connection
│   │   ├── env.ts               # Environment validation (zod)
│   │   └── logger.ts            # Winston setup
│   ├── modules/
│   │   ├── auth/
│   │   │   ├── controllers/
│   │   │   ├── services/
│   │   │   ├── models/
│   │   │   └── routes.ts
│   │   ├── receipt/
│   │   │   ├── controllers/
│   │   │   ├── services/
│   │   │   ├── models/
│   │   │   └── routes.ts
│   │   ├── ocr/
│   │   │   ├── controllers/
│   │   │   │   ├── OcrController.ts
│   │   │   │   └── DevOcrController.ts
│   │   │   ├── services/
│   │   │   │   ├── OCRService.ts
│   │   │   │   ├── OCRValidationService.ts
│   │   │   │   └── OcrCache.ts
│   │   │   ├── models/
│   │   │   └── routes.ts
│   │   ├── accounting/
│   │   │   ├── controllers/
│   │   │   ├── services/
│   │   │   │   ├── AccountingService.ts
│   │   │   │   ├── MedicerService.ts
│   │   │   │   └── JournalEntryService.ts
│   │   │   ├── models/
│   │   │   └── routes.ts
│   │   ├── classification/
│   │   │   ├── services/
│   │   │   │   └── GroqClassificationService.ts
│   │   │   ├── models/
│   │   │   └── routes.ts
│   │   ├── storage/
│   │   │   ├── services/
│   │   │   │   ├── GoogleDriveService.ts
│   │   │   │   └── EncryptionService.ts
│   │   │   └── models/
│   │   ├── teable/
│   │   │   ├── services/
│   │   │   │   └── TeableClient.ts
│   │   │   └── models/
│   │   ├── config/
│   │   │   ├── controllers/
│   │   │   ├── services/
│   │   │   │   └── ConfigService.ts (SystemConfig CRUD)
│   │   │   ├── models/
│   │   │   └── routes.ts
│   │   └── dev/
│   │       ├── controllers/
│   │       │   └── DevController.ts
│   │       └── routes.ts (all /api/dev/...)
│   ├── middleware/
│   │   ├── auth.ts
│   │   ├── errorHandler.ts
│   │   ├── rateLimit.ts
│   │   └── logger.ts
│   ├── utils/
│   │   ├── money.ts            # Integer conversion
│   │   ├── validation.ts       # Zod schemas
│   │   ├── errors.ts           # Custom error classes
│   │   └── mediciHelpers.ts    # T-account helpers
│   ├── types/
│   │   ├── index.ts            # Global types
│   │   └── express.d.ts        # Express custom props
│   └── app.ts                  # Express app factory
├── tests/
│   ├── unit/
│   ├── integration/
│   └── fixtures/
├── migrations/
│   ├── 001_init_schema.ts
│   └── 002_add_devmode_fields.ts
├── biome.json                  # Code formatter
├── bunfig.toml                 # Bun config
└── package.json
```

### Module Responsibilities

| Module | Purpose | Key Files |
|--------|---------|-----------|
| `auth/` | JWT + role-based access (dev, accountant, admin) | `AuthService.ts`, `JwtGuard.ts` |
| `receipt/` | Receipt CRUD + file upload | `ReceiptService.ts`, `ReceiptSchema.ts` |
| `ocr/` | PaddleOCR + Google Vision worker integration | `OCRService.ts`, `OCRValidationService.ts` |
| `accounting/` | Medici ledger + journal entries | `AccountingService.ts`, `MedicerService.ts` |
| `classification/` | Groq AI categorization + feedback | `GroqClassificationService.ts` |
| `storage/` | Google Drive + encryption | `GoogleDriveService.ts`, `EncryptionService.ts` |
| `teable/` | Webhook + sync to Teable base | `TeableClient.ts` |
| `config/` | System configuration (dev mode flags, quotas) | `ConfigService.ts`, `SystemConfig.ts` |
| `dev/` | Dev-only APIs (mock JSON, queue clear) | `DevOcrController.ts`, `DevConfigController.ts` |

---

## 5. INSTALLATION & DEVELOPMENT SETUP

### Prerequisites

- **Bun** v1.1+ ([bun.sh](https://bun.sh))
- **MongoDB** v7+ (local or Atlas)
- **Node.js** 18+ (for Python worker, if needed)
- **Git** (GitHub Secrets for deployment)

### Step 1: Clone & Setup

```bash
# Clone repo
git clone https://github.com/Waytid-way/Auto_Acct101.git
cd Auto_Acct101

# Install dependencies (Bun)
bun install

# Copy environment template
cp .env.example .env.local
```

### Step 2: Environment Configuration

Edit `.env.local`:

```env
# Database
MONGODB_URI=mongodb://localhost:27017/auto_acct_dev
MONGODB_REPLICA_SET=rs0  # Single-node replica set for transactions

# Authentication
JWT_SECRET=your-super-secret-key-min-32-chars-dev-only
JWT_EXPIRY=24h
DEV_MODE_SECRET=dev-secret-for-dev-apis

# Google Drive (Service Account)
GOOGLE_SERVICE_ACCOUNT_JSON='{"type":"service_account",...}'
GOOGLE_DRIVE_FOLDER_ID=your-folder-id

# Encryption (AES-256-GCM)
ENCRYPTION_KEY=your-32-byte-hex-key
ENCRYPTION_IV_LENGTH=12

# OCR
PADDLEOCR_ENDPOINT=http://localhost:8000  # Python worker
GOOGLE_VISION_KEY_JSON='{"type":"service_account",...}'
GOOGLE_VISION_QUOTA_PER_MONTH=1000

# AI Classification
GROQ_API_KEY=your-groq-api-key
GROQ_MODEL=mixtral-8x7b-32768

# Teable
TEABLE_API_URL=https://app.teable.io/api
TEABLE_API_KEY=your-teable-api-key
TEABLE_BASE_ID=your-base-id
TEABLE_RECEIPT_TABLE_ID=your-table-id

# Logging
LOG_LEVEL=debug
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...  # For 5xx alerts

# Dev Mode
NODE_ENV=development
DEV_MODE_ENABLED=true
```

### Step 3: Initialize MongoDB

**Option A: Local Replica Set (Docker)**

```bash
# docker-compose.yml (provided)
docker-compose up -d mongo

# Initialize replica set
docker exec auto_acct_mongo mongosh --eval \
  'rs.initiate({ _id: "rs0", members: [{ _id: 0, host: "localhost:27017" }] })'
```

**Option B: MongoDB Atlas (Cloud)**

```env
MONGODB_URI=mongodb+srv://<user>:<password>@cluster.mongodb.net/auto_acct_dev?retryWrites=true&w=majority
```

### Step 4: Run Migrations

```bash
# Apply schema migrations
bun run db:migrate

# Output:
# Migration 001_init_schema.ts ✓
# Migration 002_add_devmode_fields.ts ✓
# ✅ All migrations completed
```

### Step 5: Seed Initial Data

```bash
# Create default Chart of Accounts (IAS 9 template)
bun run db:seed

# Output includes:
# ✓ 100 - Assets
# ✓ 200 - Liabilities
# ✓ 300 - Equity
# ✓ 400 - Revenue
# ✓ 500 - Expenses (including 5100 - Food & Beverage)
```

### Step 6: Start Development Server

```bash
# Backend (Bun)
bun run dev

# Output:
# [API] Listening on http://localhost:3000
# [OCR] Worker queue initialized
# [DB] MongoDB connected (replica set rs0)
# ✅ Dev mode enabled (X-Dev-Token required for /api/dev/...)
```

**In another terminal: Python OCR Worker**

```bash
cd backend/workers/ocr
python main.py --port 8000

# Output:
# [OCR] PaddleOCR loaded (GPU available)
# [Server] Listening on 0.0.0.0:8000
```

---

## 6. THE DOUBLE-ENTRY LEDGER PATTERN

### Concept: T-Accounts

In double-entry accounting, **every transaction affects exactly 2 accounts**:
- **Debit** (left side): increases assets/expenses, decreases liabilities/revenue
- **Credit** (right side): increases liabilities/revenue, decreases assets/expenses

### The Equation

```
Assets = Liabilities + Equity

Debit (Dr) = Credit (Cr)  ← Must always balance
```

### Example: Coffee Receipt

**Scenario**: Pay 125 THB for coffee (expense). Money comes from checking account.

```
Account:        Debit      Credit
─────────────────────────────────
1010 Checking                12,500  (cash decreases = credit)
5100 Food         12,500            (expense increases = debit)
─────────────────────────────────
Total            12,500     12,500  ✓ Balanced
```

### Code Pattern (Medici)

```typescript
// backend/src/services/MedicerService.ts
async recordCoffeeExpense(
  amount: MoneyInt,
  description: string
): Promise<void> {
  await this.medicer.debit(
    '5100-Food',           // Expense account
    amount,
    description
  );
  
  await this.medicer.credit(
    '1010-Checking',       // Asset account
    amount,
    description
  );
  
  await this.medicer.commit();
  
  // Verify trial balance
  const balance = await this.medicer.balance();
  if (balance !== 0) {
    throw new FinancialIntegrityError('Trial balance failed');
  }
}
```

### Chart of Accounts (COA)

Auto-Acct uses IAS 9 standard structure:

```
1000 - ASSETS
  1010 - Checking Account (cash)
  1020 - Petty Cash
  1100 - Accounts Receivable
  1200 - Inventory

2000 - LIABILITIES
  2010 - Accounts Payable
  2100 - Salary Payable
  2200 - Tax Payable (VAT/WHT)

3000 - EQUITY
  3010 - Owner's Capital
  3020 - Retained Earnings

4000 - REVENUE
  4100 - Service Income
  4200 - Product Sales

5000 - EXPENSES
  5100 - Food & Beverage
  5200 - Office Supplies
  5300 - Travel
  5400 - Salary
  5500 - Utilities
```

---

## 7. INTEGER MONEY PATTERN (SATANG/CENTS)

### Conversion Functions

File: `backend/src/utils/money.ts`

```typescript
import { z } from 'zod';

/**
 * MoneyInt brand type: all amounts are in Satang (1/100 THB)
 * Database storage: always integer (no decimals)
 * Display: divide by 100 and format to 2 decimal places
 */
export type MoneyInt = number & { readonly __brand: 'MoneyInt' };

/**
 * Zod schema for strict integer validation
 */
export const MoneyIntSchema = z
  .number()
  .int('Amount must be integer (Satang)')
  .nonnegative('Amount must be non-negative')
  .refine(
    (v) => v <= Number.MAX_SAFE_INTEGER,
    'Amount exceeds max safe integer'
  ) as z.ZodType<MoneyInt>;

/**
 * Convert Baht (display) → Satang (storage)
 * @param baht number (e.g., 125.50)
 * @returns MoneyInt (e.g., 12550)
 */
export function bahtToSatang(baht: number): MoneyInt {
  const satang = Math.round(baht * 100);
  return satang as MoneyInt;
}

/**
 * Convert Satang (storage) → Baht (display)
 * @param satang MoneyInt (e.g., 12550)
 * @returns string formatted to 2 decimals (e.g., "125.50")
 */
export function satangToBaht(satang: MoneyInt): string {
  return (satang / 100).toFixed(2);
}

/**
 * Validate that value is a valid MoneyInt
 */
export function isValidMoneyInt(value: unknown): value is MoneyInt {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= Number.MAX_SAFE_INTEGER
  );
}

/**
 * Safe arithmetic operations on MoneyInt
 */
export const money = {
  add: (...amounts: MoneyInt[]): MoneyInt => {
    const sum = amounts.reduce((acc, val) => acc + val, 0);
    if (!isValidMoneyInt(sum)) throw new Error('Money add overflow');
    return sum as MoneyInt;
  },
  
  subtract: (a: MoneyInt, b: MoneyInt): MoneyInt => {
    const diff = a - b;
    if (!isValidMoneyInt(diff)) throw new Error('Money subtract invalid');
    return diff as MoneyInt;
  },
  
  multiply: (amount: MoneyInt, factor: number): MoneyInt => {
    const result = Math.round(amount * factor);
    if (!isValidMoneyInt(result)) throw new Error('Money multiply overflow');
    return result as MoneyInt;
  },
  
  divide: (amount: MoneyInt, divisor: number): MoneyInt => {
    const result = Math.round(amount / divisor);
    if (!isValidMoneyInt(result)) throw new Error('Money divide invalid');
    return result as MoneyInt;
  },
};

/**
 * Plug method: split amount into N parts ensuring sum = total
 * @example
 * plugSplit(10000, 3) → [3334, 3333, 3333]  (10000 / 3 = 3333.33... → [3334, 3333, 3333])
 */
export function plugSplit(total: MoneyInt, parts: number): MoneyInt[] {
  if (parts <= 0) throw new Error('Parts must be > 0');
  
  const baseAmount = Math.floor(total / parts);
  const remainder = total % parts;
  
  const result = Array(parts).fill(baseAmount);
  
  // Add remainder to first item (could also add to largest)
  result[0] += remainder;
  
  // Verify sum equals total
  const sum = result.reduce((a, b) => a + b, 0);
  if (sum !== total) {
    throw new Error(`Plug method failed: ${sum} !== ${total}`);
  }
  
  return result as MoneyInt[];
}
```

### Usage in DTOs

```typescript
// backend/src/modules/receipt/dto/CreateReceiptDto.ts
import { z } from 'zod';
import { MoneyIntSchema } from '@utils/money';

export const CreateReceiptDto = z.object({
  vendor: z.string().min(1),
  amount: MoneyIntSchema,  // ← Validates integer, >= 0
  date: z.coerce.date(),
  taxId: z.string().optional(),
});

export type CreateReceiptDto = z.infer<typeof CreateReceiptDto>;
```

### Frontend Integration

```typescript
// frontend/src/utils/money.ts (Next.js)
export function displayMoney(satang: number): string {
  return `฿${(satang / 100).toFixed(2)}`;
}

export function parseMoney(input: string): number {
  const cleaned = input.replace(/[^\d.]/g, '');
  const baht = parseFloat(cleaned);
  if (isNaN(baht)) return 0;
  return Math.round(baht * 100);  // → Satang
}
```

---

## 8. SECURITY & ENCRYPTION STRATEGY

### Hybrid Encryption Model

Auto-Acct uses a **two-tier encryption strategy**:

| File Type | Storage | Encryption | Use Case |
|-----------|---------|-----------|----------|
| Coffee receipt | Google Drive | ❌ None (raw upload) | Non-sensitive |
| Payroll slip | Google Drive | ✅ AES-256-GCM | Sensitive data |
| Tax document | Google Drive | ✅ AES-256-GCM | Regulated |
| Filename | MongoDB | ✅ UUID obfuscation | Privacy |

### Implementation

```typescript
// backend/src/modules/storage/services/EncryptionService.ts
import crypto from 'crypto';

export class EncryptionService {
  private encryptionKey: Buffer;
  private ivLength: number = 12;  // 96 bits for GCM
  
  constructor(hexKey: string) {
    this.encryptionKey = Buffer.from(hexKey, 'hex');
    if (this.encryptionKey.length !== 32) {
      throw new Error('Encryption key must be 32 bytes (256 bits)');
    }
  }
  
  /**
   * Encrypt file buffer using AES-256-GCM
   * Returns: { ciphertext, iv, authTag } (all base64)
   */
  encrypt(plaintext: Buffer, aad?: string): {
    ciphertext: string;
    iv: string;
    authTag: string;
  } {
    const iv = crypto.randomBytes(this.ivLength);
    const cipher = crypto.createCipheriv(
      'aes-256-gcm',
      this.encryptionKey,
      iv
    );
    
    if (aad) {
      cipher.setAAD(Buffer.from(aad, 'utf8'));
    }
    
    const ciphertext = Buffer.concat([
      cipher.update(plaintext),
      cipher.final(),
    ]);
    
    const authTag = cipher.getAuthTag();
    
    return {
      ciphertext: ciphertext.toString('base64'),
      iv: iv.toString('base64'),
      authTag: authTag.toString('base64'),
    };
  }
  
  /**
   * Decrypt ciphertext using AES-256-GCM
   */
  decrypt(
    ciphertext: string,
    iv: string,
    authTag: string,
    aad?: string
  ): Buffer {
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      this.encryptionKey,
      Buffer.from(iv, 'base64')
    );
    
    decipher.setAuthTag(Buffer.from(authTag, 'base64'));
    
    if (aad) {
      decipher.setAAD(Buffer.from(aad, 'utf8'));
    }
    
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(ciphertext, 'base64')),
      decipher.final(),
    ]);
    
    return plaintext;
  }
}
```

### Filename Obfuscation

```typescript
// backend/src/modules/storage/services/GoogleDriveService.ts
import { v4 as uuidv4 } from 'uuid';

export class GoogleDriveService {
  async uploadReceipt(
    file: Buffer,
    originalFileName: string,
    sensitive: boolean = false
  ): Promise<{
    driveFileId: string;
    obfuscatedName: string;
    fileHash: string;
  }> {
    // 1. Generate UUID for Drive filename (never upload original)
    const obfuscatedName = `${uuidv4()}.${this.getExtension(originalFileName)}`;
    
    // 2. Encrypt if sensitive
    let fileToUpload = file;
    let metadata: Record<string, string> = {
      originalFileName,  // Encrypted separately
      uploadedAt: new Date().toISOString(),
    };
    
    if (sensitive) {
      const encrypted = this.encryptionService.encrypt(file, originalFileName);
      fileToUpload = Buffer.from(JSON.stringify(encrypted));
      metadata.encrypted = 'true';
      metadata.aad = originalFileName;  // Additional authenticated data
    }
    
    // 3. Upload to Google Drive
    const driveFileId = await this.drive.files.create({
      requestBody: {
        name: obfuscatedName,
        mimeType: 'application/octet-stream',
        properties: metadata,
      },
      media: {
        mimeType: 'application/octet-stream',
        body: fileToUpload,
      },
    });
    
    // 4. Store mapping in MongoDB
    const fileHash = this.hashFile(file);
    await FileMapping.create({
      driveFileId: driveFileId.data.id,
      obfuscatedName,
      originalFileName,  // Encrypted in DB if needed
      fileHash,
      sensitive,
      uploadedAt: new Date(),
    });
    
    return {
      driveFileId: driveFileId.data.id,
      obfuscatedName,
      fileHash,
    };
  }
  
  private getExtension(filename: string): string {
    const parts = filename.split('.');
    return parts[parts.length - 1] || 'bin';
  }
  
  private hashFile(file: Buffer): string {
    return crypto
      .createHash('sha256')
      .update(file)
      .digest('hex');
  }
}
```

### Credential Safety (GitHub Secrets)

**Never commit Google Service Account JSON or encryption keys**:

```yaml
# .github/workflows/deploy.yml
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Set secrets in ENV
        run: |
          echo "GOOGLE_SERVICE_ACCOUNT_JSON=${{ secrets.GOOGLE_SERVICE_ACCOUNT_JSON }}" >> $GITHUB_ENV
          echo "ENCRYPTION_KEY=${{ secrets.ENCRYPTION_KEY }}" >> $GITHUB_ENV
          echo "JWT_SECRET=${{ secrets.JWT_SECRET }}" >> $GITHUB_ENV
      
      - name: Deploy to production
        run: |
          bun run build
          bun run deploy
```

---

## 9. DATABASE DESIGN (MONGODB + MONGOOSE)

### Collections & Schema

#### 1. `receipts`

```typescript
// backend/src/modules/receipt/models/Receipt.ts
interface Receipt {
  _id: ObjectId;
  
  // File metadata
  fileName: string;
  fileHash: string;            // SHA-256, for duplicate detection
  driveFileId?: string;
  mimeType?: string;
  
  // OCR data
  ocrText?: string;
  ocrEngine?: 'paddleocr' | 'googlevision' | 'mock';
  extractedFields?: {
    vendor?: string;
    amount?: MoneyInt;          // Satang
    date?: Date;
    taxId?: string;
  };
  confidenceScores?: {
    vendor?: number;            // 0-1
    amount?: number;
    date?: number;
    overall?: number;
  };
  
  // Status & workflow
  status: 'queued_for_ocr' | 'processing' | 'processed' | 'manual_review_required';
  
  // User corrections (feedback loop)
  feedback?: {
    vendorCorrected?: string;
    amountCorrected?: MoneyInt;
    dateCorrected?: Date;
    categoryCorrected?: string;
    reason?: string;
  };
  
  // Accounting link
  journalEntryId?: ObjectId;
  
  // Metadata
  clientId: ObjectId;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: ObjectId;         // User ID
  queuePosition?: number;       // For FIFO
  
  // Dev mode
  isMockData?: boolean;
}

const receiptSchema = new mongoose.Schema<Receipt>({
  fileName: { type: String, required: true },
  fileHash: { type: String, unique: true, sparse: true },  // Allow null for duplicates
  driveFileId: String,
  mimeType: String,
  
  ocrText: String,
  ocrEngine: { type: String, enum: ['paddleocr', 'googlevision', 'mock'] },
  extractedFields: {
    vendor: String,
    amount: { type: Number, validate: validateMoneyInt },
    date: Date,
    taxId: String,
  },
  confidenceScores: {
    vendor: { type: Number, min: 0, max: 1 },
    amount: { type: Number, min: 0, max: 1 },
    date: { type: Number, min: 0, max: 1 },
    overall: { type: Number, min: 0, max: 1 },
  },
  
  status: {
    type: String,
    enum: ['queued_for_ocr', 'processing', 'processed', 'manual_review_required'],
    default: 'queued_for_ocr',
  },
  
  feedback: {
    vendorCorrected: String,
    amountCorrected: { type: Number, validate: validateMoneyInt },
    dateCorrected: Date,
    categoryCorrected: String,
    reason: String,
  },
  
  journalEntryId: { type: mongoose.Schema.Types.ObjectId, ref: 'JournalEntry' },
  
  clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  queuePosition: Number,
  
  isMockData: { type: Boolean, default: false },
}, { timestamps: true });

// Indices
receiptSchema.index({ fileHash: 1, clientId: 1 });
receiptSchema.index({ status: 1, createdAt: 1 });  // For FIFO queries
receiptSchema.index({ clientId: 1, createdAt: -1 });
```

#### 2. `journalentries`

```typescript
// backend/src/modules/accounting/models/JournalEntry.ts
interface JournalEntry {
  _id: ObjectId;
  
  // Entry definition
  account: {
    debit: string;             // COA code (e.g., '5100-Food')
    credit: string;
  };
  debit: MoneyInt;             // Satang
  credit: MoneyInt;
  description: string;
  
  // Medici reference
  medicer?: {
    journalId: string;
    timestamp: Date;
  };
  
  // Status
  status: 'draft' | 'pending' | 'posted' | 'voided' | 'voided_reversal';
  
  // Void/Reversal
  originalEntryId?: ObjectId;
  voidReason?: string;
  voidedAt?: Date;
  
  // Receipt link
  receiptId?: ObjectId;
  
  // Teable sync
  teableRecordId?: string;
  teable SyncStatus?: 'pending' | 'synced' | 'failed';
  
  // Metadata
  clientId: ObjectId;
  createdAt: Date;
  updatedAt: Date;
  approvedBy?: ObjectId;       // Accountant
  approvedAt?: Date;
  
  // Dev mode
  isMockEntry?: boolean;
}

const journalEntrySchema = new mongoose.Schema<JournalEntry>({
  account: {
    debit: { type: String, required: true },
    credit: { type: String, required: true },
  },
  debit: { type: Number, required: true, validate: validateMoneyInt },
  credit: { type: Number, required: true, validate: validateMoneyInt },
  description: { type: String, required: true },
  
  medicer: {
    journalId: String,
    timestamp: Date,
  },
  
  status: {
    type: String,
    enum: ['draft', 'pending', 'posted', 'voided', 'voided_reversal'],
    default: 'draft',
  },
  
  originalEntryId: { type: mongoose.Schema.Types.ObjectId, ref: 'JournalEntry' },
  voidReason: String,
  voidedAt: Date,
  
  receiptId: { type: mongoose.Schema.Types.ObjectId, ref: 'Receipt' },
  
  teableRecordId: String,
  teableSyncStatus: { type: String, enum: ['pending', 'synced', 'failed'] },
  
  clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approvedAt: Date,
  
  isMockEntry: { type: Boolean, default: false },
}, { timestamps: true });

// Indices
journalEntrySchema.index({ status: 1, createdAt: -1 });
journalEntrySchema.index({ receiptId: 1 });
journalEntrySchema.index({ clientId: 1, createdAt: -1 });
journalEntrySchema.index({ originalEntryId: 1 });  // For void tracking
```

#### 3. `systemconfig` (Dev mode & settings)

```typescript
// backend/src/modules/config/models/SystemConfig.ts
interface SystemConfig {
  _id: ObjectId;
  key: string;                 // Unique config key
  value: any;                  // JSON-serializable
  type: 'boolean' | 'number' | 'string' | 'json';
  description?: string;
  updatedAt: Date;
}

const systemConfigSchema = new mongoose.Schema<SystemConfig>({
  key: { type: String, unique: true, required: true },
  value: mongoose.Schema.Types.Mixed,
  type: { type: String, enum: ['boolean', 'number', 'string', 'json'] },
  description: String,
  updatedAt: { type: Date, default: Date.now },
});

// Dev mode config keys (seeds)
const devModeConfigs = [
  {
    key: 'dev.ocrBypassRateLimit',
    value: true,
    type: 'boolean',
    description: 'Bypass OCR rate limiter in dev mode',
  },
  {
    key: 'dev.ocrBypassDuplicateCheck',
    value: false,
    type: 'boolean',
    description: 'Allow duplicate file hashes in dev mode',
  },
  {
    key: 'dev.ocrAllowCacheClear',
    value: true,
    type: 'boolean',
    description: 'Allow OCR cache clearing via dev API',
  },
  {
    key: 'dev.ocrMaxConcurrencyOverride',
    value: 10,
    type: 'number',
    description: 'Max concurrent OCR jobs in dev (override)',
  },
  {
    key: 'dev.uiShowDebugPanel',
    value: true,
    type: 'boolean',
    description: 'Show debug panel in frontend (dev)',
  },
  {
    key: 'ocr.maxConcurrency',
    value: 3,
    type: 'number',
    description: 'Max concurrent OCR jobs (production)',
  },
  {
    key: 'groq.rateLimit',
    value: 100,
    type: 'number',
    description: 'Groq API calls per minute',
  },
];
```

#### 4. `ocrcaches`

```typescript
// backend/src/modules/ocr/models/OcrCache.ts
interface OcrCache {
  _id: ObjectId;
  fileHash: string;
  ocrResult: {
    ocrText: string;
    extractedFields: {
      vendor?: string;
      amount?: MoneyInt;
      date?: Date;
      taxId?: string;
    };
    confidenceScores: {
      vendor?: number;
      amount?: number;
      date?: number;
      overall?: number;
    };
    engine: 'paddleocr' | 'googlevision';
  };
  createdAt: Date;
  ttlExpiresAt: Date;  // Auto-delete after 30 days
}

const ocrCacheSchema = new mongoose.Schema<OcrCache>(
  {
    fileHash: { type: String, unique: true, required: true },
    ocrResult: {
      ocrText: String,
      extractedFields: {
        vendor: String,
        amount: { type: Number, validate: validateMoneyInt },
        date: Date,
        taxId: String,
      },
      confidenceScores: {
        vendor: Number,
        amount: Number,
        date: Number,
        overall: Number,
      },
      engine: { type: String, enum: ['paddleocr', 'googlevision'] },
    },
    createdAt: { type: Date, default: Date.now },
    ttlExpiresAt: { type: Date, index: { expireAfterSeconds: 0 } },  // TTL index
  },
  { timestamps: false }
);
```

---

## 10. COMMON WORKFLOWS & PATTERNS

### Workflow 1: Upload Receipt → OCR → Review

```
┌──────────────────┐
│ 1. Upload Image  │
└────────┬─────────┘
         │ POST /api/ocr/queue-upload
         ↓
┌──────────────────┐
│ 2. Create Receipt│
│ status: queued   │
└────────┬─────────┘
         │
         ↓
┌──────────────────┐
│ 3. User Clicks   │
│ "Run OCR FIFO"   │
└────────┬─────────┘
         │ POST /api/ocr/start-queue
         ↓
┌──────────────────┐
│ 4. Poll Status   │
│ GET /api/ocr/... │
└────────┬─────────┘
         │
         ↓
┌──────────────────┐
│ 5. Display OCR   │
│ Extract Fields   │
└────────┬─────────┘
         │
         ↓
┌──────────────────┐
│ 6. User Review & │
│ Correction       │
└────────┬─────────┘
         │ POST /api/ocr/confirm-receipts
         ↓
┌──────────────────┐
│ 7. Save Feedback │
│ (for ML training)│
└──────────────────┘
```

### Workflow 2: Confirm Receipt → Groq Classification → Teable

```
┌──────────────────┐
│ 1. Receipt       │
│ Confirmed by User│
└────────┬─────────┘
         │ POST /api/accounting/journal-entries/from-ocr
         ↓
┌──────────────────┐
│ 2. Groq AI       │
│ Classify Entry   │
│ (Dr/Cr + reason) │
└────────┬─────────┘
         │
         ↓
┌──────────────────┐
│ 3. Create Draft  │
│ JournalEntry     │
│ status: draft    │
└────────┬─────────┘
         │
         ↓
┌──────────────────┐
│ 4. MongoDB       │
│ Transaction OK   │
│ Trial Balance ✓  │
└────────┬─────────┘
         │
         ↓
┌──────────────────┐
│ 5. Push to       │
│ Teable (sync)    │
└────────┬─────────┘
         │
         ↓
┌──────────────────┐
│ 6. Return Entry  │
│ ID + Status      │
└──────────────────┘
```

### Workflow 3: Dev Mode - Upload Mock JSON & Test

```
┌──────────────────┐
│ 1. Dev clicks    │
│ "Upload Mock JSON"
└────────┬─────────┘
         │ POST /api/dev/ocr/mock-receipts
         │ Body: { receipts: [...], options: {...} }
         ↓
┌──────────────────┐
│ 2. Map to Receipt│
│ Generate fileHash│
└────────┬─────────┘
         │
         ↓
┌──────────────────┐
│ 3. Insert into   │
│ Receipts with    │
│ isMockData: true │
└────────┬─────────┘
         │
         ↓
┌──────────────────┐
│ 4. Optional:     │
│ Auto-validate    │
│ Auto-Groq        │
└────────┬─────────┘
         │
         ↓
┌──────────────────┐
│ 5. UI displays   │
│ mocks in queue   │
│ for review       │
└──────────────────┘
```

---

## 11. ERROR HANDLING & LOGGING

### Custom Error Hierarchy

```typescript
// backend/src/utils/errors.ts
export class AppError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public code: string,
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class FinancialIntegrityError extends AppError {
  constructor(message: string, details?: Record<string, any>) {
    super(500, message, 'FINANCIAL_INTEGRITY_ERROR', details);
  }
}

export class DuplicateReceiptError extends AppError {
  constructor(fileHash: string) {
    super(
      409,
      'Duplicate receipt detected',
      'DUPLICATE_RECEIPT',
      { fileHash }
    );
  }
}

export class OCRValidationError extends AppError {
  constructor(message: string, field: string) {
    super(422, message, 'OCR_VALIDATION_ERROR', { field });
  }
}

export class DevModeAuthError extends AppError {
  constructor() {
    super(403, 'Dev mode not enabled or invalid token', 'DEV_AUTH_ERROR');
  }
}
```

### Structured Logging (Winston)

```typescript
// backend/src/config/logger.ts
import winston from 'winston';

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'auto-acct-001' },
  transports: [
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
    }),
    new winston.transports.File({
      filename: 'logs/combined.log',
    }),
  ],
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(
          ({ level, message, timestamp, ...meta }) =>
            `${timestamp} [${level}] ${message} ${JSON.stringify(meta)}`
        )
      ),
    })
  );
}
```

### Global Error Handler

```typescript
// backend/src/middleware/errorHandler.ts
export const globalErrorHandler = (
  err: any,
  req: Express.Request,
  res: Express.Response,
  next: Express.NextFunction
) => {
  const correlationId = req.headers['x-correlation-id'] || generateId();
  
  // Log error
  logger.error({
    correlationId,
    error: err.message,
    code: err.code || 'UNKNOWN',
    stack: err.stack,
    path: req.path,
    method: req.method,
    statusCode: err.statusCode || 500,
  });
  
  // Alert Discord for 5xx errors
  if ((err.statusCode || 500) >= 500) {
    await alertDiscord({
      correlationId,
      error: err.message,
      path: req.path,
      timestamp: new Date(),
    });
  }
  
  const statusCode = err.statusCode || 500;
  const response = {
    success: false,
    error: {
      code: err.code || 'INTERNAL_SERVER_ERROR',
      message: err.message || 'An error occurred',
      correlationId,
      details: process.env.NODE_ENV === 'development' ? err.details : undefined,
    },
  };
  
  res.status(statusCode).json(response);
};
```

---

## 12. TESTING STRATEGY

### Unit Tests (Bun Test)

```typescript
// backend/tests/unit/utils/money.test.ts
import { expect, test, describe } from 'bun:test';
import { bahtToSatang, satangToBaht, plugSplit } from '@utils/money';

describe('Money Utils', () => {
  test('bahtToSatang converts correctly', () => {
    expect(bahtToSatang(125.5)).toBe(12550);
    expect(bahtToSatang(0.01)).toBe(1);
    expect(bahtToSatang(0)).toBe(0);
  });
  
  test('satangToBaht formats to 2 decimals', () => {
    expect(satangToBaht(12550 as MoneyInt)).toBe('125.50');
    expect(satangToBaht(100 as MoneyInt)).toBe('1.00');
  });
  
  test('plugSplit ensures sum equals total', () => {
    const split = plugSplit(10000 as MoneyInt, 3);
    const sum = split.reduce((a, b) => a + b, 0);
    expect(sum).toBe(10000);
    expect(split.length).toBe(3);
  });
  
  test('plugSplit handles remainder correctly', () => {
    const split = plugSplit(100 as MoneyInt, 3);
    // 100 / 3 = 33.33... → [34, 33, 33]
    expect(split[0]).toBe(34);
    expect(split[1]).toBe(33);
    expect(split[2]).toBe(33);
  });
});
```

### Integration Tests

```typescript
// backend/tests/integration/accounting/journal-entry.test.ts
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import mongoose from 'mongoose';
import { AccountingService } from '@modules/accounting/services/AccountingService';

describe('Journal Entry Integration', () => {
  let accountingService: AccountingService;
  let session: mongoose.ClientSession;
  
  beforeAll(async () => {
    await mongoose.connect(process.env.MONGODB_TEST_URI);
    accountingService = new AccountingService();
    session = await mongoose.startSession();
  });
  
  afterAll(async () => {
    await session.endSession();
    await mongoose.disconnect();
  });
  
  test('createJournalEntry maintains trial balance', async () => {
    const entries = [
      {
        account: { debit: '1010-Checking', credit: '5100-Food' },
        debit: 12500 as MoneyInt,
        credit: 12500 as MoneyInt,
        description: 'Coffee expense',
      },
    ];
    
    session.startTransaction();
    try {
      await accountingService.createJournalEntry(entries, session);
      const balance = await accountingService.getTrialBalance(session);
      expect(balance).toBe(0);  // ← Trial balance verified
      await session.commitTransaction();
    } catch (err) {
      await session.abortTransaction();
      throw err;
    }
  });
  
  test('voidJournalEntry creates reversal entry', async () => {
    // Create original entry, then void it
    const original = await JournalEntry.create([{ ... }]);
    await accountingService.voidJournalEntry(original._id, 'Test void');
    
    const voided = await JournalEntry.findById(original._id);
    expect(voided.status).toBe('voided');
    
    // Verify reversal entry exists
    const reversal = await JournalEntry.findOne({
      originalEntryId: original._id,
    });
    expect(reversal).toBeDefined();
    expect(reversal.status).toBe('voided_reversal');
  });
});
```

### Run Tests

```bash
# Run all tests (Bun test runner)
bun test

# Watch mode
bun test --watch

# Specific file
bun test tests/unit/utils/money.test.ts

# Output:
# tests/unit/utils/money.test.ts
#   Money Utils
#     ✓ bahtToSatang converts correctly (2ms)
#     ✓ satangToBaht formats to 2 decimals (1ms)
#     ✓ plugSplit ensures sum equals total (1ms)
#
# 3 tests pass (5ms)
```

---

## 13. TROUBLESHOOTING & FAQ

### Q: "Trial Balance Failed" Error

**Symptom**: Journal entry creation fails with `FinancialIntegrityError: Trial balance failed`

**Cause**: Debit ≠ Credit somewhere in the entry set

**Solution**:
```typescript
// Debug: print all entries before creating
for (const entry of entries) {
  console.log(`${entry.account.debit}: Dr=${entry.debit}, Cr=${entry.credit}`);
  if (entry.debit !== entry.credit) {
    console.error(`MISMATCH: ${entry.account.debit}`);
  }
}
```

---

### Q: MongoDB Replica Set Not Initializing

**Symptom**: Connection error: `no replset available`

**Solution**:
```bash
# For local MongoDB (Docker)
docker exec auto_acct_mongo mongosh --eval \
  'rs.initiate({ _id: "rs0", members: [{ _id: 0, host: "localhost:27017" }] })'

# Verify
docker exec auto_acct_mongo mongosh --eval 'rs.status()'
```

---

### Q: Floating Point Error in Amount Calculation

**Symptom**: 0.1 + 0.2 !== 0.3 in JavaScript

**Solution**: Always use `bahtToSatang()` before any arithmetic:
```typescript
// ❌ WRONG
const total = 0.1 + 0.2;

// ✅ CORRECT
const satang1 = bahtToSatang(0.1);  // 10
const satang2 = bahtToSatang(0.2);  // 20
const total = satang1 + satang2;    // 30 (= 0.30 THB)
```

---

### Q: Dev Mode APIs Return 403

**Symptom**: `POST /api/dev/ocr/mock-receipts` returns `DevModeAuthError`

**Solution**: Include dev token in header:
```bash
curl -X POST http://localhost:3000/api/dev/ocr/mock-receipts \
  -H "X-Dev-Token: your-dev-secret" \
  -H "Content-Type: application/json" \
  -d '{...}'

# Or check NODE_ENV and JWT role
echo $NODE_ENV  # should be 'development'
```

---

### Q: OCR Cache Not Clearing

**Symptom**: Same receipt processed twice returns cached result

**Solution**: Use dev API to clear cache:
```bash
curl -X DELETE http://localhost:3000/api/dev/ocr/cache \
  -H "X-Dev-Token: ..." \
  -H "Content-Type: application/json" \
  -d '{ "beforeDate": "2026-01-15" }'
```

---

## APPENDIX: Quick Reference

### Bun Commands

```bash
bun install              # Install deps
bun run dev              # Start dev server
bun test                 # Run tests
bun build                # Build for production
bun run db:migrate       # Apply migrations
bun run db:seed          # Seed initial data
bun run dev:gen-key      # Generate encryption key (32-byte hex)
```

### Common API Endpoints (Phase 3C)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `POST` | `/api/ocr/queue-upload` | Upload receipts (queue) |
| `POST` | `/api/ocr/start-queue` | Trigger FIFO OCR processing |
| `GET` | `/api/ocr/queue-status` | Inspect queue status |
| `POST` | `/api/ocr/confirm-receipts` | User confirms + save corrections |
| `POST` | `/api/accounting/journal-entries/from-ocr` | Create entries + sync to Teable |
| `POST` | `/api/dev/ocr/mock-receipts` | Upload mock JSON (dev only) |
| `DELETE` | `/api/dev/ocr/cache` | Clear OCR cache (dev only) |
| `GET` | `/api/dev/ocr/queues` | Inspect all queues (dev only) |
| `POST` | `/api/dev/queues/clear` | Clear queue (dev only) |
| `POST` | `/api/dev/ocr/reset-limits` | Reset quota/rate limit (dev only) |

---

## NEXT STEPS

✅ **Volume 1 covers**: Architecture, setup, financial principles, database design, core patterns, error handling, testing

⏭️ **Volume 2 will cover**:
- Step-by-step implementation walkthrough (Services, Controllers, Routes)
- Frontend integration (Next.js + Teable)
- OCR worker setup (Python + PaddleOCR)
- AI classification flow (Groq integration)
- Deployment & DevOps (Docker, GitHub Actions, self-hosted)
- Monitoring & metrics (Kibana, alerts)
- Advanced topics (multi-tenant, multi-currency, advanced reporting)

---

**Document Version**: 1.0  
**Last Updated**: January 20, 2026, 12:30 AM +07  
**Prepared by**: Auto-Acct Expert Team  
**Status**: ✅ Production-Ready
