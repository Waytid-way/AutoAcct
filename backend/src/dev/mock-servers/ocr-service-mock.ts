// backend/src/dev/mock-servers/ocr-service-mock.ts

import express from 'express';
import type { Request, Response } from 'express';
import multer from 'multer';

/**
 * MOCK OCR SERVICE API
 *
 * Purpose: Simulate OCR API for local testing
 * Port: 8000
 *
 * Endpoints:
 * - POST /api/v1/ocr/extract      Extract text from image
 * - POST /api/v1/ocr/batch        Batch processing
 */

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

app.use(express.json());

// POST /api/v1/ocr/extract
app.post('/api/v1/ocr/extract', upload.single('image'), (req: Request, res: Response) => {
  const file = req.file as Express.Multer.File;
  if (!file) {
    return res.status(400).json({
      success: false,
      error: { code: 'NO_IMAGE', message: 'Image file is required' },
    });
  }

  // Simulate OCR processing delay
  setTimeout(() => {
    const result = {
      ocrText: 'COFFEE SHOP\nTotal: 125.00 THB\nDate: 22/01/2026\nTax ID: 1234567890123',
      extractedFields: {
        vendor: 'Coffee Shop',
        amountSatang: 12500,
        issueDate: '2026-01-22',
        taxId: '1234567890123',
        documentNumber: 'INV-001',
      },
      confidenceScores: {
        vendor: 0.95,
        amount: 0.98,
        date: 0.92,
        taxId: 0.99,
        overall: 0.96,
      },
      processingTimeMs: 500,
      engine: 'mock',
    };

    console.log(`[MockOCR] Processed image: ${file.originalname}`);

    res.json({
      success: true,
      data: result,
    });
  }, 500);  // 500ms delay
});

// POST /api/v1/ocr/batch
app.post('/api/v1/ocr/batch', upload.array('images'), (req: Request, res: Response) => {
  const files = req.files as Express.Multer.File[];

  if (!files || files.length === 0) {
    return res.status(400).json({
      success: false,
      error: { code: 'NO_IMAGES', message: 'Image files are required' },
    });
  }

  // Simulate batch processing delay
  setTimeout(() => {
    const results = files.map((file, index) => ({
      index,
      ocrText: `DOCUMENT ${index + 1}\nAmount: ${(index + 1) * 100}.00 THB`,
      extractedFields: {
        vendor: `Vendor ${index + 1}`,
        amountSatang: (index + 1) * 10000,
        issueDate: '2026-01-22',
      },
      confidenceScores: {
        vendor: 0.90 + Math.random() * 0.08,
        amount: 0.95 + Math.random() * 0.04,
        date: 0.88 + Math.random() * 0.10,
        overall: 0.92 + Math.random() * 0.06,
      },
      processingTimeMs: 400 + Math.random() * 200,
      engine: 'mock',
    }));

    console.log(`[MockOCR] Batch processed ${files.length} images`);

    res.json({
      success: true,
      data: results,
    });
  }, 800);  // 800ms delay for batch
});

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'MockOCR',
    version: '1.0.0',
  });
});

// Start server
export function startOcrMock(port: number = 8000) {
  app.listen(port, () => {
    console.log(`
╔════════════════════════════════════════════════════╗
║  🤖 MOCK OCR SERVICE API                          ║
║  Port: ${port}                                      ║
║  Mode: DEV                                         ║
║                                                    ║
║  Endpoints:                                        ║
║  POST /api/v1/ocr/extract                          ║
║  POST /api/v1/ocr/batch                            ║
║  GET  /health                                      ║
╚════════════════════════════════════════════════════╝
    `);
  });
}

// Run if executed directly
if (require.main === module) {
  startOcrMock();
}