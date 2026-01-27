# AutoAcct Task 2 – Groq OCR Integration Adapter

**Version:** 2.0.0 (Full Pipeline - Option C)  
**Category:** Backend Integration  
**Stack:** TypeScript, Node.js/Bun, Groq Vision API, BullMQ (async queue)  
**Project:** AutoAcct (OCR AI Auto Accounting)  
**Task:** `.ai/tasks/backend/task-2-groq-ocr.task.md`

---

## 📑 1. Quick Start (30 seconds)

**Groq OCR Integration (Option C)** = Full pipeline: Receipt image → Groq Vision → Raw OCR text → AI-powered field extraction → Confidence scoring

```typescript
// 1. Define OCR Result Type
export type OCRResult = {
  vendor?: string;
  amount?: MoneyInt;  // Satang
  date?: Date;
  taxId?: string;
  confidenceScores?: {
    vendor?: number;  // 0-1
    amount?: number;
    date?: number;
    overall?: number;
  };
  rawText?: string;   // Full OCR output from Groq
};

// 2. Use Adapter
const ocrService = process.env.NODE_ENV === 'development'
  ? new MockOCRService()           // ← In-memory, instant results
  : new GroqOCRService(apiKey);    // ← Real Groq Vision API, async

// 3. Queue a Receipt for OCR
const { jobId } = await ocrService.extractFromImage(
  receipt.fileBuffer,
  receipt.mimeType,
  correlationId
);

// 4. Frontend polls status endpoint
// GET /api/receipts/:receiptId/ocr-status → { status: 'complete', result: OCRResult }

// 5. Response includes full extracted data + confidence
{
  "vendor": "STARBUCKS BANGKOK 456",
  "amount": 12500,
  "date": "2026-01-26",
  "taxId": "0123456789012",
  "rawText": "[Full OCR text from image]",
  "confidenceScores": {
    "vendor": 0.95,
    "amount": 0.98,
    "date": 0.88,
    "overall": 0.94
  }
}
```

---

## 📖 2. Description

**Groq OCR Full Pipeline (Option C)** = ระบบที่:

- 🤖 **Step 1: Groq Vision API** – ส่งรูปภาพไปให้ Groq Vision LLM อ่าน
- 📝 **Step 2: Raw OCR Text** – Groq คืนข้อความทั้งหมดที่อ่านได้จากรูป
- 🧠 **Step 3: AI Parsing** – ใช้ LLM prompt engineering สกัดฟิลด์ (vendor, amount, date, taxId)
- 📊 **Step 4: Confidence Scoring** – คำนวณความมั่นใจ 0-1 สำหรับแต่ละฟิลด์
- 🔄 **Async Queue (BullMQ)** – ไม่บล็อก HTTP response, process ใน background
- 🔐 **Dev/Prod Duality** – MockOCRService (instant) vs GroqOCRService (real API, retry)

### ความแตกต่างจาก Task 1:

```
Task 1 (Ledger Adapter):
  Receipt → Direct API call → Journal Entry ✓ (sync)

Task 2 (Groq OCR - Option C):
  Receipt image → Queue → Groq Vision → Extract text → Parse fields → Score confidence → Update receipt ✓ (async)
```

---

## 🎯 3. Environment Setup

### 3.1 `.env.example` – Template for Configuration

```bash
# ============================================
# GROQ API CONFIGURATION (Task 2: OCR)
# ============================================

# Groq API Key - Get from https://console.groq.com/keys
# Steps to obtain:
# 1. Go to https://console.groq.com/keys
# 2. Click "Create API Key"
# 3. Copy the key and paste below
GROQ_API_KEY=gsk_your_groq_api_key_here_replace_this

# Groq Model Selection
# Options: grok-vision-alpha, llama-2-vision-90b (when available)
GROQ_MODEL=grok-vision-alpha

# ============================================
# REDIS CONFIGURATION (BullMQ Queue)
# ============================================

REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=          # Leave empty if no password

# ============================================
# OCR SERVICE CONFIGURATION
# ============================================

# OCR Service Mode: 'mock' (dev) or 'groq' (prod)
# - mock: Fast testing, no API calls
# - groq: Real Groq Vision API with async queue
OCR_SERVICE_MODE=mock

# Confidence threshold (0-1) for auto-acceptance
# If confidence >= this value, OCR result auto-accepted
# If confidence < this value, mark as 'NEEDS_MANUAL_ENTRY'
OCR_CONFIDENCE_THRESHOLD=0.75

# Max processing time (milliseconds) before timeout
OCR_TIMEOUT_MS=30000

# Number of concurrent OCR workers
OCR_WORKER_CONCURRENCY=3

# Retry configuration
OCR_MAX_RETRIES=3
OCR_BACKOFF_DELAY_MS=2000  # Exponential backoff: 2s, 4s, 8s

# Circuit breaker configuration
OCR_CIRCUIT_BREAKER_THRESHOLD=5      # Failures before opening
OCR_CIRCUIT_BREAKER_RESET_MS=30000   # Time to reset

# ============================================
# LOGGING & MONITORING
# ============================================

LOG_LEVEL=debug          # debug, info, warn, error
ENABLE_OCR_METRICS=true
```

### 3.2 Installation & Dependencies

```bash
# Install dependencies (if not already installed)
npm install groq-sdk bull redis axios zod

# or with Bun
bun add groq-sdk bull redis axios zod

# Start Redis locally (required for BullMQ)
# Option 1: Docker
docker run -d -p 6379:6379 redis:7-alpine

# Option 2: Local Redis
redis-server

# Verify Redis is running
redis-cli ping  # Should return PONG
```

---

## 🏗️ 4. Architecture: Full Pipeline (Option C)

