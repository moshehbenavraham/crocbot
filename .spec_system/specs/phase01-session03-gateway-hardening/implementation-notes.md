# Implementation Notes

**Session ID**: `phase01-session03-gateway-hardening`
**Started**: 2026-01-30 07:55
**Completed**: 2026-01-30 08:15
**Last Updated**: 2026-01-30 08:15

---

## Session Progress

| Metric | Value |
|--------|-------|
| Tasks Completed | 20 / 20 |
| Blockers | 0 |

---

## Task Log

### [2026-01-30] - Session Start

**Environment verified**:
- [x] Prerequisites confirmed (jq, git available)
- [x] Tools available (Node 22, pnpm)
- [x] Directory structure ready
- [x] CONVENTIONS.md reviewed

---

### T001-T007 - Setup and Audit Phase

**Completed**: 2026-01-30 08:00

**Findings**:
- `network-errors.ts`: Good socket-level error coverage, missing HTTP status codes (429, 502, 503, 504)
- `monitor.ts`: Backoff policy solid (2s-30s, 1.8 factor), but `restartAttempts` never reset on success
- `bot.ts`: Duplicate `bot.catch()` handlers at lines 144-152 need consolidation
- `server-http.ts`: /health endpoint returns basic `{status, timestamp, uptime}` - could use memory metrics
- `run-loop.ts`: 5s shutdown timeout correct, signal handlers proper, no completion timing log

---

### T008 - Add HTTP Status Codes to Error Detection

**Completed**: 2026-01-30 08:02

**Changes**:
- Added `RECOVERABLE_HTTP_STATUS_CODES` set: 429, 502, 503, 504
- Added `getHttpStatusCode()` helper to extract HTTP status from grammy errors
- Integrated HTTP status check into `isRecoverableTelegramNetworkError()`

**Files Changed**:
- `src/telegram/network-errors.ts` - Added HTTP status code detection (~20 lines)

---

### T009 - Consolidate Duplicate bot.catch() Handlers

**Completed**: 2026-01-30 08:03

**Changes**:
- Removed duplicate `bot.catch()` handler (lines 149-152)
- Kept the handler using `formatUncaughtError()` for consistent error formatting

**Files Changed**:
- `src/telegram/bot.ts` - Removed 5 lines

---

### T010-T011 - Add Reconnection Logging and Counter Reset

**Completed**: 2026-01-30 08:05

**Changes**:
- Added reconnection attempt logging with attempt count
- Added reset of `restartAttempts` when connection stable >60s before failure
- Consistent log format: `telegram: network error (attempt N): ...`

**Files Changed**:
- `src/telegram/monitor.ts` - Enhanced logging in restart loop (~20 lines)

---

### T012-T013 - Enhance Health Endpoint

**Completed**: 2026-01-30 08:07

**Changes**:
- Added memory metrics to HTTP /health endpoint: heapUsedMb, heapTotalMb, rssMb
- Full channel health available via WebSocket health method (existing)

**Design Decision**: HTTP /health stays lightweight for container probes; full channel probing available via WebSocket health method which already exists.

**Files Changed**:
- `src/gateway/server-http.ts` - Added memory metrics to /health response (~10 lines)

---

### T014-T015 - Add Memory and Shutdown Logging

**Completed**: 2026-01-30 08:08

**Changes**:
- Added `formatMemoryMb()` helper
- Log memory at gateway startup: `gateway started (heap=XMB rss=YMB)`
- Log memory at shutdown start: `received SIGTERM; shutting down (heap=XMB rss=YMB)`
- Log shutdown timing: `shutdown completed in Xms`

**Files Changed**:
- `src/cli/gateway-cli/run-loop.ts` - Added memory helper and logging (~15 lines)

---

### T016-T017 - Extend Tests

**Completed**: 2026-01-30 08:10

**Changes**:
- Added 7 new tests for HTTP status code detection (429, 502, 503, 504)
- Added test for nested HTTP status in cause chain
- Added negative test for non-recoverable codes (400, 401)
- Added test for reconnection attempt logging

**Files Changed**:
- `src/telegram/network-errors.test.ts` - Added 7 tests
- `src/telegram/monitor.test.ts` - Added 1 test

---

### T018-T020 - Verification

**Completed**: 2026-01-30 08:15

**Results**:
- `pnpm lint`: 0 warnings, 0 errors
- `pnpm build`: Success
- `pnpm test`: 638 test files passed, 3590 tests passed
- `pnpm vitest run src/telegram/network-errors.test.ts src/telegram/monitor.test.ts`: 18 tests passed

---

## Design Decisions

### Decision 1: HTTP Status Code Extraction

**Context**: grammy errors use `error_code` property for Telegram API HTTP status
**Options**:
1. Check only `error_code` property
2. Check multiple properties for compatibility

**Chosen**: Option 2 - Check `error_code`, `errorCode`, and `status` for robustness
**Rationale**: Future-proofs against library changes, minimal overhead

### Decision 2: Restart Counter Reset Threshold

**Context**: When to consider a connection "stable" enough to reset retry counter
**Options**:
1. Reset immediately on any successful poll
2. Reset after fixed duration (60s)
3. Reset after N successful requests

**Chosen**: Option 2 - 60s threshold
**Rationale**: Prevents rapid retry cycling when failures cluster, simple to implement

### Decision 3: Health Endpoint Scope

**Context**: How much detail to include in HTTP /health
**Options**:
1. Full channel probing (expensive)
2. Cached channel state
3. Memory metrics only

**Chosen**: Option 3 - Memory metrics
**Rationale**: HTTP /health is for container liveness/readiness; full channel health available via WebSocket

---

## Files Changed Summary

| File | Lines Added | Lines Removed | Purpose |
|------|-------------|---------------|---------|
| `src/telegram/network-errors.ts` | ~20 | 0 | HTTP status detection |
| `src/telegram/bot.ts` | 0 | ~5 | Remove duplicate handler |
| `src/telegram/monitor.ts` | ~20 | ~5 | Logging and reset logic |
| `src/gateway/server-http.ts` | ~10 | ~3 | Memory metrics |
| `src/cli/gateway-cli/run-loop.ts` | ~15 | 0 | Startup/shutdown logging |
| `src/telegram/network-errors.test.ts` | ~40 | 0 | New tests |
| `src/telegram/monitor.test.ts` | ~15 | 0 | New test |

---

## Quality Gates

- [x] `pnpm lint` passes (0 errors, 0 warnings)
- [x] `pnpm build` succeeds
- [x] `pnpm test` passes (3590 tests)
- [x] All files ASCII-encoded
- [x] Unix LF line endings
