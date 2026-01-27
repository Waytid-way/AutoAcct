# AutoAcct Backend

**Version:** 1.2.0 (Phase 3E - Intelligence Layer)
**Status:** 🚀 Active Development
**Last Updated:** January 2026

---

## 🎯 Overview

The AutoAcct Backend is the core engine ensuring financial integrity and intelligent processing. It orchestrates the flow from Receipt Upload -> OCR Extraction -> AI Classification -> Double-Entry Ledger Posting.

## 🔑 Key Modules

### 1. Receipt Management (`/modules/receipt`)
-   Handles file uploads (Multer) and duplicate detection (SHA-256).
-   Manages processing status (Queued -> OCR -> AI -> Confirmed).
-   **New:** Supports **Split Transactions** (Line Items) in the `Receipt` model.

### 2. Accounting Ledger (`/modules/accounting`)
-   **Medici Integration**: Implements a double-entry ledger system.
-   **Journal Entries**: Atomically records debits and credits.
-   **Rules Enforced**:
    -   *Trial Balance*: Total Debits must equal Total Credits.
    -   *Immutability*: Posted transactions cannot be altered, only reversed.

### 3. AI & OCR (`/modules/ocr`, `/modules/ai`)
-   **OCR**: Pluggable architecture supporting PaddleOCR, Google Vision, etc.
-   **Groq AI**: Intelligent classification of line items into accounting categories.

### 4. Transaction Service (`/modules/transaction`)
-   Manages high-level transaction workflows (`createDraft`, `postTransaction`).

---

## 🛠️ API Endpoints

### Receipts
-   `POST /api/receipts/upload` - Upload a new receipt image/PDF.
-   `GET /api/receipts/queue` - Get receipts waiting for processing/review.
-   `GET /api/receipts/:id` - Get receipt details (including extracted line items).
-   `POST /api/receipts/:id/confirm` - Confirm receipt and create transaction (supports Split Items).

### Transactions
-   `GET /api/transactions` - List recent transactions.
-   `GET /api/transactions/trial-balance` - Get current trial balance.

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
bun install
```

### 2. Environment Setup
Copy `.env.example` to `.env` and configure:
-   `MONGODB_URI`
-   `GROQ_API_KEY` (for AI classification)

### 3. Run Server
```bash
bun run dev
```

### 4. Run Tests
```bash
bun test
```

---

## 🏗️ Architecture Notables
-   **Lego Architecture**: Modular, domain-driven design.
-   **Satang-based Math**: All monetary values are integers (Satang) to prevent floating-point errors.
-   **Correlation IDs**: End-to-end request tracing.
