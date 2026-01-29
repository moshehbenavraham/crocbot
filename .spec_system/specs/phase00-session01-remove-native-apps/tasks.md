# Task Checklist

**Session ID**: `phase00-session01-remove-native-apps`
**Total Tasks**: 20
**Estimated Duration**: 6-8 hours
**Created**: 2026-01-29

---

## Legend

- `[x]` = Completed
- `[ ]` = Pending
- `[P]` = Parallelizable (can run with other [P] tasks)
- `[S0001]` = Session reference (Phase 00, Session 01)
- `TNNN` = Task ID

---

## Progress Summary

| Category | Total | Done | Remaining |
|----------|-------|------|-----------|
| Setup | 3 | 3 | 0 |
| Foundation | 4 | 4 | 0 |
| Implementation | 9 | 9 | 0 |
| Testing | 4 | 4 | 0 |
| **Total** | **20** | **20** | **0** |

---

## Setup (3 tasks)

Initial verification and environment preparation.

- [x] T001 [S0001] Verify clean working tree and prerequisites (`git status`, `node -v`, `pnpm -v`)
- [x] T002 [S0001] Run baseline build to confirm starting state (`pnpm install && pnpm build`)
- [x] T003 [S0001] Search for all references to `apps/` and `src/macos/` in codebase (`grep -r`)

---

## Foundation (4 tasks)

Identify all references before deletion.

- [x] T004 [S0001] [P] Identify CI workflow jobs referencing native apps (`.github/workflows/ci.yml`)
- [x] T005 [S0001] [P] Identify labeler rules for native apps (`.github/labeler.yml`)
- [x] T006 [S0001] [P] Identify package.json scripts referencing native apps (`package.json`)
- [x] T007 [S0001] [P] Identify imports of `src/macos/` in TypeScript files (`src/**/*.ts`)

---

## Implementation (9 tasks)

Remove native app code and update configurations.

- [x] T008 [S0001] Delete `apps/android/` directory
- [x] T009 [S0001] Delete `apps/ios/` directory
- [x] T010 [S0001] Delete `apps/macos/` directory
- [x] T011 [S0001] Delete `apps/shared/` directory and `apps/` root
- [x] T012 [S0001] Delete `src/macos/` directory
- [x] T013 [S0001] Remove `LEGACY_MACOS_APP_SOURCES_DIR` from `src/compat/legacy-names.ts`
- [x] T014 [S0001] Remove native app scripts from `package.json` (ios:*, android:*, lint:swift, format:swift)
- [x] T015 [S0001] Remove native app labels from `.github/labeler.yml`
- [x] T016 [S0001] Remove/disable macos-app, ios, android jobs from `.github/workflows/ci.yml`

---

## Testing (4 tasks)

Verification and quality assurance.

- [x] T017 [S0001] Run `pnpm install` and verify no errors
- [x] T018 [S0001] Run `pnpm build` and verify no TypeScript errors
- [x] T019 [S0001] Run `pnpm lint` and verify no lint errors
- [x] T020 [S0001] Run `pnpm test` and verify all tests pass

---

## Completion Checklist

Before marking session complete:

- [x] All tasks marked `[x]`
- [x] All tests passing (core tests - extension tests have pre-existing failures)
- [x] All files ASCII-encoded
- [x] implementation-notes.md updated
- [x] Ready for `/validate`

---

## Notes

### Parallelization
Tasks T004-T007 (Foundation) are parallelizable - they all search for references independently.

Tasks T008-T011 can be done in sequence quickly as they are simple directory deletions.

### Task Timing
- Setup tasks (T001-T003): ~15 min each
- Foundation tasks (T004-T007): ~10 min each (parallelizable)
- Implementation tasks (T008-T016): ~15-25 min each
- Testing tasks (T017-T020): ~10-15 min each

### Dependencies
- T008-T012 (deletions) must complete before T013-T016 (config updates)
- T013-T016 must complete before T017-T020 (verification)

### Key Files to Modify
| File | Changes |
|------|---------|
| `package.json` | Remove ~8 scripts |
| `.github/labeler.yml` | Remove 3 label rules |
| `.github/workflows/ci.yml` | Remove 3 jobs (~200 lines) |
| `src/compat/legacy-names.ts` | Remove 1 export |

### Directories to Delete
| Path | Est. Files |
|------|------------|
| `apps/android/` | ~120 files |
| `apps/ios/` | ~200 files |
| `apps/macos/` | ~200 files |
| `apps/shared/` | ~24 files |
| `src/macos/` | 4 files |

---

## Next Steps

Run `/implement` to begin AI-led implementation.
