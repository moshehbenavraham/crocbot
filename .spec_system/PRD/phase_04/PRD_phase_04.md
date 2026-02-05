# PRD Phase 04: Upstream Bug Fixes Port

**Status**: Complete
**Sessions**: 3
**Estimated Duration**: 2-3 days

**Progress**: 3/3 sessions (100%)

---

## Overview

Phase 04 ports critical bug fixes from the upstream OpenClaw repository to improve crocbot stability and resilience. The focus is on Grammy timeout recovery to prevent Telegram bot crashes during network interruptions, and session transcript repair to handle corrupted session files after crashes. Cron delivery fixes have been descoped due to architectural incompatibility.

---

## Progress Tracker

| Session | Name | Status | Est. Tasks | Validated |
|---------|------|--------|------------|-----------|
| 01 | Grammy Timeout Recovery | Complete | 18 | 2026-02-05 |
| 02 | Session Transcript Repair | Complete | 18 | 2026-02-05 |
| 03 | Bug Fix Validation | Complete | 18 | 2026-02-05 |

---

## Completed Sessions

- **Session 01: Grammy Timeout Recovery** - Completed 2026-02-05
  - Extended error candidate traversal for Grammy HttpError `.error` property
  - Added "timed out" and "timeout" message patterns
  - Added ECONNABORTED and ERR_NETWORK error codes
  - Registered scoped unhandled rejection handler in monitor.ts
  - 7 new tests, all 3811 tests passing

- **Session 02: Session Transcript Repair** - Completed 2026-02-05
  - Ported `sanitizeToolCallInputs()` and `repairToolCallInputs()` to drop malformed tool calls
  - Created `session-file-repair.ts` with JSONL repair, atomic writes, and backup
  - Integrated file repair into `attempt.ts` before `SessionManager.open()`
  - Integrated tool call sanitization into `session-tool-result-guard.ts`
  - 10 new tests, all 3825 tests passing

- **Session 03: Bug Fix Validation** - Completed 2026-02-05
  - Validated all 35 Phase 04-specific tests pass (19+4+6+6 across 4 test files)
  - Verified all 7 integration points (attempt.ts, session-tool-result-guard.ts, monitor.ts)
  - Full regression: build (0 errors), lint (0 warnings), test suite (188/192, 4 pre-existing)
  - Zero new regressions introduced by Phase 04

---

## Upcoming Sessions

*None - all sessions complete.*

---

## Objectives

1. Eliminate Telegram bot crashes from Grammy network timeout errors
2. Implement session transcript repair for crash resilience
3. Ensure all fixes integrate cleanly without regressions

---

## Prerequisites

- Phase 03 completed (Upstream Features Port)
- Upstream reference codebase available in `.001_ORIGINAL/`
- Understanding of Grammy error handling patterns
- Understanding of session file JSONL format

---

## Technical Considerations

### Architecture
- Grammy HttpError wraps errors differently than standard Error (uses `.error` not `.cause`)
- Session files use JSONL format with tool call/result pairing requirements
- Existing unhandled rejection handler infrastructure in `src/infra/unhandled-rejections.ts`

### Technologies
- grammy - Telegram Bot API with HttpError type
- @grammyjs/runner - Bot runner with error handling
- JSONL session file format in `src/agents/`

### Risks
- **Partial implementation conflicts**: Grammy timeout handling has partial implementation. Mitigation: Changes are additive, extending existing patterns.
- **Session repair edge cases**: Malformed session files may have many variations. Mitigation: Test with real-world corrupted files from production.
- **Regression in error handling**: New error patterns may not be caught. Mitigation: Comprehensive test suite for error scenarios.

### Relevant Considerations
<!-- From CONSIDERATIONS.md -->
- [P00] **Incremental verification**: Running build/lint/test after each change catches issues early.
- [P00] **TypeScript as refactoring guide**: Let compiler errors guide integration of upstream fixes.
- [P00] **Test coupling to fixtures**: Grammy mock behaviors may need updates for new error patterns.

---

## Descoped: Cron Delivery Fixes

**NOT PORTABLE** - crocbot's cron implementation has architectural differences from upstream:
- Upstream uses separate `CronDelivery` object with dedicated `delivery.ts` module
- crocbot embedded delivery config directly in payload during strip-down
- Type system mismatch: upstream `job.delivery` vs crocbot `job.payload.deliver`
- Missing infrastructure: `resolveCronDeliveryPlan()`, `mergeCronDelivery()`, etc.

If cron delivery issues arise, they must be fixed within crocbot's simplified model.

---

## Success Criteria

Phase complete when:
- [x] All 3 sessions completed
- [x] Grammy timeout errors are caught and recovered gracefully
- [x] `.error` property traversal added to error collection
- [x] "timed out" message pattern recognized as recoverable
- [x] Scoped unhandled rejection handler in monitor.ts
- [x] Session transcript repair handles malformed tool calls
- [x] Session file JSONL repair handles corrupt entries
- [x] All tests passing (35 Phase 04 tests; 4 pre-existing failures in unrelated files)
- [x] No regressions in existing Telegram error handling

---

## Dependencies

### Depends On
- Phase 03: Upstream Features Port

### Enables
- Phase 05: Upstream Build Tooling Port
- Improved production stability
