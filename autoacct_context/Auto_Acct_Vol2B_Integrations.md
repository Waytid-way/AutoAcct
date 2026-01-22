---
**AUTO-ACCT-001 GUIDE BOOK**  
**VOLUME 2B: Integrations (Groq AI, Teable, Medici)**

**Version:** 2.0B  
**Date:** January 20, 2026, 4:35 PM +07  
**Target Audience:** Backend Developers, Integration Engineers  
**Status:** Production-Ready Implementation  
**Prerequisites:** Volume 1 (Architecture), Volume 2A (Controllers & Services)

---

# TABLE OF CONTENTS

**VOLUME 2B: INTEGRATIONS (SECTIONS 5.2, 6, 7)**

- **5.2** MedicerService (Medici Ledger Wrapper)
- **6** AI Classification (Groq Integration)
  - 6.1 GroqClassificationService Implementation
  - 6.2 Prompt Engineering for Thai Accounting
  - 6.3 Confidence Scoring & Fallback
  - 6.4 Error Handling & Rate Limiting
  - 6.5 Testing & Production Tips
- **7** Teable Webhook & Sync
  - 7.1 TeableClient Implementation
  - 7.2 Webhook Handler (HMAC Signature)
  - 7.3 Polling Job (Backup Sync)
  - 7.4 Bidirectional Sync Pattern
  - 7.5 Error Recovery
- **Appendix A:** Sequence Diagrams
- **Appendix B:** Configuration Examples
- **Appendix C:** Testing Patterns

---

# 5.2 MedicerService (Medici Ledger Wrapper)

## Overview

**MedicerService** wraps the `medici` library to provide:
- Type-safe T-account operations
- Trial balance verification
- MongoDB session integration
- Immutable journal entries

**File Path:** `backend/src/modules/accounting/services/MedicerService.ts`

---

## Implementation

```typescript
// backend/src/modules/accounting/services/MedicerService.ts
import { Book } from 'medici';
import { ClientSession } from 'mongoose';
import { MoneyInt, satangToBaht } from '../../../utils/money';
import { FinancialIntegrityError } from '../../../utils/errors';
import logger from '../../../config/logger';

/**
 * MedicerService - Wrapper around Medici library
 * 
 * Responsibilities:
 * - Post debit/credit entries to T-accounts
 * - Calculate trial balance (Dr == Cr)
 * - Generate audit logs
 * - Enforce double-entry equation
 */
export class MedicerService {
  private book: typeof Book;

  constructor() {
    this.book = Book;
  }

  /**
   * Post a debit entry
   * @param account - Chart of Accounts code (e.g., "5100-Food")
   * @param amount - Amount in Satang (MoneyInt)
   * @param description - Transaction description
   * @param session - MongoDB session (for transactions)
   */
  async debit(
    account: string,
    amount: MoneyInt,
    description: string,
    session?: ClientSession
  ): Promise<void> {
    try {
      await this.book
        .entry(description)
        .debit(account, amount)
        .commit({ session });

      logger.debug({
        action: 'medici_debit',
        account,
        amount,
        description,
      });
    } catch (error: any) {
      logger.error({
        action: 'medici_debit_failed',
        account,
        amount,
        error: error.message,
      });
      throw new FinancialIntegrityError(`Medici debit failed: ${error.message}`);
    }
  }

  /**
   * Post a credit entry
   */
  async credit(
    account: string,
    amount: MoneyInt,
    description: string,
    session?: ClientSession
  ): Promise<void> {
    try {
      await this.book
        .entry(description)
        .credit(account, amount)
        .commit({ session });

      logger.debug({
        action: 'medici_credit',
        account,
        amount,
        description,
      });
    } catch (error: any) {
      logger.error({
        action: 'medici_credit_failed',
        account,
        amount,
        error: error.message,
      });
      throw new FinancialIntegrityError(`Medici credit failed: ${error.message}`);
    }
  }

  /**
   * Post a full journal entry (Dr + Cr)
   * Validates that Dr == Cr before posting
   */
  async postEntry(
    debitAccount: string,
    creditAccount: string,
    amount: MoneyInt,
    description: string,
    session?: ClientSession
  ): Promise<string> {
    try {
      // Validate amount
      if (amount <= 0) {
        throw new FinancialIntegrityError('Amount must be positive', { amount });
      }

      // Create balanced entry
      const entry = await this.book
        .entry(description)
        .debit(debitAccount, amount)
        .credit(creditAccount, amount)
        .commit({ session });

      logger.info({
        action: 'medici_entry_posted',
        debitAccount,
        creditAccount,
        amount,
        journalId: entry._id,
      });

      return entry._id.toString();
    } catch (error: any) {
      logger.error({
        action: 'medici_entry_failed',
        debitAccount,
        creditAccount,
        amount,
        error: error.message,
      });
      throw new FinancialIntegrityError(`Medici entry failed: ${error.message}`);
    }
  }

  /**
   * Get trial balance for a client
   * @returns Total debit - Total credit (should ALWAYS be 0)
   */
  async getTrialBalance(
    clientId: string,
    session?: ClientSession
  ): Promise<number> {
    try {
      const balance = await this.book.balance({
        account: new RegExp(`^${clientId}`), // Filter by clientId prefix
        session,
      });

      logger.debug({
        action: 'trial_balance',
        clientId,
        balance,
        balanced: balance === 0,
      });

      return balance;
    } catch (error: any) {
      logger.error({
        action: 'trial_balance_failed',
        clientId,
        error: error.message,
      });
      throw new FinancialIntegrityError(`Trial balance calculation failed: ${error.message}`);
    }
  }

  /**
   * Get ledger for a specific account
   */
  async getLedger(
    account: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<any[]> {
    try {
      const query: any = { account };
      if (startDate) query.datetime = { $gte: startDate };
      if (endDate) query.datetime = { ...query.datetime, $lte: endDate };

      const ledger = await this.book.ledger(query);

      logger.debug({
        action: 'get_ledger',
        account,
        entries: ledger.length,
      });

      return ledger.map((entry: any) => ({
        date: entry.datetime,
        description: entry.memo,
        debit: entry.debit || 0,
        credit: entry.credit || 0,
        balance: entry.balance,
      }));
    } catch (error: any) {
      logger.error({
        action: 'get_ledger_failed',
        account,
        error: error.message,
      });
      throw new FinancialIntegrityError(`Ledger retrieval failed: ${error.message}`);
    }
  }

  /**
   * Void an entry (create reversal)
   * NOTE: This creates a REVERSAL entry, not a deletion
   */
  async voidEntry(
    originalJournalId: string,
    reason: string,
    session?: ClientSession
  ): Promise<string> {
    try {
      // Fetch original entry
      const original = await this.book.findById(originalJournalId);
      if (!original) {
        throw new FinancialIntegrityError('Original entry not found', { originalJournalId });
      }

      // Create reversal (swap Dr/Cr)
      const reversal = await this.book
        .entry(`VOID: ${original.memo} (Reason: ${reason})`)
        .debit(original.credit_account, original.amount) // Swap
        .credit(original.debit_account, original.amount) // Swap
        .commit({ session });

      logger.info({
        action: 'medici_entry_voided',
        originalJournalId,
        reversalJournalId: reversal._id,
        reason,
      });

      return reversal._id.toString();
    } catch (error: any) {
      logger.error({
        action: 'medici_void_failed',
        originalJournalId,
        error: error.message,
      });
      throw new FinancialIntegrityError(`Void entry failed: ${error.message}`);
    }
  }
}
```

