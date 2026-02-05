# Task Checklist

**Session ID**: `phase04-session03-bug-fix-validation`
**Total Tasks**: 18
**Created**: 2026-02-05

---

## Legend

- `[x]` = Completed
- `[ ]` = Pending
- `[P]` = Parallelizable (can run with other [P] tasks)
- `[S0403]` = Session reference (Phase 04, Session 03)
- `TNNN` = Task ID

---

## Progress Summary

| Category | Total | Done | Remaining |
|----------|-------|------|-----------|
| Setup | 2 | 2 | 0 |
| Foundation | 4 | 4 | 0 |
| Implementation | 8 | 8 | 0 |
| Testing | 4 | 4 | 0 |
| **Total** | **18** | **18** | **0** |

---

## Setup (2 tasks)

Environment verification and prerequisite confirmation.

- [x] T001 [S0403] Verify prerequisites: Node 22+, pnpm installed, dependencies up to date (`pnpm install`)
- [x] T002 [S0403] Verify Session 01 and Session 02 commits present in git log and all source files exist

---

## Foundation (4 tasks)

Targeted test execution for each Phase 04 test file in isolation.

- [x] T003 [S0403] [P] Run Grammy timeout recovery tests individually (`src/telegram/network-errors.test.ts`) -- 19/19 passed
- [x] T004 [S0403] [P] Run session file repair tests individually (`src/agents/session-file-repair.test.ts`) -- 4/4 passed
- [x] T005 [S0403] [P] Run session transcript repair tests individually (`src/agents/session-transcript-repair.test.ts`) -- 6/6 passed
- [x] T006 [S0403] [P] Run session tool result guard tests individually (`src/agents/session-tool-result-guard.test.ts`) -- 6/6 passed

---

## Implementation (8 tasks)

Integration verification and full regression suite.

- [x] T007 [S0403] Verify `repairSessionFileIfNeeded()` integration in attempt.ts -- called before `SessionManager.open()` (line 382 vs 398)
- [x] T008 [S0403] Verify `sanitizeToolCallInputs()` integration in guardedAppend -- called on assistant messages (line 90-91)
- [x] T009 [S0403] Verify `flushPendingToolResults()` called in both error recovery and finally block (lines 535, 868)
- [x] T010 [S0403] Verify scoped unhandled rejection handler in monitor.ts -- register (line 92) / unregister (line 221) with Grammy HttpError gate (line 80-83)
- [x] T011 [S0403] Run full build: `pnpm build` -- zero TypeScript errors confirmed
- [x] T012 [S0403] Run full lint: `pnpm lint` -- zero warnings (fixed pre-existing unused param in startup-recovery.ts)
- [x] T013 [S0403] Run full test suite: `pnpm test` -- 188/192 pass; 4 failures in 3 pre-existing files (hooks.test.ts, server-nodes-late-invoke.test.ts, send.test.ts)
- [x] T014 [S0403] Confirm total Phase 04 test count: 35 tests across 4 files (19+4+6+6); no tests skipped or disabled

---

## Testing (4 tasks)

Documentation, phase closure, and final verification.

- [x] T015 [S0403] Create validation.md with test matrix mapping each PRD scenario to test results
- [x] T016 [S0403] Update PRD phase tracker to mark Session 03 complete and check off success criteria
- [x] T017 [S0403] Update CONSIDERATIONS.md with Phase 04 lessons learned: Grammy `.error` traversal, verbatim upstream ports, scoped handler pattern
- [x] T018 [S0403] Create IMPLEMENTATION_SUMMARY.md with session completion summary

---

## Completion Checklist

Before marking session complete:

- [x] All tasks marked `[x]`
- [x] All 35 Phase 04-specific tests passing (actual count; spec estimated 38)
- [x] Full regression suite passing (build, lint, test -- 4 pre-existing failures documented)
- [x] All files ASCII-encoded
- [x] validation.md documents test matrix with results
- [x] IMPLEMENTATION_SUMMARY.md written
- [x] PRD updated with Session 03 completion
- [x] CONSIDERATIONS.md updated with Phase 04 lessons
- [x] Ready for `/validate`

---

## Notes

### Parallelization
Tasks T003-T006 are parallelizable -- all four Phase 04 test files can be run simultaneously since they are independent test suites.

### Pre-existing Failures
Per Session 02 notes, hooks.test.ts, server.nodes.late-invoke.test.ts, and send.test.ts have pre-existing failures unrelated to Phase 04. These should be documented but not block validation.

### Test Count Verification (Actual)
- network-errors.test.ts: 19 tests (Session 01)
- session-file-repair.test.ts: 4 tests (Session 02)
- session-transcript-repair.test.ts: 6 tests (Session 02) -- spec estimated 8
- session-tool-result-guard.test.ts: 6 tests (Session 02) -- spec estimated 7
- **Total: 35 Phase 04-specific tests** (spec estimated 38)

### Dependencies
Complete tasks in order unless marked `[P]`. T007-T010 (integration verification) can proceed after T003-T006 (targeted tests) pass. T011-T013 (full regression) depend on integration checks. T015-T018 (documentation) depend on all verification tasks completing.

---

## Next Steps

Run `/validate` to verify session completeness.
