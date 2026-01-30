# Task Checklist

**Session ID**: `phase00-session04-simplify-build`
**Total Tasks**: 20
**Estimated Duration**: 6-8 hours
**Created**: 2026-01-30

---

## Legend

- `[x]` = Completed
- `[ ]` = Pending
- `[P]` = Parallelizable (can run with other [P] tasks)
- `[S0004]` = Session reference (Phase 00, Session 04)
- `TNNN` = Task ID

---

## Progress Summary

| Category | Total | Done | Remaining |
|----------|-------|------|-----------|
| Setup | 2 | 2 | 0 |
| Foundation | 4 | 4 | 0 |
| Implementation | 10 | 10 | 0 |
| Testing | 4 | 4 | 0 |
| **Total** | **20** | **20** | **0** |

---

## Setup (2 tasks)

Initial verification and environment preparation.

- [x] T001 [S0004] Verify prerequisites met - native apps, extensions, and channels removed
- [x] T002 [S0004] Grep for script references across codebase to identify safe deletions

---

## Foundation (4 tasks)

Analysis and identification of artifacts to remove.

- [x] T003 [S0004] [P] Analyze `.github/labeler.yml` for stale channel labels (`scripts/sync-labels.ts`)
- [x] T004 [S0004] [P] Analyze `.github/workflows/ci.yml` for macOS-specific jobs to evaluate
- [x] T005 [S0004] [P] Analyze `package.json` scripts for app/extension-specific commands
- [x] T006 [S0004] [P] Analyze `package.json` files array for stale dist/ entries

---

## Implementation (10 tasks)

Remove unused scripts and clean up configuration files.

- [x] T007 [S0004] [P] Delete macOS app scripts (`scripts/package-mac-app.sh`, `scripts/package-mac-dist.sh`, `scripts/create-dmg.sh`)
- [x] T008 [S0004] [P] Delete macOS signing scripts (`scripts/codesign-mac-app.sh`, `scripts/notarize-mac-artifact.sh`)
- [x] T009 [S0004] [P] Delete macOS utility scripts (`scripts/restart-mac.sh`, `scripts/build-and-run-mac.sh`, `scripts/clawlog.sh`)
- [x] T010 [S0004] [P] Delete macOS asset scripts (`scripts/make_appcast.sh`, `scripts/build_icon.sh`, `scripts/changelog-to-html.sh`)
- [x] T011 [S0004] [P] Delete iOS/mobile scripts (`scripts/ios-team-id.sh`, `scripts/mobile-reauth.sh`)
- [x] T012 [S0004] [P] Delete Termux scripts (`scripts/termux-quick-auth.sh`, `scripts/termux-auth-widget.sh`, `scripts/termux-sync-widget.sh`)
- [x] T013 [S0004] [P] Delete auth system scripts (`scripts/auth-monitor.sh`, `scripts/claude-auth-status.sh`, `scripts/setup-auth-system.sh`)
- [x] T014 [S0004] [P] Delete extension scripts (`scripts/sync-plugin-versions.ts`, `scripts/protocol-gen-swift.ts`)
- [x] T015 [S0004] Update `.github/labeler.yml` - remove stale channel labels (discord, imessage, signal, slack, whatsapp-web)
- [x] T016 [S0004] Update `package.json` - remove unused scripts (mac:*, plugins:sync) and stale files entries

---

## Testing (4 tasks)

Verification and quality assurance.

- [x] T017 [S0004] Run full CI gate locally (`pnpm lint && pnpm build && pnpm test`)
- [x] T018 [S0004] Test Docker build (`docker build -t crocbot-test .`)
- [x] T019 [S0004] Validate ASCII encoding on all modified files
- [x] T020 [S0004] Update implementation-notes.md with changes made

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
Tasks T003-T006 (Foundation) can be analyzed in parallel.
Tasks T007-T014 (script deletions) can be done in parallel as they are independent file deletions.

### Task Timing
Target ~20-25 minutes per task.

### Dependencies
- T007-T014 depend on T002 (grep analysis to confirm safe deletion)
- T015-T016 depend on T003-T006 (analysis of what to change)
- T017-T020 depend on all implementation tasks completing

### Key Files to Modify
1. `.github/labeler.yml` - Remove 5 channel labels
2. `package.json` - Remove ~10 scripts, update files array

### Scripts to Delete (21 total)
**macOS App (10):**
- `package-mac-app.sh`, `package-mac-dist.sh`, `create-dmg.sh`
- `codesign-mac-app.sh`, `notarize-mac-artifact.sh`
- `restart-mac.sh`, `build-and-run-mac.sh`, `clawlog.sh`
- `make_appcast.sh`, `build_icon.sh`, `changelog-to-html.sh`

**iOS/Mobile (2):**
- `ios-team-id.sh`, `mobile-reauth.sh`

**Termux (3):**
- `termux-quick-auth.sh`, `termux-auth-widget.sh`, `termux-sync-widget.sh`

**Auth System (3):**
- `auth-monitor.sh`, `claude-auth-status.sh`, `setup-auth-system.sh`

**Extensions (2):**
- `sync-plugin-versions.ts`, `protocol-gen-swift.ts`

---

## Next Steps

Run `/implement` to begin AI-led implementation.
