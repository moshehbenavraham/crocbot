# PRD Phase 05: Upstream Build Tooling Port

**Status**: In Progress
**Sessions**: 5 (initial estimate)
**Estimated Duration**: 3-5 days

**Progress**: 2/5 sessions (40%)

---

## Overview

Port upstream OpenClaw build tooling improvements to crocbot. This phase replaces the current `tsc` compilation with `tsdown` for significantly faster production builds, unifies TypeScript configuration across `src/` and `ui/` directories, enables stricter linting rules to catch issues earlier, and adds convenience scripts for the development workflow.

---

## Progress Tracker

| Session | Name | Status | Est. Tasks | Validated |
|---------|------|--------|------------|-----------|
| 01 | Research Build Tooling Delta | Complete | 18 | 2026-02-05 |
| 02 | tsdown Migration | Complete | 18 | 2026-02-05 |
| 03 | TypeScript Config Unification | Not Started | ~15 | - |
| 04 | Stricter Linting Rules | Not Started | ~20 | - |
| 05 | Build Validation and CI Integration | Not Started | ~15 | - |

---

## Completed Sessions

### Session 01: Research Build Tooling Delta (2026-02-05)
- Comprehensive delta analysis between crocbot and upstream OpenClaw build tooling
- 587-line research document covering 8 analysis areas
- Entry point mapping, tsconfig delta, oxlint delta, `any` type inventory
- Prioritized migration plan for Sessions 02-05

### Session 02: tsdown Migration (2026-02-05)
- Replaced `tsc` with `tsdown` as production build tool (54% faster: 10.3s -> 4.7s)
- Created `tsdown.config.ts` with 3 entry points (index, entry, plugin-sdk)
- Updated `tsconfig.json` to `noEmit: true` (tsc now type-checker only)
- Added `pnpm check` convenience script for unified code quality validation
- Zero test regressions (3825 passed, 26 pre-existing failures unchanged)

---

## Upcoming Sessions

- Session 03: TypeScript Config Unification
- Session 04: Stricter Linting Rules
- Session 05: Build Validation and CI Integration

---

## Objectives

1. Achieve faster production builds by migrating from `tsc` to `tsdown` bundler
2. Unify TypeScript configuration for `src/` and `ui/` under a single `tsconfig.json`
3. Enable stricter linting rules (`perf`, `suspicious`, `typescript/no-explicit-any`) to catch issues earlier
4. Add `pnpm check` convenience script for unified code quality validation

---

## Prerequisites

- Phase 04 completed (Upstream Bug Fixes Port)
- Upstream reference codebase available in `.001_ORIGINAL/`
- Node 22+ runtime
- pnpm package manager

---

## Technical Considerations

### Architecture

The build tooling migration affects the compilation pipeline but not runtime behavior. The key change is replacing TypeScript's `tsc` compiler with `tsdown` (a Rust-based bundler built on Rolldown/Oxc) for the production build step. Type checking shifts to `tsgo` or a separate `tsc --noEmit` pass.

crocbot's build pipeline currently:
1. Bundles `canvas-host/a2ui` via esbuild
2. Compiles TypeScript via `tsc -p tsconfig.json`
3. Copies canvas assets and hook metadata
4. Writes build info

After migration:
1. Bundles `canvas-host/a2ui` via esbuild (unchanged)
2. Compiles via `tsdown` (faster, production-optimized)
3. Copies canvas assets and hook metadata (unchanged)
4. Writes build info (unchanged)

### Technologies

- **tsdown** - Rust-based TypeScript bundler (~10x faster than tsc)
- **oxlint** - Already in use; stricter rule categories to enable
- **oxfmt** - Already in use; no changes needed
- **Vitest** - Test framework; unaffected by build tooling changes

### Risks

- **Entry point mismatch**: tsdown requires explicit entry points; crocbot may have different entry points than upstream. Mitigation: Session 01 maps all entry points before migration.
- **Runtime behavior change**: tsdown bundles differently than tsc (tree-shaking, module resolution). Mitigation: Session 05 validates runtime behavior end-to-end.
- **Lint rule violations**: Enabling `typescript/no-explicit-any` may surface many existing violations. Mitigation: Session 04 fixes violations incrementally; may need to allowlist legacy files.
- **CI pipeline breakage**: Build script changes may break existing GitHub Actions workflows. Mitigation: Session 05 validates CI integration.

### Relevant Considerations

- [P00] **TypeScript as refactoring guide**: Strict typing effectively identifies necessary updates. Let compiler errors guide the migration.
- [P00] **Incremental verification**: Running build/lint/test after each major change catches issues early.
- [P00] **Conservative dependency removal**: When changing build tools, verify build after each step.

---

## Success Criteria

Phase complete when:
- [ ] All 5 sessions completed
- [ ] Production builds use tsdown and complete faster than tsc baseline
- [ ] Unified tsconfig covers both `src/` and `ui/` directories
- [ ] `typescript/no-explicit-any` enabled as error (or warning with suppression plan)
- [ ] `perf` and `suspicious` oxlint categories enabled as error
- [ ] `pnpm check` script runs type checking, linting, and formatting in one command
- [ ] All existing tests pass with no regressions
- [ ] CI workflows updated and green

---

## Dependencies

### Depends On
- Phase 04: Upstream Bug Fixes Port (complete)

### Enables
- Phase 06: Upstream Security Hardening Port