### 4.1 Component Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    Receipt Upload                           │
│              (ReceiptController.upload)                     │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
        ┌──────────────────────────────┐
        │   OCRIntegrationService      │
        │ (Factory: Mock or Groq)      │
        └──────────────┬───────────────┘
                       │
        ┌──────────────┴─────────────────┐
        │                                │
        ▼                                ▼
  ┌──────────────┐            ┌──────────────────────┐
  │ MockOCRSvc   │            │  GroqOCRService      │
  │ (instant)    │            │  (real API, retry)   │
  └──────────────┘            └──────────┬───────────┘
                                         │
                       ┌─────────────────┴──────────────┐
                       │                                │
                       ▼                                ▼
                ┌──────────────┐          ┌──────────────────────┐
                │  BullMQ      │          │  Groq Vision API     │
                │  Queue       │          │  (Vision LLM)        │
                │  (Redis)     │          │                      │
                └──────┬───────┘          │ Step 1: Send image   │
                       │                  │ Step 2: Get raw text │
                       ▼                  └──────────┬───────────┘
                ┌──────────────┐                     │
                │   Worker     │                     ▼
                │ (BullMQ)     │          ┌──────────────────────┐
                │              │          │ GroqPromptService    │
                │ Process jobs │          │ (Prompt engineering) │
                └──────┬───────┘          │                      │
                       │                  │ Step 3: Parse fields │
                       │                  │ Step 4: Structure    │
                       │                  └──────────┬───────────┘
                       │                             │
                       │                  ┌──────────▼──────────┐
                       │                  │ ConfidenceScorer    │
                       │                  │ (Calculate 0-1)     │
                       │                  │                     │
                       │                  │ vendor: 0.95        │
                       │                  │ amount: 0.98        │
                       │                  │ date: 0.88          │
                       │                  │ overall: 0.94       │
                       │                  └──────────┬──────────┘
                       │                             │
                       └─────────────────┬───────────┘
                                         │
                                         ▼
                        ┌────────────────────────────────┐
                        │   Update Receipt MongoDB       │
                        │ • ocrStatus = 'complete'       │
                        │ • ocrResult = { extracted }    │
                        │ • ocrConfidence = 0.94         │
                        └────────────────────────────────┘
                                         │
                                         ▼
                        ┌────────────────────────────────┐
                        │  Frontend polls status         │
                        │  GET /receipts/:id/ocr-status  │
                        │  Response: Complete + result   │
                        └────────────────────────────────┘
```

### 4.2 Data Flow: Full Pipeline

```
Input: Receipt Image (JPG/PNG/PDF)
  ↓
[Step 1] Send to Groq Vision API
  ↓
Groq Response: Raw OCR text
  "STARBUCKS COFFEE COMPANY
   BANGKOK BRANCH 456
   DATE: 26/01/2026
   AMOUNT: ฿125.50
   TAX ID: 0123456789012
   ..."
  ↓
[Step 2] GroqPromptService parses with LLM
  Prompt: "Extract vendor, amount (in Baht), date (YYYY-MM-DD), taxId from Thai receipt"
  ↓
Groq Response: JSON
  {
    "vendor": "STARBUCKS BANGKOK 456",
    "amount": "125.50",
    "date": "2026-01-26",
    "taxId": "0123456789012"
  }
  ↓
[Step 3] ConfidenceScorer calculates confidence
  • vendor similarity to known patterns: 0.95
  • amount regex match: 0.98
  • date format correctness: 0.88
  • overall average: 0.94
  ↓
Output: OCRResult
  {
    vendor: "STARBUCKS BANGKOK 456",
    amount: 12550 (in Satang),
    date: Date(2026-01-26),
    taxId: "0123456789012",
    rawText: "[Full OCR text]",
    confidenceScores: {
      vendor: 0.95,
      amount: 0.98,
      date: 0.88,
      overall: 0.94
    }
  }
```

---

## 🔧 5. Core Principles (MANDATORY)

### 5.1 Full Pipeline = 4 Steps (Not Just Image→Text)

**Rule:** OCR must include:
1. ✅ Image → Groq Vision → Raw text
2. ✅ Raw text → LLM prompt → Parse fields
3. ✅ Parsed fields → Validate & score confidence
4. ✅ Return: Fields + raw text + confidence scores

**Why:**
- 🎯 Transparency: User sees both AI extraction AND raw text
- 🔍 Auditability: Can re-verify if needed
- 📊 Confidence: User knows how sure AI is
- 🛡️ Safety: Low confidence → user must verify manually

### 5.2 Async Queue (BullMQ) - Never Block

```typescript
// ❌ WRONG: Blocking
async upload(req, res, next) {
  const receipt = await receiptService.uploadReceipt(...);
  const { vendor, amount, date } = await ocrService.extract(...);  // 3-5s wait!
  res.json({ receipt, vendor, amount, date });
}

// ✅ CORRECT: Queue + poll
async upload(req, res, next) {
  const receipt = await receiptService.uploadReceipt(...);
  const { jobId } = await ocrService.queueExtraction(...);  // Return instantly
  res.status(202).json({ receiptId: receipt._id, jobId });
  // Frontend: setInterval(() => GET /receipts/:id/ocr-status, 1000)
}
```

### 5.3 Confidence Scoring: Every Field Gets a Score

**Rule:** Return 0-1 confidence for vendor, amount, date, overall

```typescript
type ConfidenceScores = {
  vendor?: number;    // 0-1: How sure about vendor name
  amount?: number;    // 0-1: How sure about total amount
  date?: number;      // 0-1: How sure about receipt date
  overall?: number;   // 0-1: Average confidence
};

// If overall < 0.75 (configurable):
if (confidenceScores.overall < 0.75) {
  receipt.status = 'NEEDS_MANUAL_ENTRY';  // User must verify
}
```

### 5.4 Raw Text Preservation (Audit Trail)

**Rule:** Always store rawText from Groq Vision

```typescript
type OCRResult = {
  vendor?: string;
  amount?: MoneyInt;
  date?: Date;
  taxId?: string;
  rawText?: string;        // ✅ Full OCR output - never discard!
  confidenceScores?: { ... };
};

// Why:
// 1. Audit: Prove AI extracted from this text
// 2. Re-score: Recalculate if business rules change
// 3. Human review: User can read raw to understand low confidence
```

### 5.5 CorrelationId Everywhere

**Rule:** Every BullMQ message includes correlationId

```typescript
await ocrQueue.add(
  'extract',
  {
    receiptId,
    fileBuffer,
    mimeType,
    correlationId,  // ✅ Propagate for end-to-end tracing!
  },
  { jobId: `ocr-${receiptId}` }
);

