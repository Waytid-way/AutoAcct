// backend/src/dev/mock-servers/index.ts

/**
 * DEVELOPMENT MOCK SERVERS
 *
 * Starts all mock servers for local development
 *
 * Usage:
 * - bun run dev:mocks
 * - Or import and call startAllMocks()
 */

import { startExpressMock } from './express-accounting-mock';
import { startOcrMock } from './ocr-service-mock';

export function startAllMocks(options?: {
  expressPort?: number;
  ocrPort?: number;
}) {
  const {
    expressPort = 9000,
    ocrPort = 8000,
  } = options || {};

  console.log(`
╔════════════════════════════════════════════════════╗
║  🚀 STARTING AUTOACCT DEV MOCK SERVERS            ║
║                                                    ║
║  Services:                                         ║
║  • Express Accounting Mock → http://localhost:${expressPort} ║
║  • OCR Service Mock        → http://localhost:${ocrPort} ║
║                                                    ║
║  Press Ctrl+C to stop all servers                 ║
╚════════════════════════════════════════════════════╝
  `);

  // Start servers
  startExpressMock(expressPort);
  startOcrMock(ocrPort);

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down mock servers...');
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('\n🛑 Shutting down mock servers...');
    process.exit(0);
  });
}

// Run if executed directly
if (require.main === module) {
  startAllMocks();
}