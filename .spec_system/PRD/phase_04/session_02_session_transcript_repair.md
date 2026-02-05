# Session 02: Session Transcript Repair

**Session ID**: `phase04-session02-session-transcript-repair`
**Status**: Not Started
**Estimated Tasks**: ~12-18
**Estimated Duration**: 2-4 hours

---

## Objective

Port session transcript repair functionality from upstream to handle corrupted session files and malformed tool calls after crashes.

---

## Scope

### In Scope (MVP)
- Port tool call repair logic for malformed tool calls (missing input)
- Port tool use/result pairing validation and repair
- Port session file JSONL repair for corrupt entries
- Add repair invocation on session load
- Add tests for repair scenarios

### Out of Scope
- Automatic backup before repair (manual backup adequate)
- Repair history/audit trail
- UI for repair operations
- Cron delivery-related repairs (incompatible architecture)

---

## Prerequisites

- [ ] Session 01 completed (Grammy Timeout Recovery)
- [ ] Understanding of session file JSONL format
- [ ] Understanding of tool call/result message structure
- [ ] Sample corrupted session files for testing (or ability to create them)

---

## Key Files

### Upstream Reference (`.001_ORIGINAL/`)
- `src/agents/session-transcript-repair.ts` - Transcript repair logic
- `src/agents/session-file-repair.ts` - Session file repair logic

### crocbot Files to Create/Modify
- `src/agents/session-transcript-repair.ts` - New file or integrate into existing
- `src/agents/session-file-repair.ts` - New file or integrate into existing
- `src/agents/session-manager.ts` - Add repair invocation on load (if applicable)

---

## Deliverables

1. Tool call repair functionality for malformed inputs
2. Tool use/result pairing validation and repair
3. Session file JSONL repair for corrupt entries
4. Integration with session loading
5. Test cases for repair scenarios
6. Documentation of repair behavior

---

## Success Criteria

- [ ] Malformed tool calls (missing input) are repaired
- [ ] Orphaned tool uses/results are handled gracefully
- [ ] Corrupt JSONL entries don't break session loading
- [ ] Repairs are logged for debugging
- [ ] Existing valid sessions unaffected
- [ ] All tests passing
- [ ] Build and lint pass
