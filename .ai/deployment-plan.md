# AutoAcct Deployment Preparation Plan

## 📋 Current Status
- **Code Review Score**: 4/5 ⭐ (Production-Ready with improvements needed)
- **Critical Issue**: No unit tests (high priority for financial system)
- **Deploy Blockers**: 
  - Missing unit tests for financial calculations
  - Incomplete dependency injection
  - TODO items unresolved

---

## 🎯 Phase 1: Critical Fixes (ก่อน Deploy)

### Job 1: Unit Tests for Money Utilities ⏱️ 2 ชม.
**Priority**: 🔴 P0 - MUST HAVE
**Files**:
- `backend/src/utils/__tests__/money.test.ts`

**Test Cases**:
- [ ] bahtToSatang conversion
- [ ] satangToBaht formatting
- [ ] money.add/subtract/multiply/divide
- [ ] plugSplit remainder handling
- [ ] Edge cases: MAX_SAFE_INTEGER, negative inputs
- [ ] Formatting: formatTHB, parseMoneyInput

---

### Job 2: Receipt Deduplication Tests ⏱️ 1.5 ชม.
**Priority**: 🔴 P0
**Files**:
- `backend/src/modules/receipt/__tests__/dedup.test.ts`

**Test Cases**:
- [ ] Hash generation from receipt data
- [ ] Duplicate detection logic
- [ ] Confidence scoring

---

### Job 3: Trial Balance Tests ⏱️ 1.5 ชม.
**Priority**: 🔴 P0
**Files**:
- `backend/src/modules/accounting/__tests__/trial-balance.test.ts`

**Test Cases**:
- [ ] Double-entry integrity (debits = credits)
- [ ] Account balance calculations
- [ ] Period filtering

---

### Job 4: Fix Dependency Injection ⏱️ 2 ชม.
**Priority**: 🟡 P1
**Files**:
- `backend/src/shared/di/container.ts`
- All service constructors

**Tasks**:
- [ ] Remove default instantiations from constructors
- [ ] Force explicit injection (fail fast if missing)
- [ ] Add proper interfaces for all services
- [ ] Update ReceiptService: Inject StorageAdapter

---

## 🎯 Phase 2: Code Quality (ควรมีก่อน Deploy)

### Job 5: Fix Frontend any Types ⏱️ 1 ชม.
**Priority**: 🟡 P1
**Files**:
- `frontend/src/components/receipt/confirmSplitReceipt.tsx`

**Tasks**:
- [ ] Define LineItem interface
- [ ] Replace all `any` with proper types
- [ ] Add type guards where needed

---

### Job 6: Resolve TODO Items ⏱️ 1.5 ชม.
**Priority**: 🟡 P1
**Files**:
- `backend/src/modules/receipt/services/ReceiptService.ts` - StorageAdapter injection
- `backend/src/modules/transaction/services/TransactionService.ts` - Wire Voiding to Ledger
- `backend/src/shared/di/container.ts` - Complete DI migration

---

### Job 7: Deployment Scripts ⏱️ 1 ชม.
**Priority**: 🟡 P1
**Files**:
- `deploy-backend.sh` (Fly.io)
- `deploy-frontend.sh` (Vercel)
- `deploy-monitor.sh` (Health checks)

**Tasks**:
- [ ] Backend: Dockerfile, fly.toml, deploy script
- [ ] Frontend: Vercel config, deploy script
- [ ] Monitoring: Health check endpoint calls

---

## 📊 Timeline Estimation

| Phase | Jobs | Est. Time | Status |
|-------|------|-----------|--------|
| Phase 1 (Critical) | 4 jobs | 7 ชม. | ⏳ Pending |
| Phase 2 (Quality) | 3 jobs | 3.5 ชม. | ⏳ Pending |
| **Total** | **7 jobs** | **~10.5 ชม.** | |

---

## 🚀 Deployment Checklist

- [ ] All Phase 1 tests passing
- [ ] Code review fixes applied
- [ ] Secrets configured (Fly.io, Vercel)
- [ ] CI/CD workflows active
- [ ] Health checks passing
- [ ] Staging deployment tested

---

## 📝 Notes for WAY_AI

**When cron triggers development:**
1. Read current job status from Kanban
2. Pick highest priority job from Doing/Todo
3. Implement following code review guidelines
4. Run tests after each change
5. Update job status when complete
6. Commit changes with descriptive messages

**Test Command**:
```bash
cd backend && npm test
```

**Deploy Commands**:
```bash
./deploy-backend.sh
./deploy-frontend.sh
```
