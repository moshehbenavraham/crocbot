# Task Checklist

**Session ID**: `phase05-session04-stricter-linting-rules`
**Total Tasks**: 20
**Created**: 2026-02-05

---

## Legend

- `[x]` = Completed
- `[ ]` = Pending
- `[P]` = Parallelizable (can run with other [P] tasks)
- `[S0504]` = Session reference (Phase 05, Session 04)
- `TNNN` = Task ID

---

## Progress Summary

| Category | Total | Done | Remaining |
|----------|-------|------|-----------|
| Setup | 3 | 3 | 0 |
| Foundation | 3 | 3 | 0 |
| Implementation | 10 | 10 | 0 |
| Testing | 4 | 4 | 0 |
| **Total** | **20** | **20** | **0** |

---

## Setup (3 tasks)

Initial configuration and environment preparation.

- [x] T001 [S0504] Verify prerequisites: `pnpm build`, `pnpm lint`, `pnpm test` all pass clean on current main
- [x] T002 [S0504] Snapshot current lint baseline: run `pnpm lint` and record current error/warning count for comparison
- [x] T003 [S0504] Update dependency versions: oxlint `^1.41.0` -> `^1.43.0`, oxfmt `0.26.0` -> `0.28.0` in `package.json` and run `pnpm install` (`package.json`)

---

## Foundation (3 tasks)

Lint configuration changes that do not introduce new violations.

- [x] T004 [S0504] Expand ignore patterns in `.oxlintrc.json`: add `assets/`, `dist/`, `node_modules/`, `pnpm-lock.yaml/`, `skills/` (`.oxlintrc.json`)
- [x] T005 [S0504] Add upstream-aligned rule overrides (disabled rules): `eslint-plugin-unicorn/prefer-array-find`, `eslint/no-await-in-loop`, `eslint/no-new`, `oxc/no-accumulating-spread`, `oxc/no-async-endpoint-handlers`, `oxc/no-map-spread`, `typescript/no-extraneous-class`, `typescript/no-unsafe-type-assertion`, `unicorn/consistent-function-scoping`, `unicorn/require-post-message-target-origin` (`.oxlintrc.json`)
- [x] T006 [S0504] Dry-run lint with proposed `perf`/`suspicious`/`no-explicit-any`/`curly` rules enabled to get exact violation count and identify all files needing fixes

---

## Implementation (10 tasks)

Fix violations and enable stricter rules.

- [x] T007 [S0504] [P] Fix `any` types in `src/agents/` (7 files, ~10 occurrences): replace `AgentTool<any>` with proper generic types or `AgentTool<unknown>`, fix `as any` parameter casts (`src/agents/*.ts`)
- [x] T008 [S0504] [P] Fix `any` types in `src/gateway/` (2 files, ~5 occurrences): replace `as any` casts on tool metadata with proper types or `as unknown as T` (`src/gateway/*.ts`)
- [x] T009 [S0504] [P] Fix `any` types in `src/auto-reply/reply/` (3 files, ~4 occurrences): replace `as any` on channel/result types (`src/auto-reply/reply/*.ts`)
- [x] T010 [S0504] [P] Fix `any` types in `src/telegram/` (1 file, ~2 occurrences): replace `as any` Grammy API type casts with `as unknown as T` where needed (`src/telegram/*.ts`)
- [x] T011 [S0504] [P] Fix `any` types in `src/plugins/` (1 file, ~2 occurrences): replace `as any` on hook handler and promise check (`src/plugins/*.ts`)
- [x] T012 [S0504] [P] Fix `any` types in `src/security/`, `src/hooks/`, `src/commands/` (3 files, ~3 occurrences): replace config property `as any`, message content `as any`, and `catch (error: any)` -> `catch (error: unknown)` (`src/security/*.ts`, `src/hooks/*.ts`, `src/commands/*.ts`)
- [x] T013 [S0504] Fix violations surfaced by `perf` category: address performance anti-patterns flagged by oxlint (files TBD from T006 dry-run)
- [x] T014 [S0504] Fix violations surfaced by `suspicious` category: address suspicious code constructs flagged by oxlint (files TBD from T006 dry-run)
- [x] T015 [S0504] Add inline suppression comments with justification where fixes are genuinely impractical (third-party type boundaries, Grammy/plugin SDK constraints)
- [x] T016 [S0504] Commit final `.oxlintrc.json` with all categories and rules enabled: `perf: error`, `suspicious: error`, `typescript/no-explicit-any: error`, `curly: error` (`.oxlintrc.json`)