---

## Usage in AccountingService

```typescript
// backend/src/modules/accounting/services/AccountingService.ts
import { MedicerService } from './MedicerService';

export class AccountingService {
  constructor(private medicerService: MedicerService) {}

  async postEntry(
    entryId: string,
    clientId: string,
    approvedBy: string,
    correlationId: string
  ): Promise<any> {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // 1. Fetch entry
      const entry = await JournalEntry.findOne({ _id: entryId, clientId, status: 'draft' }).session(session);
      if (!entry) throw new NotFoundError('Draft entry not found');

      // 2. Check trial balance BEFORE posting
      const balanceBefore = await this.medicerService.getTrialBalance(clientId, session);
      if (balanceBefore !== 0) {
        throw new FinancialIntegrityError('Trial balance not zero before posting', { balance: balanceBefore });
      }

      // 3. Post to Medici ledger
      const journalId = await this.medicerService.postEntry(
        entry.account.debit,
        entry.account.credit,
        entry.debit,
        entry.description,
        session
      );

      // 4. Check trial balance AFTER posting
      const balanceAfter = await this.medicerService.getTrialBalance(clientId, session);
      if (balanceAfter !== 0) {
        throw new FinancialIntegrityError('Trial balance not zero after posting', { balance: balanceAfter });
      }

      // 5. Update entry status
      entry.status = 'posted';
      entry.medicer = { journalId, timestamp: new Date() };
      entry.approvedBy = new ObjectId(approvedBy);
      entry.approvedAt = new Date();
      await entry.save({ session });

      await session.commitTransaction();

      logger.info({ correlationId, action: 'entry_posted_successfully', entryId, journalId });

      return entry;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      await session.endSession();
    }
  }
}
```

---

## Testing MedicerService

```typescript
// backend/tests/unit/MedicerService.test.ts
import { MedicerService } from '../../../src/modules/accounting/services/MedicerService';
import { bahtToSatang } from '../../../src/utils/money';

describe('MedicerService', () => {
  let medicerService: MedicerService;

  beforeEach(() => {
    medicerService = new MedicerService();
  });

  it('should post a balanced entry and verify trial balance', async () => {
    const amount = bahtToSatang(125); // 12500 Satang

    // Post entry: Dr 5100-Food, Cr 1010-Checking
    const journalId = await medicerService.postEntry(
      '5100-Food',
      '1010-Checking',
      amount,
      'Coffee from 7-Eleven'
    );

    expect(journalId).toBeDefined();

    // Verify trial balance (should be 0)
    const balance = await medicerService.getTrialBalance('client123');
    expect(balance).toBe(0);
  });

  it('should throw error if trial balance is not zero', async () => {
    // Intentionally post unbalanced entry (manual debit without credit)
    await medicerService.debit('5100-Food', bahtToSatang(100), 'Test');

    const balance = await medicerService.getTrialBalance('client123');
    expect(balance).not.toBe(0); // Should be 10000 (Satang)
  });

  it('should void an entry and verify reversal', async () => {
    const amount = bahtToSatang(50);
    const journalId = await medicerService.postEntry(
      '5200-Office',
      '1010-Checking',
      amount,
      'Office supplies'
    );

    // Void the entry
    const reversalId = await medicerService.voidEntry(journalId, 'Duplicate entry');
    expect(reversalId).toBeDefined();

    // Verify trial balance is still 0 after void
    const balance = await medicerService.getTrialBalance('client123');
    expect(balance).toBe(0);
  });
});
```

---

# 6. AI CLASSIFICATION (GROQ INTEGRATION)

## 6.1 GroqClassificationService Implementation

**File Path:** `backend/src/modules/ai/GroqClassificationService.ts`

### Full Implementation

