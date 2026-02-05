# Task Checklist

**Session ID**: `phase05-session05-build-validation-ci-integration`
**Total Tasks**: 18
**Created**: 2026-02-05

---

## Legend

- `[x]` = Completed
- `[ ]` = Pending
- `[P]` = Parallelizable (can run with other [P] tasks)
- `[S0505]` = Session reference (Phase 05, Session 05)
- `TNNN` = Task ID

---

## Progress Summary

| Category | Total | Done | Remaining |
|----------|-------|------|-----------|
| Setup | 2 | 2 | 0 |
| Foundation | 4 | 4 | 0 |
| Implementation | 7 | 7 | 0 |
| Testing | 5 | 5 | 0 |
| **Total** | **18** | **18** | **0** |

---

## Setup (2 tasks)

Initial verification and environment preparation.

- [x] T001 [S0505] Verify prerequisites: Node 22+, pnpm 10.x, Docker daemon running
- [x] T002 [S0505] Run `pnpm install --frozen-lockfile` to confirm clean dependency state

---

## Foundation (4 tasks)

Build pipeline verification and baseline measurement.

- [x] T003 [S0505] Run `pnpm check` and verify all three stages pass (tsc --noEmit, oxlint, oxfmt)
- [x] T004 [S0505] Run `pnpm build` and verify exit code 0 with expected dist/ outputs
- [x] T005 [S0505] Inspect dist/ directory structure: confirm `dist/index.js`, `dist/entry.js`, `dist/plugin-sdk/index.js`, `dist/plugin-sdk/index.d.ts` all exist
- [x] T006 [S0505] Benchmark tsdown build time (3 runs, record median) and document result

---

## Implementation (7 tasks)

End-to-end validation of all production surfaces and CI compatibility.

- [x] T007 [S0505] Verify CLI entry point: run `node dist/entry.js --help` and confirm expected output
- [x] T008 [S0505] Verify plugin-sdk exports: test that `dist/plugin-sdk/index.js` and `dist/plugin-sdk/index.d.ts` resolve correctly
- [x] T009 [S0505] Build Docker image: run `docker build .` and confirm all stages complete without errors (`Dockerfile`)
- [x] T010 [S0505] Start Docker container and verify `/health` endpoint returns `{"status":"ok",...}`
- [x] T011 [S0505] Review CI workflow for stale tsc references and update `bunx tsc` to use correct tsconfig (`.github/workflows/ci.yml`)
- [x] T012 [S0505] [P] Verify CI workflow build/lint/format/test commands match current package.json scripts (`.github/workflows/ci.yml`)
- [x] T013 [S0505] [P] Add CHANGELOG.md entry documenting Phase 05 build tooling migration (`CHANGELOG.md`)

---

## Testing (5 tasks)

Full test suite, coverage, and quality verification.

- [x] T014 [S0505] Run full test suite with `pnpm test` and confirm all tests pass
- [x] T015 [S0505] Verify V8 coverage thresholds maintained (70% minimum)
- [x] T016 [S0505] [P] Validate ASCII encoding on all modified and generated files
- [x] T017 [S0505] [P] Validate Unix LF line endings on all modified files
- [x] T018 [S0505] Final end-to-end smoke test: `pnpm check && pnpm build && pnpm test` in sequence

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
Tasks marked `[P]` can be worked on simultaneously:
- T012 + T013: CI review and CHANGELOG entry are independent
- T016 + T017: ASCII and LF checks are independent

### Task Sizing
Most tasks are verification-focused (inspect, run, confirm) rather than code-writing. The CHANGELOG entry (T013) and potential CI workflow update (T011) are the primary code-change tasks.

### Dependencies
- T003-T005 must pass before downstream validations (T007-T010)
- T009 (Docker build) must succeed before T010 (health check)
- T011-T012 (CI review) can proceed in parallel with Docker validation
- T018 is the final gate and depends on all prior tasks

### Key Risks (Resolved)
- Docker build failed because `tsdown.config.ts` was not copied to the builder stage (fixed in Dockerfile)
- CI `bunx tsc` step (line 94) uses tsconfig.json which has `noEmit: true` - this is a valid type-check, not a stale reference
- Plugin-sdk .d.ts generation works correctly with 89 exports and matching declarations

---

## Next Steps

Run `/validate` to verify session completeness.
