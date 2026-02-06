# Task Checklist

**Session**: `phase05-session03-typescript-config-unification`
**Generated**: 2026-02-05
**Total Tasks**: 15

---

## Phase A: Baseline Verification (Tasks 1-3)

Capture pre-change state to detect regressions.

- [x] **Task 01**: Run `tsc --noEmit` on root tsconfig and record current status (pass/fail, error count)
- [x] **Task 02**: Run `tsc --noEmit -p ui/tsconfig.json` and record current status (pass/fail, error count)
- [x] **Task 03**: Run `pnpm build` and `pnpm test` to establish baseline (record test count, pass/fail, build output file list)

## Phase B: Root tsconfig.json Updates (Tasks 4-10)

Apply upstream delta options incrementally, verifying type checking after each change.

- [x] **Task 04**: Upgrade root `tsconfig.json` target from `ES2022` to `ES2023`
- [x] **Task 05**: Add `"lib": ["ES2023"]` to root `tsconfig.json` compilerOptions
- [x] **Task 06**: Add `"allowImportingTsExtensions": true` to root `tsconfig.json` compilerOptions
- [x] **Task 07**: Add `"declaration": true` to root `tsconfig.json` compilerOptions
- [x] **Task 08**: Add `"experimentalDecorators": true` to root `tsconfig.json` compilerOptions
- [x] **Task 09**: Add `"useDefineForClassFields": false` to root `tsconfig.json` compilerOptions
- [x] **Task 10**: Add `"noEmitOnError": true` to root `tsconfig.json` compilerOptions

## Phase C: Root tsconfig Verification (Task 11)

Verify all root changes together.

- [x] **Task 11**: Run `tsc --noEmit` on root tsconfig -- verify zero type errors after all option additions

## Phase D: UI tsconfig.json Updates (Tasks 12-13)

Apply ES2023 upgrade to ui config.

- [x] **Task 12**: Upgrade `ui/tsconfig.json` target from `ES2022` to `ES2023`
- [x] **Task 13**: Upgrade `ui/tsconfig.json` lib from `["ES2022", "DOM", "DOM.Iterable"]` to `["ES2023", "DOM", "DOM.Iterable"]`

## Phase E: Full Validation (Tasks 14-15)

End-to-end verification of all changes.

- [x] **Task 14**: Run `tsc --noEmit -p ui/tsconfig.json` -- verify zero type errors after UI config changes (70 pre-existing errors, no new regressions)
- [x] **Task 15**: Run full validation suite: `pnpm build`, `pnpm test`, `pnpm check` -- verify no regressions against baseline

---

## Completion Criteria

All 15 tasks checked off. Both tsconfigs updated with upstream delta options, zero type errors, build succeeds, tests pass, `pnpm check` clean.
