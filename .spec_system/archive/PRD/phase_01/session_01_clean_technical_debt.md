# Session 01: Clean Technical Debt

**Session ID**: `phase01-session01-clean-technical-debt`
**Status**: Not Started
**Estimated Tasks**: ~15-20
**Estimated Duration**: 2-4 hours

---

## Objective

Remove remaining stub files, orphaned code, and technical debt left over from Phase 00 codebase stripping. Verify all removed feature code is fully eliminated.

---

## Scope

### In Scope (MVP)
- Remove TTS stub files (`src/tts/tts.ts` and related)
- Remove pairing stub files (`src/pairing/`, `src/infra/device-pairing.ts`)
- Remove Bonjour/mDNS stub code
- Verify and remove `src/config/types.whatsapp.ts` if unused
- Verify BlueBubbles provider status and remove if unused
- Verify plugin loader doesn't reference removed extensions
- Clean up any orphaned imports or references
- Run full build/lint/test verification

### Out of Scope
- Docker optimization (Session 02)
- Gateway hardening (Session 03)
- CI/CD changes (Session 04)
- Documentation updates (Session 05)

---

## Prerequisites

- [ ] Phase 00 complete
- [ ] All tests passing
- [ ] Build compiles without errors

---

## Deliverables

1. All stub files removed or justified for retention
2. No orphaned code referencing removed features
3. Clean build with no dead code warnings
4. All tests passing
5. Updated CONSIDERATIONS.md with resolved items

---

## Success Criteria

- [ ] No TTS stub files remain
- [ ] No pairing stub files remain
- [ ] No Bonjour/mDNS code remains
- [ ] WhatsApp types verified or removed
- [ ] BlueBubbles provider verified or removed
- [ ] `pnpm build` passes
- [ ] `pnpm lint` passes
- [ ] `pnpm test` passes
- [ ] No TypeScript errors
