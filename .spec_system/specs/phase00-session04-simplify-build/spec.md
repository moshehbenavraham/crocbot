# Session Specification

**Session ID**: `phase00-session04-simplify-build`
**Phase**: 00 - Strip Moltbot to minimal footprint for VPS/Coolify/Ubuntu deployment
**Status**: Not Started
**Created**: 2026-01-30

---

## 1. Session Overview

This session simplifies the build system and CI pipelines after the bulk removal work completed in Sessions 01-03 (native apps, extensions, and non-Telegram channels). The goal is to streamline CI workflows, remove unused build scripts, simplify package.json scripts, and optimize the Dockerfile for a lean CLI + Telegram gateway deployment.

The build infrastructure currently retains workflows, scripts, and configurations for iOS/Android/macOS apps, multiple extension packages, and various messaging channels that no longer exist in the codebase. Cleaning up this infrastructure reduces CI runtime, simplifies maintenance, and aligns the build system with the stripped-down crocbot footprint.

This session is a prerequisite for Session 05 (dependency removal) and Session 06 (dead code refactoring), as a clean build system makes it easier to identify and remove unused dependencies and dead code paths.

---

## 2. Objectives

1. Remove or disable CI workflows and jobs for removed native apps, extensions, and channels
2. Simplify `package.json` scripts by removing app-specific and extension-specific commands
3. Remove unused build scripts from the `scripts/` directory
4. Update `.github/labeler.yml` to reflect the remaining codebase (Telegram-only channels)
5. Verify all CI checks still pass after cleanup

---

## 3. Prerequisites

### Required Sessions
- [x] `phase00-session01-remove-native-apps` - Native app code removed
- [x] `phase00-session02-remove-extensions` - Extension packages removed
- [x] `phase00-session03-remove-channels` - Non-Telegram channels removed

### Required Tools/Knowledge
- GitHub Actions workflow YAML syntax
- pnpm/npm script configuration
- Docker multi-stage builds (basic knowledge)
- Shell scripting (for evaluating script dependencies)

### Environment Requirements
- Node.js 22+
- pnpm 10.23.0+
- Git access to the repository

---

## 4. Scope

### In Scope (MVP)
- Clean up CI workflows in `.github/workflows/`
- Remove unused scripts from `scripts/` directory
- Simplify `package.json` scripts section
- Update `.github/labeler.yml` for remaining code
- Remove stale references in `package.json` files section
- Verify build/lint/test all pass after changes

### Out of Scope (Deferred)
- Dependency removal from `package.json` - *Reason: Session 05 scope*
- Code refactoring in `src/` - *Reason: Session 06 scope*
- Dockerfile optimization beyond script removal - *Reason: Dockerfile is already minimal*
- Documentation updates - *Reason: Session 08 scope*

---

## 5. Technical Approach

### Architecture
The build system cleanup follows a conservative approach: identify artifacts referencing removed code, verify they are no longer needed, and remove them. CI workflows and scripts are independent units, so removal is low-risk as long as remaining functionality is tested.

### Design Patterns
- **Surgical removal**: Remove only what is clearly dead; preserve anything uncertain
- **Verify before delete**: Run full CI checks after each major removal batch
- **Preserve core workflows**: Keep lint/test/build workflows intact; only remove platform-specific jobs

### Technology Stack
- GitHub Actions (YAML workflows)
- pnpm 10.23.0
- Node.js 22+
- Bash (script evaluation)
- Docker (verification only)

---

## 6. Deliverables

### Files to Create
| File | Purpose | Est. Lines |
|------|---------|------------|
| None | N/A | N/A |

### Files to Modify
| File | Changes | Est. Lines Changed |
|------|---------|-------------------|
| `.github/workflows/ci.yml` | Remove macOS-specific test job if no longer needed | ~20 |
| `.github/labeler.yml` | Remove labels for deleted channels (discord, imessage, signal, slack, whatsapp-web) | ~25 |
| `package.json` | Remove unused scripts (mac:*, test:docker:*, etc.) and stale `files` entries | ~40 |