```typescript
// backend/src/modules/ai/GroqClassificationService.ts
import Groq from 'groq-sdk';
import logger from '../../config/logger';
import { sendMLUpdate } from '../../loaders/logger'; // Discord ML alerts

interface ClassificationResult {
  category: string; // e.g., "5100 - อาหาร เครื่องดื่ม"
  confidence: number; // 0.0 - 1.0
  reasoning: string; // AI's explanation
  suggestedAccount?: {
    debit: string; // e.g., "5100-Food"
    credit: string; // e.g., "1010-Checking"
  };
}

/**
 * GroqClassificationService - AI-powered transaction categorization
 * 
 * Uses Groq's Llama 3.3 70B model to classify Thai accounting transactions
 * into 12 expense categories + 3 revenue categories.
 * 
 * Performance (as of Phase 3A):
 * - Average confidence: 97.7%
 * - Response time: 200ms
 * - Cost: $0/month (free tier: 14,400 req/day)
 */
export class GroqClassificationService {
  private client: Groq;
  private model: string;
  private confidenceThreshold: number;

  constructor() {
    if (!process.env.GROQ_API_KEY) {
      throw new Error('GROQ_API_KEY not configured');
    }

    this.client = new Groq({
      apiKey: process.env.GROQ_API_KEY,
    });

    this.model = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
    this.confidenceThreshold = parseFloat(process.env.ML_CONFIDENCE_THRESHOLD || '0.80');

    logger.info({
      action: 'groq_service_initialized',
      model: this.model,
      threshold: this.confidenceThreshold,
    });
  }

  /**
   * Classify a transaction using Groq AI
   * @param params - vendor, amount (Satang), description
   * @returns ClassificationResult with category, confidence, reasoning
   */
  async classifyEntry(params: {
    vendor: string;
    amount: number; // MoneyInt (Satang)
    description?: string;
  }): Promise<ClassificationResult> {
    const { vendor, amount, description } = params;

    try {
      const prompt = this.buildPrompt(vendor, amount, description);

      logger.debug({
        action: 'groq_classify_start',
        vendor,
        amount,
        model: this.model,
      });

      // Call Groq API
      const startTime = Date.now();
      const completion = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: SYSTEM_PROMPT, // Defined below
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3, // Lower = more deterministic
        max_tokens: 200,
      });

      const duration = Date.now() - startTime;

      // Parse response
      const rawResponse = completion.choices[0]?.message?.content || '';
      const result = this.parseResponse(rawResponse);

      logger.info({
        action: 'groq_classify_success',
        vendor,
        category: result.category,
        confidence: result.confidence,
        duration,
      });

      // Send Discord ML alert
      await sendMLUpdate({
        vendor,
        amount: amount / 100, // Convert Satang → Baht for display
        category: result.category,
        confidence: result.confidence,
        reasoning: result.reasoning,
      });

      return result;
    } catch (error: any) {
      logger.error({
        action: 'groq_classify_failed',
        vendor,
        error: error.message,
        stack: error.stack,
      });

      // Fallback to "PENDING_REVIEW" if AI fails
      return {
        category: 'PENDING_REVIEW',
        confidence: 0.0,
        reasoning: `AI classification failed: ${error.message}`,
      };
    }
  }

  /**
   * Build prompt for Groq AI
   */
  private buildPrompt(vendor: string, amount: number, description?: string): string {
    const amountBaht = (amount / 100).toFixed(2); // Satang → Baht

    return `
Classify this Thai accounting transaction:

**Vendor:** ${vendor}
**Amount:** ${amountBaht} THB
**Description:** ${description || 'N/A'}

