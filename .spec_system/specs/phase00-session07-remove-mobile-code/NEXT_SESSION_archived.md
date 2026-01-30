# NEXT_SESSION.md

## Session Recommendation

**Generated**: 2026-01-30
**Project State**: Phase 00 - Strip Moltbot to minimal footprint for VPS/Coolify/Ubuntu deployment
**Completed Sessions**: 6 of 8

---

## Recommended Next Session

**Session ID**: `phase00-session07-remove-mobile-code`
**Session Name**: Remove Mobile-Specific Code
**Estimated Duration**: 2-3 hours
**Estimated Tasks**: 12-18

---

## Why This Session Next?

### Prerequisites Met
- [x] Session 01 - Remove native apps (completed)
- [x] Session 02 - Remove extensions (completed)
- [x] Session 03 - Remove channels (completed)
- [x] Session 04 - Simplify build (completed)
- [x] Session 05 - Remove dependencies (completed)
- [x] Session 06 - Refactor dead code (completed)

### Dependencies
- **Builds on**: Session 06 (refactor dead code) - codebase is now clean of channel references
- **Enables**: Session 08 (update documentation) - final session in Phase 00

### Project Progression
This is the penultimate session in Phase 00. With all channels removed and dead code refactored, the mobile-specific code (device pairing, Bonjour/mDNS discovery, TTS) is now isolated and safe to remove. This session continues the systematic stripping of non-VPS functionality before the final documentation cleanup.

---

## Session Overview

### Objective
Remove all mobile-specific functionality including device pairing, Bonjour/mDNS discovery, and text-to-speech (TTS) code that is not needed for VPS deployment.

### Key Deliverables
1. `src/pairing/` directory removed (device pairing code)
2. `src/tts/` directory removed (text-to-speech code)
3. Bonjour/mDNS discovery code removed
4. CLI commands updated to remove pairing/TTS commands
5. Gateway verified to run without pairing requirements
6. Build and tests passing

### Scope Summary
- **In Scope (MVP)**: Remove `src/pairing/`, `src/tts/`, Bonjour/mDNS code, related CLI commands, mobile-specific config options
- **Out of Scope**: Channel code (done), native apps (done), dependency cleanup (done), documentation (Session 08)

---

## Technical Considerations

### Technologies/Patterns
- TypeScript/ESM code removal
- CLI command registry cleanup
- Configuration schema updates
- Gateway initialization flow

### Potential Challenges
- Pairing code may be referenced by gateway startup logic
- TTS may have lingering imports in utility modules
- Bonjour/mDNS (@homebridge/ciao) may be deeply integrated
- Configuration loading may expect pairing settings

### Relevant Considerations
<!-- From CONSIDERATIONS.md - none currently apply -->
No active concerns or lessons learned are currently documented that affect this session.

---

## Alternative Sessions

If this session is blocked:
1. **phase00-session08-update-documentation** - Can proceed if mobile code removal is deferred (but not recommended as it depends on knowing final feature set)

---

## Next Steps

Run `/sessionspec` to generate the formal specification.
