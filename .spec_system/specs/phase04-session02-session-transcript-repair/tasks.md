# Task Checklist

**Session ID**: `phase04-session02-session-transcript-repair`
**Total Tasks**: 18
**Estimated Duration**: 2-4 hours
**Created**: 2026-02-05

---

## Legend

- `[x]` = Completed
- `[ ]` = Pending
- `[P]` = Parallelizable (can run with other [P] tasks)
- `[S0402]` = Session reference (Phase 04, Session 02)
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

Initial verification and environment preparation.

- [x] T001 [S0402] Verify prerequisites: confirm `phase04-session01` complete, `pnpm build` passes, upstream `.001_ORIGINAL/` accessible
- [x] T002 [S0402] Audit existing files: read current `session-transcript-repair.ts`, `session-tool-result-guard.ts`, `attempt.ts`, and upstream equivalents to confirm diff scope

---

## Foundation (4 tasks)

Core types, helpers, and constants needed by implementation tasks.

- [x] T003 [S0402] [P] Add `TOOL_CALL_TYPES` constant to `session-transcript-repair.ts` (`src/agents/session-transcript-repair.ts`)
- [x] T004 [S0402] [P] Add `ToolCallBlock` type and `ToolCallInputRepairReport` export type to `session-transcript-repair.ts` (`src/agents/session-transcript-repair.ts`)
- [x] T005 [S0402] [P] Add `isToolCallBlock()` helper to `session-transcript-repair.ts` (`src/agents/session-transcript-repair.ts`)
- [x] T006 [S0402] [P] Add `hasToolCallInput()` helper to `session-transcript-repair.ts` (`src/agents/session-transcript-repair.ts`)

---

## Implementation (7 tasks)

Main feature implementation across file-layer and message-layer repair pipelines.

- [x] T007 [S0402] Implement `repairToolCallInputs()` in `session-transcript-repair.ts` -- port from upstream, adapt types, use `[crocbot]` prefix (`src/agents/session-transcript-repair.ts`)
- [x] T008 [S0402] Implement `sanitizeToolCallInputs()` wrapper in `session-transcript-repair.ts` -- export convenience function (`src/agents/session-transcript-repair.ts`)
- [x] T009 [S0402] Run `pnpm build` checkpoint -- verify transcript repair additions compile cleanly
- [x] T010 [S0402] Create `session-file-repair.ts` with `RepairReport` type, `isSessionHeader()`, and `repairSessionFileIfNeeded()` ported from upstream (`src/agents/session-file-repair.ts`)
- [x] T011 [S0402] Integrate `sanitizeToolCallInputs` into `guardedAppend` in `session-tool-result-guard.ts` -- add import, sanitize assistant messages before tracking tool calls, handle empty sanitization result (`src/agents/session-tool-result-guard.ts`)
- [x] T012 [S0402] Integrate `repairSessionFileIfNeeded` into `attempt.ts` -- add import, call before `prewarmSessionFile`/`SessionManager.open()` (`src/agents/pi-embedded-runner/run/attempt.ts`)
- [x] T013 [S0402] Run `pnpm build` checkpoint -- verify all integration points compile with zero type errors

---

## Testing (5 tasks)

Verification and quality assurance.

- [x] T014 [S0402] [P] Create `session-file-repair.test.ts` -- port upstream tests: malformed lines, CRLF handling, invalid header, non-ENOENT read errors; adapt `openclaw` references to `crocbot` (`src/agents/session-file-repair.test.ts`)
- [x] T015 [S0402] [P] Add `sanitizeToolCallInputs` test suite to `session-transcript-repair.test.ts` -- port upstream tests: missing input drops, valid calls preserved, text blocks preserved (`src/agents/session-transcript-repair.test.ts`)
- [x] T016 [S0402] Run full `pnpm test` -- verify all new and existing tests pass (including existing `sanitizeToolUseResultPairing` and guard tests)
- [x] T017 [S0402] Run `pnpm lint` and `pnpm build` -- ensure zero warnings, zero type errors, ESM `.js` imports correct
- [x] T018 [S0402] Validate all new/modified files: ASCII encoding (0-127 only), Unix LF line endings, no `any` types, `[crocbot]` prefix on synthetic messages

---

## Completion Checklist

Before marking session complete:

- [x] All tasks marked `[x]`
- [x] All tests passing (`pnpm test`) -- 4 pre-existing failures in gateway tests unrelated to this session
- [x] `pnpm build` zero type errors
- [x] `pnpm lint` zero warnings
- [x] All files ASCII-encoded with Unix LF
- [x] implementation-notes.md updated
- [x] Ready for `/validate`

---

## Notes

### Parallelization
- **T003-T006** (Foundation): All four are independent additions to `session-transcript-repair.ts` and can be written in a single pass.
- **T014-T015** (Testing): Test files are independent and can be written concurrently.

### Task Timing
Target ~15-20 minutes per task. Foundation tasks (T003-T006) are small and can be batched into a single editing pass.

### Dependencies
- T003-T006 must complete before T007-T008 (helpers needed by repair functions)
- T007-T008 must complete before T011 (guard needs `sanitizeToolCallInputs` export)
- T010 must complete before T012 (attempt.ts needs `repairSessionFileIfNeeded` import)
- T009 and T013 are build checkpoints -- do not skip
- T014-T015 can begin once their implementation counterparts are done (T010 for T014, T008 for T015)

### Key Files

| File | Action | Tasks |
|------|--------|-------|
| `src/agents/session-transcript-repair.ts` | Modify | T003-T008 |
| `src/agents/session-file-repair.ts` | Create | T010 |
| `src/agents/session-tool-result-guard.ts` | Modify | T011 |
| `src/agents/pi-embedded-runner/run/attempt.ts` | Modify | T012 |
| `src/agents/session-file-repair.test.ts` | Create | T014 |
| `src/agents/session-transcript-repair.test.ts` | Modify | T015 |

---

## Next Steps

Run `/validate` to verify session completeness.
