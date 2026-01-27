# 🗺️ AutoAcct Phase 2.3: Integration Layer – MASTER SPECIFICATION

**Status:** IN PROGRESS  
**Start Date:** January 26, 2026  
**Target Duration:** 10-15 days  
**Architecture:** Task-based, Adapter Pattern, Dual-Mode (Dev/Prod)

---

## 📌 Phase 2.3 Vision

**Phase 2.2 built the financial engine. Phase 2.3 connects the eyes & hands:**

```
┌─────────────────────────────────────────────────────────────┐
│ AutoAcct Phase 2.3: Integration Layer                       │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  Task 1: Medici Ledger Adapter                              │
│  ├─ ILedgerAdapter (interface)                              │
│  ├─ MockLedgerAdapter (port 9000 for dev/testing)          │
│  ├─ MediciAdapter (real API for prod)                       │
│  ├─ Retry logic + Circuit breaker                          │
│  └─ Status: POSTED_TO_LEDGER, LEDGER_ERROR                 │
│                                                               │
│  Task 2: Groq OCR Integration                               │
│  ├─ IOCRService (interface)                                 │
│  ├─ MockOCRService (port 9001 for dev)                     │
│  ├─ GroqOCRService (real Groq API for prod)                │
│  ├─ Async queue (BullMQ/RabbitMQ)                          │
│  └─ Status: OCR_PENDING → OCR_PROCESSING → OCR_COMPLETE    │
│                                                               │
│  Task 3: Teable Sync Integration (Optional)                │
│  ├─ ITiableAdapter (interface)                             │
│  ├─ MockTeableAdapter (port 9002)                          │
│  ├─ TeableAdapter (real API)                               │
│  └─ Status: SYNCED_TO_TEABLE, TEABLE_ERROR                 │
│                                                               │
│  Task 4: Express Export & Batch Operations                 │
│  ├─ ExpressExportService                                    │
│  ├─ BatchExportService (queue-based)                       │
│  ├─ Export formats: JSON, CSV, PDF                         │
│  └─ Status: EXPORT_PENDING → EXPORT_COMPLETE              │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## 🎯 Phase 2.3 Goals

### Goal 1: Medici Ledger Integration ⭐ CRITICAL
**Objective:** Post journal entries to Medici ledger (real or mock)

**Acceptance Criteria:**
- [ ] MediciAdapter can post entries to Medici API (or mock server)
- [ ] Retry logic handles transient failures
- [ ] Circuit breaker prevents cascading failures
- [ ] Fallback to queue if Medici is down
- [ ] Error tracking via EXTERNAL_SERVICE_ERROR
- [ ] 95%+ test coverage

**Key Classes:**
```
ILedgerAdapter (interface)
├── postEntry(entry: JournalEntry, correlationId): Promise<{ ledgerId: string }>
├── getBalance(accountId: string): Promise<number>
├── reconcile(): Promise<TrialBalance>
└── health(): Promise<'healthy' | 'degraded' | 'down'>

MockLedgerAdapter (dev/testing)
├── In-memory store (no real API calls)
├── Deterministic behavior for tests
├── Slowness simulation (optional)
└── Error injection (triggerError query param)

MediciAdapter (production)
├── HTTP client to Medici API
├── Retry logic: exponential backoff (1s, 2s, 4s, 8s, max 30s)
├── Circuit breaker: 3 failures → 30s cooldown
├── Timeout: 10s per request
└── Auth: Bearer token from config
```

---

### Goal 2: Groq OCR Integration ⭐ CRITICAL
**Objective:** Extract invoice data from images automatically

**Acceptance Criteria:**
- [ ] GroqOCRService can process images (real or mock)
- [ ] Async queue processes OCR asynchronously
- [ ] Status tracking: PENDING → PROCESSING → COMPLETE
- [ ] Fallback to manual entry if OCR fails
- [ ] Error handling + retry
- [ ] 90%+ test coverage

**Key Classes:**
```
IOCRService (interface)
├── processImage(file: Buffer, mimeType: string, correlationId): Promise<{
│   └─ invoiceNumber?: string
│   └─ date?: Date
│   └─ vendor?: string
│   └─ amount?: number
│   └─ confidence?: number
│   └─ rawText?: string
│ }>
├── status(jobId: string): Promise<'pending' | 'processing' | 'complete'>
└── health(): Promise<'healthy' | 'degraded' | 'down'>

