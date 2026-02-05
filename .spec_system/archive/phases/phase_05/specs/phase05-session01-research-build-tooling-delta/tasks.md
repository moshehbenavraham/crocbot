# Task Checklist

**Session ID**: `phase05-session01-research-build-tooling-delta`
**Total Tasks**: 18
**Estimated Duration**: 2-4 hours
**Created**: 2026-02-05

---

## Legend

- `[x]` = Completed
- `[ ]` = Pending
- `[P]` = Parallelizable (can run with other [P] tasks)
- `[S0501]` = Session reference (Phase 05, Session 01)
- `TNNN` = Task ID

---

## Progress Summary

| Category | Total | Done | Remaining |
|----------|-------|------|-----------|
| Setup | 3 | 3 | 0 |
| Foundation | 4 | 4 | 0 |
| Implementation | 8 | 8 | 0 |
| Testing | 3 | 3 | 0 |
| **Total** | **18** | **18** | **0** |

---

## Setup (3 tasks)

Initial verification and environment preparation.

- [x] T001 [S0501] Verify `.001_ORIGINAL/` upstream reference exists and document upstream commit/version (`ls .001_ORIGINAL/`)
- [x] T002 [S0501] Verify Phase 04 completion status in state.json and all prerequisites met
- [x] T003 [S0501] Create research output directory and scaffold research document (`mkdir -p .spec_system/PRD/phase_05/research/`)

---

## Foundation (4 tasks)

Extract current configurations from both codebases for comparison.

- [x] T004 [S0501] [P] Extract crocbot entry points -- inventory `src/index.ts`, `src/entry.ts`, `src/plugin-sdk/index.ts` and document what each exports (`src/`)
- [x] T005 [S0501] [P] Extract upstream OpenClaw entry points -- inventory all entry points including `src/extensionAPI.ts` and tsdown.config.ts references (`.001_ORIGINAL/`)
- [x] T006 [S0501] [P] Extract crocbot build configuration -- `tsconfig.json`, `ui/tsconfig.json`, `.oxlintrc.json`, `package.json` build scripts
- [x] T007 [S0501] [P] Extract upstream build configuration -- `tsconfig.json`, `ui/tsconfig.json`, `.oxlintrc.json`, `package.json` build scripts, `tsdown.config.ts` (`.001_ORIGINAL/`)

---

## Implementation (8 tasks)

Core research analysis and document authoring.

- [x] T008 [S0501] Write entry point mapping table -- crocbot vs upstream, with tsdown config requirements per entry point (`.spec_system/PRD/phase_05/research/build-tooling-delta.md`)
- [x] T009 [S0501] Document upstream `src/extensionAPI.ts` absence impact assessment -- confirm safe omission from crocbot tsdown config (`.spec_system/PRD/phase_05/research/build-tooling-delta.md`)
- [x] T010 [S0501] Write tsconfig.json delta analysis table -- line-by-line comparison with adopt/reject/adapt decision per option (`.spec_system/PRD/phase_05/research/build-tooling-delta.md`)
- [x] T011 [S0501] Write ui/tsconfig.json delta analysis -- document differences and unification feasibility (`.spec_system/PRD/phase_05/research/build-tooling-delta.md`)
- [x] T012 [S0501] Write oxlint delta analysis table -- plugins, rule categories, ignored patterns with severity recommendations (`.spec_system/PRD/phase_05/research/build-tooling-delta.md`)
- [x] T013 [S0501] Run `any` type inventory -- count by directory, classify stubs vs active code, document grep commands used (`.spec_system/PRD/phase_05/research/build-tooling-delta.md`)
- [x] T014 [S0501] Write build script pipeline comparison -- current `pnpm build` steps vs upstream tsdown-based pipeline, document tsdown version/compatibility, check `pnpm.patchedDependencies` (`.spec_system/PRD/phase_05/research/build-tooling-delta.md`)
- [x] T015 [S0501] Write prioritized migration plan -- session-to-session dependency ordering (S02-S05), crocbot-specific adaptations, risk assessment (`.spec_system/PRD/phase_05/research/build-tooling-delta.md`)

---

## Testing (3 tasks)

Verification and quality assurance.

- [x] T016 [S0501] [P] Verify entry point mapping -- confirm all referenced files exist with `ls`, cross-check against tsdown.config.ts references
- [x] T017 [S0501] [P] Verify `any` type counts are reproducible -- re-run documented grep commands and confirm totals match
- [x] T018 [S0501] Final review -- confirm all delta items have adopt/reject/adapt decisions, no TBD/placeholder entries, ASCII encoding, Unix LF line endings

---

## Completion Checklist

Before marking session complete:

- [x] All tasks marked `[x]`
- [x] All 9 functional requirements from spec Section 7 verified
- [x] Research document complete with no placeholder entries
- [x] All files ASCII-encoded
- [x] implementation-notes.md updated
- [x] Ready for `/validate`

---

## Notes

### Parallelization
Tasks T004-T007 (Foundation) can all run simultaneously -- they extract independent configuration from separate codebases/files.
Tasks T016-T017 (Testing) can run simultaneously -- they verify independent sections of the research document.

### Task Timing
Target ~15-20 minutes per task. Foundation extraction tasks (T004-T007) are lighter; Implementation analysis tasks (T008-T015) are heavier.

### Dependencies
- T004-T007 must complete before T008 (entry point mapping needs both crocbot and upstream data)
- T008-T009 should complete before T010-T012 (entry points inform tsconfig and oxlint context)
- T013 (`any` inventory) is independent of T008-T012 and can run in parallel with them
- T014-T015 depend on all prior analysis tasks
- T016-T018 depend on all Implementation tasks

### Session Reference
This research document is consumed by:
- **S0502** (tsdown migration): entry point mapping, tsdown config analysis
- **S0503** (TypeScript config unification): tsconfig delta analysis
- **S0504** (stricter linting): oxlint delta, `any` type inventory
- **S0505** (build validation/CI): full migration plan

---

## Next Steps

Run `/validate` to verify session completeness.
