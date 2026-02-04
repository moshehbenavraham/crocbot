# Session 03: Remaining Technical Debt

**Session ID**: `phase02-session03-remaining-technical-debt`
**Status**: Not Started
**Estimated Tasks**: ~12-18
**Estimated Duration**: 2-3 hours

---

## Objective

Clean up remaining stub files and technical debt from Phase 00/01, removing or documenting all disabled feature remnants for a clean codebase.

---

## Scope

### In Scope (MVP)
- Remove TTS stub files (src/tts/) if no longer needed
- Remove pairing stub files (src/pairing/, src/infra/device-pairing.ts)
- Verify and remove BlueBubbles provider if unused
- Verify and remove WhatsApp types if web provider not needed
- Remove any remaining dead imports/references
- Update CONSIDERATIONS.md with resolutions

### Out of Scope
- Adding new features
- Refactoring working code
- Performance optimizations

---

## Prerequisites

- [ ] Phase 01 completed
- [ ] Grep analysis of stub file usage
- [ ] Understanding of web provider requirements

---

## Deliverables

1. TTS directory removed or documented as needed
2. Pairing infrastructure removed or documented
3. BlueBubbles provider status resolved
4. WhatsApp types status resolved
5. Clean build/lint/test with no dead code warnings
6. Updated CONSIDERATIONS.md

---

## Success Criteria

- [ ] No stub files remain for truly unused features
- [ ] Any retained stubs documented with justification
- [ ] `pnpm build` succeeds with no dead code
- [ ] `pnpm lint` passes
- [ ] `pnpm test` passes
- [ ] CONSIDERATIONS.md Active Concerns updated
