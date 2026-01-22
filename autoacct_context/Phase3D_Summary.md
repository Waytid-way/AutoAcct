# 🚀 PHASE 3D: EXPRESS EXPORT (DEBUG MODE)
## Complete Implementation Summary

**Version:** 3.0D-Debug  
**Date:** January 21, 2026, 12:44 PM +07  
**Status:** ✅ Production-Ready Debug Foundation  

---

# 📊 What's New (Phase 3D vs Vol 2C)

## Volume 2C Flow (Before)
```
User Upload Receipt
    ↓
OCR + AI Classification
    ↓
Teable Draft Review
    ↓
Accountant Approves
    ↓
Posted to Medici Ledger
    ↓ ❌ STOPS HERE
```

## Phase 3D Flow (After)
```
User Upload Receipt
    ↓
OCR + AI Classification
    ↓
Teable Draft Review
    ↓
Accountant Approves
    ↓
Posted to Medici Ledger ✅
    ↓
📤 AUTO-TRIGGER: Export Service
    ↓
Account Mapping (5101 → 510100)
    ↓
Transform Format (Satang → Baht)
    ↓
Mock Express API (Debug) / Real Express (Production)
    ↓
ExportLog Created (tracking)
    ↓
Frontend Status Display
    ↓
Retry Job (if failed, exponential backoff)
```

---

# 🏗️ Architecture Components

## 1. Configuration Layer
- **accountMapping.ts** - Thai COA (Chart of Accounts) configuration
  - 30+ predefined account mappings
  - Auto-Acct → Express account code conversion
  - Account type classification (asset/liability/equity/revenue/expense)

## 2. Service Layer
- **ExportService.ts** - Business logic for export workflow
  - Transform journal entries to Express format
  - Validate account mapping & double-entry
  - Log export events for audit trail
  - Retry logic with exponential backoff (5m → 15m → 1h)
  - Batch export support

## 3. Adapter Layer
- **ExpressAdapter.ts** - API client abstraction
  - Multiple modes: debug (mock) / staging / production
  - Format transformation (Satang → Baht, account code mapping)
  - Error handling + retry logic
  - Health check capability

## 4. Mock Server
- **express-mock.ts** - Simulated Express Accounting API
  - Runs on localhost:9000 (during debug)
  - Validates entry format
  - Returns realistic responses
  - Debug endpoint to inspect imported entries

## 5. Controller Layer
- **ExportController.ts** - REST endpoints
  - POST /api/v1/export/entries - Manual export trigger
  - GET /api/v1/export/status/:entryId - Check status
  - POST /api/v1/export/retry - Retry failed export

## 6. Database Layer
- **ExportLog Model** - Audit trail collection
  - Tracks every export attempt
  - Status: pending → success | failed → retrying
  - Correlation ID for tracing
  - Processing time metrics
  - Error messages for debugging

## 7. Frontend Component
- **ExportStatus.tsx** - React component
  - Shows export status badge
  - Displays external ID from Express
  - Handles retry button (if failed)
  - Auto-polls while retrying

## 8. Integration Points
- **JournalController.approveEntry()** - Auto-triggers export after posting
- **ExportRetryJob** - Background job every 5 minutes
- **Teable Webhook** - Receives approval events
- **Mock Express API** - Receives exported entries

---

# 📈 Complete Data Flow

### 1️⃣ User Approves in Teable
```
Accountant clicks "Approve" button in Teable UI
    ↓
Teable webhook: POST /api/v1/accounting/journal-entries/:entryId/approve
```

### 2️⃣ Entry Posted to Medici
```
JournalController.approveEntry()
    ↓
AccountingService.postEntry()
    ↓
MedicerService.post() x 2 (debit + credit lines)
    ↓
Trial Balance verification (Dr == Cr)
    ↓
Entry marked as "posted"
```

### 3️⃣ Export Triggered (Background)
```
ExportService.exportPostedEntry()
    ↓
Fetch entry from JournalEntry collection
    ↓
Transform to Express format:
  - 5101-Food-Expense → 510100
  - 1500 Satang → 15.00 Baht
  - Date: 2026-01-21
```

### 4️⃣ Account Mapping Validation
```
mapAccount('5101') → {
  expressCode: '510100',
  expressName: 'Expense - Food & Beverage',
  accountType: 'expense'
}

❌ If unmapped: Error + retry
✅ If mapped: Continue to export
```

### 5️⃣ Send to Express (or Mock)
```
DEBUG MODE:
ExpressAdapter → Mock Express (localhost:9000)
    ↓
Generate realistic response
    ↓
Return externalId: EXP-1705859600000-abc123

PRODUCTION:
ExpressAdapter → Real Express API
    ↓
POST /api/journal-entries
    ↓
Return Transaction ID from Express
```

