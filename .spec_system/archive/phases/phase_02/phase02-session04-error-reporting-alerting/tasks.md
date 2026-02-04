# Task Checklist

**Session ID**: `phase02-session04-error-reporting-alerting`
**Total Tasks**: 20
**Estimated Duration**: 6-8 hours
**Created**: 2026-01-30

---

## Legend

- `[x]` = Completed
- `[ ]` = Pending
- `[P]` = Parallelizable (can run with other [P] tasks)
- `[S0204]` = Session reference (Phase 02, Session 04)
- `TNNN` = Task ID

---

## Progress Summary

| Category | Total | Done | Remaining |
|----------|-------|------|-----------|
| Setup | 2 | 2 | 0 |
| Foundation | 5 | 5 | 0 |
| Implementation | 8 | 8 | 0 |
| Testing | 5 | 5 | 0 |
| **Total** | **20** | **20** | **0** |

---

## Setup (2 tasks)

Initial configuration and environment preparation.

- [x] T001 [S0204] Create alerting module directory structure (`src/alerting/`)
- [x] T002 [S0204] Add AlertingConfig types to config schema (`src/config/types.alerting.ts`)

---

## Foundation (5 tasks)

Core structures and base implementations.

- [x] T003 [S0204] [P] Define ErrorSeverity enum and classification logic (`src/alerting/severity.ts`)
- [x] T004 [S0204] [P] Define Notifier interface for pluggable notification channels (`src/alerting/notifier.ts`)
- [x] T005 [S0204] Implement ErrorAggregator with deduplication and rate limiting (`src/alerting/aggregator.ts`)
- [x] T006 [S0204] Export alerting types from config/types.ts (`src/config/types.ts`)
- [x] T007 [S0204] Add alerting config to GatewayConfig type (`src/config/types.gateway.ts`)

---

## Implementation (8 tasks)

Main feature implementation.

- [x] T008 [S0204] [P] Implement WebhookNotifier with HTTP POST dispatch (`src/alerting/notifier-webhook.ts`)
- [x] T009 [S0204] [P] Implement TelegramNotifier using existing sendMessageTelegram (`src/alerting/notifier-telegram.ts`)
- [x] T010 [S0204] Implement ErrorReporter main API with notifier orchestration (`src/alerting/reporter.ts`)
- [x] T011 [S0204] Create public module exports (`src/alerting/index.ts`)
- [x] T012 [S0204] Add severity label to errors counter in gateway metrics (`src/metrics/gateway.ts`)
- [x] T013 [S0204] Initialize alerting on gateway startup (`src/gateway/server.impl.ts`)
- [x] T014 [S0204] Add /alerts/webhook test endpoint to HTTP server (`src/gateway/server-http.ts`)
- [x] T015 [S0204] Create alerting configuration documentation (`docs/gateway/alerting.md`)

---

## Testing (5 tasks)

Verification and quality assurance.

- [x] T016 [S0204] [P] Write unit tests for severity classification (`src/alerting/severity.test.ts`)
- [x] T017 [S0204] [P] Write unit tests for aggregator deduplication and rate limiting (`src/alerting/aggregator.test.ts`)
- [x] T018 [S0204] [P] Write unit tests for webhook notifier (`src/alerting/notifier-webhook.test.ts`)
- [x] T019 [S0204] [P] Write unit tests for Telegram notifier (`src/alerting/notifier-telegram.test.ts`)
- [x] T020 [S0204] Write unit tests for reporter API and integration (`src/alerting/reporter.test.ts`)

---

## Completion Checklist

Before marking session complete:

- [x] All tasks marked `[x]`
- [x] All tests passing (`pnpm test`)
- [x] All files ASCII-encoded (no Unicode characters outside strings)
- [x] Unix LF line endings
- [x] `pnpm lint` passes
- [x] `pnpm build` succeeds
- [x] Coverage thresholds met (93.56% - above 70% minimum)
- [x] implementation-notes.md updated
- [x] docs.json updated with alerting page
- [x] Ready for `/validate`

---

## Notes

### Parallelization
Tasks marked `[P]` can be worked on simultaneously:
- T003, T004: Foundation types can be created in parallel
- T008, T009: Notifier implementations are independent
- T016-T019: Unit tests for independent modules

### Task Timing
Target ~20-25 minutes per task.

### Dependencies
- T005 depends on T003 (ErrorSeverity enum)
- T008, T009 depend on T004 (Notifier interface)
- T010 depends on T005, T008, T009 (aggregator and notifiers)
- T011 depends on T003-T010 (exports all modules)
- T012-T014 depend on T010 (reporter must exist)
- T015 can start after T002 (config schema)
- All tests (T016-T020) depend on their respective implementations

### Key Implementation Details
- ErrorAggregator uses singleton pattern with reset function for test cleanup
- Deduplication key: hash of error message + context (channel, etc.)
- Rate limit defaults: 5 critical/5min, 10 warning/hour
- Re-entry prevention flag needed in reporter to avoid circular dependency with logger
- TelegramNotifier uses existing `sendMessageTelegram()` function

### ASCII Reminder
All output files must use ASCII-only characters (0-127). No smart quotes, em dashes, or Unicode symbols outside of string literals.

---

## Next Steps

Run `/validate` to verify session completeness.