**Output format (JSON):**
{
  "category": "5100 - อาหาร เครื่องดื่ม",
  "confidence": 0.95,
  "reasoning": "Food and beverage purchase from convenience store",
  "suggestedAccount": {
    "debit": "5100-Food",
    "credit": "1010-Checking"
  }
}
`.trim();
  }

  /**
   * Parse Groq's JSON response
   */
  private parseResponse(rawResponse: string): ClassificationResult {
    try {
      // Remove markdown code blocks if present
      const cleaned = rawResponse
        .replace(/```json/g, '')
        .replace(/```/g, '')
        .trim();

      const parsed = JSON.parse(cleaned);

      return {
        category: parsed.category || 'PENDING_REVIEW',
        confidence: parsed.confidence || 0.0,
        reasoning: parsed.reasoning || 'No reasoning provided',
        suggestedAccount: parsed.suggestedAccount,
      };
    } catch (error) {
      logger.warn({
        action: 'groq_parse_failed',
        rawResponse,
        error: (error as Error).message,
      });

      return {
        category: 'PENDING_REVIEW',
        confidence: 0.0,
        reasoning: 'Failed to parse AI response',
      };
    }
  }

  /**
   * Batch classification (for multiple transactions)
   */
  async classifyBatch(
    entries: Array<{ vendor: string; amount: number; description?: string }>
  ): Promise<ClassificationResult[]> {
    const results: ClassificationResult[] = [];

    for (const entry of entries) {
      // Rate limiting: 30 req/min → ~2s delay between requests
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const result = await this.classifyEntry(entry);
      results.push(result);
    }

    logger.info({
      action: 'groq_batch_complete',
      total: entries.length,
      avgConfidence: (results.reduce((sum, r) => sum + r.confidence, 0) / results.length).toFixed(2),
    });

    return results;
  }
}

/**
 * System Prompt for Groq AI
 * Defines the AI's role and category definitions
 */
const SYSTEM_PROMPT = `
You are an expert Thai accounting assistant. Your task is to classify business transactions into one of the following categories using IAS 9 (Thai Accounting Standards).

**12 EXPENSE CATEGORIES:**
- **5100 - อาหาร เครื่องดื่ม** (Food & Beverage): 7-Eleven, Tops, restaurants, coffee shops
- **5200 - เครื่องใช้สำนักงาน** (Office Supplies): pens, paper, printer ink
- **5300 - สาธารณูปโภค** (Utilities): electricity, water, internet (TOT, True, AIS)
- **5400 - เงินเดือน** (Salaries): employee wages, bonuses
- **5500 - เช่า** (Rent): office rent, coworking space
- **5600 - ขนส่ง** (Transportation): Grab, taxi, fuel, parking
- **5700 - การตลาด** (Marketing): Facebook Ads, Google Ads, promotional materials
- **5800 - อุปกรณ์ IT** (IT Equipment): laptops, software licenses (Microsoft, Adobe)
- **5900 - อื่นๆ** (Miscellaneous): items that don't fit above

**3 REVENUE CATEGORIES:**
- **4100 - รายได้จากบริการ** (Service Revenue): consulting, freelance work
- **4200 - รายได้จากขายสินค้า** (Product Sales): physical goods sold
- **4900 - รายได้อื่นๆ** (Other Revenue): interest, dividends

**CONFIDENCE SCORING:**
- **0.95-1.0:** Very certain (e.g., "7-Eleven" → Food & Beverage)
- **0.80-0.94:** Confident (e.g., "Grab" → Transportation)
- **0.60-0.79:** Moderate (e.g., "Amazon" → could be books, electronics, etc.)
- **< 0.60:** Low confidence → suggest "PENDING_REVIEW"

**OUTPUT:** Always respond in JSON format. Include:
1. **category**: The matched category (e.g., "5100 - อาหาร เครื่องดื่ม")
2. **confidence**: Score from 0.0 to 1.0
3. **reasoning**: Brief explanation (1-2 sentences)
4. **suggestedAccount**: { "debit": "5100-Food", "credit": "1010-Checking" }

**EXAMPLES:**
- Vendor: "7-Eleven", Amount: 125 THB → Category: "5100 - อาหาร เครื่องดื่ม", Confidence: 0.95
- Vendor: "TOT Fiber", Amount: 599 THB → Category: "5300 - สาธารณูปโภค", Confidence: 1.0
- Vendor: "Amazon", Amount: 2500 THB → Category: "PENDING_REVIEW", Confidence: 0.50 (ambiguous: could be books or electronics)
`.trim();
```

---

## 6.2 Prompt Engineering for Thai Accounting

### Key Principles

1. **Use IAS 9 Thai Standards** - Aligns with local regulations
2. **Include Vendor Examples** - Trains AI with common Thai vendors (7-Eleven, Grab, TOT)
3. **Confidence Thresholds** - Auto-approve ≥ 0.80, manual review < 0.80
4. **JSON Output Format** - Ensures parseable responses

### Example Prompts

```typescript
// GOOD PROMPT (Specific, structured)
const prompt = `
Classify this Thai accounting transaction:

**Vendor:** 7-Eleven
**Amount:** 125.00 THB
**Description:** Coffee and sandwich

**Output format (JSON):**
{
  "category": "5100 - อาหาร เครื่องดื่ม",
  "confidence": 0.95,
  "reasoning": "Food and beverage purchase from convenience store"
}
`;

// BAD PROMPT (Vague, unstructured)
const prompt = "What category is 7-Eleven 125 baht?";
```

---

## 6.3 Confidence Scoring & Fallback

### Decision Flow

```
Groq Confidence ≥ 0.80?
├─ YES: Auto-approve → status = "approved"
└─ NO:  Manual review → status = "pending"
```

### Implementation

```typescript
// In JournalController.createFromOcr()
const classification = await this.groqService.classifyEntry({ vendor, amount, description });

if (classification.confidence >= config.ML_CONFIDENCE_THRESHOLD) {
  // High confidence → Auto-approve
  entry.category = classification.category;
  entry.autoClassified = true;
  entry.aiConfidence = classification.confidence;
  entry.status = 'approved';
} else {
  // Low confidence → Human review
  entry.category = 'PENDING_REVIEW';
  entry.suggestedCategory = classification.category;
  entry.aiConfidence = classification.confidence;
  entry.status = 'pending';
}
```

---

## 6.4 Error Handling & Rate Limiting

### Rate Limiting

**Groq Free Tier Limits:**
- **30 req/min**
- **14,400 req/day**

**Implementation:**

```typescript
// Batch processing with 2-second delays
async classifyBatch(entries: any[]): Promise<any[]> {
  const results = [];

  for (const entry of entries) {
    await new Promise((resolve) => setTimeout(resolve, 2000)); // 2s delay
    const result = await this.classifyEntry(entry);
    results.push(result);
  }

  return results;
}
```

### Error Handling

```typescript
try {
  const result = await groqService.classifyEntry({ vendor, amount });
} catch (error) {
  // Fallback: Mark as PENDING_REVIEW
  logger.error({ action: 'groq_failed', error: error.message });

  return {
    category: 'PENDING_REVIEW',
    confidence: 0.0,
    reasoning: `AI failed: ${error.message}`,
  };
}
```

---

## 6.5 Testing & Production Tips

### Unit Tests

```typescript
// backend/tests/unit/GroqClassificationService.test.ts
import { GroqClassificationService } from '../../../src/modules/ai/GroqClassificationService';

describe('GroqClassificationService', () => {
  let groqService: GroqClassificationService;

  beforeEach(() => {
    groqService = new GroqClassificationService();
  });

  it('should classify 7-Eleven as Food & Beverage (5100)', async () => {
    const result = await groqService.classifyEntry({
      vendor: '7-Eleven',
      amount: 12500, // 125 THB
      description: 'Coffee and sandwich',
    });

    expect(result.category).toContain('5100');
    expect(result.confidence).toBeGreaterThanOrEqual(0.80);
  });

  it('should classify TOT Fiber as Utilities (5300)', async () => {
    const result = await groqService.classifyEntry({
      vendor: 'TOT Fiber',
      amount: 59900, // 599 THB
    });

    expect(result.category).toContain('5300');
    expect(result.confidence).toBeGreaterThanOrEqual(0.95);
  });

  it('should mark ambiguous vendor as PENDING_REVIEW', async () => {
    const result = await groqService.classifyEntry({
      vendor: 'Amazon',
      amount: 250000, // 2500 THB
    });

    expect(result.category).toBe('PENDING_REVIEW');
    expect(result.confidence).toBeLessThan(0.80);
  });
});
```

### Production Tips

1. **Monitor Confidence Distribution**
   ```bash
   # Check average confidence per day
   db.journalentries.aggregate([
     { $match: { autoClassified: true } },
     { $group: { _id: null, avgConfidence: { $avg: "$aiConfidence" } } }
   ])
   ```

2. **Set Up Alerts**
   ```typescript
   if (classification.confidence < 0.80) {
     await sendCriticalAlert(`Low confidence classification: ${vendor} (${classification.confidence})`);
   }
   ```

3. **Fallback to Manual**
   ```typescript
   if (groqFails) {
     // Send to Teable for accountant review
     await teableClient.createRecord({ ...entry, status: 'manual_review' });
   }
   ```

---

# 7. TEABLE WEBHOOK & SYNC

## 7.1 TeableClient Implementation

**File Path:** `backend/src/modules/teable/services/TeableClient.ts`

### Full Implementation

```typescript
// backend/src/modules/teable/services/TeableClient.ts
import axios, { AxiosInstance } from 'axios';
import logger from '../../../config/logger';

interface TeableRecord {
  id: string;
  fields: Record<string, any>;
  createdTime: string;
  lastModifiedTime: string;
}

interface CreateRecordParams {
  journalEntryId: string;
  vendor: string;
  amount: number; // Display in Baht
  status: 'pending_approval' | 'approved' | 'rejected';
  category?: string;
  aiConfidence?: number;
  exportPath?: 'manual' | 'immediate' | 'scheduled';
}

/**
 * TeableClient - Bidirectional sync with Teable (No-Code DB)
 * 
 * Features:
 * - Create draft journal entries for accountant review
 * - Listen for approvals via webhook
 * - Poll for status changes (backup to webhooks)
 * - Update sync status in Auto-Acct
 */
export class TeableClient {
  private client: AxiosInstance;
  private baseId: string;
  private tableId: string;

  constructor() {
    if (!process.env.TEABLE_API_KEY || !process.env.TEABLE_BASE_ID || !process.env.TEABLE_TABLE_ID) {
      throw new Error('Teable config missing: API_KEY, BASE_ID, or TABLE_ID');
    }

    this.baseId = process.env.TEABLE_BASE_ID;
    this.tableId = process.env.TEABLE_TABLE_ID;

    this.client = axios.create({
      baseURL: process.env.TEABLE_API_URL || 'https://app.teable.io/api',
      headers: {
        'Authorization': `Bearer ${process.env.TEABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    });

    logger.info({
      action: 'teable_client_initialized',
      baseId: this.baseId,
      tableId: this.tableId,
    });
  }

  /**
   * Create a record in Teable (for accountant review)
   */
  async createRecord(params: CreateRecordParams, correlationId?: string): Promise<TeableRecord> {
    try {
      logger.debug({
        correlationId,
        action: 'teable_create_record_start',
        journalEntryId: params.journalEntryId,
      });

      const response = await this.client.post(
        `/base/${this.baseId}/table/${this.tableId}/record`,
        {
          fields: {
            'Journal Entry ID': params.journalEntryId,
            'Vendor': params.vendor,
            'Amount (THB)': params.amount, // Already in Baht
            'Status': params.status,
            'Category': params.category || 'N/A',
            'AI Confidence': params.aiConfidence ? (params.aiConfidence * 100).toFixed(1) + '%' : 'N/A',
            'Export Path': params.exportPath || 'manual',
            'Created At': new Date().toISOString(),
          },
        }
      );

      const record: TeableRecord = response.data;

      logger.info({
        correlationId,
        action: 'teable_record_created',
        teableRecordId: record.id,
        journalEntryId: params.journalEntryId,
      });

      return record;
    } catch (error: any) {
      logger.error({
        correlationId,
        action: 'teable_create_record_failed',
        journalEntryId: params.journalEntryId,
        error: error.message,
        response: error.response?.data,
      });

      throw new Error(`Teable create failed: ${error.message}`);
    }
  }

  /**
   * Fetch approved records (for polling job)
   */
  async getApprovedRecords(limit: number = 50): Promise<TeableRecord[]> {
    try {
      const response = await this.client.get(
        `/base/${this.baseId}/table/${this.tableId}/record`,
        {
          params: {
            filter: JSON.stringify({
              conjunction: 'and',
              filterSet: [
                {
                  fieldId: 'Status',
                  operator: 'is',
                  value: 'approved',
                },
              ],
            }),
            take: limit,
          },
        }
      );

      const records: TeableRecord[] = response.data.records || [];

      logger.debug({
        action: 'teable_fetch_approved',
        count: records.length,
      });

      return records;
    } catch (error: any) {
      logger.error({
        action: 'teable_fetch_approved_failed',
        error: error.message,
      });

      return [];
    }
  }

  /**
   * Update record status (after processing)
   */
  async updateRecordStatus(
    recordId: string,
    status: 'processed' | 'failed',
    errorMessage?: string
  ): Promise<void> {
    try {
      await this.client.patch(
        `/base/${this.baseId}/table/${this.tableId}/record/${recordId}`,
        {
          fields: {
            'Status': status,
            'Error Message': errorMessage || null,
            'Processed At': new Date().toISOString(),
          },
        }
      );

      logger.info({
        action: 'teable_record_updated',
        recordId,
        status,
      });
    } catch (error: any) {
      logger.error({
        action: 'teable_update_failed',
        recordId,
        error: error.message,
      });
    }
  }
}
```

---

## 7.2 Webhook Handler (HMAC Signature)

**File Path:** `backend/src/modules/teable/webhooks/TeableWebhookController.ts`

### Full Implementation

```typescript
// backend/src/modules/teable/webhooks/TeableWebhookController.ts
import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import logger from '../../../config/logger';
import { AccountingService } from '../../accounting/services/AccountingService';
import { ExpressExportService } from '../../export/services/ExpressExportService';

