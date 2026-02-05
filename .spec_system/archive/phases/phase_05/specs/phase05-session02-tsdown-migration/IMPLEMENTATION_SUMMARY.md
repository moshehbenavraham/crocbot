# Implementation Summary

**Session ID**: `phase05-session02-tsdown-migration`
**Completed**: 2026-02-05
**Duration**: ~1 hour

---

## Overview

Replaced `tsc` (TypeScript compiler) with `tsdown` as the production build tool for crocbot. The migration swapped a single step in the 5-step build pipeline, achieving a 54% build time improvement (10.3s to 4.7s) while preserving identical runtime behavior and zero test regressions.

---

## Deliverables

### Files Created
| File | Purpose | Lines |
|------|---------|-------|
| `tsdown.config.ts` | tsdown bundler configuration with 3 entry points (index, entry, plugin-sdk) | ~29 |

### Files Modified
| File | Changes |
|------|---------|
| `package.json` | Replaced `tsc -p tsconfig.json` with `tsdown` in build script, added `check` script, added tsdown devDep (^0.20.3), updated rolldown to 1.0.0-rc.3 |
| `tsconfig.json` | Replaced `noEmitOnError: true` with `noEmit: true` (tsc now type-checker only) |

---

## Technical Decisions

1. **skipNodeModulesBundle: true**: tsdown tried to bundle native `.node` files from `@napi-rs/canvas` (optionalDep). Since crocbot is a Node.js CLI app (not a browser library), skipping node_modules bundling matches tsc's behavior and is semantically correct.
2. **rolldown 1.0.0-rc.3 (not rc.2)**: The spec called for rc.2 but tsdown 0.20.3 depends on rc.3. Using rc.2 caused a DTS plugin error (`ctx.inner is not a function`).
3. **Shared config object**: Extracted common options (env, fixedExtension, platform, skipNodeModulesBundle) into a `shared` const to reduce duplication across the 3 entry point configurations.

---

## Test Results

| Metric | Value |
|--------|-------|
| Total Tests | 3853 |
| Passed | 3825 |
| Failed | 26 (pre-existing, unchanged from baseline) |
| Skipped | 2 |
| New Regressions | 0 |
| Lint Warnings | 0 |
| Type Errors | 0 |

---

## Lessons Learned

1. Always verify tsdown/rolldown peer dependency versions match exactly; mismatches cause cryptic DTS plugin errors
2. Node.js CLI apps should use `skipNodeModulesBundle: true` to avoid native addon bundling issues
3. tsdown's code-splitting produces fewer but larger files (~268 chunks vs 1400 individual tsc files) with identical runtime behavior

---

## Future Considerations

Items for future sessions:
1. Session 03: TypeScript Config Unification (depends on tsdown handling emit)
2. Session 04: Stricter Linting Rules (depends on unified tsconfig from Session 03)
3. Session 05: Build Validation and CI Integration (validates entire pipeline end-to-end)

---

## Session Statistics

- **Tasks**: 18 completed
- **Files Created**: 1
- **Files Modified**: 2
- **Tests Added**: 0 (build tooling change; existing 3825 tests serve as regression suite)
- **Blockers**: 3 resolved (Node version, rolldown version, native addon bundling)
