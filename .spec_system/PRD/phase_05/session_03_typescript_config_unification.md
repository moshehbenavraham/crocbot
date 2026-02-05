# Session 03: TypeScript Config Unification

**Session ID**: `phase05-session03-typescript-config-unification`
**Status**: Not Started
**Estimated Tasks**: ~15
**Estimated Duration**: 2-4 hours

---

## Objective

Unify TypeScript configuration to cover both `src/` and `ui/` directories under a single tsconfig, upgrade target to ES2023, and align compiler options with upstream.

---

## Scope

### In Scope (MVP)
- Upgrade TypeScript target from ES2022 to ES2023
- Add `ui/**/*` to tsconfig include paths
- Add DOM and DOM.Iterable to lib array for UI type support
- Add `allowImportingTsExtensions: true` for .ts extension imports
- Add `declaration: true` for type declaration output
- Add `noEmit: true` (tsdown handles emit, tsc/tsgo for type checking only)
- Update ignore patterns for ui test files
- Verify type checking passes across both src/ and ui/ directories
- Verify tsdown build still produces correct output
- Run full test suite to confirm no regressions

### Out of Scope
- Adding `experimentalDecorators` (not used in crocbot)
- Linting rule changes (Session 04)
- CI pipeline updates (Session 05)

---

## Prerequisites

- [ ] Session 02 tsdown migration complete
- [ ] tsdown handling emit (tsc/tsgo used for type checking only)

---

## Deliverables

1. Updated `tsconfig.json` with unified configuration
2. Clean type checking across src/ and ui/ directories
3. Verified build output unchanged

---

## Success Criteria

- [ ] `tsc --noEmit` (or `tsgo`) passes with zero errors
- [ ] Both `src/` and `ui/` directories covered by type checking
- [ ] ES2023 target active
- [ ] DOM types available for ui/ components
- [ ] `pnpm build` still produces correct output
- [ ] All existing tests pass