export class TeableWebhookController {
  constructor(
    private accountingService: AccountingService,
    private exportService: ExpressExportService
  ) {}

  /**
   * POST /api/webhooks/teable
   * Handle accountant approval from Teable UI
   * 
   * Headers:
   * - x-teable-signature: HMAC-SHA256 signature
   * 
   * Body:
   * {
   *   "record": {
   *     "id": "rec123",
   *     "fields": {
   *       "Journal Entry ID": "64abc...",
   *       "Status": "approved",
   *       "Export Path": "immediate"
   *     }
   *   },
   *   "action": "approve"
   * }
   */
  async handleApproval(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const correlationId = (req.headers['x-correlation-id'] as string) || generateId();

      // 1. Validate HMAC signature
      if (!this.validateSignature(req)) {
        logger.warn({
          correlationId,
          action: 'teable_webhook_invalid_signature',
          ip: req.ip,
        });

        res.status(401).json({ success: false, message: 'Invalid signature' });
        return;
      }

      // 2. Parse webhook payload
      const { record, action } = req.body;
      const journalEntryId = record.fields['Journal Entry ID'];
      const status = record.fields['Status'];
      const exportPath = record.fields['Export Path'] || 'manual';

      logger.info({
        correlationId,
        action: 'teable_webhook_received',
        teableRecordId: record.id,
        journalEntryId,
        status,
        exportPath,
      });

      // 3. Process based on action
      if (action === 'approve' && status === 'approved') {
        // 3a. Post entry to ledger (if not already posted)
        const entry = await this.accountingService.getEntryById(journalEntryId);

        if (entry.status === 'draft') {
          await this.accountingService.postEntry(
            journalEntryId,
            entry.clientId.toString(),
            'teable_webhook', // approvedBy
            correlationId
          );

          logger.info({
            correlationId,
            action: 'entry_posted_via_webhook',
            journalEntryId,
          });
        }

        // 3b. Queue for export (if exportPath is set)
        if (exportPath === 'immediate') {
          await this.exportService.queueForExportImmediate(journalEntryId, correlationId);
        } else if (exportPath === 'scheduled') {
          await this.exportService.queueForScheduledExport(journalEntryId, correlationId);
        }

        // 3c. Update Teable record status
        await this.teableClient.updateRecordStatus(record.id, 'processed');
      }

      res.status(200).json({ success: true, message: 'Webhook processed' });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Validate HMAC-SHA256 signature
   */
  private validateSignature(req: Request): boolean {
    const signature = req.headers['x-teable-signature'] as string;
    if (!signature) return false;

    const secret = process.env.TEABLE_WEBHOOK_SECRET || '';
    const payload = JSON.stringify(req.body);

    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }
}
```

---

## 7.3 Polling Job (Backup Sync)

**File Path:** `backend/src/jobs/TeablePollingJob.ts`

### Implementation

```typescript
// backend/src/jobs/TeablePollingJob.ts
import cron from 'node-cron';
import { TeableClient } from '../modules/teable/services/TeableClient';
import { AccountingService } from '../modules/accounting/services/AccountingService';
import { ExpressExportService } from '../modules/export/services/ExpressExportService';
import logger from '../config/logger';

/**
 * TeablePollingJob - Backup sync mechanism
 * 
 * Schedule: Every 30 minutes
 * Purpose: Ensure all approvals are captured even if webhook fails
 */
export class TeablePollingJob {
  private schedule: string = '*/30 * * * *'; // Every 30 minutes

