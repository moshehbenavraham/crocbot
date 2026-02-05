# Session Specification

**Session ID**: `phase04-session03-bug-fix-validation`
**Phase**: 04 - Upstream Bug Fixes Port
**Status**: Not Started
**Created**: 2026-02-05

---

## 1. Session Overview

This is the final session of Phase 04 (Upstream Bug Fixes Port). Session 01 ported Grammy timeout recovery to prevent Telegram bot crashes during network interruptions, and Session 02 ported session transcript repair to handle corrupted JSONL session files and malformed tool calls. This validation session ensures both fixes work correctly end-to-end, confirms no regressions in existing Telegram and session management functionality, and formally closes out the phase.

The session focuses on three validation layers: (1) verifying the Grammy timeout recovery error classification, scoped unhandled rejection handling, and retry logic through targeted test execution and scenario analysis; (2) verifying session file repair, tool call sanitization, and guarded append integration through targeted test execution and edge case verification; (3) running the full regression suite (build, lint, tests) to confirm nothing was broken. Upon successful validation, Phase 04 documentation is finalized and CONSIDERATIONS.md is updated with lessons learned via carryforward.

Completing this session unblocks Phase 05 (Upstream Build Tooling Port) and Phase 06 (Security Hardening).

---

## 2. Objectives

1. Validate all Grammy timeout recovery scenarios pass (error codes, message patterns, HttpError traversal, scoped rejection handler)
2. Validate all session transcript repair scenarios pass (JSONL file repair, tool call sanitization, guarded append, attempt.ts integration)
3. Confirm zero regressions across the full test suite, build, and lint
4. Finalize Phase 04 documentation and update CONSIDERATIONS.md with lessons learned

---

## 3. Prerequisites

### Required Sessions
- [x] `phase04-session01-grammy-timeout-recovery` - Grammy HttpError traversal, timeout patterns, scoped rejection handler (completed 2026-02-05)
- [x] `phase04-session02-session-transcript-repair` - JSONL file repair, tool call sanitization, guarded append integration (completed 2026-02-05)

### Required Tools/Knowledge
- Vitest test runner and coverage reporting
- Grammy HttpError error model (`.error` property, not `.cause`)
- JSONL session file format and tool call/result pairing rules
- Understanding of `collectErrorCandidates()` BFS traversal
- Understanding of `guardedAppend` monkey-patching pattern

### Environment Requirements
- Node 22+ runtime
- pnpm package manager
- All dependencies installed (`pnpm install`)
- TypeScript strict mode compilation

---

## 4. Scope

### In Scope (MVP)
- Execute and verify all Grammy timeout recovery tests (19 tests in `network-errors.test.ts`)
- Execute and verify all session file repair tests (4 tests in `session-file-repair.test.ts`)
- Execute and verify all session transcript repair tests (5+ tests in `session-transcript-repair.test.ts`)
- Execute and verify session tool result guard tests (6 tests in `session-tool-result-guard.test.ts`)
- Run full regression suite: `pnpm build`, `pnpm lint`, `pnpm test`
- Verify integration points: `attempt.ts` calls `repairSessionFileIfNeeded()` before `SessionManager.open()`
- Verify integration points: `guardedAppend` calls `sanitizeToolCallInputs()` on assistant messages
- Document validation results in validation.md
- Update PRD phase tracker to mark Session 03 complete
- Update CONSIDERATIONS.md with Phase 04 lessons learned
- Update state.json to mark Phase 04 complete

### Out of Scope (Deferred)
- New feature development - *Reason: validation only*
- Performance optimization - *Reason: not in Phase 04 scope*
- Fixing pre-existing test failures (hooks.test.ts, server.nodes.late-invoke.test.ts, send.test.ts) - *Reason: pre-date Phase 04, documented in Session 02 summary*
- Additional bug fixes outside Phase 04 scope - *Reason: deferred to future phases*
- Live Telegram environment testing - *Reason: requires production deployment*

---

## 5. Technical Approach

### Architecture
This session is validation-only: no new code is written. The approach is systematic test execution across three layers:

1. **Targeted test execution**: Run Phase 04-specific test files individually to verify each fix in isolation with detailed output
2. **Integration verification**: Read and verify integration points in `attempt.ts` and `session-tool-result-guard.ts` to confirm wiring is correct
3. **Full regression**: Run complete build, lint, and test suites to confirm no regressions

### Design Patterns
- **Incremental verification**: Run targeted tests first, then full suite (proven pattern from CONSIDERATIONS.md)
- **Test matrix validation**: Map each PRD scenario to a specific test case and verify coverage

### Technology Stack
- Vitest (test runner with V8 coverage)
- TypeScript strict mode (compilation verification)
- oxlint (linting)
- oxfmt (formatting)

---

## 6. Deliverables

### Files to Create
| File | Purpose | Est. Lines |
|------|---------|------------|
| `.spec_system/specs/phase04-session03-bug-fix-validation/validation.md` | Validation test matrix with results | ~80 |
| `.spec_system/specs/phase04-session03-bug-fix-validation/IMPLEMENTATION_SUMMARY.md` | Session completion summary | ~60 |

