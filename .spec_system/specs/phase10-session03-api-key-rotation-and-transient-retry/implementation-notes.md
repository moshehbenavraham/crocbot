# Implementation Notes

**Session ID**: `phase10-session03-api-key-rotation-and-transient-retry`
**Started**: 2026-02-10 04:55
**Last Updated**: 2026-02-10 05:10

---

## Session Progress

| Metric | Value |
|--------|-------|
| Tasks Completed | 20 / 20 |
| Blockers | 0 |

---

## Task Log

### 2026-02-10 - Session Start

**Environment verified**:
- [x] Prerequisites confirmed (Node 22.22.0, pnpm 10.23.0, Vitest 4.0.18)
- [x] Tools available (tsdown, oxlint, vitest)
- [x] Directory structure ready
- [x] Green baseline: build passes, lint 0 errors, 199 tests passing (34 files)

---

### T001 - Verify prerequisites

**Completed**: 2026-02-10 04:57
**Notes**: Build, lint, and all existing tests pass. Green baseline confirmed.

### T002 - Verify Session 02 deliverables

**Completed**: 2026-02-10 04:58
**Notes**: Confirmed `provider-rate-limiter.ts` exports `createProviderRateLimiter()` and
`provider-rate-limiter-config.ts` exports `ProviderRateLimiter`, `RateLimitCheckResult`, and all
required types. API surface matches spec expectations.

### T003-T006 - Skeleton files, types, interfaces, factory signatures

**Completed**: 2026-02-10 05:02
**Notes**: Created `key-pool.ts` and `llm-retry.ts` with full type definitions, interfaces, and
factory function signatures. Both files compile cleanly on first build.

**Files Created**:
- `src/infra/key-pool.ts` - Key pool adapter with types + full implementation
- `src/infra/llm-retry.ts` - LLM retry policy with types + full implementation

### T007-T008 - Test scaffolds

**Completed**: 2026-02-10 05:03
**Notes**: Test scaffolds created with mock factories for rate limiter, secrets registry,
and auth profile dependencies. Describe blocks match spec Section 9 test scenarios.

**Files Created**:
- `src/infra/key-pool.test.ts` - 19 unit tests
- `src/infra/llm-retry.test.ts` - 54 unit tests

### T009-T011 - Key pool implementation

**Completed**: 2026-02-10 05:02
**Notes**: Implemented in `key-pool.ts`:
- `createKeyPool()` factory with SecretsRegistry integration at creation time
- `selectKey()` with rate limiter pre-check + cooldown filtering + round-robin via resolveOrder
- `reportSuccess()` delegates to markUsed
- `reportFailure()` routes to markFailure + conditional recordRateLimitHit on 429/rate_limit

### T012-T014 - LLM retry implementation

**Completed**: 2026-02-10 05:02
**Notes**: Implemented in `llm-retry.ts`:
- `isTransientLlmError()` - status-based (408/429/5xx) + network error codes + cause chain
- `parseLlmRetryAfter()` - numeric seconds + HTTP-date + pre-parsed retryAfterMs + maxDelay cap
- `createLlmRetryOptions()` - RetryOptions preset composable with retryAsync()

### T015 - Edge cases

**Completed**: 2026-02-10 05:02
**Notes**: All edge cases handled:
- Zero keys for provider -> null immediately
- Single key degraded -> null
- All keys in cooldown -> null
- Rate limiter blocks but keys healthy -> null
- Retry-After zero/negative -> undefined
- Retry-After exceeding maxDelay -> capped
- No status code + no network code -> non-transient
- Network errors in cause chain -> transient

### T016 - JSDoc and export cleanup

**Completed**: 2026-02-10 05:02
**Notes**: All public functions/types documented with JSDoc. Named exports only (no defaults).
All import paths use `.js` extensions per ESM conventions.

### T017 - Key pool unit tests

**Completed**: 2026-02-10 05:05
**Notes**: 19 tests covering: round-robin ordering, skip degraded, skip rate-limited,
all-unavailable, recovery after cooldown, SecretsRegistry integration, degradation feedback
(auth/rate_limit/timeout), zero keys, provider normalization.

### T018 - LLM retry unit tests

**Completed**: 2026-02-10 05:05
**Notes**: 54 tests covering: transient classification (6 status codes), non-transient rejection
(5 status codes), network errors (5 codes + lowercase + cause chain), no-status defaults,
statusCode property, Retry-After parsing (seconds, fractional, zero, negative, HTTP-date, past
date, max cap), header extraction (response.headers, headers, retryAfterMs, case-insensitive),
createLlmRetryOptions defaults/overrides, integration with retryAsync (success on retry,
permanent rejection, max exhaustion, onRetry callback).

### T019 - Quality gates

**Completed**: 2026-02-10 05:10
**Notes**:
- `pnpm build`: passes (all 3 build phases complete)
- `pnpm lint`: 0 warnings, 0 errors across 2237 files
- Full test suite: 728 test files, 4698 tests passed, 1 skipped, 0 failures
- New tests: 2 files, 73 tests (19 key-pool + 54 llm-retry)

### T020 - ASCII validation and implementation notes

**Completed**: 2026-02-10 05:10
**Notes**: All 4 new files verified ASCII-only (chars 0-127) with Unix LF line endings.

---

## Design Decisions

### Decision 1: Synchronous selectKey

**Context**: Architecture Decision 7 requires synchronous key selection for event loop safety.
**Chosen**: `selectKey()` is fully synchronous - calls `tryAcquire()` (sync) and `isInCooldown()` (sync).
**Rationale**: No async operations needed in the hot path.

### Decision 2: Rate limiter check before profile iteration

**Context**: Should we check rate limits per-key or per-provider?
**Options**:
1. Check rate limiter once per provider, then iterate keys
2. Check rate limiter per key

**Chosen**: Option 1 - check once per provider.
**Rationale**: The rate limiter is per-provider (not per-key). If the provider is rate-limited,
no key will work regardless of health. This avoids redundant tryAcquire calls.

### Decision 3: Mock structure for lint compliance

**Context**: oxlint's `unbound-method` rule flagged `expect(obj.method).toHaveBeenCalled()`
patterns in tests where the method was a mock on an object literal.
**Chosen**: Store mock functions as standalone variables and pass them into the mock object,
then assert on the standalone variable.
**Rationale**: Avoids false-positive lint errors without disabling the rule globally.

---

## Files Changed

| File | Lines | Purpose |
|------|-------|---------|
| `src/infra/key-pool.ts` | 189 | Key pool adapter: health-aware round-robin with rate limiter integration |
| `src/infra/key-pool.test.ts` | 267 | Unit tests for key pool (19 tests) |
| `src/infra/llm-retry.ts` | 257 | LLM-specific retry policy with transient error classification |
| `src/infra/llm-retry.test.ts` | 311 | Unit tests for LLM retry (54 tests) |
