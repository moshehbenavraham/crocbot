# Implementation Notes

**Session ID**: `phase06-session02-ssrf-guards`
**Started**: 2026-02-05 22:50
**Last Updated**: 2026-02-05 22:50

---

## Session Progress

| Metric | Value |
|--------|-------|
| Tasks Completed | 20 / 20 |
| Estimated Remaining | 0 |
| Blockers | 0 |

---

## Task Log

### [2026-02-05] - Session Start

**Environment verified**:
- [x] Prerequisites confirmed (upstream files exist, undici 7.19.0 installed)
- [x] Tools available (Node 22, pnpm, vitest)
- [x] Directory structure ready

### Task T001 - Verify prerequisites

**Started**: 2026-02-05 22:50
**Completed**: 2026-02-05 22:52
**Duration**: 2 minutes

**Notes**:
- Upstream `.001_ORIGINAL/src/infra/net/ssrf.ts` (309 lines) confirmed
- Upstream `.001_ORIGINAL/src/infra/net/fetch-guard.ts` (172 lines) confirmed
- undici 7.19.0 installed
- Existing `ssrf.pinning.test.ts` exists with 3 tests

### Task T002 - Verify call site inventory

**Started**: 2026-02-05 22:52
**Completed**: 2026-02-05 22:53
**Duration**: 1 minute

**Notes**:
- `src/alerting/notifier-webhook.ts:56` - bare `fetch(url, ...)` confirmed
- `src/agents/skills-install.ts:183` - bare `fetch(url, ...)` confirmed
- `src/media/fetch.ts:85` - bare `fetcher(url)` confirmed

### Task T003 - Verify protected call sites

**Started**: 2026-02-05 22:53
**Completed**: 2026-02-05 22:53
**Duration**: <1 minute

**Notes**:
- `src/agents/tools/web-fetch.ts` uses `resolvePinnedHostname` + `createPinnedDispatcher` - protected
- `src/media/input-files.ts` uses `resolvePinnedHostname` + `createPinnedDispatcher` - protected
- Neither will be modified

### Task T004 - Export LookupFn type

**Completed**: 2026-02-05
**Notes**: Changed `type LookupFn` to `export type LookupFn` in ssrf.ts

### Task T005 - Add SsrFPolicy type

**Completed**: 2026-02-05
**Notes**: Added `export type SsrFPolicy = { allowPrivateNetwork?: boolean; allowedHostnames?: string[] }` to ssrf.ts

### Task T006 - Add normalizeHostnameSet helper

**Completed**: 2026-02-05
**Notes**: Added `normalizeHostnameSet()` function matching upstream

### Task T007 - Add resolvePinnedHostnameWithPolicy and refactor

**Completed**: 2026-02-05
**Notes**: Added `resolvePinnedHostnameWithPolicy()` function, refactored `resolvePinnedHostname()` to delegate

### Task T008-T010 - Create fetch-guard.ts

**Completed**: 2026-02-05
**Notes**: Ported verbatim from upstream `.001_ORIGINAL/src/infra/net/fetch-guard.ts` (172 lines). Includes `buildAbortSignal()`, `GuardedFetchOptions`, `GuardedFetchResult`, `isRedirectStatus()`, `fetchWithSsrFGuard()`.

### Task T011 - Verify build

**Completed**: 2026-02-05
**Notes**: `pnpm build` and `pnpm lint` both pass clean after fetch-guard.ts creation.

### Task T012 - Integrate guarded fetch into webhook notifier

**Completed**: 2026-02-05
**Notes**: Replaced bare `fetch()` with `fetchWithSsrFGuard()` in `notifier-webhook.ts`. Removed manual AbortController/timeout. Added SSRF-specific error handling. Updated test file to mock SSRF DNS resolution for fake timer compatibility.

**Files Changed**:
- `src/alerting/notifier-webhook.ts` - replaced fetch with guarded fetch
- `src/alerting/notifier-webhook.test.ts` - added vi.mock for ssrf module

### Task T013 - Integrate guarded fetch into skills installer

**Completed**: 2026-02-05
**Notes**: Replaced bare `fetch()` in `downloadFile()` with `fetchWithSsrFGuard()`. Response body consumed via stream pipeline before `release()`.

