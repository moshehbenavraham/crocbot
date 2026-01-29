# NEXT_SESSION.md

## Session Recommendation

**Generated**: 2026-01-29
**Project State**: Phase 00 - Strip Moltbot to minimal footprint for VPS/Coolify/Ubuntu deployment
**Completed Sessions**: 0

---

## Recommended Next Session

**Session ID**: `phase00-session01-remove-native-apps`
**Session Name**: Remove Native Apps
**Estimated Duration**: 2-4 hours
**Estimated Tasks**: 15-20

---

## Why This Session Next?

### Prerequisites Met
- [x] Fresh project state (no prior sessions)
- [x] Build infrastructure in place (pnpm, TypeScript, Vitest)
- [x] No dependencies on other sessions

### Dependencies
- **Builds on**: Nothing - this is the first session
- **Enables**: All subsequent sessions (02-08) depend on reduced codebase complexity

### Project Progression
This session is the logical first step because:

1. **Lowest Risk**: Native apps (macOS/iOS/Android) are completely isolated from the core CLI and gateway. Removing them has zero impact on Telegram functionality.
2. **Biggest Win**: The `apps/` directory contains 330+ files (80 Kotlin, 100 Swift iOS, 150 Swift macOS). Removing this immediately cuts ~15-20% of the codebase.
3. **Clean Foundation**: Subsequent sessions (extensions, channels) will be easier to validate with fewer moving parts.
4. **PRD-Specified Order**: The PRD explicitly states "Remove native apps (lowest risk, biggest win)" as the first implementation step.

---

## Session Overview

### Objective
Remove all native application code (macOS, iOS, Android) from the repository while ensuring core CLI and gateway functionality remains intact.

### Key Deliverables
1. `apps/` directory removed entirely (Android, iOS, macOS, shared)
2. `src/macos/` directory removed (macOS helpers in TypeScript)
3. `package.json` cleaned of app-related scripts
4. Workspace configuration updated (pnpm-workspace.yaml)
5. GitHub labeler config updated (.github/labeler.yml)
6. Build verification passed (install, build, lint, test)

### Scope Summary
- **In Scope (MVP)**: Remove `apps/android/`, `apps/ios/`, `apps/macos/`, `apps/shared/`, `src/macos/`; update configs; verify build
- **Out of Scope**: Channel removal (Session 03), extension removal (Session 02), dependency cleanup (Session 05), documentation updates (Session 08)

---

## Technical Considerations

### Technologies/Patterns
- Directory deletion (rm -rf with verification)
- package.json script cleanup
- pnpm workspace configuration
- GitHub Actions labeler YAML
- TypeScript build validation

### Potential Challenges
- **Import References**: Some core code may import from `src/macos/`. Need to identify and stub or remove these imports.
- **Script References**: package.json may have scripts that reference removed directories. Must clean all references.
- **CI Workflow References**: GitHub workflows may have jobs for native app builds that will fail if not updated.

---

## Alternative Sessions

If this session is blocked:
1. **phase00-session02-remove-extensions** - Could be done first if native app directories are somehow protected, but less optimal ordering.
2. **phase00-session08-update-documentation** - Could begin documentation work in parallel, but blocking on this would be unusual.

---

## Next Steps

Run `/sessionspec` to generate the formal specification for `phase00-session01-remove-native-apps`.
