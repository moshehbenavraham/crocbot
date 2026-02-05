# Implementation Notes

**Session ID**: `phase04-session02-session-transcript-repair`
**Started**: 2026-02-05 09:51
**Last Updated**: 2026-02-05 10:05

---

## Session Progress

| Metric | Value |
|--------|-------|
| Tasks Completed | 18 / 18 |
| Blockers | 0 |

---

## Task Log

### [2026-02-05] - Session Start

**Environment verified**:
- [x] Prerequisites confirmed (Node v22.22.0, pnpm, build passes)
- [x] Tools available (upstream `.001_ORIGINAL/` accessible)
- [x] Directory structure ready

### Task T001 - Verify prerequisites

**Completed**: 2026-02-05 09:51

**Notes**:
- `pnpm build` passes cleanly
- Upstream `.001_ORIGINAL/` accessible
- Node v22.22.0 confirmed

### Task T002 - Audit existing files

**Completed**: 2026-02-05 09:51

**Notes**:
- Compared crocbot `session-transcript-repair.ts` (207 lines) with upstream (306 lines)
- Identified missing: `TOOL_CALL_TYPES`, `ToolCallBlock`, `isToolCallBlock()`, `hasToolCallInput()`, `ToolCallInputRepairReport`, `repairToolCallInputs()`, `sanitizeToolCallInputs()`
- `session-file-repair.ts` entirely missing from crocbot
- Guard missing `sanitizeToolCallInputs` integration
- `attempt.ts` missing `repairSessionFileIfNeeded` call before `SessionManager.open()`
- Crocbot already has `[crocbot]` branding in `makeMissingToolResult`

**Files Changed**:
- None (audit only)

### Tasks T003-T006 - Foundation types and helpers

**Completed**: 2026-02-05 09:55

**Notes**:
- Added `TOOL_CALL_TYPES` constant (Set of "toolCall", "toolUse", "functionCall")
- Added `ToolCallBlock` type with loose `unknown` fields matching upstream
- Added `isToolCallBlock()` type guard using `TOOL_CALL_TYPES`
- Added `hasToolCallInput()` checking both `input` and `arguments` fields
- All four batched into a single editing pass

**Files Changed**:
- `src/agents/session-transcript-repair.ts` - Added constant, type, and 2 helper functions

### Tasks T007-T008 - repairToolCallInputs and sanitizeToolCallInputs

**Completed**: 2026-02-05 09:56

**Notes**:
- Ported `ToolCallInputRepairReport` export type
- Ported `repairToolCallInputs()` - drops tool call blocks missing input/arguments, drops entire assistant messages if all calls malformed
- Ported `sanitizeToolCallInputs()` convenience wrapper
- No branding changes needed (these functions don't emit synthetic messages)

**Files Changed**:
- `src/agents/session-transcript-repair.ts` - Added export type and 2 exported functions

### Task T009 - Build checkpoint

**Completed**: 2026-02-05 09:57

**Notes**:
- `pnpm build` passes with zero type errors after transcript repair additions

### Task T010 - Create session-file-repair.ts

**Completed**: 2026-02-05 09:58

**Notes**:
- Created `src/agents/session-file-repair.ts` ported directly from upstream
- Contains `RepairReport` type, `isSessionHeader()` helper, `repairSessionFileIfNeeded()` async function
- Handles: ENOENT gracefully, CRLF line endings, invalid headers, atomic file replacement with backup
- No branding changes needed (warning messages are generic)

**Files Changed**:
- `src/agents/session-file-repair.ts` - Created (~100 lines)

### Task T011 - Integrate sanitizeToolCallInputs into guard

**Completed**: 2026-02-05 09:59

**Notes**:
- Added `sanitizeToolCallInputs` import to `session-tool-result-guard.ts`
- Modified `guardedAppend` to sanitize assistant messages at the top of the function
- If sanitization removes all content (all tool calls malformed), flush pending and return undefined
- Uses `nextMessage` variable pattern matching upstream exactly

**Files Changed**:
- `src/agents/session-tool-result-guard.ts` - Added import, restructured guardedAppend

### Task T012 - Integrate repairSessionFileIfNeeded into attempt.ts

**Completed**: 2026-02-05 10:00

**Notes**:
- Added `repairSessionFileIfNeeded` import from `../../session-file-repair.js`
- Inserted call before `hadSessionFile` check (matching upstream pattern)
- Warns via `log.warn` on repair events

**Files Changed**:
- `src/agents/pi-embedded-runner/run/attempt.ts` - Added import and repair call

### Task T013 - Build checkpoint

**Completed**: 2026-02-05 10:00

**Notes**:
- `pnpm build` passes with zero type errors after all integration points

### Task T014 - Create session-file-repair.test.ts

**Completed**: 2026-02-05 10:01

**Notes**:
- Created `src/agents/session-file-repair.test.ts` with 4 tests ported from upstream
- Adapted `openclaw` references to `crocbot` in temp directory names
- Tests: malformed line repair, CRLF preservation, invalid header warning, non-ENOENT error handling

**Files Changed**:
- `src/agents/session-file-repair.test.ts` - Created (~95 lines)

### Task T015 - Add sanitizeToolCallInputs tests

**Completed**: 2026-02-05 10:02

**Notes**:
- Added `sanitizeToolCallInputs` import to existing test file
- Added 2 test cases: drops tool calls missing input, keeps valid calls with text blocks
- Ported directly from upstream test suite

**Files Changed**:
- `src/agents/session-transcript-repair.test.ts` - Added import and describe block

### Tasks T016-T018 - Final verification

**Completed**: 2026-02-05 10:05

**Notes**:
- `pnpm test`: All session repair tests pass (16/16 across 3 test files). 4 pre-existing failures in gateway tests (hooks.test.ts, server.nodes.late-invoke.test.ts, send.test.ts) unrelated to this session.
- `pnpm lint`: 0 warnings, 0 errors (oxlint on 2160 files)
- `pnpm build`: 0 type errors
- ASCII validation: All 6 new/modified files are ASCII-only
- Line endings: All 6 files use Unix LF
- No `any` types in new/modified source files
- `[crocbot]` prefix confirmed on synthetic messages

---

## Design Decisions

### Decision 1: Exact upstream port

**Context**: Whether to adapt upstream repair logic or port verbatim
**Chosen**: Verbatim port with minimal adaptation
**Rationale**: The repair logic is well-tested upstream. Adapting it risks introducing subtle bugs. Only changes were: branding (`[openclaw]` -> `[crocbot]` where applicable) and temp directory naming in tests.

### Decision 2: Guard restructure using nextMessage pattern

**Context**: How to integrate sanitizeToolCallInputs into guardedAppend
**Chosen**: Match upstream's `nextMessage` variable pattern exactly
**Rationale**: The upstream guard was restructured to use a `nextMessage` variable that starts as the input message and gets replaced by the sanitized version for assistant messages. This is cleaner than adding a conditional branch and matches the tested upstream behavior.

---

## Pre-existing Test Failures

The following 4 test failures exist in the repository before this session and are unrelated:

1. `src/gateway/hooks.test.ts` - normalizeAgentPayload defaults + validates channel
2. `src/gateway/server.nodes.late-invoke.test.ts` - returns success for unknown invoke id (late arrival after timeout)
3. `src/gateway/server.nodes.late-invoke.test.ts` - returns success for unknown invoke id with error payload
4. `src/gateway/server-methods/send.test.ts` - derives a target session key when none is provided

---