// Logging:
logger.info(`[${correlationId}] OCR job queued: ${jobId}`);
logger.info(`[${correlationId}] Groq API called for image`);
logger.info(`[${correlationId}] Confidence: 0.94, marked complete`);
```

### 5.6 Error Mapping (Same as Task 1)

**Rule:** All Groq API errors → ExternalServiceError

```typescript
try {
  const response = await groqClient.messages.create({
    model: this.model,
    messages: payload,
    max_tokens: this.maxTokens,
  });
} catch (err: any) {
  throw new ExternalServiceError(
    'GroqVision',
    `OCR extraction failed: ${err.message}`,
    err.response?.status || 502
  );
}
```

---

## 📝 6. OCR Data Model & Type Definitions

### 6.1 OCRResult Type (Core)

```typescript
// modules/ocr/types/ocr.types.ts

export type OCRResult = {
  vendor?: string;              // e.g., "STARBUCKS BANGKOK 456"
  amount?: MoneyInt;            // e.g., 12550 (in Satang)
  date?: Date;                  // e.g., 2026-01-26
  taxId?: string;               // e.g., "0123456789012"
  
  // Full Pipeline Specific
  rawText?: string;             // Full OCR text from Groq Vision
  extractionDuration?: number;  // ms, for metrics
  
  confidenceScores?: {
    vendor?: number;            // 0-1
    amount?: number;
    date?: number;
    overall?: number;           // Average of above
  };
};

export type OCRJobStatus = 'queued' | 'processing' | 'complete' | 'failed';

export type OCRJobResult = {
  jobId: string;
  receiptId: string;
  status: OCRJobStatus;
  result?: OCRResult;
  error?: string;
  createdAt: Date;
  completedAt?: Date;
  processingTime?: number;      // ms
};

// Groq Vision Payload Structure
export type GroqVisionPayload = {
  model: string;
  messages: Array<{
    role: 'user' | 'system';
    content: Array<{
      type: 'text' | 'image_url';
      text?: string;
      image_url?: { url: string };
    }>;
  }>;
  max_tokens: number;
  temperature?: number;  // 0-1, default 0.7
};

// Groq Vision API Response
export type GroqVisionResponse = {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;  // ← Raw OCR text here
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
};

// Parsed JSON from Step 2 (GroqPromptService)
export type ParsedOCRFields = {
  vendor?: string;
  amount?: string;     // "125.50" (in Baht, string format)
  date?: string;       // "2026-01-26"
  taxId?: string;
};
```

### 6.2 Receipt Model Extension

```typescript
// modules/receipt/models/Receipt.ts

interface IReceipt extends Document {
  // Existing fields...
  fileName: string;
  fileHash: string;
  driveFileId?: string;
  mimeType: string;

  // NEW: OCR Integration Fields
  ocrJobId?: string;              // BullMQ job ID
  ocrStatus?: 'queued' | 'processing' | 'complete' | 'failed' | 'needs_manual';
  ocrResult?: OCRResult;          // Full result with rawText + confidence
  ocrConfidence?: number;         // Overall confidence 0-1
  ocrErrors?: string[];           // Array of error messages

  // Metadata
  clientId: ObjectId;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: ObjectId;
}

// Mongoose schema
const receiptSchema = new mongoose.Schema({
  // ... existing fields ...
  
  // OCR Fields
  ocrJobId: {
    type: String,
    index: true,  // Index for fast polling
  },
  ocrStatus: {
    type: String,
    enum: ['queued', 'processing', 'complete', 'failed', 'needs_manual'],
    default: 'queued',
  },
  ocrResult: mongoose.Schema.Types.Mixed,  // Flexible JSON storage
  ocrConfidence: {
    type: Number,
    min: 0,
    max: 1,
  },
  ocrErrors: [String],
  
  // Timestamps
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
}, { timestamps: true });

// Compound index for efficient polling
receiptSchema.index({ ocrStatus: 1, ocrJobId: 1 });
receiptSchema.index({ clientId: 1, ocrStatus: 1 });
```

---

## 7️⃣ 7. GroqPromptService (Step 2: Parse Fields)

### 7.1 Purpose

GroqPromptService handles **Step 2 of the full pipeline**: Takes raw OCR text from Groq Vision and uses LLM prompt engineering to extract structured fields (vendor, amount, date, taxId).

```typescript
// modules/ocr/services/GroqPromptService.ts

import Groq from 'groq-sdk';
import { ParsedOCRFields } from '../types/ocr.types';
import { ExternalServiceError } from '../../../shared/errors';

export class GroqPromptService {
  private groqClient: Groq;

  constructor(apiKey: string) {
    this.groqClient = new Groq({ apiKey });
  }

