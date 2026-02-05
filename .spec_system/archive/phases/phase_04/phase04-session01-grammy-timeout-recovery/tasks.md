# Task Checklist

**Session ID**: `phase04-session01-grammy-timeout-recovery`
**Total Tasks**: 18
**Created**: 2026-02-05

---

## Legend

- `[x]` = Completed
- `[ ]` = Pending
- `[P]` = Parallelizable (can run with other [P] tasks)
- `[S0401]` = Session reference (Phase 04, Session 01)
- `TNNN` = Task ID

---

## Progress Summary

| Category | Total | Done | Remaining |
|----------|-------|------|-----------|
| Setup | 2 | 2 | 0 |
| Foundation | 4 | 4 | 0 |
| Implementation | 7 | 7 | 0 |
| Testing | 5 | 5 | 0 |
| **Total** | **18** | **18** | **0** |

---

## Setup (2 tasks)

Initial configuration and environment verification.

- [x] T001 [S0401] Verify prerequisites: confirm Grammy version, check upstream reference exists
- [x] T002 [S0401] Run baseline audit: `pnpm build && pnpm lint && pnpm test` to confirm clean starting state

---

## Foundation (4 tasks)

Extend error code and message pattern constants.

- [x] T003 [S0401] [P] Add "ECONNABORTED" to RECOVERABLE_ERROR_CODES (`src/telegram/network-errors.ts`)
- [x] T004 [S0401] [P] Add "ERR_NETWORK" to RECOVERABLE_ERROR_CODES (`src/telegram/network-errors.ts`)
- [x] T005 [S0401] [P] Add "timeout" pattern to RECOVERABLE_MESSAGE_SNIPPETS (`src/telegram/network-errors.ts`)
- [x] T006 [S0401] [P] Add "timed out" pattern to RECOVERABLE_MESSAGE_SNIPPETS (`src/telegram/network-errors.ts`)

---

## Implementation (7 tasks)

Core Grammy HttpError traversal and scoped rejection handler.

- [x] T007 [S0401] Add getErrorName helper check for "HttpError" in collectErrorCandidates (`src/telegram/network-errors.ts`)
- [x] T008 [S0401] Add `.error` property traversal for HttpError in collectErrorCandidates (`src/telegram/network-errors.ts`)
- [x] T009 [S0401] Verify HTTP status code handling (kept for safety per spec notes) (`src/telegram/network-errors.ts`)
- [x] T010 [S0401] Add import for registerUnhandledRejectionHandler (`src/telegram/monitor.ts`)
- [x] T011 [S0401] Add isGrammyHttpError helper function (`src/telegram/monitor.ts`)
- [x] T012 [S0401] Register scoped unhandled rejection handler at start of monitorTelegramProvider (`src/telegram/monitor.ts`)
- [x] T013 [S0401] Add try-finally wrapper to unregister handler on exit (`src/telegram/monitor.ts`)

---

## Testing (5 tasks)

Verification and quality assurance.

- [x] T014 [S0401] [P] Add test for additional error codes (ECONNABORTED, ERR_NETWORK) (`src/telegram/network-errors.test.ts`)
- [x] T015 [S0401] [P] Add test for "timed out" message pattern (`src/telegram/network-errors.test.ts`)
- [x] T016 [S0401] [P] Add tests for Grammy HttpError .error traversal (`src/telegram/network-errors.test.ts`)
- [x] T017 [S0401] Run full audit: `pnpm build && pnpm lint && pnpm test`
- [x] T018 [S0401] Validate ASCII encoding on all modified files

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
Tasks T003-T006 (error codes and message patterns) can be done in a single edit.
Tasks T014-T016 (tests) can be done in a single edit.

### Key Differences from Upstream
1. **Keep HTTP status code handling**: Crocbot has `RECOVERABLE_HTTP_STATUS_CODES` (429, 502, 503, 504) that upstream removed. Keep this for safety - it provides an additional layer of transient error recovery.
2. **Metrics integration**: Crocbot has `incrementReconnects()` calls that upstream lacks. Preserve these.
3. **Log format**: Crocbot uses `telegram:` prefix; upstream uses `[telegram]`. Keep crocbot's format for consistency.

### Task Sizing Note
Tasks T003-T006 are small constant additions - combine into single edit if efficient.
Tasks T007-T008 are tightly coupled - the HttpError check gates the .error traversal.

### Dependencies
- T007 must complete before T008 (need getErrorName check before using it)
- T010 must complete before T012 (import before use)
- T012 must complete before T013 (register before wrapping in try-finally)

---

## Next Steps

Run `/validate` to verify session completeness.