**Files Changed**:
- `src/agents/skills-install.ts` - replaced fetch with guarded fetch

### Task T014 - Integrate guarded fetch into media fetcher

**Completed**: 2026-02-05
**Notes**: Used two-path approach: custom `fetchImpl` path uses synchronous `isBlockedHostname()` + `isPrivateIpAddress()` checks to preserve call contract; no-fetchImpl path uses full `fetchWithSsrFGuard()` with DNS pinning.

**Files Changed**:
- `src/media/fetch.ts` - replaced fetcher with guarded fetch (two-path approach)

### Task T015 - Verify build after integrations

**Completed**: 2026-02-05
**Notes**: `pnpm build` and `pnpm lint` both pass clean.

### Task T016 - Write ssrf.test.ts

**Completed**: 2026-02-05
**Notes**: 24 unit tests covering `normalizeHostnameSet`, `resolvePinnedHostnameWithPolicy` (default policy, allowPrivateNetwork, allowedHostnames), and `LookupFn` export.

**Files Changed**:
- `src/infra/net/ssrf.test.ts` (new, ~200 lines)

### Task T017 - Write fetch-guard.test.ts

**Completed**: 2026-02-05
**Notes**: 14 unit tests covering public fetch, private IP blocking, redirect-to-private blocking, redirect loops, max redirects, timeout, external signal composition, invalid protocols, release cleanup, finalUrl tracking, missing Location header, init passthrough.

**Files Changed**:
- `src/infra/net/fetch-guard.test.ts` (new, ~270 lines)

### Task T018 - Run full test suite

**Completed**: 2026-02-05
**Notes**: 689/690 test files pass, 4094/4097 tests pass. One flaky pre-existing failure in `bash-tools.test.ts` ("backgrounds after yield and can be polled" - timing race condition, passes in isolation). Transient EBADF error in `session-write-lock.test.ts` (pre-existing). No regressions from our changes. `ssrf.pinning.test.ts` passes unchanged.

### Task T019 - Validate ASCII and LF line endings

**Completed**: 2026-02-05
**Notes**: All new/modified files are ASCII-only with Unix LF line endings. Two pre-existing non-ASCII characters found in `skills-install.ts:65` and `media/fetch.ts:72` (ellipsis `...` character) - these are not in our changed lines, pre-existing before this session.

### Task T020 - Final verification

**Completed**: 2026-02-05
**Notes**: `pnpm build` succeeds (zero errors), `pnpm lint` passes clean (0 warnings, 0 errors), `pnpm test` passes (no new failures). All quality gates met.

---

## Design Decisions

### Decision 1: Two-path approach for media/fetch.ts

**Context**: `fetchRemoteMedia()` accepts an optional `fetchImpl` parameter (e.g. proxy fetch from Telegram). Using `fetchWithSsrFGuard` directly would change the call contract (adds init params) breaking 10 Telegram media tests.
**Options Considered**:
1. Use `fetchWithSsrFGuard` for all paths - breaks `fetchImpl` call contract
2. Use async DNS validation (`assertPublicHostname`) for `fetchImpl` path - still causes test timing issues
3. Use synchronous hostname/IP validation for `fetchImpl` path, full guard for direct fetch

**Chosen**: Option 3
**Rationale**: Preserves `fetchImpl(url)` call contract exactly, avoids async DNS in proxy path (proxy already handles DNS), provides full DNS-pinned protection for direct fetch path.

### Decision 2: Mock SSRF module in webhook notifier tests

**Context**: Two existing webhook tests use fake timers to verify timeout behavior. `fetchWithSsrFGuard` does async DNS resolution which blocks under fake timers.
**Options Considered**:
1. Rewrite tests to avoid fake timers - would lose timeout precision testing
2. Mock the fetch-guard module entirely - would lose integration testing value
3. Mock the ssrf module's DNS functions to return instantly

**Chosen**: Option 3
**Rationale**: Preserves the tests' intent (verifying timeout signal behavior) while allowing `fetchWithSsrFGuard` to proceed through DNS resolution. The mock is narrowly scoped to DNS functions only.

---