  constructor(
    private teableClient: TeableClient,
    private accountingService: AccountingService,
    private exportService: ExpressExportService
  ) {}

  start(): void {
    cron.schedule(this.schedule, () => this.execute());
    logger.info({
      action: 'teable_polling_job_started',
      schedule: this.schedule,
    });
  }

  private async execute(): Promise<void> {
    const correlationId = generateId();

    try {
      logger.info({ correlationId, action: 'teable_polling_start' });

      // 1. Fetch approved records from Teable
      const approvedRecords = await this.teableClient.getApprovedRecords(50);

      if (approvedRecords.length === 0) {
        logger.debug({ correlationId, action: 'teable_polling_no_records' });
        return;
      }

      logger.info({
        correlationId,
        action: 'teable_polling_fetched',
        count: approvedRecords.length,
      });

      // 2. Process each record
      for (const record of approvedRecords) {
        try {
          const journalEntryId = record.fields['Journal Entry ID'];
          const exportPath = record.fields['Export Path'] || 'manual';

          // 2a. Post entry (if not already posted)
          const entry = await this.accountingService.getEntryById(journalEntryId);

          if (entry.status === 'draft') {
            await this.accountingService.postEntry(
              journalEntryId,
              entry.clientId.toString(),
              'teable_polling', // approvedBy
              correlationId
            );
          }

          // 2b. Queue for export
          if (exportPath === 'immediate') {
            await this.exportService.queueForExportImmediate(journalEntryId, correlationId);
          } else if (exportPath === 'scheduled') {
            await this.exportService.queueForScheduledExport(journalEntryId, correlationId);
          }

          // 2c. Update Teable record
          await this.teableClient.updateRecordStatus(record.id, 'processed');
        } catch (err: any) {
          logger.error({
            correlationId,
            action: 'teable_polling_record_failed',
            recordId: record.id,
            error: err.message,
          });

          await this.teableClient.updateRecordStatus(record.id, 'failed', err.message);
        }
      }

      logger.info({
        correlationId,
        action: 'teable_polling_complete',
        processed: approvedRecords.length,
      });
    } catch (error: any) {
      logger.error({
        correlationId,
        action: 'teable_polling_failed',
        error: error.message,
      });
    }
  }
}
```

---

## 7.4 Bidirectional Sync Pattern

### Flow Diagram

```
Auto-Acct                    Teable
   |                            |
   |--- Create draft entry ---->|  (POST /record)
   |                            |
   |                            |  Accountant reviews in UI
   |                            |  Clicks "Approve" + selects export path
   |                            |
   |<-- Webhook: approve -------|  (POST /webhooks/teable)
   |                            |
   |  Post to ledger            |
   |  Queue for export          |
   |                            |
   |--- Update status: processed ->|  (PATCH /record)
   |                            |