MockOCRService (dev)
├── Rule-based extraction (filename patterns)
├── Deterministic results
├── Latency simulation (async, ~1 second)
└── Error injection

GroqOCRService (production)
├── HTTP client to Groq Vision API
├── Image preprocessing (resize, optimize)
├── Structured extraction (JSON mode)
├── Retry: 3 attempts with exponential backoff
└── Timeout: 30s per image
```

---

### Goal 3: Teable Kanban Sync (Optional but Nice) 🌟
**Objective:** Sync receipts to Teable Kanban board

**Acceptance Criteria:**
- [ ] TeableAdapter can sync receipt data
- [ ] Real-time board updates (new receipts → "To Review" column)
- [ ] Status mapping: Receipt status → Board column
- [ ] Error recovery (queue-based retry)
- [ ] 85%+ test coverage

**Key Classes:**
```
ITiableAdapter (interface)
├── createCard(receipt: Receipt, correlationId): Promise<{ cardId: string }>
├── updateCard(cardId: string, update: Partial<Card>): Promise<void>
├── deleteCard(cardId: string): Promise<void>
└── health(): Promise<'healthy' | 'degraded' | 'down'>

Kanban Board Structure:
├── "Pending OCR" (new uploads)
├── "Ready for Review" (OCR complete)
├── "Approved" (validated by user)
└── "Posted to GL" (journal entry created)

Status Mapping:
- Receipt.status = 'UPLOADED' → Card in "Pending OCR"
- Receipt.status = 'OCR_COMPLETE' → Card in "Ready for Review"
- Receipt.status = 'APPROVED' → Card in "Approved"
- Receipt.status = 'POSTED' → Card in "Posted to GL"
```

---

### Goal 4: Express Export Service 🚀
**Objective:** Export GL data to Express accounting format

**Acceptance Criteria:**
- [ ] ExpressExportService formats GL entries correctly
- [ ] Support multiple formats: JSON, CSV, PDF
- [ ] Batch exports (queue-based)
- [ ] Date range filtering
- [ ] Permission checking (client isolation)
- [ ] 90%+ test coverage

**Key Classes:**
```
ExpressExportService
├── exportJSON(clientId, dateRange, correlationId): Promise<Buffer>
├── exportCSV(clientId, dateRange, correlationId): Promise<Buffer>
├── exportPDF(clientId, dateRange, correlationId): Promise<Buffer>
└── validateExportPermission(clientId, userId): Promise<boolean>

BatchExportService
├── queueExport(req: ExportRequest): Promise<{ jobId: string }>
├── getStatus(jobId): Promise<'pending' | 'processing' | 'complete'>
├── download(jobId): Promise<Buffer>
└── [async worker processes exports in background]

Express Format:
{
  "exportDate": "2026-01-26T20:00:00Z",
  "clientName": "ACME Corp",
  "entries": [
    {
      "date": "2026-01-20",
      "accountCode": "1000",
      "accountName": "Cash",
      "debit": 50000,
      "credit": 0,
      "description": "Cash receipt",
      "reference": "INV-2026-001"
    }
  ],
  "summary": {
    "totalDebit": 50000,
    "totalCredit": 50000,
    "periodStart": "2026-01-01",
    "periodEnd": "2026-01-31"
  }
}
```

---

## 🏗️ Task Breakdown

### TASK 1: Medici Ledger Adapter Pattern (Days 1-3)

#### 1.1 Create Interface + Types
```
File: modules/ledger/types/ledger.types.ts
├── interface ILedgerAdapter
├── type LedgerEntry
├── type LedgerAccount
├── type TrialBalance
└── type LedgerHealth

File: modules/ledger/adapters/ILedgerAdapter.ts
└── export interface ILedgerAdapter { ... }
```

#### 1.2 Implement MockLedgerAdapter
```
File: modules/ledger/adapters/MockLedgerAdapter.ts
├── In-memory store (Map<accountId, balance>)
├── postEntry() - updates balance
├── getBalance() - retrieves balance
├── reconcile() - returns trial balance
├── health() - returns mock health status
└── [for testing without real API]

