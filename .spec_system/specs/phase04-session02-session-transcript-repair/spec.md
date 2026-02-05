# Session Specification

**Session ID**: `phase04-session02-session-transcript-repair`
**Phase**: 04 - Upstream Bug Fixes Port
**Status**: Not Started
**Created**: 2026-02-05

---

## 1. Session Overview

This session ports the remaining session transcript repair functionality from upstream OpenClaw into crocbot. While crocbot already has the tool use/result pairing repair (`repairToolUseResultPairing`), it is missing two critical components: the tool call input repair logic (`repairToolCallInputs` / `sanitizeToolCallInputs`) that drops malformed tool calls without `input` or `arguments` fields, and the JSONL session file repair (`repairSessionFileIfNeeded`) that handles corrupt lines in session files on disk.

The upstream code integrates these repairs at two points: (1) `session-file-repair.ts` runs before `SessionManager.open()` to clean corrupt JSONL lines, and (2) `sanitizeToolCallInputs()` runs inside the session tool result guard to filter malformed assistant messages at persistence time. Crocbot's `attempt.ts` skips the file repair step entirely, and its tool result guard omits the input sanitization that upstream applies. This session closes both gaps, porting the upstream repair functions and wiring them into crocbot's session loading and guard pipelines.

Together with Session 01 (Grammy Timeout Recovery), this completes the resilience story for Phase 04: prevention of crashes via timeout recovery, plus recovery from corruption when crashes do occur from other causes.

---

## 2. Objectives

1. Port `repairToolCallInputs()` and `sanitizeToolCallInputs()` into crocbot's `session-transcript-repair.ts`
2. Port `repairSessionFileIfNeeded()` as a new `session-file-repair.ts` in crocbot
3. Integrate file-level JSONL repair into `attempt.ts` before `SessionManager.open()`
4. Integrate tool call input sanitization into the session tool result guard (`guardedAppend`)
5. Port and adapt all corresponding tests

---

## 3. Prerequisites

### Required Sessions
- [x] `phase04-session01-grammy-timeout-recovery` - Grammy timeout recovery in place; the bot survives network interruptions

### Required Tools/Knowledge
- Understanding of JSONL session file format (header + message entries)
- Understanding of Anthropic tool_use/tool_result message pairing requirements
- Upstream reference code in `.001_ORIGINAL/src/agents/`

### Environment Requirements
- Node 22+ runtime
- pnpm package manager
- Access to `.001_ORIGINAL/` upstream reference

---

## 4. Scope

### In Scope (MVP)
- Port `repairToolCallInputs()` and `sanitizeToolCallInputs()` with `ToolCallInputRepairReport` type into `session-transcript-repair.ts`
- Port helper functions `isToolCallBlock()` and `hasToolCallInput()` needed by input repair
- Create `src/agents/session-file-repair.ts` with `repairSessionFileIfNeeded()` ported from upstream
- Add `repairSessionFileIfNeeded()` call in `attempt.ts` before `SessionManager.open()`
- Add `sanitizeToolCallInputs()` call in `session-tool-result-guard.ts` `guardedAppend` for assistant messages
- Create `src/agents/session-file-repair.test.ts` with tests ported from upstream
- Update existing `session-transcript-repair.test.ts` with `sanitizeToolCallInputs` tests from upstream
- Ensure all synthetic error messages use `[crocbot]` prefix (not `[openclaw]`)

### Out of Scope (Deferred)
- Automatic backup before repair beyond what `repairSessionFileIfNeeded` does - *Reason: upstream's built-in backup is sufficient*
- Repair history/audit trail - *Reason: logging provides adequate visibility*
- UI for repair operations - *Reason: crocbot is CLI/Telegram only, no admin UI*
- Cron delivery-related repairs - *Reason: incompatible architecture with crocbot*
- Changes to `compact.ts` session loading - *Reason: compaction path already uses guard; file repair scope limited to attempt.ts for MVP*

---

