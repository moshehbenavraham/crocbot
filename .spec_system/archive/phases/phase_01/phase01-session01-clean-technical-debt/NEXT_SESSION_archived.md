# NEXT_SESSION.md

## Session Recommendation

**Generated**: 2026-01-30
**Project State**: Phase 01 - Production Hardening and Deployment
**Completed Sessions**: 8 (Phase 00 complete)

---

## Recommended Next Session

**Session ID**: `phase01-session01-clean-technical-debt`
**Session Name**: Clean Technical Debt
**Estimated Duration**: 2-4 hours
**Estimated Tasks**: 15-20

---

## Why This Session Next?

### Prerequisites Met
- [x] Phase 00 complete (all 8 sessions)
- [x] All tests passing (verified in Phase 00 Session 08)
- [x] Build compiles without errors

### Dependencies
- **Builds on**: Phase 00 codebase stripping (all channels, apps, extensions removed)
- **Enables**: Session 02 Docker Optimization (needs clean codebase first)

### Project Progression
This is the natural first step for Phase 01. Phase 00 successfully stripped the codebase from multi-platform to Telegram-only, but left behind API-compatible stubs for disabled features (TTS, pairing, Bonjour) to minimize cascading changes. Now that the major deletions are complete, these stubs can be safely removed along with any orphaned code.

Session 01 must come before Docker optimization (Session 02) because:
1. Removing stubs will further reduce image size
2. Clean codebase ensures Docker optimization isn't wasted on dead code
3. Verifying no orphaned imports prevents runtime errors in container

---

## Session Overview

### Objective
Remove remaining stub files, orphaned code, and technical debt left over from Phase 00 codebase stripping. Verify all removed feature code is fully eliminated.

### Key Deliverables
1. All TTS stub files removed (`src/tts/tts.ts` and related)
2. All pairing stub files removed (`src/pairing/`, `src/infra/device-pairing.ts`)
3. Bonjour/mDNS stub code removed
4. WhatsApp types verified or removed (`src/config/types.whatsapp.ts`)
5. BlueBubbles provider verified or removed
6. Plugin loader verified clean (no references to removed extensions)
7. Full build/lint/test passing

### Scope Summary
- **In Scope (MVP)**: Remove stubs, verify orphaned code, clean imports, validate build
- **Out of Scope**: Docker optimization, gateway hardening, CI/CD changes, documentation updates

---

## Technical Considerations

### Technologies/Patterns
- TypeScript strict mode guides stub removal
- grep/ripgrep for reference tracing before deletion
- Incremental verification (build/lint/test after each major change)

### Potential Challenges
- Stub removal may reveal hidden consumers not caught by TypeScript
- WhatsApp types may still be needed by web provider
- Plugin loader may have dynamic references not visible at compile time

### Relevant Considerations
<!-- From CONSIDERATIONS.md -->
- [P00] **Stub files for disabled features**: API-compatible stubs remain for TTS, pairing, Bonjour. This session will assess and remove them.
- [P00] **WhatsApp types retained**: `src/config/types.whatsapp.ts` kept for web provider. Must verify if still needed before removal.
- [P00] **BlueBubbles provider status**: May be unused after channel removals. This session will verify.
- [P00] **Plugin system intact**: Core plugin system preserved; verify loader doesn't reference removed extensions.
- [P00] **Stub approach for feature removal**: Stubs were intentionally left in Phase 00 to minimize cascading changes - now safe to remove.

---

## Alternative Sessions

If this session is blocked:
1. **phase01-session05-internal-docs-cleanup** - Can proceed independently if code changes are blocked (docs don't affect runtime)
2. **phase01-session04-cicd-finalization** - Could audit workflows first if stub removal is blocked

---

## Next Steps

Run `/sessionspec` to generate the formal specification.