### Files to Delete
| File | Reason |
|------|--------|
| `scripts/package-mac-app.sh` | macOS app packaging no longer needed |
| `scripts/package-mac-dist.sh` | macOS distribution no longer needed |
| `scripts/create-dmg.sh` | DMG creation no longer needed |
| `scripts/codesign-mac-app.sh` | macOS codesigning no longer needed |
| `scripts/notarize-mac-artifact.sh` | macOS notarization no longer needed |
| `scripts/restart-mac.sh` | macOS app restart no longer needed |
| `scripts/build-and-run-mac.sh` | macOS build/run no longer needed |
| `scripts/make_appcast.sh` | Sparkle appcast no longer needed |
| `scripts/build_icon.sh` | macOS icon building no longer needed |
| `scripts/changelog-to-html.sh` | Changelog HTML for apps no longer needed |
| `scripts/clawlog.sh` | macOS unified log helper no longer needed |
| `scripts/ios-team-id.sh` | iOS team ID lookup no longer needed |
| `scripts/protocol-gen-swift.ts` | Swift protocol generation no longer needed |
| `scripts/mobile-reauth.sh` | Mobile reauth no longer needed |
| `scripts/termux-quick-auth.sh` | Termux auth no longer needed |
| `scripts/termux-auth-widget.sh` | Termux widget no longer needed |
| `scripts/termux-sync-widget.sh` | Termux sync no longer needed |
| `scripts/auth-monitor.sh` | Auth monitoring for mobile no longer needed |
| `scripts/claude-auth-status.sh` | Claude auth status script no longer needed |
| `scripts/setup-auth-system.sh` | Auth system setup no longer needed |
| `scripts/sync-plugin-versions.ts` | Plugin version sync no longer needed (no extensions) |

---

## 7. Success Criteria

### Functional Requirements
- [ ] No CI workflows reference removed apps, extensions, or channels
- [ ] `pnpm install` completes without errors
- [ ] `pnpm build` completes without errors
- [ ] `pnpm lint` passes
- [ ] `pnpm test` passes
- [ ] Dockerfile builds successfully

### Testing Requirements
- [ ] Full CI gate passes locally (`pnpm lint && pnpm build && pnpm test`)
- [ ] Docker build tested (`docker build .`)

### Quality Gates
- [ ] All files ASCII-encoded
- [ ] Unix LF line endings
- [ ] Code follows project conventions
- [ ] No broken script references in package.json

---

## 8. Implementation Notes

### Key Considerations
- Scripts may have interdependencies; trace `source` and function calls before deletion
- Some scripts may be referenced in documentation (Session 08 will handle doc cleanup)
- The `checks-macos` CI job runs tests on macOS - verify if this is still needed for CLI/gateway testing
- Labeler config should keep `channel: telegram` and remove other channel labels

### Potential Challenges
- **Script interdependencies**: Some scripts may source common helpers; verify before deleting
  - Mitigation: Grep for script references across the codebase before deletion
- **CI workflow dependencies**: Jobs may have implicit dependencies
  - Mitigation: Review workflow YAML structure carefully; test CI locally
- **package.json files array**: Stale entries reference removed directories
  - Mitigation: Review each entry against existing `dist/` structure

### Relevant Considerations
*None currently - CONSIDERATIONS.md has no active concerns recorded yet.*

### ASCII Reminder
All output files must use ASCII-only characters (0-127).

---

## 9. Testing Strategy

### Unit Tests
- N/A - no new code being added

### Integration Tests
- Full build pipeline: `pnpm build`
- Full test suite: `pnpm test`
- Docker build: `docker build -t crocbot-test .`

### Manual Testing
- Run `pnpm install` on fresh clone
- Run `pnpm lint && pnpm build && pnpm test`
- Verify no broken script references when running package.json scripts
- Test Docker build completes successfully

### Edge Cases
- Verify scripts not referenced elsewhere before deletion
- Check for any CI workflow files that import deleted scripts
- Ensure no runtime code imports deleted scripts

---

## 10. Dependencies

### External Libraries
- None added or modified

### Other Sessions
- **Depends on**: `phase00-session01`, `phase00-session02`, `phase00-session03` (all completed)
- **Depended by**: `phase00-session05` (dependency removal), `phase00-session06` (dead code refactoring)

---

## Next Steps

Run `/tasks` to generate the implementation task checklist.
