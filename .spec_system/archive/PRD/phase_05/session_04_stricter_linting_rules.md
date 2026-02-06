# Session 04: Stricter Linting Rules

**Session ID**: `phase05-session04-stricter-linting-rules`
**Status**: Not Started
**Estimated Tasks**: ~20
**Estimated Duration**: 2-4 hours

---

## Objective

Enable stricter oxlint rule categories and specific rules from upstream to catch more issues at lint time, fixing or suppressing existing violations as needed.

---

## Scope

### In Scope (MVP)
- Enable `perf` category as error in `.oxlintrc.json`
- Enable `suspicious` category as error in `.oxlintrc.json`
- Enable `typescript/no-explicit-any` rule (as error or warn depending on violation count)
- Enable `no-unnecessary-template-expression` rule
- Add upstream-aligned rule overrides (off rules for intentional patterns)
- Add appropriate ignore patterns (assets, dist, docs, vendor, skills, patches)
- Fix lint violations in new/recently-modified code
- Suppress or allowlist violations in legacy code where fixing is impractical
- Verify all tests still pass after lint fixes

### Out of Scope
- Refactoring legacy code solely to satisfy new lint rules
- Build tooling changes (Sessions 02-03)
- CI pipeline updates (Session 05)

---

## Prerequisites

- [ ] Session 01 research complete with `any` type usage inventory
- [ ] Session 03 tsconfig unification complete (type-aware linting needs unified config)

---

## Deliverables

1. Updated `.oxlintrc.json` with stricter rules
2. Fixed lint violations in recently-modified code
3. Suppression comments in legacy code where needed
4. Clean `pnpm lint` pass

---

## Success Criteria

- [ ] `perf` and `suspicious` categories enabled as error
- [ ] `typescript/no-explicit-any` rule active (error or warn)
- [ ] `no-unnecessary-template-expression` rule active
- [ ] `pnpm lint` passes with zero errors
- [ ] All existing tests pass
- [ ] No new runtime regressions introduced by lint fixes
