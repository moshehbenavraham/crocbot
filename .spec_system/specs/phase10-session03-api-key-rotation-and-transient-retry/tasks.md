# Task Checklist

**Session ID**: `phase10-session03-api-key-rotation-and-transient-retry`
**Total Tasks**: 20
**Estimated Duration**: 6-8 hours
**Created**: 2026-02-10

---

## Legend

- `[x]` = Completed
- `[ ]` = Pending
- `[P]` = Parallelizable (can run with other [P] tasks)
- `[S1003]` = Session reference (Phase 10, Session 03)
- `TNNN` = Task ID

---

## Progress Summary

| Category | Total | Done | Remaining |
|----------|-------|------|-----------|
| Setup | 3 | 3 | 0 |
| Foundation | 5 | 5 | 0 |
| Implementation | 8 | 8 | 0 |
| Testing | 4 | 4 | 0 |
| **Total** | **20** | **20** | **0** |

---

## Setup (3 tasks)

Initial configuration and environment preparation.

- [x] T001 [S1003] Verify prerequisites: green baseline (`pnpm build`, `pnpm lint`, `pnpm test`)
- [x] T002 [S1003] Verify Session 02 deliverables exist and exports match expected API (`src/infra/provider-rate-limiter.ts`, `src/infra/provider-rate-limiter-config.ts`)
- [x] T003 [S1003] Create skeleton files with module headers and empty exports (`src/infra/key-pool.ts`, `src/infra/llm-retry.ts`)

---

## Foundation (5 tasks)

Core types, interfaces, and structural scaffolding.

- [x] T004 [S1003] [P] Define key pool types and interfaces (`src/infra/key-pool.ts`)
  - `KeyPoolConfig`: dependencies (rateLimiter, resolveOrder, isInCooldown, markFailure, markUsed, secretsRegistry)
  - `KeyPoolEntry`: profileId, providerId, apiKey
  - `KeyPool` interface: `selectKey(providerId) -> KeyPoolEntry | null`, `reportSuccess(profileId)`, `reportFailure(profileId, reason, status?)`, `registeredCount`
- [x] T005 [S1003] [P] Define LLM retry types and interfaces (`src/infra/llm-retry.ts`)
  - `LlmRetryOptions`: extends/composes with existing `RetryOptions` from `src/infra/retry.ts`
  - `TransientClassification`: `{ retryable: boolean, retryAfterMs?: number }`
  - Export signatures: `isTransientLlmError(err)`, `parseLlmRetryAfter(err)`, `createLlmRetryOptions(overrides?)`
- [x] T006 [S1003] Define factory function signature for key pool (`src/infra/key-pool.ts`)
  - `createKeyPool(entries, config) -> KeyPool`
  - Accept dependency-injected functions for auth profile ops (testability)
  - Register all key values with SecretsRegistry at creation time
- [x] T007 [S1003] [P] Create test scaffold for key pool (`src/infra/key-pool.test.ts`)
  - Import types, set up describe blocks for each test scenario from spec Section 9
  - Create mock factories for auth profile functions and rate limiter
- [x] T008 [S1003] [P] Create test scaffold for LLM retry (`src/infra/llm-retry.test.ts`)
  - Import types, set up describe blocks for each test scenario from spec Section 9
  - Create helper to build mock errors with status codes and headers

---

## Implementation (8 tasks)

Main feature implementation.

- [x] T009 [S1003] Implement `createKeyPool` factory with SecretsRegistry integration (`src/infra/key-pool.ts`)
  - Register all API key values via `SecretsRegistry.getInstance().register()` at pool creation
  - Store entries indexed by providerId for O(1) lookup
  - Initialize round-robin counters per provider
- [x] T010 [S1003] Implement `selectKey` with round-robin and health checks (`src/infra/key-pool.ts`)
  - Call `resolveAuthProfileOrder()` to get sorted profile IDs for provider
  - Filter by: not in cooldown (`isProfileInCooldown`) AND rate limiter allows (`tryAcquire`)
  - Return first available key entry, or null if all exhausted
  - Synchronous selection (architecture Decision 7)
- [x] T011 [S1003] Implement `reportSuccess` and `reportFailure` feedback methods (`src/infra/key-pool.ts`)
  - `reportSuccess(profileId)`: delegate to `markAuthProfileUsed()`
  - `reportFailure(profileId, reason, status?)`:
    - On 401/403: delegate to `markAuthProfileFailure()` with reason "auth"
    - On 429: delegate to `markAuthProfileFailure()` with reason "rate_limit" AND call `rateLimiter.recordRateLimitHit()`
    - On 5xx: delegate to `markAuthProfileFailure()` with reason "timeout" or "unknown"
- [x] T012 [S1003] Implement `isTransientLlmError` classifier (`src/infra/llm-retry.ts`)
  - Status-based: 408, 429, 500, 502, 503, 504 -> retryable
  - Non-retryable: 400, 401, 403, 404, 422
  - Network errors: ECONNRESET, ETIMEDOUT, ECONNREFUSED, EPIPE, UND_ERR_CONNECT_TIMEOUT -> retryable
  - No status code + no network code -> non-retryable (safe default)
  - Leverage existing `isTimeoutError()` and `resolveFailoverReasonFromError()` from `failover-error.ts`