## 5. Technical Approach

### Architecture
The repair pipeline operates at two layers:

1. **File layer** (`session-file-repair.ts`): Before the SessionManager opens a session file, `repairSessionFileIfNeeded()` reads the raw JSONL, validates JSON syntax on each line, validates the session header, drops malformed lines, creates a timestamped backup, and atomically replaces the file. This prevents `SessionManager.open()` from choking on corrupt JSON.

2. **Message layer** (`session-transcript-repair.ts` + `session-tool-result-guard.ts`): At runtime, the guard intercepts `appendMessage()` calls. For assistant messages, `sanitizeToolCallInputs()` drops tool call blocks missing `input`/`arguments` fields (and drops entire assistant messages if all tool calls are malformed). For tool results, the existing pairing logic ensures every tool call has a matching result.

### Design Patterns
- **Additive port**: Copy upstream logic, adapt to crocbot's type system and branding
- **Atomic file replacement**: temp file + rename for crash-safe JSONL repair
- **Monkey-patch guard**: existing pattern for intercepting `appendMessage()`

### Technology Stack
- TypeScript 5.x (strict mode, ESM)
- Node.js `fs/promises` for file I/O
- Vitest for testing
- `@mariozechner/pi-agent-core` for `AgentMessage` type
- `@mariozechner/pi-coding-agent` for `SessionManager` type

---

## 6. Deliverables

### Files to Create
| File | Purpose | Est. Lines |
|------|---------|------------|
| `src/agents/session-file-repair.ts` | JSONL session file repair (port from upstream) | ~110 |
| `src/agents/session-file-repair.test.ts` | Tests for session file repair | ~100 |

### Files to Modify
| File | Changes | Est. Lines Changed |
|------|---------|------------|
| `src/agents/session-transcript-repair.ts` | Add `repairToolCallInputs()`, `sanitizeToolCallInputs()`, `isToolCallBlock()`, `hasToolCallInput()`, `ToolCallInputRepairReport` type, `TOOL_CALL_TYPES` constant | ~60 |
| `src/agents/session-transcript-repair.test.ts` | Add `sanitizeToolCallInputs` test suite from upstream | ~35 |
| `src/agents/session-tool-result-guard.ts` | Import `sanitizeToolCallInputs`, add input sanitization in `guardedAppend` for assistant messages | ~15 |
| `src/agents/pi-embedded-runner/run/attempt.ts` | Import and call `repairSessionFileIfNeeded()` before `SessionManager.open()` | ~10 |

---

## 7. Success Criteria

### Functional Requirements
- [ ] Malformed tool calls (missing `input`/`arguments`) are dropped from assistant messages
- [ ] Assistant messages with all tool calls malformed are dropped entirely
- [ ] Corrupt JSONL lines in session files are dropped and file is repaired
- [ ] Session file backup is created before repair with timestamped `.bak-` suffix
- [ ] Atomic file replacement (temp file + rename) prevents partial writes
- [ ] CRLF line endings in session files are handled without data loss
- [ ] Missing/empty session files return gracefully (no crash)
- [ ] Invalid session headers skip repair with warning
- [ ] Repairs are logged via the `warn` callback for debugging
- [ ] Existing valid sessions are not modified (identity check: no changes = return original array/report false)
- [ ] Synthetic error messages use `[crocbot]` prefix

### Testing Requirements
- [ ] Unit tests for `repairSessionFileIfNeeded` (malformed lines, CRLF, invalid header, read errors)
- [ ] Unit tests for `sanitizeToolCallInputs` (missing input, valid calls, mixed blocks)
- [ ] Existing `sanitizeToolUseResultPairing` tests still pass
- [ ] Existing `session-tool-result-guard` tests still pass

### Quality Gates
- [ ] `pnpm build` passes with zero type errors
- [ ] `pnpm lint` passes with zero warnings
- [ ] `pnpm test` passes with all tests green
- [ ] All files ASCII-encoded
- [ ] Unix LF line endings
- [ ] Code follows project conventions (ESM, `.js` imports, strict mode, no `any`)