### Files to Modify
| File | Changes | Est. Lines |
|------|---------|------------|
| `.spec_system/PRD/phase_04/PRD_phase_04.md` | Mark Session 03 complete, update progress tracker, check off success criteria | ~15 |
| `.spec_system/CONSIDERATIONS.md` | Add Phase 04 lessons learned (Grammy `.error` traversal, verbatim upstream ports, scoped handler pattern) | ~10 |
| `.spec_system/state.json` | Mark phase04-session03 completed, set Phase 04 status to complete | ~5 |

---

## 7. Success Criteria

### Functional Requirements
- [ ] All 19 Grammy timeout recovery tests pass (`src/telegram/network-errors.test.ts`)
- [ ] All 4 session file repair tests pass (`src/agents/session-file-repair.test.ts`)
- [ ] All session transcript repair tests pass (`src/agents/session-transcript-repair.test.ts`)
- [ ] All 6 session tool result guard tests pass (`src/agents/session-tool-result-guard.test.ts`)
- [ ] Grammy HttpError `.error` traversal verified (only for HttpError, not other error types)
- [ ] Scoped unhandled rejection handler verified in monitor.ts (register/unregister pattern)
- [ ] `repairSessionFileIfNeeded()` integration in attempt.ts verified (called before SessionManager.open)
- [ ] `sanitizeToolCallInputs()` integration in guardedAppend verified (called on assistant messages)

### Testing Requirements
- [ ] All Phase 04-specific tests pass individually
- [ ] Full test suite passes (`pnpm test`)
- [ ] No new test failures introduced

### Quality Gates
- [ ] `pnpm build` succeeds with zero TypeScript errors
- [ ] `pnpm lint` succeeds with zero warnings
- [ ] `pnpm test` passes (all tests green)
- [ ] All files ASCII-encoded
- [ ] Unix LF line endings
- [ ] Validation results documented in validation.md

---

## 8. Implementation Notes

### Key Considerations
- Session 01 added 7 new tests (19 total in network-errors.test.ts) covering error codes, message patterns, HttpError traversal, and context-aware behavior
- Session 02 added 10 new tests across session-file-repair.test.ts (4) and session-transcript-repair.test.ts (6)
- Pre-existing test failures in hooks.test.ts, server.nodes.late-invoke.test.ts, and send.test.ts are unrelated to Phase 04 and should be noted but not block validation
- Grammy HttpError uses `.error` (not `.cause`) -- this non-standard pattern is the key insight from Session 01

### Potential Challenges
- **Pre-existing test failures**: 4 tests in gateway-related files may still fail. Mitigation: document as pre-existing, verify they are unchanged from before Phase 04.
- **Test timing sensitivity**: Network error tests may have timing-dependent assertions. Mitigation: run tests multiple times if flaky behavior suspected.

### Relevant Considerations
- [P00] **Incremental verification**: Apply the proven pattern of running build/lint/test after each validation step, exactly as done in Sessions 01 and 02.
- [P00] **TypeScript as refactoring guide**: Build compilation serves as an integration test verifying all new code connects cleanly with existing types.
- [P00] **Test coupling to fixtures**: Verify that Grammy mock behaviors correctly simulate the `.error` property traversal pattern.

### ASCII Reminder
All output files must use ASCII-only characters (0-127).

---

## 9. Testing Strategy

### Unit Tests
- Run `src/telegram/network-errors.test.ts` (19 tests): error codes, HTTP status codes, message patterns, Grammy HttpError traversal, context-aware matching
- Run `src/agents/session-file-repair.test.ts` (4 tests): malformed line repair, CRLF preservation, invalid header handling, read error handling
- Run `src/agents/session-transcript-repair.test.ts` (5+ tests): tool result pairing/moving, duplicate dropping, orphan dropping, tool call input sanitization
- Run `src/agents/session-tool-result-guard.test.ts` (6 tests): guarded append behavior, pending tracking, synthetic results

### Integration Tests
- Verify `attempt.ts` calls `repairSessionFileIfNeeded()` before `SessionManager.open()` (code review)
- Verify `guardedAppend` calls `sanitizeToolCallInputs()` on assistant messages (code review)
- Verify `flushPendingToolResults()` is called in both error recovery and finally block in attempt.ts

### Manual Testing
- Review test output for each Phase 04 test file individually
- Confirm test counts match expected (19 + 4 + 5+ + 6 = 34+ Phase 04-specific tests)
- Verify no test was accidentally skipped or disabled

### Edge Cases
- Grammy HttpError with nested `.error` containing timeout message (covered by test)
- Non-HttpError with `.error` property not traversed (covered by isolation test)
- JSONL file with CRLF line endings (covered by test)
- Session file with invalid header (covered by test)
- Tool call blocks missing both `input` and `arguments` (covered by sanitize test)
- Duplicate tool results across transcript spans (covered by test)
- Orphan tool results without matching assistant call (covered by test)

---

## 10. Dependencies

### External Libraries
- vitest: test runner
- grammy: Telegram Bot API (HttpError type for mocking)

### Other Sessions
- **Depends on**: `phase04-session01-grammy-timeout-recovery`, `phase04-session02-session-transcript-repair`
- **Depended by**: Phase 05 (Upstream Build Tooling Port), Phase 06 (Security Hardening)

---

## Next Steps

Run `/tasks` to generate the implementation task checklist.