---

## Testing (4 tasks)

Verification and quality assurance.

- [x] T017 [S0504] Run `pnpm lint` and confirm zero errors with all stricter rules active
- [x] T018 [S0504] Run `pnpm build` and confirm successful compilation (no type regressions from `any` fixes)
- [x] T019 [S0504] Run `pnpm test` and confirm all existing tests pass (no runtime regressions)
- [x] T020 [S0504] Run `pnpm check` (typecheck + lint + format) and confirm clean pass; spot-check `as unknown as T` casts for correctness

---

## Completion Checklist

Before marking session complete:

- [x] All tasks marked `[x]`
- [x] All tests passing
- [x] All files ASCII-encoded
- [x] implementation-notes.md updated
- [x] Ready for `/validate`

---

## Notes

### Parallelization
Tasks T007-T012 are parallelizable -- each targets independent source directories with no cross-file dependencies. These represent the bulk of the `any` remediation work and can be worked on in any order.

### Task Dependencies
- T003 (version bump) must complete before T006 (dry-run with new oxlint version)
- T004-T005 (config changes) must complete before T006 (dry-run)
- T006 (dry-run) must complete before T013-T014 (fix perf/suspicious violations)
- T007-T015 (all fixes) must complete before T016 (enable final config)
- T016 must complete before T017-T020 (validation)

### Strategy: Fix First, Then Enable
Per the spec, the approach is:
1. Update ignore patterns and rule overrides (T004-T005, no new violations)
2. Dry-run to identify all violations (T006)
3. Fix all `any` occurrences in active code (T007-T012)
4. Fix perf/suspicious violations (T013-T014)
5. Add suppressions where needed (T015)
6. Enable final config (T016)
7. Full validation (T017-T020)

### Implementation Summary

**Dependency Updates (T003)**:
- oxlint `^1.41.0` -> `^1.43.0`, oxfmt `0.26.0` -> `0.28.0`, oxlint-tsgolint `^0.11.1` -> `^0.11.2`

**Dry-Run Results (T006)**:
- Initial: 8610 errors (8079 curly, 292 no-unnecessary-type-assertion, 86 no-array-sort, 73 no-explicit-any, etc.)
- After `oxlint --fix` auto-fix: 91 errors remaining (72 no-explicit-any, 23 no-unused-vars, 12 template-expr, 4 useless-concat, 2 preserve-caught-error, 1 no-base-to-string)

**Any Type Fixes (T007-T012)**:
- 25 no-explicit-any in non-test src files fixed across 15+ files
- 47 no-explicit-any in test files handled via `.oxlintrc.json` overrides (out of scope)
- Patterns: biome-ignore -> oxlint suppression for TypeBox boundaries, `any` -> `unknown`, removed unnecessary `as any` casts

**Perf/Suspicious Fixes (T013-T014)**:
- 24 no-unused-vars: removed unused type imports across 17 files
- 12 no-unnecessary-template-expression: removed unnecessary template wrapping
- 4 no-useless-concat: combined concatenated string literals
- 1 preserve-caught-error: AggregateError in memory/embeddings.ts
- 1 no-base-to-string: explicit typeof checks in doctor-sandbox.ts

**Type Assertion Restoration**:
- `oxlint --fix` for `no-unnecessary-type-assertion` removed `as { ... }` type casts from `callGateway()`/`callGatewayTool()` calls
- Restored as generic type parameters (`callGateway<T>()`) across 20+ files
- `as` casts restored where generics not applicable (model-scan.ts, skills.ts, onboarding.gateway-config.ts)

**Final Validation (T017-T020)**:
- `pnpm lint`: 0 warnings, 0 errors (134 rules, 2153 files)
- `pnpm build`: clean (135 files)
- `pnpm test`: 3851 tests passed, 653 test files
- `pnpm check`: typecheck + lint + format all clean

### Out of Scope
- Test file `any` types (47 occurrences) -- handled via overrides, not individual fixes
- Legacy code refactoring beyond lint compliance
- `typescript/no-unsafe-type-assertion` stays `off` per upstream

---

## Session Complete

All 20/20 tasks completed. Run `/validate` to verify session completeness.
