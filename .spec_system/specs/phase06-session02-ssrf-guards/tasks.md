# Task Checklist

**Session ID**: `phase06-session02-ssrf-guards`
**Total Tasks**: 20
**Estimated Duration**: 6-8 hours
**Created**: 2026-02-05

---

## Legend

- `[x]` = Completed
- `[ ]` = Pending
- `[P]` = Parallelizable (can run with other [P] tasks)
- `[S0602]` = Session reference (Phase 06, Session 02)
- `TNNN` = Task ID

---

## Progress Summary

| Category | Total | Done | Remaining |
|----------|-------|------|-----------|
| Setup | 3 | 3 | 0 |
| Foundation | 4 | 4 | 0 |
| Implementation | 8 | 8 | 0 |
| Testing | 5 | 5 | 0 |
| **Total** | **20** | **20** | **0** |

---

## Setup (3 tasks)

Initial verification and reference analysis.

- [x] T001 [S0602] Verify prerequisites: confirm upstream reference files exist, undici installed, existing ssrf.pinning.test.ts passes (`src/infra/net/ssrf.pinning.test.ts`)
- [x] T002 [S0602] Verify current call site inventory: grep for bare `fetch(` in the three unprotected files matches spec expectations (`src/alerting/notifier-webhook.ts`, `src/agents/skills-install.ts`, `src/media/fetch.ts`)
- [x] T003 [S0602] Verify existing protected call sites (web-fetch.ts, input-files.ts) use pinned dispatchers and will not be modified

---

## Foundation (4 tasks)

Add policy types and helper functions to ssrf.ts, matching upstream delta.

- [x] T004 [S0602] Export `LookupFn` type -- change `type LookupFn` to `export type LookupFn` in `ssrf.ts` (`src/infra/net/ssrf.ts`)
- [x] T005 [S0602] Add `SsrFPolicy` exported type to `ssrf.ts` (`src/infra/net/ssrf.ts`)
- [x] T006 [S0602] Add `normalizeHostnameSet()` helper function to `ssrf.ts` (`src/infra/net/ssrf.ts`)
- [x] T007 [S0602] Add `resolvePinnedHostnameWithPolicy()` and refactor `resolvePinnedHostname()` to delegate to it (`src/infra/net/ssrf.ts`)

---

## Implementation (8 tasks)

Create fetch-guard.ts and integrate into call sites.

- [x] T008 [S0602] Create `fetch-guard.ts` -- port `buildAbortSignal()` helper from upstream (`src/infra/net/fetch-guard.ts`)
- [x] T009 [S0602] Create `fetch-guard.ts` -- port `GuardedFetchOptions`, `GuardedFetchResult` types and `isRedirectStatus()` helper (`src/infra/net/fetch-guard.ts`)
- [x] T010 [S0602] Create `fetch-guard.ts` -- port `fetchWithSsrFGuard()` main function with redirect loop, DNS pinning, and cleanup logic (`src/infra/net/fetch-guard.ts`)
- [x] T011 [S0602] Verify `fetch-guard.ts` builds clean: run `pnpm build` and `pnpm lint` after creation
- [x] T012 [S0602] Integrate guarded fetch into webhook notifier: replace bare `fetch()` with `fetchWithSsrFGuard()`, compose timeouts, handle `release()` (`src/alerting/notifier-webhook.ts`)
- [x] T013 [S0602] Integrate guarded fetch into skills installer: replace bare `fetch()` in `downloadFile()` with `fetchWithSsrFGuard()`, pipe response body before `release()` (`src/agents/skills-install.ts`)
- [x] T014 [S0602] Integrate guarded fetch into media fetcher: replace bare `fetcher()` in `fetchRemoteMedia()` with `fetchWithSsrFGuard()`, use `finalUrl` instead of `res.url` for redirect tracking (`src/media/fetch.ts`)
- [x] T015 [S0602] Run `pnpm build` and `pnpm lint` after all three integrations to verify clean compilation

---

## Testing (5 tasks)

Unit tests and regression verification.

- [x] T016 [S0602] [P] Write `ssrf.test.ts` -- unit tests for `resolvePinnedHostnameWithPolicy()` (default policy blocks, allowPrivateNetwork, allowedHostnames), `normalizeHostnameSet()`, `LookupFn` export (`src/infra/net/ssrf.test.ts`)
- [x] T017 [S0602] [P] Write `fetch-guard.test.ts` -- unit tests for `fetchWithSsrFGuard()` (public fetch, private IP blocked, redirect to private blocked, redirect loop, max redirects, timeout, external signal, invalid protocol, release cleanup, finalUrl tracking) (`src/infra/net/fetch-guard.test.ts`)
- [x] T018 [S0602] Run full test suite: `pnpm test` -- confirm existing `ssrf.pinning.test.ts` passes unchanged and no regressions
- [x] T019 [S0602] Validate all new/modified files are ASCII-encoded with Unix LF line endings
- [x] T020 [S0602] Final verification: `pnpm build && pnpm lint && pnpm test` all pass clean

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
Tasks T016 and T017 can be worked on simultaneously (independent test files).

### Task Timing
Target ~20-25 minutes per task.

### Dependencies
- T004-T007 must complete sequentially (each builds on previous ssrf.ts changes)
- T008-T010 are sequential (building up fetch-guard.ts incrementally)
- T011 gates T012-T014 (need clean build before integration)
- T012-T014 are sequential (verify each integration independently)
- T015 gates T016-T017 (need clean build before writing tests)
- T018-T020 run after all implementation and tests are written

### Key Upstream References
- `.001_ORIGINAL/src/infra/net/ssrf.ts` (309 lines) -- policy delta source
- `.001_ORIGINAL/src/infra/net/fetch-guard.ts` (172 lines) -- verbatim port source

### Integration Challenges
- **Webhook notifier**: Already manages its own AbortController -- replace with guarded fetch's `timeoutMs` parameter
- **Skills installer downloadFile()**: Pipes response body to file via stream -- must consume body before calling `release()`
- **Media fetcher**: Uses `res.url` for redirect tracking -- must switch to `finalUrl` from guarded fetch result

---

## Next Steps

Run `/implement` to begin AI-led implementation.
