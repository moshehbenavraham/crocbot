# NEXT_SESSION.md

## Session Recommendation

**Generated**: 2026-01-30
**Project State**: Phase 02 - Operational Maturity and Observability
**Completed Sessions**: 15 total (8 in Phase 00, 5 in Phase 01, 2 in Phase 02)

---

## Recommended Next Session

**Session ID**: `phase02-session03-remaining-technical-debt`
**Session Name**: Remaining Technical Debt Cleanup
**Estimated Duration**: 2-3 hours
**Estimated Tasks**: 12-18

---

## Why This Session Next?

### Prerequisites Met
- [x] Phase 00 completed (codebase stripped to Telegram-only)
- [x] Phase 01 completed (production hardening)
- [x] Session 01 structured logging in place
- [x] Session 02 metrics monitoring in place

### Dependencies
- **Builds on**: Phase 00/01 stub file identification in CONSIDERATIONS.md
- **Enables**: Session 04 (clean codebase for error reporting) and Session 05 (runbooks)

### Project Progression
This session addresses technical debt documented in CONSIDERATIONS.md during Phase 00/01. The stub files for disabled features (TTS, pairing, Bonjour, BlueBubbles, WhatsApp types) were left in place for API compatibility during the rapid stripping phase. Now that the codebase is stable and production-ready, these remnants should be properly resolved - either removed entirely or documented if still needed.

Cleaning technical debt now, before Session 04 (Error Reporting) and Session 05 (Runbooks), ensures:
1. Error reporting won't flag dead code warnings
2. Runbooks document the actual codebase, not legacy stubs
3. Clean baseline for future development

---

## Session Overview

### Objective
Clean up remaining stub files and technical debt from Phase 00/01, removing or documenting all disabled feature remnants for a clean codebase.

### Key Deliverables
1. TTS stub files (`src/tts/`) removed or documented
2. Pairing infrastructure (`src/pairing/`, `src/infra/device-pairing.ts`) removed or documented
3. BlueBubbles provider status resolved
4. WhatsApp types (`src/config/types.whatsapp.ts`) status resolved
5. Clean build/lint/test with no dead code warnings
6. Updated CONSIDERATIONS.md with resolutions

### Scope Summary
- **In Scope (MVP)**: Remove TTS stubs, remove pairing stubs, verify BlueBubbles/WhatsApp usage, remove dead imports, update CONSIDERATIONS.md
- **Out of Scope**: Adding new features, refactoring working code, performance optimizations

---

## Technical Considerations

### Technologies/Patterns
- TypeScript strict mode for identifying dead code
- Grep/find for usage analysis
- Incremental deletion with build verification

### Potential Challenges
- Web provider (`src/provider-web.ts`) may still use WhatsApp types - need verification
- BlueBubbles may have hidden references in config schemas
- Removing stubs may break type definitions elsewhere

### Relevant Considerations
- [P00] **Stub files for disabled features**: TTS, pairing, Bonjour stubs remain. This session resolves their status.
- [P00] **WhatsApp types retained**: Web provider still uses these. Must verify actual usage before removal.
- [P00] **BlueBubbles provider status**: May be unused after channel removals. Needs verification.

---

## Alternative Sessions

If this session is blocked:
1. **phase02-session04-error-reporting-alerting** - Can proceed if stub cleanup deferred, but may flag warnings for dead code
2. **phase02-session05-operational-runbooks** - Documentation can proceed, but should ideally document final codebase state

---

## Next Steps

Run `/sessionspec` to generate the formal specification.
