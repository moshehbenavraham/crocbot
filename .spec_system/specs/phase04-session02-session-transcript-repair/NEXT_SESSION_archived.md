# NEXT_SESSION.md

## Session Recommendation

**Generated**: 2026-02-05
**Project State**: Phase 04 - Upstream Bug Fixes Port
**Completed Sessions**: 22

---

## Recommended Next Session

**Session ID**: `phase04-session02-session-transcript-repair`
**Session Name**: Session Transcript Repair
**Estimated Duration**: 2-4 hours
**Estimated Tasks**: 12-18

---

## Why This Session Next?

### Prerequisites Met
- [x] Session 01 completed (Grammy Timeout Recovery)
- [x] Understanding of session file JSONL format (available in upstream reference)
- [x] Understanding of tool call/result message structure (upstream reference in `.001_ORIGINAL/`)
- [x] Sample corrupted session files can be created for testing

### Dependencies
- **Builds on**: `phase04-session01-grammy-timeout-recovery` — Grammy timeout recovery is now in place, meaning the bot survives network interruptions; session transcript repair handles the aftermath when crashes do occur
- **Enables**: `phase04-session03-bug-fix-validation` — the validation session requires both Sessions 01 and 02 to be complete before it can run end-to-end testing of all Phase 04 bug fixes

### Project Progression
This is the natural sequential next step within Phase 04. Grammy timeout recovery (Session 01) prevents crashes from network errors, while session transcript repair (Session 02) handles the damage when crashes still occur from other causes. Together they form a complete resilience story: prevention + recovery. Session 03 (Bug Fix Validation) cannot proceed until both are implemented, making this the only unblocked candidate.

---

## Session Overview

### Objective
Port session transcript repair functionality from upstream to handle corrupted session files and malformed tool calls after crashes, ensuring the bot can recover gracefully from session file corruption.

### Key Deliverables
1. Tool call repair logic for malformed tool calls (missing input fields)
2. Tool use/result pairing validation and repair (orphaned messages)
3. Session file JSONL repair for corrupt entries
4. Integration with session loading (repair on load)
5. Test cases covering all repair scenarios

### Scope Summary
- **In Scope (MVP)**: Port tool call repair, tool use/result pairing validation, JSONL repair, session load integration, tests
- **Out of Scope**: Automatic backup before repair, repair history/audit trail, UI for repair operations, cron delivery-related repairs (incompatible architecture)

---

## Technical Considerations

### Technologies/Patterns
- TypeScript ESM with strict mode
- JSONL file format for session transcripts
- Anthropic message structure (tool_use/tool_result pairing)
- Additive porting from upstream `.001_ORIGINAL/` reference code

### Potential Challenges
- Upstream code may reference features/types removed during crocbot strip-down — will need adaptation
- Session file format may have subtle differences between upstream and crocbot
- Testing corrupt session files requires careful fixture construction
- Integration point for repair-on-load needs to be identified in crocbot's session management code

### Relevant Considerations
- [P00] **TypeScript as refactoring guide**: Let compiler errors guide adaptation of upstream code to crocbot's type system
- [P00] **Incremental verification**: Run build/lint/test after each major change to catch issues early
- [P00] **Scope discipline**: Stick to the port; don't add repair features beyond what upstream provides

---

## Alternative Sessions

If this session is blocked:
1. **phase04-session03-bug-fix-validation** - Could partially validate Grammy timeout recovery (Session 01) alone, but would need to be re-run after Session 02 completes. Not recommended — better to complete Session 02 first.
2. **Phase 05 sessions** - Could skip ahead to build tooling if a blocking issue is discovered with transcript repair. However, Phase 04 should be completed first for stability.

---

## Next Steps

Run `/sessionspec` to generate the formal specification.