  /**
   * Parse raw OCR text using Groq LLM with Thai receipt prompt.
   * Step 2 of full pipeline: Raw text → Structured fields
   * 
   * @param rawText Full OCR output from Groq Vision Step 1
   * @param correlationId For tracing
   * @returns { vendor?, amount?, date?, taxId? }
   */
  async parseReceiptText(
    rawText: string,
    correlationId: string
  ): Promise<ParsedOCRFields> {
    try {
      const systemPrompt = `You are an expert at parsing Thai receipts/invoices.
Your task is to extract structured data from OCR text.

Instructions:
1. Extract vendor_name: Business name from the receipt
2. Extract total_amount_baht: Total amount in Thai Baht (numeric only, e.g., "125.50")
3. Extract receipt_date: Date in YYYY-MM-DD format
4. Extract tax_id: Thai tax ID if visible (13 digits, format: XXXXXXXXX)

Important:
- If a field is not visible or unclear, OMIT it from the response
- amount_baht should be a number string without currency symbol
- Return ONLY valid JSON, no explanation or extra text

Example:
Input OCR: "STARBUCKS BANGKOK 26/01/2026 ฿125.50 TAX: 0123456789012"
Output: {"vendor_name": "STARBUCKS BANGKOK", "amount_baht": "125.50", "receipt_date": "2026-01-26", "tax_id": "0123456789012"}`;

      const userPrompt = `Parse this Thai receipt OCR text:\n\n${rawText}`;

      const response = await this.groqClient.messages.create({
        model: 'mixtral-8x7b-32768',  // Faster than vision model for text parsing
        messages: [
          {
            role: 'user',
            content: userPrompt,
          },
        ],
        system: systemPrompt,
        max_tokens: 200,
        temperature: 0.3,  // Low temperature for consistent output
      });

      // Extract JSON from response
      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response type from Groq');
      }

      const jsonMatch = content.text.match(/\{[^}]+\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      const result: ParsedOCRFields = {
        vendor: parsed.vendor_name,
        amount: parsed.amount_baht,
        date: parsed.receipt_date,
        taxId: parsed.tax_id,
      };

      console.log(`[${correlationId}] Parsed OCR fields:`, result);

      return result;
    } catch (err: any) {
      console.error(`[${correlationId}] Failed to parse OCR text:`, err.message);

      throw new ExternalServiceError(
        'GroqPromptService',
        `Failed to parse OCR text: ${err.message}`,
        502
      );
    }
  }

  /**
   * Validate parsed fields (optional stricter checking)
   */
  validateParsedFields(fields: ParsedOCRFields): boolean {
    if (fields.vendor && fields.vendor.length < 2) return false;
    if (fields.amount) {
      const amountNum = parseFloat(fields.amount);
      if (isNaN(amountNum) || amountNum <= 0) return false;
    }
    if (fields.date && !this.isValidDate(fields.date)) return false;
    if (fields.taxId && !/^\d{13}$/.test(fields.taxId)) return false;
    return true;
  }

  private isValidDate(dateStr: string): boolean {
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    if (!regex.test(dateStr)) return false;
    const date = new Date(dateStr);
    return date instanceof Date && !isNaN(date.getTime());
  }
}
```

---

## 8️⃣ 8. ConfidenceScorer (Step 3: Score Confidence)

### 8.1 Purpose

ConfidenceScorer calculates 0-1 confidence for each extracted field based on multiple factors:
- Text pattern matching (e.g., is amount a valid number?)
- Field completeness
- Thai business naming conventions
- Tax ID format validation

```typescript
// modules/ocr/services/ConfidenceScorer.ts

import { ParsedOCRFields } from '../types/ocr.types';

export class ConfidenceScorer {
  /**
   * Calculate confidence scores for each field.
   * Step 3 of full pipeline: Validate and score parsed fields
   * 
   * @param parsedFields Output from GroqPromptService
   * @param rawText Original OCR text for pattern matching
   * @returns { vendor?, amount?, date?, overall? } all 0-1
   */
  scoreFields(
    parsedFields: ParsedOCRFields,
    rawText: string
  ): {
    vendor?: number;
    amount?: number;
    date?: number;
    overall?: number;
  } {
    const scores = {
      vendor: this.scoreVendor(parsedFields.vendor, rawText),
      amount: this.scoreAmount(parsedFields.amount, rawText),
      date: this.scoreDate(parsedFields.date, rawText),
    };

    // Calculate overall confidence (average of non-null scores)
    const validScores = Object.values(scores).filter((s) => s !== undefined) as number[];
    const overall = validScores.length > 0
      ? validScores.reduce((a, b) => a + b, 0) / validScores.length
      : 0;

    return { ...scores, overall };
  }

  /**
   * Score vendor name confidence (0-1)
   * Factors:
   * - Length > 3 characters (not a junk string)
   * - Contains Thai or English letters
   * - Not all uppercase (spammy receipts often all caps)
   * - Appears in rawText (not hallucinated)
   */
  private scoreVendor(vendor?: string, rawText?: string): number | undefined {
    if (!vendor) return undefined;

    let score = 0.5;  // Base score

    // Length check
    if (vendor.length >= 3 && vendor.length <= 100) score += 0.15;

    // Contains letters (not just numbers)
    if (/[a-zA-Zก-ฮ]/.test(vendor)) score += 0.1;

    // Not overly uppercase
    if (!/^[A-Z\s0-9]+$/.test(vendor)) score += 0.1;

    // Appears in rawText (not hallucinated)
    if (rawText && rawText.toUpperCase().includes(vendor.toUpperCase())) {
      score += 0.2;
    } else {
      score -= 0.1;  // Penalize if not found in raw text
    }

    return Math.max(0, Math.min(1, score));
  }