Dev Mode: NODE_ENV=development
├── Listen on port 9000
├── REST endpoints: /api/mock-ledger/*
└── Query params: ?triggerError=true (for error testing)
```

#### 1.3 Implement MediciAdapter
```
File: modules/ledger/adapters/MediciAdapter.ts
├── HTTP client to Medici API
├── Exponential backoff retry
├── Circuit breaker pattern
├── Timeout handling
├── Error mapping to ExternalServiceError
└── Request/response logging

Config:
- MEDICI_API_URL (from env)
- MEDICI_API_KEY (from env)
- MEDICI_REQUEST_TIMEOUT = 10000ms
- MEDICI_RETRY_MAX_ATTEMPTS = 3
- MEDICI_CIRCUIT_BREAKER_THRESHOLD = 5 failures
```

#### 1.4 Integrate with JournalService
```
File: modules/journal/services/JournalService.ts
├── Inject ILedgerAdapter
├── After posting to GL → call ledgerAdapter.postEntry()
├── Handle ledger errors → queue for retry
├── Update Receipt status: POSTED_TO_LEDGER
└── Log correlation trace

Flow:
  JournalService.postEntry()
    → Validate journal entry
    → Update GL atomically
    → Check trial balance
    → Call ledgerAdapter.postEntry() ← NEW
    → If error: queue for retry (Phase 2.3B)
    → Update receipt status
    → Return success
```

#### 1.5 Testing & Error Scenarios
```
Test Cases: 15+ tests
├── Mock adapter: post entry, get balance, reconcile
├── Real adapter: successful post, retry on failure
├── Circuit breaker: cascade failure prevention
├── Timeout: handle slow API
├── Error mapping: 500 → ExternalServiceError
├── Correlation tracing: verify correlationId passed through
└── Integration: end-to-end JournalService → Ledger

Error Scenarios:
├── Medici API down (503) → fallback to queue
├── Medici timeout (10s) → retry with backoff
├── Medici invalid response → log + alert
├── Circuit breaker open → queue all requests
└── Mock adapter in dev → deterministic testing
```

---

### TASK 2: Groq OCR Integration (Days 3-6)

#### 2.1 Create Interface + Types
```
File: modules/ocr/types/ocr.types.ts
├── interface IOCRService
├── type OCRResult
├── type OCRStatus
├── type OCRJob
└── type OCRConfig

File: modules/ocr/adapters/IOCRService.ts
└── export interface IOCRService { ... }
```

#### 2.2 Implement MockOCRService
```
File: modules/ocr/adapters/MockOCRService.ts
├── Rule-based extraction from filename/metadata
├── Deterministic results for testing
├── Async delay simulation (1-2 seconds)
├── Error injection (?triggerError=true)
└── No external API calls

Dev Mode:
├── Listen on port 9001
├── REST endpoints: /api/mock-ocr/*
├── Test files: test-invoice-001.jpg → predictable extraction
└── Status tracking: PENDING → PROCESSING → COMPLETE
```

#### 2.3 Implement GroqOCRService
```
File: modules/ocr/adapters/GroqOCRService.ts
├── HTTP client to Groq Vision API
├── Image preprocessing (resize, optimize)
├── Structured extraction (JSON mode):
│   ├── invoiceNumber
│   ├── date (ISO format)
│   ├── vendor name
│   ├── amount (in satang)
│   ├── confidence score
│   └── rawText (OCR output)
├── Retry: 3 attempts with exponential backoff
├── Timeout: 30s per image
└── Error → ExternalServiceError

Config:
- GROQ_API_KEY (from env)
- GROQ_MODEL = 'groq-vision-latest'
- GROQ_REQUEST_TIMEOUT = 30000ms
- GROQ_RETRY_MAX_ATTEMPTS = 3
```

#### 2.4 Implement Async Queue (BullMQ or similar)
```
File: modules/ocr/queue/OcrQueue.ts
├── BullMQ job queue
├── Job status: PENDING → PROCESSING → COMPLETE
├── Retry: 3 attempts on failure
├── Concurrency: 2 jobs parallel
├── DLQ (dead-letter queue) for failures
└── Webhook callback to ReceiptService on completion

Job Structure:
{
  receiptId: string,
  fileBuffer: Buffer,
  mimeType: string,
  correlationId: string,
  createdAt: Date
}

Flow:
  1. ReceiptService.uploadReceipt()
     → Save file, status = OCR_PENDING
     → Queue OCR job

  2. [Async worker]
     → Process job: GroqOCRService.processImage()
     → Update Receipt: status = OCR_COMPLETE, extractedData = {...}
     → Callback: emit event for webhook

  3. [UI polling or WebSocket]
     → Poll /api/receipts/{id}/ocr-status
     → Show OCR result to user
```

#### 2.5 Testing & Error Scenarios
```
Test Cases: 20+ tests
├── Mock OCR: deterministic extraction
├── Real OCR: Groq API integration
├── Queue: job enqueue, process, complete
├── Retry: exponential backoff on failure
├── Timeout: handle slow API
├── Error mapping: 500 → ExternalServiceError
├── Status tracking: PENDING → PROCESSING → COMPLETE
├── Webhook: callback on completion
└── Correlation tracing: throughout pipeline

Error Scenarios:
├── Image invalid → ValidationError
├── Groq API down → queue retry
├── Groq timeout → retry with backoff
├── OCR confidence < 50% → flag for manual review
├── Queue full → queue on disk (persistent)
└── Worker crash → job persists, resumes
```

---

### TASK 3: Teable Sync Integration (Days 6-7) 🌟

#### 3.1 Create Interface + Types
```
File: modules/teable/types/teable.types.ts
├── interface ITiableAdapter
├── type TeableCard
├── type TeableColumn
├── type TeableStatus
└── type KanbanMapping

Kanban Board Structure:
{
  baseId: "abc123",
  tableId: "receipts-table",
  columns: [
    { id: "col-1", name: "Pending OCR" },
    { id: "col-2", name: "Ready for Review" },
    { id: "col-3", name: "Approved" },
    { id: "col-4", name: "Posted to GL" }
  ]
}
```

#### 3.2 Implement MockTeableAdapter
```
File: modules/teable/adapters/MockTeableAdapter.ts
├── In-memory Kanban board
├── Create/update/delete cards
├── Status column tracking
├── No external API calls
└── Port 9002 for dev mode
```

#### 3.3 Implement TeableAdapter
```
File: modules/teable/adapters/TeableAdapter.ts
├── HTTP client to Teable API
├── Create card: receipt → Kanban card
├── Update card: status change → column move
├── Delete card: cleanup on receipt delete
├── Retry: queue-based fallback
└── Error → ExternalServiceError

Config:
- TEABLE_API_KEY (from env)
- TEABLE_BASE_ID (from env)
- TEABLE_TABLE_ID (from env)
```

#### 3.4 Integrate with ReceiptService
```
File: modules/receipt/services/ReceiptService.ts
├── After uploadReceipt() → create Teable card
├── After OCR complete → move card to "Ready for Review"
├── After user approval → move to "Approved"
├── After posting to GL → move to "Posted to GL"
└── Handle Teable errors gracefully (don't block receipt flow)

Flow:
  ReceiptService.updateReceiptStatus()
    → Update Receipt.status in DB
    → Call tiableAdapter.updateCard() (async, non-blocking)
    → Return success (even if Teable fails)
```

---

### TASK 4: Express Export & Batch (Days 7-9)

#### 4.1 Create Export Service
```
File: modules/export/services/ExportService.ts
├── exportJSON(clientId, dateRange)
├── exportCSV(clientId, dateRange)
├── exportPDF(clientId, dateRange)
├── formatGLEntry(entry: GLEntry): ExportRow
└── validatePermissions(clientId, userId)

Express Format Example:
{
  "exportDate": "2026-01-26T20:10:00Z",
  "clientName": "ACME Corp",
  "entries": [
    {
      "date": "2026-01-20",
      "accountCode": "1000",
      "accountName": "Cash",
      "debit": 50000,
      "credit": 0,
      "description": "Cash receipt INV-2026-001"
    },
    {
      "date": "2026-01-20",
      "accountCode": "4000",
      "accountName": "Revenue",
      "debit": 0,
      "credit": 50000,
      "description": "Revenue from customer"
    }
  ],
  "summary": {
    "totalDebit": 50000,
    "totalCredit": 50000,
    "entryCount": 2,
    "periodStart": "2026-01-01",
    "periodEnd": "2026-01-31"
  }
}
```

#### 4.2 Implement Batch Export Service
```
File: modules/export/services/BatchExportService.ts
├── BullMQ job queue
├── Queue job: queueExport(req)
├── Worker: process export in background
├── Status polling: getStatus(jobId)
├── Download: getExportFile(jobId)
└── Concurrency: 1 job at a time (CPU-intensive)

Job Structure:
{
  clientId: string,
  userId: string,
  format: 'json' | 'csv' | 'pdf',
  dateStart: Date,
  dateEnd: Date,
  correlationId: string
}

API Endpoints:
POST /api/exports (queue export)
  → Returns { jobId, status: 'pending' }

GET /api/exports/{jobId}/status (poll status)
  → Returns { status: 'processing' | 'complete', progress: 45 }

GET /api/exports/{jobId}/download (download file)
  → Returns Buffer (application/json, text/csv, application/pdf)
```

#### 4.3 Testing & Error Scenarios
```
Test Cases: 18+ tests
├── Export formats: JSON, CSV, PDF
├── Date filtering: correct GL entry selection
├── Permissions: verify client isolation
├── Batch queue: enqueue, process, complete
├── Large exports: 10,000+ entries
├── Empty exports: no entries in range
├── Correlation tracing: throughout export
└── Error handling: invalid clientId, permission denied, etc.
```

---

## 🔌 Adapter Pattern (Reusable Architecture)

**All integrations follow same pattern for dev/prod switching:**

```typescript
// Step 1: Define interface
export interface IMyAdapter {
  doSomething(param: string): Promise<Result>;
  health(): Promise<'healthy' | 'degraded' | 'down'>;
}

// Step 2: Mock for dev
export class MockMyAdapter implements IMyAdapter {
  async doSomething(param: string): Promise<Result> {
    // Deterministic, no real API calls
    return { success: true };
  }
  async health() { return 'healthy'; }
}

// Step 3: Real for prod
export class RealMyAdapter implements IMyAdapter {
  constructor(apiKey: string) { this.apiKey = apiKey; }
  async doSomething(param: string): Promise<Result> {
    // Real HTTP calls + retry + circuit breaker
    return this.httpClient.post('/api/endpoint', { param });
  }
  async health() { ... }
}

// Step 4: Factory (ConfigManager handles switching)
function createMyAdapter(): IMyAdapter {
  if (ConfigManager.isDev()) {
    return new MockMyAdapter();
  }
  return new RealMyAdapter(process.env.API_KEY!);
}

// Step 5: Use in service
export class MyService {
  constructor(private adapter: IMyAdapter) {}
  async process() {
    await this.adapter.doSomething('data');
  }
}
```

---

## 🚨 Error Handling Strategy (Phase 2.3)

**All external API errors map to existing error classes:**

```typescript
// ExternalServiceError catches all adapter errors
try {
  const result = await ledgerAdapter.postEntry(entry);
} catch (err) {
  if (err instanceof ExternalServiceError) {
    // Medici is down → queue for retry
    await this.retryQueue.enqueue({
      type: 'ledger_post',
      data: entry,
      retryCount: 0,
      nextRetryAt: Date.now() + 1000 // exponential backoff
    });
    
    // Alert ops
    logger.error(`[${correlationId}] Medici error: ${err.message}`);
    
    // Return success to user (async posting)
    return { success: true, status: 'queued_for_ledger' };
  }
  throw err; // Other errors bubble up
}
```

---

## 📊 Folder Structure (Phase 2.3 Update)

```
backend/src/modules/
├── ledger/
│   ├── types/
│   │   └── ledger.types.ts
│   ├── adapters/
│   │   ├── ILedgerAdapter.ts
│   │   ├── MockLedgerAdapter.ts
│   │   └── MediciAdapter.ts
│   ├── services/
│   │   └── LedgerIntegrationService.ts
│   ├── routes/
│   │   └── ledger.routes.ts
│   └── __tests__/
│       ├── MockLedgerAdapter.test.ts
│       ├── MediciAdapter.test.ts
│       └── integration.test.ts
│
├── ocr/
│   ├── types/
│   │   └── ocr.types.ts
│   ├── adapters/
│   │   ├── IOCRService.ts
│   │   ├── MockOCRService.ts
│   │   └── GroqOCRService.ts
│   ├── queue/
│   │   ├── OcrQueue.ts
│   │   └── OcrWorker.ts
│   ├── services/
│   │   └── OcrIntegrationService.ts
│   ├── routes/
│   │   └── ocr.routes.ts
│   └── __tests__/
│       ├── MockOCRService.test.ts
│       ├── GroqOCRService.test.ts
│       └── OcrQueue.test.ts
│
├── teable/
│   ├── types/
│   │   └── teable.types.ts
│   ├── adapters/
│   │   ├── ITiableAdapter.ts
│   │   ├── MockTeableAdapter.ts
│   │   └── TeableAdapter.ts
│   ├── services/
│   │   └── TeableIntegrationService.ts
│   └── __tests__/
│       └── TeableAdapter.test.ts
│
├── export/
│   ├── types/
│   │   └── export.types.ts
│   ├── services/
│   │   ├── ExportService.ts
│   │   └── BatchExportService.ts
│   ├── queue/
│   │   ├── ExportQueue.ts
│   │   └── ExportWorker.ts
│   ├── routes/
│   │   └── export.routes.ts
│   └── __tests__/
│       ├── ExportService.test.ts
│       └── BatchExportService.test.ts
│
└── queue/ (shared)
    ├── QueueManager.ts
    ├── RetryQueue.ts
    └── DeadLetterQueue.ts
```

---

## 🎬 Implementation Timeline

### Week 1 (Jan 27-31)
| Day | Task | Deliverable |
|-----|------|-------------|
| Mon | Task 1.1-1.2 | ILedgerAdapter + MockLedgerAdapter |
| Tue | Task 1.3-1.4 | MediciAdapter + JournalService integration |
| Wed | Task 1.5 + Task 2.1 | Ledger testing + OCR types |
| Thu | Task 2.2-2.3 | MockOCRService + GroqOCRService |
| Fri | Task 2.4-2.5 | OcrQueue + testing |

### Week 2 (Feb 1-5)
| Day | Task | Deliverable |
|-----|------|-------------|
| Mon | Task 3 | TeableAdapter + integration |
| Tue | Task 4.1-4.2 | ExportService + BatchExportService |
| Wed | Task 4.3 | Export testing |
| Thu | Integration testing | End-to-end tests |
| Fri | Documentation + polish | README, examples |

---

## ✅ Definition of Done (Phase 2.3)

For each task to be considered complete:

- [ ] Code written (TypeScript, production-grade)
- [ ] Unit tests: 90%+ coverage
- [ ] Integration tests: happy path + error scenarios
- [ ] Mock adapter: works without external API
- [ ] Real adapter: works with production API
- [ ] Error handling: maps to DomainError
- [ ] Logging: includes correlationId
- [ ] Documentation: JSDoc comments + examples
- [ ] No breaking changes to Phase 2.2
- [ ] PR reviewed + approved
- [ ] Merged to main branch

---

## 🎯 Success Metrics

By end of Phase 2.3:

✅ **Functionality:**
- Receipt upload → OCR extraction (auto)
- Journal entry post → Medici ledger (async with retry)
- Receipt status sync → Teable Kanban (real-time)
- GL export → Express format (batch downloads)

✅ **Reliability:**
- 95%+ successful Medici posts (with retry)
- 90%+ successful OCR (with manual fallback)
- 99%+ Teable sync (best-effort, non-blocking)
- Zero GL data loss

✅ **Developer Experience:**
- Switch dev/prod mode: change 1 env variable
- All adapters testable locally (mock servers on ports 9000-9002)
- Correlation tracing end-to-end
- Clear error messages + logging

---

## 📞 Handoff from Phase 2.2 → Phase 2.3

**Phase 2.2 Team Delivered:**
- ✅ Financial engine (JournalService, GLService, TrialBalance)
- ✅ Error handling (DomainError, global handler)
- ✅ Validation (Zod validators)
- ✅ Database schemas (Mongoose models)

**Phase 2.3 Team Takes:**
- ✅ All above, plus integrations with external systems
- ✅ Adapter pattern for extensibility
- ✅ Async queues for reliability
- ✅ Monitoring + alerting setup

**Key Files to Reference:**
- `shared/errors/ExternalServiceError.ts` – wrap all external API errors
- `shared/config/ConfigManager.ts` – isDev(), isProd(), get(key)
- `modules/journal/services/JournalService.ts` – calls MediciAdapter
- `modules/receipt/services/ReceiptService.ts` – calls OCR + Teable

---

## 🚀 Phase 2.3 Ready to Launch!

**All specifications finalized. Let's build integrations.** 💪

*Specification Generated: January 26, 2026 11:15 PM +07*  
*AutoAcct Lead Architect*
