# NEXT_SESSION.md

## Session Recommendation

**Generated**: 2026-01-30
**Project State**: Phase 00 - Strip Moltbot to minimal footprint for VPS/Coolify/Ubuntu deployment
**Completed Sessions**: 5

---

## Recommended Next Session

**Session ID**: `phase00-session06-refactor-dead-code`
**Session Name**: Refactor Dead Channel Code
**Estimated Duration**: 3-4 hours
**Estimated Tasks**: 18-25

---

## Why This Session Next?

### Prerequisites Met
- [x] Session 01 (remove-native-apps) completed
- [x] Session 02 (remove-extensions) completed
- [x] Session 03 (remove-channels) completed
- [x] Session 04 (simplify-build) completed
- [x] Session 05 (remove-dependencies) completed

### Dependencies
- **Builds on**: Sessions 01-05 removed major code (apps, extensions, channels, dependencies)
- **Enables**: Session 07 (remove-mobile-code) and Session 08 (update-documentation)

### Project Progression
This session is the natural next step because:
1. **Code cleanup after bulk removal**: Sessions 01-05 removed entire directories and dependencies. Now we need to clean up the remaining references and dead code paths.
2. **Type safety**: TypeScript may have stale type unions and references to removed channels that need cleanup.
3. **Routing simplification**: The channel routing logic can be dramatically simplified now that only Telegram remains.
4. **Foundation for final sessions**: Sessions 07-08 depend on clean, working code without dead references.

---

## Session Overview

### Objective
Clean up remaining references to removed channels throughout the codebase, simplifying shared utilities, routing logic, and type definitions to reflect Telegram-only architecture.

### Key Deliverables
1. Clean channel type definitions (Telegram only)
2. Simplified routing code in `src/channels/` and `src/routing/`
3. No dead code paths for removed channels
4. Clean TypeScript compilation with no type errors
5. All tests pass

### Scope Summary
- **In Scope (MVP)**: Remove channel type unions, simplify routing, clean up shared types, remove dead code paths, fix TypeScript errors
- **Out of Scope**: Telegram code changes, new features, performance optimizations, mobile-specific code (Session 07)

---

## Technical Considerations

### Technologies/Patterns
- TypeScript type definitions and unions
- Channel routing abstraction layer
- Message handling pipelines
- Configuration schemas

### Potential Challenges
- **Hidden dependencies**: Some shared utilities may have subtle dependencies on removed channel code
- **Type narrowing**: Simplifying type unions may require adjusting type guards throughout the codebase
- **Test coverage**: Need to verify Telegram functionality remains intact after cleanup

### Relevant Considerations
<!-- From CONSIDERATIONS.md - no active concerns currently apply -->
*No active concerns from CONSIDERATIONS.md apply to this session.*

---

## Alternative Sessions

If this session is blocked:
1. **phase00-session08-update-documentation** - Documentation can be updated in parallel if code cleanup is blocked, though some docs depend on knowing final code state
2. **phase00-session07-remove-mobile-code** - Could proceed if mobile code is isolated from channel references, but depends on clean types

**Note**: Session 06 should not be skipped - sessions 07 and 08 have dependencies on clean code from this session.

---

## Next Steps

Run `/sessionspec` to generate the formal specification.