  /**
   * Score amount confidence (0-1)
   * Factors:
   * - Valid number format
   * - Reasonable range (0.01 - 100,000 Baht)
   * - Amount appears in rawText with currency symbol
   * - Matches common price patterns
   */
  private scoreAmount(amount?: string, rawText?: string): number | undefined {
    if (!amount) return undefined;

    let score = 0.5;  // Base score

    // Parse as number
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum)) return 0;  // Invalid number = 0 confidence

    // Reasonable range (0.01 - 999,999 Baht)
    if (amountNum >= 0.01 && amountNum <= 999999) score += 0.15;
    if (amountNum < 0.01 || amountNum > 999999) score -= 0.2;

    // Decimal places (usually 0-2 for Thai currency)
    const decimalPlaces = (amount.split('.')[1] || '').length;
    if (decimalPlaces <= 2) score += 0.1;
    if (decimalPlaces > 2) score -= 0.1;

    // Appears in rawText with currency symbol
    if (rawText) {
      const patterns = [
        `฿\\s*${amount}`,  // ฿125.50
        `${amount}\\s*฿`,  // 125.50฿
        amount,            // 125.50 (bare number)
      ];
      if (patterns.some((p) => new RegExp(p).test(rawText))) {
        score += 0.2;
      } else {
        score -= 0.1;
      }
    }

    return Math.max(0, Math.min(1, score));
  }

  /**
   * Score date confidence (0-1)
   * Factors:
   * - Valid YYYY-MM-DD format
   * - Reasonable date (not future, not >5 years old)
   * - Date appears in rawText in various formats
   */
  private scoreDate(date?: string, rawText?: string): number | undefined {
    if (!date) return undefined;

    let score = 0.5;  // Base score

    // Valid format (YYYY-MM-DD)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return 0;  // Invalid format = 0

    // Valid actual date
    const dateObj = new Date(date);
    if (isNaN(dateObj.getTime())) return 0;

    // Reasonable date range (not future, not >10 years old)
    const now = new Date();
    const tenYearsAgo = new Date(now.getFullYear() - 10, now.getMonth(), now.getDate());
    if (dateObj > now) {
      score -= 0.3;  // Future date is suspicious
    } else if (dateObj < tenYearsAgo) {
      score -= 0.2;  // Very old receipt
    } else {
      score += 0.2;  // Recent receipt is good
    }

    // Date appears in rawText (various formats)
    if (rawText) {
      const [year, month, day] = date.split('-');
      const patterns = [
        `${day}/${month}/${year}`,  // Thai format: 26/01/2026
        `${month}/${day}/${year}`,  // US format: 01/26/2026
        `${day}-${month}-${year}`,  // EU format: 26-01-2026
        date,                       // Exact format
      ];
      if (patterns.some((p) => rawText.includes(p))) {
        score += 0.2;
      }
    }

    return Math.max(0, Math.min(1, score));
  }

  /**
   * Get confidence threshold recommendation
   * Used to auto-accept vs require manual review
   */
  getThreshold(): number {
    // Configurable via env: OCR_CONFIDENCE_THRESHOLD
    return parseFloat(process.env.OCR_CONFIDENCE_THRESHOLD || '0.75');
  }

  /**
   * Should user be asked to verify based on confidence?
   */
  needsManualReview(overallConfidence: number): boolean {
    return overallConfidence < this.getThreshold();
  }
}
```

---

## 9️⃣ 9. GroqOCRService (Full Pipeline Orchestration)

### 9.1 Complete Implementation

```typescript
// modules/ocr/adapters/GroqOCRService.ts

import Groq from 'groq-sdk';
import axios from 'axios';
import { IOCRService } from './IOCRService';
import { OCRResult, OCRJobStatus, GroqVisionPayload } from '../types/ocr.types';
import { ExternalServiceError } from '../../../shared/errors';
import { MoneyInt } from '../../../shared/types/money';
import { GroqPromptService } from '../services/GroqPromptService';
import { ConfidenceScorer } from '../services/ConfidenceScorer';

export class GroqOCRService implements IOCRService {
  private groqClient: Groq;
  private promptService: GroqPromptService;
  private scorer: ConfidenceScorer;
  private apiKey: string;
  private model = 'grok-vision-alpha';  // Groq Vision model
  private requestTimeout = 30000;  // 30s timeout
  private maxTokens = 500;

