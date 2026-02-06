# NEXT_SESSION.md

## Session Recommendation

**Generated**: 2026-02-05
**Project State**: Phase 05 - Upstream Build Tooling Port
**Completed Sessions**: 27

---

## Recommended Next Session

**Session ID**: `phase05-session04-stricter-linting-rules`
**Session Name**: Stricter Linting Rules
**Estimated Duration**: 2-4 hours
**Estimated Tasks**: ~20

---

## Why This Session Next?

### Prerequisites Met
- [x] Session 01 research complete with `any` type usage inventory
- [x] Session 03 tsconfig unification complete (type-aware linting needs unified config)

### Dependencies
- **Builds on**: Session 01 (research identified `any` usage counts and linting gaps), Session 03 (unified tsconfig enables type-aware lint rules)
- **Enables**: Session 05 (Build Validation and CI Integration requires linting to be finalized)

### Project Progression
This is the natural next step in the Phase 05 build tooling migration. Sessions 01-03 established the build infrastructure (tsdown bundler, unified TypeScript config). Session 04 layers stricter code quality rules on top of that foundation. Session 05 (the final validation session) explicitly lists Session 04 as a prerequisite, so this must complete first. The linting rules catch issues at development time rather than runtime, which aligns with the PRD goal of "stricter linting catches issues earlier."

---

## Session Overview

### Objective
Enable stricter oxlint rule categories and specific rules from upstream to catch more issues at lint time, fixing or suppressing existing violations as needed.

### Key Deliverables
1. Updated `.oxlintrc.json` with `perf` and `suspicious` categories enabled as error
2. `typescript/no-explicit-any` and `no-unnecessary-template-expression` rules active
3. Upstream-aligned rule overrides and ignore patterns for assets/dist/docs/vendor/skills/patches
4. Fixed lint violations in recently-modified code, suppression comments in legacy code
5. Clean `pnpm lint` pass with zero errors and all existing tests passing

### Scope Summary
- **In Scope (MVP)**: Enable `perf` category, enable `suspicious` category, enable `typescript/no-explicit-any` (error or warn depending on violation count), enable `no-unnecessary-template-expression`, add upstream-aligned rule overrides, add ignore patterns, fix violations in new/recent code, suppress legacy violations, verify tests pass
- **Out of Scope**: Refactoring legacy code solely to satisfy lint rules, build tooling changes (done in 02-03), CI pipeline updates (Session 05)

---

## Technical Considerations

### Technologies/Patterns
- oxlint rule configuration (`.oxlintrc.json`)
- TypeScript type-aware linting (depends on unified tsconfig from Session 03)
- Selective rule suppression via inline comments for legacy code

### Potential Challenges
- High `any` type usage in legacy code may require `warn` level instead of `error` for `no-explicit-any`
- `perf` and `suspicious` rules may flag patterns in vendor/third-party code that need ignore patterns
- Lint fixes in recently-modified code must not introduce runtime regressions
- Rule overrides need careful alignment with upstream `.oxlintrc.json` to avoid unnecessary divergence

### Relevant Considerations
- [P00] **TypeScript as refactoring guide**: Stricter linting extends this pattern - let the linter guide code quality improvements incrementally
- [P00] **Scope discipline**: Fix violations in recent code only; suppress legacy violations rather than refactoring entire modules

---

## Alternative Sessions

If this session is blocked:
1. **phase05-session05-build-validation-ci-integration** - Could partially proceed with `pnpm check` script and Docker validation, but linting portion would be incomplete
2. **Phase 06 research** - Begin researching upstream security hardening delta while linting blockers are resolved

---

## Next Steps

Run `/sessionspec` to generate the formal specification.