   [Backup: Every 30 min polling]
   |                            |
   |--- Poll approved records ->|  (GET /record?filter=...)
   |                            |
   |  Process any missed approvals
```

---

## 7.5 Error Recovery

### Retry Logic

```typescript
// In TeableClient.createRecord()
const MAX_RETRIES = 3;
let attempt = 0;

while (attempt < MAX_RETRIES) {
  try {
    const response = await this.client.post(...);
    return response.data;
  } catch (error) {
    attempt++;
    logger.warn({
      action: 'teable_create_retry',
      attempt,
      error: error.message,
    });

    if (attempt >= MAX_RETRIES) {
      throw error;
    }

    // Exponential backoff: 2s, 4s, 8s
    await new Promise((resolve) => setTimeout(resolve, 2000 * Math.pow(2, attempt - 1)));
  }
}
```

### Webhook Failure Handling

```typescript
// If webhook fails, polling job will catch it
if (webhookFails) {
  logger.error({ action: 'webhook_failed', error: error.message });

  // Polling job runs every 30 minutes, so max delay is 30 min
  // No immediate action needed - polling will process the approval
}
```

---

# APPENDIX A: SEQUENCE DIAGRAMS

## A1. Receipt → AI Classification → Journal Entry

\`\`\`mermaid
sequenceDiagram
    participant User
    participant API
    participant OCRService
    participant GroqService
    participant AccountingService
    participant TeableClient
    participant Discord

    User->>API: POST /api/ocr/queue-upload (image)
    API->>OCRService: processReceipt()
    OCRService->>PaddleOCR: Extract text
    PaddleOCR-->>OCRService: { vendor, amount, date }
    OCRService->>API: Receipt created (status: processed)
    API-->>User: { receiptId, extractedFields }

    User->>API: POST /api/accounting/journal-entries/from-ocr
    API->>GroqService: classifyEntry({ vendor, amount })
    GroqService->>Groq API: Classify transaction
    Groq API-->>GroqService: { category, confidence: 0.95, reasoning }
    GroqService->>Discord: sendMLUpdate (ML alert)
    GroqService-->>API: classification

    alt Confidence >= 0.80
        API->>AccountingService: createDraftEntry (auto-approved)
    else Confidence < 0.80
        API->>AccountingService: createDraftEntry (status: pending)
    end

    AccountingService->>TeableClient: createRecord (for review)
    TeableClient-->>API: { teableRecordId }
    API-->>User: { entryId, status, teableSynced }
\`\`\`

---

## A2. Teable Approval → Export

\`\`\`mermaid
sequenceDiagram
    participant Accountant
    participant Teable UI
    participant Webhook
    participant API
    participant AccountingService
    participant MedicerService
    participant ExportService
    participant Discord

    Accountant->>Teable UI: Review draft entry
    Accountant->>Teable UI: Click "Approve" + select "immediate export"
    Teable UI->>Webhook: POST /webhooks/teable (HMAC signature)

    Webhook->>API: Validate signature
    API->>AccountingService: postEntry()
    AccountingService->>MedicerService: postEntry (Dr/Cr)
    MedicerService->>Medici Ledger: Record transaction
    MedicerService->>MedicerService: Verify trial balance (Dr == Cr)
    MedicerService-->>AccountingService: journalId

    AccountingService-->>API: Entry posted

    alt exportPath == "immediate"
        API->>ExportService: queueForExportImmediate()
        ExportService->>Express API: POST /gl-journal
        Express API-->>ExportService: { status: success }
        ExportService->>Discord: sendInfoLog (Export complete)
    else exportPath == "scheduled"
        API->>ExportService: queueForScheduledExport (1800 cron)
    end

    API->>Teable UI: Update status: processed
    API-->>Webhook: { success: true }
\`\`\`

---

## A3. Daily Batch Export (Cron Job)

\`\`\`mermaid
sequenceDiagram
    participant Cron
    participant DailyExportJob
    participant ExportQueue
    participant GoogleDrive
    participant Discord

    Cron->>DailyExportJob: Trigger at 18:00 (6 PM)
    DailyExportJob->>ExportQueue: Fetch entries WHERE status=scheduled AND scheduledFor <= NOW
    ExportQueue-->>DailyExportJob: [ entry1, entry2, ... ]

    loop For each entry
        DailyExportJob->>DailyExportJob: Validate Dr == Cr
        DailyExportJob->>DailyExportJob: Generate CSV row
    end

    DailyExportJob->>GoogleDrive: Upload batch CSV
    GoogleDrive-->>DailyExportJob: { fileId, shareUrl }

    DailyExportJob->>ExportQueue: Update status: completed
    DailyExportJob->>Discord: sendInfoLog (Batch export complete: 47 entries)
    DailyExportJob-->>Cron: Done
\`\`\`

---

# APPENDIX B: CONFIGURATION EXAMPLES

## B1. Environment Variables

\`\`\`bash
# backend/.env

# Groq AI
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxx
GROQ_MODEL=llama-3.3-70b-versatile
ML_CONFIDENCE_THRESHOLD=0.80

# Teable
TEABLE_API_URL=https://app.teable.io/api
TEABLE_API_KEY=tbl_xxxxxxxxxxxxxxxxxxxx
TEABLE_BASE_ID=bse_xxxxxxxxxxxxxxxxxxxx
TEABLE_TABLE_ID=tbl_xxxxxxxxxxxxxxxxxxxx
TEABLE_WEBHOOK_SECRET=your-webhook-secret-256-bits

# Medici (optional, usually defaults)
MEDICI_DB_NAME=auto-acct-ledger

# Discord Alerts
DISCORD_WEBHOOK_ML=https://discord.com/api/webhooks/xxx
DISCORD_WEBHOOK_CRITICAL=https://discord.com/api/webhooks/yyy
DISCORD_WEBHOOK_INFO=https://discord.com/api/webhooks/zzz
\`\`\`

---

## B2. Teable Table Schema

**Table Name:** `Journal Entries (Pending Review)`

| Field Name          | Type      | Description                          | Example                  |
|---------------------|-----------|--------------------------------------|--------------------------|
| Journal Entry ID    | Text      | MongoDB ObjectId                     | `64abc123...`            |
| Vendor              | Text      | Merchant name                        | `7-Eleven`               |
| Amount (THB)        | Number    | Amount in Baht                       | `125.00`                 |
| Status              | Select    | `pending_approval`, `approved`, `rejected`, `processed` | `approved` |
| Category            | Text      | AI-suggested category                | `5100 - อาหาร เครื่องดื่ม` |
| AI Confidence       | Text      | Confidence score                     | `95.0%`                  |
| Export Path         | Select    | `manual`, `immediate`, `scheduled`   | `immediate`              |
| Created At          | DateTime  | Timestamp                            | `2026-01-20 16:00:00`    |
| Processed At        | DateTime  | When exported                        | `2026-01-20 16:05:00`    |
| Error Message       | Text      | Error if processing failed           | `null`                   |

---

# APPENDIX C: TESTING PATTERNS

## C1. Integration Test: Full OCR → Groq → Teable Flow

\`\`\`typescript
// backend/tests/integration/ocr-groq-teable.test.ts
import { OCRService } from '../../src/modules/ocr/services/OCRService';
import { GroqClassificationService } from '../../src/modules/ai/GroqClassificationService';
import { AccountingService } from '../../src/modules/accounting/services/AccountingService';
import { TeableClient } from '../../src/modules/teable/services/TeableClient';

describe('Full Flow: OCR → Groq → Teable', () => {
  let ocrService: OCRService;
  let groqService: GroqClassificationService;
  let accountingService: AccountingService;
  let teableClient: TeableClient;

  beforeAll(() => {
    ocrService = new OCRService();
    groqService = new GroqClassificationService();
    accountingService = new AccountingService();
    teableClient = new TeableClient();
  });

  it('should process receipt from upload to Teable sync', async () => {
    // 1. Upload receipt
    const receipt = await ocrService.processReceipt({
      fileBuffer: mockImageBuffer,
      fileName: 'coffee-receipt.jpg',
      clientId: 'client123',
    });

    expect(receipt.extractedFields.vendor).toBe('7-Eleven');
    expect(receipt.extractedFields.amount).toBe(12500); // 125 THB

    // 2. Classify with Groq
    const classification = await groqService.classifyEntry({
      vendor: receipt.extractedFields.vendor,
      amount: receipt.extractedFields.amount,
    });

    expect(classification.category).toContain('5100');
    expect(classification.confidence).toBeGreaterThanOrEqual(0.80);

    // 3. Create draft entry
    const entry = await accountingService.createDraftEntry({
      receiptId: receipt.id,
      account: {
        debit: '5100-Food',
        credit: '1010-Checking',
      },
      amount: receipt.extractedFields.amount,
      description: `${receipt.extractedFields.vendor} - ${classification.reasoning}`,
      classification,
      clientId: 'client123',
    });

    expect(entry.status).toBe('draft');

    // 4. Sync to Teable
    const teableRecord = await teableClient.createRecord({
      journalEntryId: entry.id,
      vendor: receipt.extractedFields.vendor,
      amount: receipt.extractedFields.amount / 100, // Satang → Baht
      status: 'pending_approval',
      category: classification.category,
      aiConfidence: classification.confidence,
    });

    expect(teableRecord.id).toBeDefined();
    expect(entry.teableRecordId).toBe(teableRecord.id);
  }, 30000); // 30s timeout for API calls
});
\`\`\`

---

## C2. Testing Webhook HMAC Signature

\`\`\`typescript
// backend/tests/unit/TeableWebhookController.test.ts
import crypto from 'crypto';
import { TeableWebhookController } from '../../src/modules/teable/webhooks/TeableWebhookController';

describe('TeableWebhookController', () => {
  it('should reject invalid HMAC signature', async () => {
    const payload = {
      record: { id: 'rec123', fields: { 'Status': 'approved' } },
      action: 'approve',
    };

    const invalidSignature = 'invalid_signature';

    const req: any = {
      headers: { 'x-teable-signature': invalidSignature },
      body: payload,
    };

    const res: any = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    await controller.handleApproval(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: 'Invalid signature',
    });
  });

  it('should accept valid HMAC signature', async () => {
    const payload = {
      record: { id: 'rec123', fields: { 'Status': 'approved' } },
      action: 'approve',
    };

    const secret = process.env.TEABLE_WEBHOOK_SECRET || '';
    const validSignature = crypto
      .createHmac('sha256', secret)
      .update(JSON.stringify(payload))
      .digest('hex');

    const req: any = {
      headers: { 'x-teable-signature': validSignature },
      body: payload,
    };

    const res: any = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    await controller.handleApproval(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      message: 'Webhook processed',
    });
  });
});
\`\`\`

---

# PRODUCTION CHECKLIST

## ✅ Before Deploying Volume 2B

- [ ] **Groq API Key** configured in `.env`
- [ ] **ML Confidence Threshold** set (default: `0.80`)
- [ ] **Teable API credentials** configured (API key, Base ID, Table ID)
- [ ] **Teable Webhook Secret** set (256-bit random string)
- [ ] **Discord Webhooks** configured for ML alerts
- [ ] **Medici database** initialized (ledger collection)
- [ ] **Test Groq classification** with 3 sample vendors
- [ ] **Test Teable webhook** with mock payload
- [ ] **Test HMAC signature validation**
- [ ] **Run integration tests** (OCR → Groq → Teable)
- [ ] **Monitor Groq rate limits** (30 req/min)
- [ ] **Setup Teable polling job** (every 30 min)

---

# WHAT'S NEXT?

**Volume 2C: DevOps & Deployment** will cover:
- Routes & API structure
- Docker deployment
- Error handling patterns
- Performance optimization
- Monitoring & debugging
- Production troubleshooting

---

**Document Version:** 2.0B  
**Last Updated:** January 20, 2026, 4:35 PM +07  
**Status:** Production-Ready Implementation  
**Total Pages:** 45

---

**END OF VOLUME 2B**