  // Circuit breaker
  private failureCount = 0;
  private circuitBreakerThreshold = parseInt(
    process.env.OCR_CIRCUIT_BREAKER_THRESHOLD || '5'
  );
  private circuitBreakerResetTime = parseInt(
    process.env.OCR_CIRCUIT_BREAKER_RESET_MS || '30000'
  );
  private circuitBreakerOpenedAt: Date | null = null;
  private circuitState: 'closed' | 'open' | 'half-open' = 'closed';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.groqClient = new Groq({ apiKey });
    this.promptService = new GroqPromptService(apiKey);
    this.scorer = new ConfidenceScorer();
  }

  async extractFromImage(
    imageBuffer: Buffer,
    mimeType: string,
    correlationId: string
  ): Promise<{ jobId: string; status: 'queued' }> {
    // Check circuit breaker
    if (this.circuitState === 'open') {
      const now = Date.now();
      const elapsedTime = now - (this.circuitBreakerOpenedAt?.getTime() || 0);
      if (elapsedTime > this.circuitBreakerResetTime) {
        this.circuitState = 'half-open';
        console.log(
          `[${correlationId}] GroqOCR: Circuit breaker transitioning to half-open`
        );
      } else {
        throw new ExternalServiceError(
          'GroqVision',
          'Circuit breaker open - service temporarily unavailable',
          503
        );
      }
    }

    // Convert buffer to base64 for API
    const imageBase64 = imageBuffer.toString('base64');

    // Build Groq Vision request (Step 1: Send image)
    const payload: GroqVisionPayload = {
      model: this.model,
      messages: [
        {
          role: 'system',
          content: [
            {
              type: 'text',
              text: `You are an OCR expert for Thai receipts/invoices.
Extract ALL text visible in the image, preserving structure and layout as much as possible.
Return complete OCR text, including:
- Business name / vendor
- Date/time
- Item descriptions and prices
- Tax information
- Total amount
- Any other visible text

Be thorough and accurate. Preserve Thai and English text.`,
            },
          ],
        },
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: {
                url: `data:${mimeType};base64,${imageBase64}`,
              },
            },
            {
              type: 'text',
              text: 'Extract all text from this receipt image.',
            },
          ],
        },
      ],
      max_tokens: this.maxTokens,
    };

    const startTime = Date.now();

    try {
      // Step 1: Send to Groq Vision API
      console.log(
        `[${correlationId}] GroqOCR: Calling Vision API for full pipeline`
      );

      const response = await this.groqClient.messages.create(payload as any);

      // Extract raw OCR text from response
      const visionResponse = response.content[0];
      if (visionResponse.type !== 'text') {
        throw new Error('Unexpected response type from Groq Vision');
      }

      const rawOCRText = visionResponse.text;
      console.log(
        `[${correlationId}] GroqOCR: Step 1 complete - Raw OCR text:`,
        rawOCRText.substring(0, 200) + '...'
      );

      // Step 2: Parse raw text using GroqPromptService
      console.log(`[${correlationId}] GroqOCR: Step 2 - Parsing fields`);
      const parsedFields = await this.promptService.parseReceiptText(
        rawOCRText,
        correlationId
      );

      // Step 3: Score confidence using ConfidenceScorer
      console.log(
        `[${correlationId}] GroqOCR: Step 3 - Scoring confidence`
      );
      const confidenceScores = this.scorer.scoreFields(
        parsedFields,
        rawOCRText
      );

      // Step 4: Convert to OCRResult format
      const processingTime = Date.now() - startTime;
      const ocrResult: OCRResult = {
        vendor: parsedFields.vendor,
        amount: parsedFields.amount
          ? this.convertBahtToSatang(parseFloat(parsedFields.amount))
          : undefined,
        date: parsedFields.date ? new Date(parsedFields.date) : undefined,
        taxId: parsedFields.taxId,
        rawText: rawOCRText,
        extractionDuration: processingTime,
        confidenceScores,
      };

      // Reset circuit breaker on success
      this.failureCount = 0;
      if (this.circuitState === 'half-open') {
        this.circuitState = 'closed';
        console.log(
          `[${correlationId}] GroqOCR: Circuit breaker closed`
        );
      }

      // Generate job ID and cache result (in production, store in Redis)
      const jobId = `groq-ocr-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      
      console.log(
        `[${correlationId}] GroqOCR: Full pipeline complete (${processingTime}ms)`,
        { confidence: confidenceScores.overall }
      );

      // Store result in memory/Redis for polling (simplified here)
      this.cacheResult(jobId, {
        status: 'complete',
        result: ocrResult,
        completedAt: new Date(),
        processingTime,
      });

      return { jobId, status: 'queued' };
    } catch (err: any) {
      this.failureCount++;

      if (this.failureCount >= this.circuitBreakerThreshold) {
        this.circuitState = 'open';
        this.circuitBreakerOpenedAt = new Date();
        console.error(
          `[${correlationId}] GroqOCR: Circuit breaker opened after ${this.failureCount} failures`
        );
      }

      const statusCode = err.response?.status || 502;
      const errorMessage = err.response?.data?.error?.message || err.message;

      throw new ExternalServiceError(
        'GroqVision',
        `OCR extraction failed: ${errorMessage}`,
        statusCode
      );
    }
  }

  async getResult(
    jobId: string,
    correlationId: string
  ): Promise<{ status: OCRJobStatus; result?: OCRResult; error?: string }> {
    // Retrieve from cache/Redis (simplified: in-memory Map)
    const cachedJob = this.getFromCache(jobId);

    if (!cachedJob) {
      return { status: 'failed', error: 'Job not found' };
    }

    console.log(`[${correlationId}] GroqOCR: Retrieved job ${jobId}`);

    return {
      status: cachedJob.status,
      result: cachedJob.result,
      error: cachedJob.error,
    };
  }

  async health(): Promise<'healthy' | 'degraded' | 'down'> {
    try {
      // Quick health check with minimal request
      await this.groqClient.messages.create({
        model: 'mixtral-8x7b-32768',
        messages: [
          {
            role: 'user',
            content: 'ping',
          },
        ],
        max_tokens: 10,
      } as any);
      return 'healthy';
    } catch (err) {
      return 'down';
    }
  }

  // ===== Helper Methods =====

  private convertBahtToSatang(baht: number): MoneyInt {
    return Math.round(baht * 100) as MoneyInt;
  }

  // In-memory cache for demo (replace with Redis in production)
  private cache = new Map<string, any>();

  private cacheResult(jobId: string, result: any): void {
    this.cache.set(jobId, result);
    // Auto-expire after 1 hour
    setTimeout(() => this.cache.delete(jobId), 3600000);
  }

  private getFromCache(jobId: string): any {
    return this.cache.get(jobId);
  }
}
```

---

## 🟢 10. MockOCRService (Dev Mode)

```typescript
// modules/ocr/adapters/MockOCRService.ts

import { IOCRService } from './IOCRService';
import { OCRResult, OCRJobStatus } from '../types/ocr.types';
import { MoneyInt } from '../../../shared/types/money';

export class MockOCRService implements IOCRService {
  private jobs: Map<
    string,
    { status: OCRJobStatus; result?: OCRResult; error?: string }
  > = new Map();
  private jobCounter = 0;

  async extractFromImage(
    imageBuffer: Buffer,
    mimeType: string,
    correlationId: string
  ): Promise<{ jobId: string; status: 'queued' }> {
    const jobId = `mock-ocr-${++this.jobCounter}`;

    // Simulate full pipeline result
    const mockResult: OCRResult = {
      vendor: 'STARBUCKS BANGKOK 456',
      amount: 12550 as MoneyInt,  // 125.50 Baht in Satang
      date: new Date('2026-01-26'),
      taxId: '0123456789012',
      rawText: `STARBUCKS COFFEE COMPANY
BANGKOK BRANCH 456
DATE: 26/01/2026
AMOUNT: ฿125.50
TAX ID: 0123456789012
THANK YOU`,
      confidenceScores: {
        vendor: 0.95,
        amount: 0.98,
        date: 0.88,
        overall: 0.94,
      },
      extractionDuration: Math.random() * 500,  // 0-500ms
    };

    // Instant completion in mock mode
    this.jobs.set(jobId, { status: 'complete', result: mockResult });

    console.log(
      `[${correlationId}] MockOCR: Created job ${jobId} with full pipeline result:`,
      {
        vendor: mockResult.vendor,
        amount: mockResult.amount,
        confidence: mockResult.confidenceScores?.overall,
      }
    );

    return { jobId, status: 'queued' };
  }

  async getResult(
    jobId: string,
    correlationId: string
  ): Promise<{ status: OCRJobStatus; result?: OCRResult; error?: string }> {
    const job = this.jobs.get(jobId);
    if (!job) {
      return { status: 'failed', error: 'Job not found' };
    }

    console.log(
      `[${correlationId}] MockOCR: Retrieved job ${jobId}`,
      job
    );

    return job;
  }

  async health(): Promise<'healthy' | 'degraded' | 'down'> {
    return 'healthy';
  }
}
```

---

## 1️⃣0️⃣ 11. API Endpoints for Full Pipeline

```typescript
// modules/receipt/routes/receipt.routes.ts

// POST /api/receipts/upload
// Queues OCR job (202 Accepted)
router.post(
  '/upload',
  authMiddleware,
  multer.single('file'),
  async (req, res, next) => {
    try {
      const receipt = await receiptService.uploadReceipt(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype,
        req.user.clientId,
        req.correlationId
      );

      res.status(202).json({
        success: true,
        data: {
          receiptId: receipt._id,
          fileName: receipt.fileName,
          ocrJobId: receipt.ocrJobId,
          ocrStatus: receipt.ocrStatus,
          message: 'Receipt uploaded. OCR processing started.',
        },
        meta: {
          correlationId: req.correlationId,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/receipts/:receiptId/ocr-status
// Poll for OCR result with full pipeline data
router.get(
  '/:receiptId/ocr-status',
  authMiddleware,
  async (req, res, next) => {
    try {
      const receipt = await Receipt.findById(req.params.receiptId);
      if (!receipt) {
        return res.status(404).json({
          success: false,
          error: 'Receipt not found',
        });
      }

      const response: any = {
        success: true,
        data: {
          receiptId: receipt._id,
          ocrStatus: receipt.ocrStatus,
        },
        meta: {
          correlationId: req.correlationId,
          timestamp: new Date().toISOString(),
        },
      };

      // Add full result if complete
      if (receipt.ocrStatus === 'complete' && receipt.ocrResult) {
        response.data.ocrResult = {
          vendor: receipt.ocrResult.vendor,
          amount: receipt.ocrResult.amount,
          date: receipt.ocrResult.date,
          taxId: receipt.ocrResult.taxId,
          rawText: receipt.ocrResult.rawText,  // Include raw OCR text
          confidenceScores: receipt.ocrResult.confidenceScores,
          extractionDuration: receipt.ocrResult.extractionDuration,
        };

        // Auto-decision: needs manual review?
        response.data.requiresManualReview =
          receipt.ocrConfidence < 0.75;  // Configurable threshold
      }

      if (receipt.ocrStatus === 'needs_manual') {
        response.data.message =
          'Low confidence. Please manually verify and correct extracted data.';
        response.data.errors = receipt.ocrErrors;
      }

      res.json(response);
    } catch (error) {
      next(error);
    }
  }
);

// PATCH /api/receipts/:receiptId/ocr-result
// User corrects OCR result (manual override)
router.patch(
  '/:receiptId/ocr-result',
  authMiddleware,
  async (req, res, next) => {
    try {
      const { vendor, amount, date, taxId } = req.body;

      const receipt = await Receipt.findByIdAndUpdate(
        req.params.receiptId,
        {
          'ocrResult.vendor': vendor,
          'ocrResult.amount': amount,
          'ocrResult.date': date,
          'ocrResult.taxId': taxId,
          ocrStatus: 'complete',  // Mark as verified by user
          updatedAt: new Date(),
        },
        { new: true }
      );

      res.json({
        success: true,
        data: { receipt },
        meta: { correlationId: req.correlationId },
      });
    } catch (error) {
      next(error);
    }
  }
);
```

---

## 1️⃣1️⃣ 12. Testing Examples

```typescript
// modules/ocr/__tests__/GroqOCRService.test.ts

import { describe, it, expect, beforeEach } from 'bun:test';
import { GroqOCRService } from '../adapters/GroqOCRService';
import { ExternalServiceError } from '../../../shared/errors';

describe('GroqOCRService - Full Pipeline', () => {
  let service: GroqOCRService;

  beforeEach(() => {
    service = new GroqOCRService('test-api-key');
  });

  it('should queue full pipeline extraction with image buffer', async () => {
    const imageBuffer = Buffer.from('fake-receipt-image-data');
    const result = await service.extractFromImage(
      imageBuffer,
      'image/jpeg',
      'corr-123'
    );

    expect(result.status).toBe('queued');
    expect(result.jobId).toBeDefined();
    expect(result.jobId).toMatch(/^groq-ocr-/);
  });

  it('should return complete OCR result after processing', async () => {
    const imageBuffer = Buffer.from('fake-receipt');
    const { jobId } = await service.extractFromImage(
      imageBuffer,
      'image/jpeg',
      'corr-123'
    );

    // Poll result
    const pollResult = await service.getResult(jobId, 'corr-123');

    expect(pollResult.status).toBe('complete');
    expect(pollResult.result).toBeDefined();
    expect(pollResult.result?.vendor).toBeDefined();
    expect(pollResult.result?.amount).toBeDefined();
    expect(pollResult.result?.date).toBeDefined();
    expect(pollResult.result?.rawText).toBeDefined();
    expect(pollResult.result?.confidenceScores).toBeDefined();
  });

  it('should include rawText from Step 1 (Vision API)', async () => {
    const imageBuffer = Buffer.from('receipt');
    const { jobId } = await service.extractFromImage(
      imageBuffer,
      'image/jpeg',
      'corr-test'
    );

    const { result } = await service.getResult(jobId, 'corr-test');

    // Raw OCR text should be present
    expect(result?.rawText).toBeDefined();
    expect(result?.rawText?.length).toBeGreaterThan(0);
  });

  it('should score confidence for each field', async () => {
    const imageBuffer = Buffer.from('receipt');
    const { jobId } = await service.extractFromImage(
      imageBuffer,
      'image/jpeg',
      'corr-test'
    );

    const { result } = await service.getResult(jobId, 'corr-test');

    // Confidence scores should be present
    expect(result?.confidenceScores).toBeDefined();
    expect(result?.confidenceScores?.vendor).toBeGreaterThanOrEqual(0);
    expect(result?.confidenceScores?.vendor).toBeLessThanOrEqual(1);
    expect(result?.confidenceScores?.overall).toBeGreaterThanOrEqual(0);
    expect(result?.confidenceScores?.overall).toBeLessThanOrEqual(1);
  });
});

// modules/ocr/__tests__/ConfidenceScorer.test.ts

describe('ConfidenceScorer', () => {
  let scorer: ConfidenceScorer;

  beforeEach(() => {
    scorer = new ConfidenceScorer();
  });

  it('should score high for valid vendor', () => {
    const score = scorer['scoreVendor'](
      'STARBUCKS BANGKOK',
      'STARBUCKS COFFEE BANGKOK BRANCH 456'
    );
    expect(score).toBeGreaterThan(0.7);
  });

  it('should score high for valid amount', () => {
    const score = scorer['scoreAmount'](
      '125.50',
      'TOTAL: ฿125.50'
    );
    expect(score).toBeGreaterThan(0.7);
  });

  it('should score date correctly', () => {
    const score = scorer['scoreDate'](
      '2026-01-26',
      'DATE: 26/01/2026'
    );
    expect(score).toBeGreaterThan(0.6);
  });

  it('should calculate overall confidence as average', () => {
    const scores = scorer.scoreFields(
      {
        vendor: 'STARBUCKS',
        amount: '125.50',
        date: '2026-01-26',
      },
      'STARBUCKS 26/01/2026 ฿125.50'
    );

    expect(scores.overall).toBeDefined();
    expect(scores.overall).toBeGreaterThanOrEqual(0);
    expect(scores.overall).toBeLessThanOrEqual(1);
  });

  it('should determine if manual review needed', () => {
    const needsReview = scorer.needsManualReview(0.5);
    expect(needsReview).toBe(true);

    const noNeedReview = scorer.needsManualReview(0.9);
    expect(noNeedReview).toBe(false);
  });
});
```

---

## 1️⃣2️⃣ 13. Dev vs Prod Behavior

### Development Mode

**Input:** Receipt image  
**Process:** Mock instant → Full result in ~200ms  
**Output:**
```json
{
  "status": "queued",
  "jobId": "mock-ocr-1",
  "polling": "GET /api/receipts/:id/ocr-status returns complete result immediately"
}
```

**Console:**
```
[corr-123] MockOCR: Created job mock-ocr-1 with full pipeline result:
{
  vendor: 'STARBUCKS BANGKOK 456',
  amount: 12550,
  confidence: 0.94
}
[corr-123] MockOCR: Retrieved job mock-ocr-1 { status: 'complete', result: {...} }
```

### Production Mode

**Input:** Receipt image  
**Step 1 (Groq Vision):** ~2-3 seconds  
**Step 2 (Prompt Service):** ~1-2 seconds  
**Step 3 (Confidence Scorer):** ~100ms  
**Total:** ~3-5 seconds

**Response:**
```json
{
  "status": "queued",
  "jobId": "groq-ocr-1704753600000-a1b2c3d4",
  "message": "OCR processing in background. Check status via polling."
}
```

**Polling result (after ~5 seconds):**
```json
{
  "status": "complete",
  "result": {
    "vendor": "STARBUCKS BANGKOK 456",
    "amount": 12550,
    "date": "2026-01-26",
    "taxId": "0123456789012",
    "rawText": "[Full OCR text from Groq Vision]",
    "confidenceScores": {
      "vendor": 0.95,
      "amount": 0.98,
      "date": 0.88,
      "overall": 0.94
    },
    "extractionDuration": 4532
  }
}
```

---

## 1️⃣3️⃣ 14. Definition of Done

Before completing Task 2:

- [ ] **Folder Structure**
  - [ ] `modules/ocr/types/` with ocr.types.ts
  - [ ] `modules/ocr/adapters/` with interfaces and implementations
  - [ ] `modules/ocr/services/` with GroqPromptService, ConfidenceScorer, OCRIntegrationService
  - [ ] `modules/ocr/queue/` with BullMQ setup and worker
  - [ ] `modules/ocr/__tests__/` with test files

- [ ] **Code Quality**
  - [ ] TypeScript strict mode compiles
  - [ ] No eslint warnings
  - [ ] Code formatted with prettier
  - [ ] JSDoc on all public methods

- [ ] **Functionality (Full Pipeline)**
  - [ ] Step 1: Groq Vision extracts raw text ✅
  - [ ] Step 2: GroqPromptService parses fields ✅
  - [ ] Step 3: ConfidenceScorer calculates scores ✅
  - [ ] Step 4: OCRResult includes rawText + confidence ✅
  - [ ] MockOCRService instant results (dev) ✅
  - [ ] GroqOCRService queues jobs (prod) ✅

- [ ] **Testing**
  - [ ] 20+ unit tests written
  - [ ] MockOCRService tests (5+)
  - [ ] GroqOCRService tests (8+)
  - [ ] ConfidenceScorer tests (5+)
  - [ ] GroqPromptService tests (5+)
  - [ ] >90% code coverage

- [ ] **Integration**
  - [ ] ReceiptService calls OCRIntegrationService
  - [ ] Receipt.ocrResult field stores full data
  - [ ] BullMQ queue with Redis backend
  - [ ] GET /receipts/:id/ocr-status returns complete result
  - [ ] PATCH /receipts/:id/ocr-result for user overrides
  - [ ] No breaking changes to Phase 2.2

- [ ] **Documentation**
  - [ ] `.env.example` with all OCR configs
  - [ ] README with setup instructions
  - [ ] Groq API key setup guide
  - [ ] Full pipeline diagram documented
  - [ ] Example responses for each step
  - [ ] Confidence scoring explanation

---

## 1️⃣4️⃣ 15. Timeline Estimate

- **Day 1 (Jan 27):** Setup + Types + MockOCRService (3 hours)
- **Day 2 (Jan 28):** GroqPromptService + ConfidenceScorer (4 hours)
- **Day 3 (Jan 29):** GroqOCRService + Integration (4 hours)
- **Day 4 (Jan 30):** BullMQ queue + Tests + Docs (4 hours)

**Total: 15 hours over 4 days**

---

## 🎉 That's Task 2: Groq OCR Full Pipeline!

**Option C Implemented:**
- ✅ Step 1: Groq Vision API extracts raw text
- ✅ Step 2: LLM prompting parses fields
- ✅ Step 3: Confidence scoring (0-1 per field)
- ✅ Step 4: Full OCRResult with transparency
- ✅ Async queue (BullMQ) - no blocking
- ✅ Dev/Prod duality (Mock vs Real)

**Ready to implement!** 🚀