---

## 8. Implementation Notes

### Key Considerations
- Crocbot's `session-transcript-repair.ts` already has `repairToolUseResultPairing` and `makeMissingToolResult` correctly branded with `[crocbot]`; the new `repairToolCallInputs` additions must match this style
- The upstream `session-tool-result-guard.ts` applies `sanitizeToolCallInputs` inside `guardedAppend` before tracking tool calls; crocbot's guard currently skips this step and needs the same logic added
- The upstream `attempt.ts` calls `repairSessionFileIfNeeded` at line 407 before `SessionManager.open()`; crocbot's `attempt.ts` jumps straight to `prewarmSessionFile` at line 392

### Potential Challenges
- **Type adaptation**: The upstream `ToolCallBlock` type uses loose `unknown` fields; crocbot's strict types may need the same approach since `AgentMessage` content blocks are union types
- **Import path**: The new `session-file-repair.ts` sits in `src/agents/` but `attempt.ts` imports from `../../session-file-repair.js` — need to verify the relative path resolves correctly
- **Guard behavior change**: Adding `sanitizeToolCallInputs` to the guard changes runtime behavior for all assistant messages; must verify existing guard tests still pass
- **File permission preservation**: `repairSessionFileIfNeeded` preserves original file permissions via `fs.stat().mode` — verify this works in Docker/Coolify environment

### Relevant Considerations
- [P00] **TypeScript as refactoring guide**: Let compiler errors guide adaptation of upstream code to crocbot's type system during the port
- [P00] **Incremental verification**: Run `pnpm build && pnpm lint && pnpm test` after each major change (file creation, guard modification, attempt.ts integration)
- [P00] **Scope discipline**: Port only the repair functions specified; do not add repair features beyond what upstream provides
- [P00] **Reference tracing before deletion**: When modifying existing exports, grep for all imports to ensure nothing breaks

### ASCII Reminder
All output files must use ASCII-only characters (0-127).

---

## 9. Testing Strategy

### Unit Tests
- `session-file-repair.test.ts`: Repair JSONL with malformed lines, CRLF handling, invalid session header, non-ENOENT read errors, empty file, missing file (ENOENT)
- `session-transcript-repair.test.ts`: Drop tool calls missing input, keep valid tool calls with text blocks, drop entire assistant message when all calls malformed

### Integration Tests
- Guard integration: Verify `sanitizeToolCallInputs` is applied to assistant messages passing through `guardedAppend`
- Attempt integration: Verify `repairSessionFileIfNeeded` is called before `SessionManager.open()` (validated by build passing with correct import)

### Manual Testing
- Create a corrupt `.jsonl` session file with truncated JSON and verify the bot loads it without crashing
- Create a session with a malformed tool call (missing input) and verify the guard drops it cleanly

### Edge Cases
- Session file with only a header and no messages (should not repair)
- Session file that is completely empty (graceful return)
- Tool call block with `arguments: {}` (valid — should NOT be dropped)
- Tool call block with `input: null` (malformed — should be dropped)
- Mixed assistant message: some tool calls valid, some malformed (keep valid ones, drop malformed)
- Concurrent repair attempts (atomic rename prevents corruption)

---

## 10. Dependencies

### External Libraries
- `@mariozechner/pi-agent-core`: `AgentMessage` type (already in use)
- `@mariozechner/pi-coding-agent`: `SessionManager` type (already in use)
- `node:fs/promises`: File I/O for session file repair (Node built-in)
- `node:path`: Path manipulation (Node built-in)

### Other Sessions
- **Depends on**: `phase04-session01-grammy-timeout-recovery` (completed)
- **Depended by**: `phase04-session03-bug-fix-validation` (validates all Phase 04 bug fixes end-to-end)

---

## Next Steps

Run `/tasks` to generate the implementation task checklist.
