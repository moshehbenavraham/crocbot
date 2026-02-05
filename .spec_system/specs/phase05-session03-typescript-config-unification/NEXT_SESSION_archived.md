# NEXT_SESSION.md

## Session Recommendation

**Generated**: 2026-02-05
**Project State**: Phase 05 - Upstream Build Tooling Port
**Completed Sessions**: 26 (2 of 5 in current phase)

---

## Recommended Next Session

**Session ID**: `phase05-session03-typescript-config-unification`
**Session Name**: TypeScript Config Unification
**Estimated Duration**: 2-4 hours
**Estimated Tasks**: ~15

---

## Why This Session Next?

### Prerequisites Met
- [x] Session 02 tsdown migration complete
- [x] tsdown handling emit (tsc/tsgo used for type checking only)

### Dependencies
- **Builds on**: `phase05-session02-tsdown-migration` (tsdown now handles emit; tsc becomes type-check-only)
- **Enables**: `phase05-session04-stricter-linting-rules` (type-aware linting needs unified tsconfig)

### Project Progression
Session 03 is the natural next step in the build tooling migration chain. With tsdown now handling emit (Session 02), TypeScript configuration can be simplified: tsc/tsgo becomes a pure type-checking tool with `noEmit: true`. This session unifies the separate `src/` and `ui/` configurations under a single tsconfig, upgrades the target to ES2023, and adds DOM types for the UI layer. This unification is a hard prerequisite for Session 04 (stricter linting) because type-aware lint rules require a unified tsconfig to function correctly across both directories.

---

## Session Overview

### Objective
Unify TypeScript configuration to cover both `src/` and `ui/` directories under a single tsconfig, upgrade target to ES2023, and align compiler options with upstream.

### Key Deliverables
1. Updated `tsconfig.json` with unified configuration (ES2023 target, DOM types, noEmit)
2. Clean type checking across both `src/` and `ui/` directories
3. Verified that tsdown build output remains unchanged

### Scope Summary
- **In Scope (MVP)**: ES2023 target upgrade, ui inclusion in tsconfig, DOM/DOM.Iterable lib types, `allowImportingTsExtensions`, `declaration: true`, `noEmit: true`, ignore pattern updates, full build and test verification
- **Out of Scope**: Decorator support, linting rule changes (Session 04), CI pipeline updates (Session 05)

---

## Technical Considerations

### Technologies/Patterns
- TypeScript compiler configuration (`tsconfig.json`)
- tsdown bundler (emit) vs tsc/tsgo (type checking only)
- NodeNext module resolution
- ES2023 target features (Array.findLast, Hashbang grammar, etc.)

### Potential Challenges
- UI directory may have type errors not previously caught when adding DOM types
- `allowImportingTsExtensions` interaction with existing `.js` extension import convention
- Ensuring `noEmit: true` doesn't conflict with tsdown's emit pipeline

### Relevant Considerations
- [P00] **TypeScript as refactoring guide**: Strict typing identifies necessary updates after changing config. Let compiler errors guide the unification.
- [P04] **Verbatim upstream port pattern**: Match upstream tsconfig approach first, then adapt only what the stripped-down architecture requires.

---

## Alternative Sessions

If this session is blocked:
1. **phase05-session04-stricter-linting-rules** - Could partially proceed with linting changes that don't require type-aware rules, but this would leave the session incomplete and is not recommended.
2. **Phase 06 planning** - Could begin Phase 06 (Security Hardening) research and session definition via `/phasebuild`, though this breaks the Phase 05 flow.

---

## Next Steps

Run `/sessionspec` to generate the formal specification.
