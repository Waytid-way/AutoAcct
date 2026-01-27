# AutoAcct 🧾

**AutoAcct** is an intelligent, self-hosted auto-accounting system designed to streamline receipt processing using OCR, AI, and Double-Entry Accounting.

## 🚀 Features

-   **Smart Receipt Processing**: Upload receipts via drag-and-drop.
-   **OCR & Data Extraction**: Automatically extracts Vendor, Date, and Amount.
-   **Split Transactions**: AI-powered line item extraction and classification (Groq AI).
-   **Double-Entry Ledger**: Built-in financial integrity using Medici-based ledger.
-   **Review & Edit**: Human-in-the-loop verification for high accuracy.
-   **Dark Minimalist UI**: Clean, focus-driven interface.

## 🏗️ Architecture

The project consists of two main components:

-   **Frontend (`/frontend`)**: Next.js 14 application with a dark minimalist UI. Handles uploads, review, and user interaction.
-   **Backend (`/backend`)**: Express.js/Node.js service managing OCR (PaddleOCR/Google/Claudia), AI (Groq), definitions, and the Accounting Ledger.

## 🛠️ Quick Start

### Prerequisites
-   Node.js 18+ (or Bun)
-   MongoDB (running locally or remote)

### 1. Backend Setup
```bash
cd backend
bun install
bun run dev
# Server running at http://localhost:3001
```

### 2. Frontend Setup
```bash
cd frontend
npm install
npm run dev
# App running at http://localhost:3000
```

## 📚 Documentation
-   [Frontend Documentation](frontend/README.md)
-   [Backend Documentation](backend/README.md)

## 🔐 Security
-   All financial data is processed locally or via secure APIs.
-   Mock Authentication (Phase 1/2) - Ready for JWT integration.

## 📜 License
Proprietary - AutoAcct Project