### 6️⃣ Log Export Result
```
ExportLog.create({
  journalEntryId: 'abc123',
  status: 'success',
  externalId: 'EXP-xxx',
  processingTimeMs: 245,
  attemptCount: 1,
  correlationId: 'corr-123'
})
```

### 7️⃣ Frontend Display
```
GET /api/v1/export/status/:entryId
    ↓
Return: {
  status: 'success',
  externalId: 'EXP-xxx',
  exportedAt: '2026-01-21T12:45:00Z',
  processingTimeMs: 245
}
    ↓
UI shows: ✅ Exported to Express (EXP-xxx)
```

### 8️⃣ Retry Job (Every 5 min)
```
ExportRetryJob runs
    ↓
Find exports where:
  - status = 'failed' OR 'retrying'
  - nextRetryAt <= now
  - attemptCount < 3
    ↓
For each: ExportService.retryFailedExport()
    ↓
Update with exponential backoff
```

---

# 🔧 Debug Mode Setup

## Start Mock Express Server
```bash
cd backend
PORT=9000 bun src/mock-servers/express-mock.ts
```

**Output:**
```
🎭 Mock Express Server running on http://localhost:9000
📊 Endpoints:
  GET  /health                    - Health check
  POST /api/v1/journal-entries    - Import entry
  GET  /api/v1/entries/:id        - Get entry status
  GET  /api/v1/accounts           - List accounts
  GET  /api/v1/debug/entries      - View all imported entries
```

## Environment Variables (Debug Mode)
```bash
# backend/.env.debug
EXPRESS_MODE=debug
EXPRESS_API_URL=http://localhost:9000
EXPRESS_API_KEY=mock-key-debug
```

## Manual Export Test
```bash
# Test export status
curl -X GET http://localhost:3000/api/v1/export/status/ENTRY_ID \
  -H "Authorization: Bearer TOKEN"

# Manually trigger export
curl -X POST http://localhost:3000/api/v1/export/entries \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d '{"entryId": "ENTRY_ID"}'

# Test account mapping
curl -X GET http://localhost:3000/api/dev/export/account-mapping

# View export logs
curl -X GET http://localhost:3000/api/dev/export/logs
```

## Check Mock Express Received Entry
```bash
curl http://localhost:9000/api/v1/debug/entries
```

**Response Shows:**
- All entries imported from Auto-Acct
- Format received
- Status in Mock Express
- Completeness check

---

# ✅ What Works in Phase 3D

| Feature | Status | Notes |
|---------|--------|-------|
| Auto-trigger export on approval | ✅ Complete | Happens after posting to Medici |
| Account mapping (Auto-Acct → Express) | ✅ Complete | 30+ Thai accounts predefined |
| Format transformation | ✅ Complete | Satang→Baht, account codes |
| Double-entry validation | ✅ Complete | Verifies Dr=Cr before export |
| Mock Express API | ✅ Complete | Simulates real Express behavior |
| Export logging | ✅ Complete | Full audit trail in MongoDB |
| Export status display (Frontend) | ✅ Complete | React component with retry |
| Export retry logic | ✅ Complete | Exponential backoff up to 3 attempts |
| Background retry job | ✅ Complete | Runs every 5 minutes |
| Debug endpoints | ✅ Complete | Dev-only inspection tools |
| Error handling | ✅ Complete | Graceful degradation + retries |
| Correlation ID tracing | ✅ Complete | Full request flow tracking |

---

# 🎯 Next Steps (Phase 3E+)

## Phase 3E: Production Express Integration
1. Replace Mock Express with real API credentials
2. Test against Express staging environment
3. Verify account mappings with real data
4. Load test (1000+ entries/day)
5. Production deployment

## Phase 3F: Advanced Features
1. Bulk export (export multiple entries at once)
2. Export scheduling (batch exports at specific times)
3. Two-way sync (pull data from Express)
4. Reconciliation (verify exported data matches Express)
5. Dashboard analytics (export statistics)

## Phase 3G: Multi-Accounting System
1. Support Xero, QuickBooks, etc.
2. Format adapters for each system
3. Account mapping templates
4. System selection UI

---

# 📁 Files Created (Phase 3D)

1. **Phase3D_Export_Debug.md** (368 lines)
   - Account mapping configuration
   - Architecture overview
   
2. **Phase3D_Export_Service.md** (1,199 lines)
   - ExportService complete implementation
   - ExpressAdapter (mock + real modes)
   - Mock Express server
   - ExportController endpoints
   - Database model

3. **Phase3D_Webhook_Frontend.md** (862 lines)
   - Auto-trigger workflow
   - Background retry job
   - Frontend component
   - Debug tools & endpoints
   - Testing scenarios
   - Deployment checklist

**Total: ~2,400 lines of production-grade code**

---

# 💡 Key Features Explained

