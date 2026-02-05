# NEXT_SESSION.md

## Session Recommendation

**Generated**: 2026-02-05
**Project State**: Phase 04 - Upstream Bug Fixes Port
**Completed Sessions**: 21

---

## Recommended Next Session

**Session ID**: `phase04-session01-grammy-timeout-recovery`
**Session Name**: Grammy Timeout Recovery
**Estimated Duration**: 2-4 hours
**Estimated Tasks**: 15-20

---

## Why This Session Next?

### Prerequisites Met
- [x] Phase 03 completed (all 3 sessions validated and marked complete)
- [x] Upstream reference in `.001_ORIGINAL/` accessible
- [x] Grammy infrastructure exists in codebase (HttpError imported, unhandled rejection handler)

### Dependencies
- **Builds on**: Phase 03 feature validation (stable codebase)
- **Enables**: Session 02 (Session Transcript Repair) - establishes error handling patterns

### Project Progression
Phase 03 completed the upstream features port (Telegram model buttons). Phase 04 focuses on stability and bug fixes. Grammy timeout recovery is the natural first step because:

1. **Highest production impact** - Telegram bot crashes from network timeouts affect daily use
2. **Well-defined scope** - Three specific additive fixes with clear implementation paths
3. **No blocking dependencies** - Can be implemented independently
4. **Foundation for Session 02** - Establishes error handling patterns that Session 02 builds upon

---

## Session Overview

### Objective
Port Grammy timeout recovery fixes from upstream to prevent Telegram bot crashes during network interruptions.

### Key Deliverables
1. Updated `collectErrorCandidates()` with `.error` property traversal for Grammy HttpError
2. Extended `RECOVERABLE_MESSAGE_SNIPPETS` with "timed out" pattern
3. Scoped unhandled rejection handler for Grammy errors in `monitor.ts`
4. Test cases for Grammy timeout scenarios

### Scope Summary
- **In Scope (MVP)**: Three specific Grammy fixes, tests, integration verification
- **Out of Scope**: Grammy library changes, cron delivery fixes, retry logic changes

---

## Technical Considerations

### Technologies/Patterns
- Grammy HttpError handling (`.error` vs `.cause` property)
- Node.js unhandled rejection handlers
- TypeScript type guards for error instances

### Potential Challenges
- Grammy HttpError may have different structure than standard errors
- Scoped vs global rejection handler conflicts
- Ensuring existing error handling continues to work

### Relevant Considerations
- [P00] **Telegram-only channel registry**: All error handling is Telegram-focused, simplifying the implementation
- [P00] **Incremental verification**: Run build/lint/test after each fix to catch issues early

---

## Alternative Sessions

If this session is blocked:
1. **phase04-session02-session-transcript-repair** - If Grammy fixes require upstream clarification, session repair is independent
2. **phase05-session01** (TBD) - Build tooling port if bug fixes need to wait for upstream sync

---

## Next Steps

Run `/sessionspec` to generate the formal specification.