- [x] T013 [S1003] Implement `parseLlmRetryAfter` header parser (`src/infra/llm-retry.ts`)
  - Parse numeric seconds: `Retry-After: 30` -> 30000ms
  - Parse HTTP-date: `Retry-After: Thu, 10 Feb 2026 12:00:00 GMT` -> delta from Date.now()
  - Extract from error object: check `err.response?.headers`, `err.headers`, `err.retryAfterMs`
  - Edge cases: 0 or negative -> return undefined, exceeding maxDelayMs -> cap at maxDelayMs
- [x] T014 [S1003] Implement `createLlmRetryOptions` factory (`src/infra/llm-retry.ts`)
  - Return `RetryOptions` preset for LLM calls:
    - `shouldRetry`: delegates to `isTransientLlmError()`
    - `retryAfterMs`: delegates to `parseLlmRetryAfter()`
    - Defaults: `attempts: 3`, `minDelayMs: 300`, `maxDelayMs: 30000`, `jitter: 0.25`
  - Accept partial overrides for all fields
  - Composable with existing `retryAsync()` from `src/infra/retry.ts`
- [x] T015 [S1003] Handle edge cases in key pool (`src/infra/key-pool.ts`)
  - Zero keys for provider -> return null immediately
  - Single key degraded -> return null (no fallback)
  - All keys in cooldown but rate limiter allows -> return null (cooldown takes precedence)
  - Rate limiter blocks but keys healthy -> return null (rate limit takes precedence)
- [x] T016 [S1003] Add JSDoc comments and ensure export barrel is clean (`src/infra/key-pool.ts`, `src/infra/llm-retry.ts`)
  - Document all public functions/types with JSDoc
  - Ensure named exports only (no default exports per project conventions)
  - Verify .js import extensions in all import paths

---

## Testing (4 tasks)

Verification and quality assurance.

- [x] T017 [S1003] Write unit tests for key pool (`src/infra/key-pool.test.ts`)
  - Round-robin ordering: 3 keys, verify A->B->C->A cycle
  - Skip degraded: Mark key B cooldown, verify A->C->A->C
  - Skip rate-limited: rateLimiter.tryAcquire returns `{ allowed: false }`, verify null
  - All unavailable: All keys in cooldown, verify null
  - Recovery after cooldown: Key exits cooldown, re-enters rotation
  - SecretsRegistry integration: Verify all key values registered on creation
  - Degradation feedback: 401 -> markAuthProfileFailure("auth"), 429 -> markAuthProfileFailure("rate_limit") + recordRateLimitHit()
  - Zero keys: Empty entries for provider returns null
- [x] T018 [S1003] Write unit tests for LLM retry (`src/infra/llm-retry.test.ts`)
  - Transient classification: 408, 429, 500, 502, 503, 504 -> true
  - Non-transient rejection: 400, 401, 403, 404, 422 -> false
  - Network errors: ECONNRESET, ETIMEDOUT -> true
  - No status code, no network code -> false
  - Backoff calculation: Verify exponential sequence with jitter bounds
  - Retry-After seconds: `Retry-After: 30` -> 30000ms
  - Retry-After HTTP-date: Absolute date -> correct ms delta
  - Retry-After zero/negative: Returns undefined
  - Max attempts exhaustion: After N failures, throws last error
  - Success on retry: Fails twice, succeeds third, returns success
  - createLlmRetryOptions: Verify defaults and override merging
- [x] T019 [S1003] Run full test suite and quality gates (`pnpm build`, `pnpm lint`, `pnpm test`)
  - Zero type errors on `pnpm build`
  - Zero lint errors on `pnpm lint`
  - All tests pass on `pnpm test` (existing + new)
  - Fix any issues found
- [x] T020 [S1003] Validate ASCII encoding and update implementation-notes.md
  - Verify all new files are ASCII-only (chars 0-127)
  - Verify Unix LF line endings
  - Create `implementation-notes.md` with session progress log
  - Record task completion times and any notable decisions

---

## Completion Checklist

Before marking session complete:

- [x] All tasks marked `[x]`
- [x] All tests passing
- [x] All files ASCII-encoded
- [x] implementation-notes.md updated
- [x] Ready for `/validate`

---

## Notes

### Parallelization
Tasks marked `[P]` can be worked on simultaneously:
- T004 + T005: Type definitions for both modules are independent
- T007 + T008: Test scaffolds for both modules are independent

### Task Timing
Target ~20-25 minutes per task.

### Dependencies
- T003 depends on T001-T002 (prerequisites verified first)
- T004-T005 depend on T003 (skeleton files exist)
- T006 depends on T004 (types defined)
- T009-T011 depend on T006-T007 (factory signature + test scaffold)
- T012-T014 depend on T005, T008 (types + test scaffold)
- T015 depends on T010-T011 (core implementation exists)
- T016 depends on T009-T015 (all implementation done)
- T017 depends on T009-T011, T015 (key pool fully implemented)
- T018 depends on T012-T014 (retry policy fully implemented)
- T019 depends on T017-T018 (all tests written)
- T020 depends on T019 (quality gates pass)

### Key Design Decisions
- **Dependency injection**: Key pool accepts auth profile functions as params (not direct imports) for testability
- **Synchronous selectKey**: No async in hot path per architecture Decision 7
- **Composition over modification**: Neither module modifies existing infrastructure; both compose with it
- **Factory pattern**: Matches `createProviderRateLimiter()` from Session 02

---

## Next Steps

Run `/validate` to verify session completeness.