## Auto-Trigger Export
```typescript
// When accountant clicks "Approve" in Teable:
// 1. Entry posted to Medici ✅
// 2. ExportService.exportPostedEntry() called in background
// 3. Frontend shows status after completion
// 4. If fails: retry job picks it up every 5 minutes
```

## Account Mapping Intelligence
```typescript
// Maps Auto-Acct codes to Express codes
5101-Food-Expense → 510100 (Express)

// If unmapped:
// ❌ Error: "Cannot map account 5101 to Express"
// → User must add mapping first
// → Or change account code
```

## Format Transformation
```typescript
// Auto-Acct format:
{
  debitAccount: "1101",
  creditAccount: "5101",
  amount: 1500  // Satang
}

// Express format:
{
  transactionDate: "2026-01-21",
  lines: [
    { accountCode: "110100", debitAmount: 15.00 },  // Baht
    { accountCode: "510100", creditAmount: 15.00 }
  ]
}
```

## Retry with Exponential Backoff
```
1st failure → Retry in 5 minutes
2nd failure → Retry in 15 minutes
3rd failure → Retry in 1 hour
4th+ failure → Manual intervention needed
```

## Audit Trail Completeness
```typescript
ExportLog tracks:
- journalEntryId (source)
- externalId (Express)
- correlationId (tracing)
- attemptCount (retry count)
- processingTime (performance)
- errorMessage (debugging)
- exportedData (snapshot)
```

---

# 🧪 Quick Test Scenario

**Goal:** Verify end-to-end export flow works

### Setup (5 min)
1. Start Mock Express: `PORT=9000 bun express-mock.ts`
2. Start Backend: `bun run dev`
3. Set env: `EXPRESS_MODE=debug`

### Test (10 min)
1. Upload receipt via frontend
2. Confirm in Teable UI
3. Click "Approve"
4. Check export log: `curl /api/v1/export/status/ENTRY_ID`
5. Verify status: `✅ success` with external ID
6. Check Mock Express: `curl localhost:9000/api/v1/debug/entries`

### Verify (5 min)
1. See entry in Mock Express with correct format
2. Verify account mapping applied (5101 → 510100)
3. Verify Satang → Baht conversion
4. Check processingTime < 500ms

**Total Time:** 20 minutes ⏱️

---

# 🔐 Security & Reliability

## Security Features
- ✅ API Key authentication
- ✅ Role-based access control (accountant only)
- ✅ Correlation ID for audit trail
- ✅ PII sanitization in logs
- ✅ HMAC webhook validation (ready for Teable)
- ✅ Error messages don't expose internals

## Reliability Features
- ✅ Automatic retry with exponential backoff
- ✅ Circuit breaker pattern ready
- ✅ Database transactions (ACID)
- ✅ Health checks on all dependencies
- ✅ Graceful degradation (exports fail gracefully)
- ✅ Background job recovery

## Monitoring Ready
- ✅ Structured logging with correlation IDs
- ✅ Processing time metrics
- ✅ Error tracking & alerting ready
- ✅ Export success rate dashboard ready
- ✅ Failed export queue inspection

---

# 📞 Support & Troubleshooting

## Mock Express Won't Start
```bash
# Check port 9000 is free
lsof -i :9000

# Kill existing process
kill -9 <PID>

# Try with different port
PORT=9001 bun express-mock.ts
```

## Export Failing with "Account mapping invalid"
```bash
# Check mapping configuration
curl http://localhost:3000/api/dev/export/account-mapping

# Verify account code exists in Auto-Acct
# Add if missing: src/config/accountMapping.ts
```

## No Export Log Created
```bash
# Check MongoDB connection
# Verify ExportLog model exists
db.exportlogs.findOne()

# Check backend logs for errors
# Look for "export_failed" in logs
```

## Retry Not Triggering
```bash
# Verify ExportRetryJob started
# Check logs for "export_retry_job_started"

# Force manual retry
curl -X POST /api/v1/export/retry \
  -d '{"exportLogId": "LOG_ID"}'
```

---

# 🎓 Learning Resources

**Phase 3D teaches you:**
1. Backend service integration patterns
2. External API adapter abstraction
3. Format transformation & mapping
4. Retry logic with exponential backoff
5. Background job scheduling
6. Audit trail design
7. Debug mode techniques
8. Frontend-backend coordination

---

**Status:** ✅ PHASE 3D COMPLETE  
**Quality:** 🌟⭐⭐⭐⭐⭐ Production-Ready Debug  
**Ready for:** Phase 3E (Real Express Integration)  

**Next Command:**
```bash
# Start mock Express server
PORT=9000 bun backend/src/mock-servers/express-mock.ts

# In another terminal, run backend
bun run dev

# Test complete workflow!
```

---

**END OF PHASE 3D SUMMARY**
