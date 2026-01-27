// backend/src/dev/mock-servers/express-accounting-mock.ts

import express from 'express';
import type { Request, Response } from 'express';

/**
 * MOCK EXPRESS ACCOUNTING API
 *
 * Purpose: Simulate Express Accounting API for local testing
 * Port: 9000
 *
 * Endpoints:
 * - POST /api/v1/transactions      Create transaction
 * - GET  /api/v1/transactions/:id  Get status
 * - POST /api/v1/transactions/:id/void  Void transaction
 */

const app = express();
app.use(express.json());

// In-memory storage
const transactions = new Map<string, any>();

// POST /api/v1/transactions
app.post('/api/v1/transactions', (req: Request, res: Response) => {
  const { debitAccount, creditAccount, amount, description, date } = req.body;

  // Validate
  if (!debitAccount || !creditAccount || !amount) {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_DATA', message: 'Missing required fields' },
    });
  }

  // Simulate processing delay
  setTimeout(() => {
    const doc = {
      documentId: `DOC-${Date.now()}`,
      documentNumber: `JV-${Math.floor(Math.random() * 10000)}`,
      status: 'posted',
      debitAccount,
      creditAccount,
      amount,
      description,
      date,
      createdAt: new Date().toISOString(),
    };

    transactions.set(doc.documentId, doc);

    console.log(`[MockExpress] Transaction created: ${doc.documentNumber}`);

    res.status(201).json({
      success: true,
      data: doc,
    });
  }, 300);  // 300ms delay
});

// GET /api/v1/transactions/:id
app.get('/api/v1/transactions/:id', (req: Request, res: Response) => {
  const doc = transactions.get(req.params.id);

  if (!doc) {
    return res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Transaction not found' },
    });
  }

  res.json({ success: true, data: doc });
});

// POST /api/v1/transactions/:id/void
app.post('/api/v1/transactions/:id/void', (req: Request, res: Response) => {
  const doc = transactions.get(req.params.id);

  if (!doc) {
    return res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Transaction not found' },
    });
  }

  doc.status = 'voided';
  doc.voidedAt = new Date().toISOString();
  doc.voidReason = req.body.reason;

  console.log(`[MockExpress] Transaction voided: ${doc.documentNumber}`);

  res.json({ success: true, data: doc });
});

// Start server
export function startExpressMock(port: number = 9000) {
  app.listen(port, () => {
    console.log(`
╔════════════════════════════════════════════════════╗
║  🎭 MOCK EXPRESS ACCOUNTING API                    ║
║  Port: ${port}                                      ║
║  Mode: DEV                                         ║
║                                                    ║
║  Endpoints:                                        ║
║  POST /api/v1/transactions                         ║
║  GET  /api/v1/transactions/:id                     ║
║  POST /api/v1/transactions/:id/void                ║
╚════════════════════════════════════════════════════╝
    `);
  });
}

// Run if executed directly
if (require.main === module) {
  startExpressMock();
}