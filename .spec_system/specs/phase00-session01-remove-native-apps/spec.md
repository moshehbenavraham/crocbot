# Session Specification

**Session ID**: `phase00-session01-remove-native-apps`
**Phase**: 00 - Strip Moltbot to minimal footprint for VPS/Coolify/Ubuntu deployment
**Status**: Not Started
**Created**: 2026-01-29

---

## 1. Session Overview

This session removes all native application code (macOS, iOS, Android) from the crocbot repository. The goal is to transform crocbot from a multi-platform application into a lean CLI + Telegram gateway optimized for VPS deployment.

Native apps represent approximately 544 files across `apps/android/`, `apps/ios/`, `apps/macos/`, and `apps/shared/`. Additionally, `src/macos/` contains 4 TypeScript files providing macOS-specific gateway daemon and relay functionality. Removing this code eliminates platform-specific complexity and reduces the attack surface for a server-focused deployment.

This is the first session in Phase 00 because it carries the lowest risk (native apps are isolated from core CLI/gateway) while providing the biggest immediate reduction in codebase size. All subsequent sessions depend on this cleaner foundation.

---

## 2. Objectives

1. Remove all native application directories (`apps/android/`, `apps/ios/`, `apps/macos/`, `apps/shared/`)
2. Remove macOS-specific TypeScript helpers (`src/macos/`)
3. Clean all references to removed code from configuration files (package.json, labeler.yml, CI workflows)
4. Verify the build, lint, and test pipeline passes after removal

---

## 3. Prerequisites

### Required Sessions
- None - this is the first session

### Required Tools/Knowledge
- pnpm (package management)
- Git (version control)
- Understanding of pnpm workspace configuration
- Familiarity with GitHub Actions workflow syntax

### Environment Requirements
- Node 22+
- pnpm installed
- Clean working tree (no uncommitted changes)

---

## 4. Scope

### In Scope (MVP)
- Delete `apps/` directory entirely (android, ios, macos, shared subdirs)
- Delete `src/macos/` directory (gateway-daemon.ts, relay.ts, relay-smoke.ts, relay-smoke.test.ts)
- Remove app-related scripts from `package.json` (ios:*, android:*, lint:swift, format:swift, protocol:check swift refs)
- Remove `LEGACY_MACOS_APP_SOURCES_DIR` from `src/compat/legacy-names.ts`
- Remove app labels from `.github/labeler.yml` (app: android, app: ios, app: macos)
- Remove or disable CI jobs: `macos-app`, `ios`, `android` from `.github/workflows/ci.yml`
- Verify `pnpm install && pnpm build && pnpm lint && pnpm test` all pass

### Out of Scope (Deferred)
- Extension removal - *Reason: Session 02 scope*
- Channel code removal - *Reason: Session 03 scope*
- Dependency cleanup (removing unused native deps) - *Reason: Session 05 scope*
- Documentation updates beyond CI/config - *Reason: Session 08 scope*
- Removing `.swiftlint.yml` and `.swiftformat` configs - *Reason: Minimal impact, can be cleaned in Session 06*

---

## 5. Technical Approach

### Architecture
This is a subtractive refactoring session. The approach is:
1. Identify all references to native app code
2. Remove directories in dependency order (apps first, then src/macos)
3. Update configuration files to remove dangling references
4. Verify build integrity at each step

### Design Patterns
- **Incremental Verification**: Run build checks after each major removal to catch issues early
- **Reference Tracing**: Use grep/search to find all references before deletion

### Technology Stack
- Bash (file deletion)
- pnpm (dependency verification)
- TypeScript (build verification)
- Vitest (test verification)
- GitHub Actions YAML (workflow updates)

---

## 6. Deliverables

### Files to Create
| File | Purpose | Est. Lines |
|------|---------|------------|
| None | This is a removal session | - |

### Files to Modify
| File | Changes | Est. Lines |
|------|---------|------------|
| `package.json` | Remove ios:*, android:*, lint:swift, format:swift, protocol:check swift refs | ~-20 |
| `.github/labeler.yml` | Remove app: android, app: ios, app: macos labels | ~-15 |
| `.github/workflows/ci.yml` | Remove/disable macos-app, ios, android jobs | ~-200 |
| `src/compat/legacy-names.ts` | Remove LEGACY_MACOS_APP_SOURCES_DIR export | ~-2 |

### Files to Delete
| Path | Description | Est. Files |
|------|-------------|------------|
| `apps/` | All native app code (android, ios, macos, shared) | ~544 |
| `src/macos/` | macOS TypeScript helpers | 4 |

---

## 7. Success Criteria

### Functional Requirements
- [ ] `apps/` directory no longer exists
- [ ] `src/macos/` directory no longer exists
- [ ] No TypeScript compilation errors referencing removed code
- [ ] No dangling imports or references in remaining code

### Testing Requirements
- [ ] `pnpm test` passes (all existing tests still work)
- [ ] No new test failures introduced

### Quality Gates
- [ ] `pnpm install` completes without errors
- [ ] `pnpm build` completes without errors
- [ ] `pnpm lint` passes with no new errors
- [ ] All files ASCII-encoded
- [ ] Unix LF line endings
- [ ] Code follows project conventions

---

## 8. Implementation Notes

### Key Considerations
- The `src/macos/` directory contains `gateway-daemon.ts` which may have imports elsewhere - verify no core code depends on it
- The `LEGACY_MACOS_APP_SOURCES_DIR` constant in `src/compat/legacy-names.ts` must be removed
- CI jobs for native apps run on macOS runners - removing them also reduces CI cost/time
- The `protocol:check` script references Swift protocol generation - this entire check should be removed or simplified

### Potential Challenges
- **CI Job Dependencies**: Other CI jobs may depend on `macos-app`, `ios`, or `android` jobs via `needs:` - verify job dependency graph
- **Package.json Script References**: Scripts may call other scripts that reference removed paths - trace full execution
- **Workspace Config**: Verify `pnpm-workspace.yaml` doesn't explicitly list `apps/*` (it doesn't currently)

### Relevant Considerations
<!-- From CONSIDERATIONS.md - none currently active for this session -->
No active concerns or lessons learned apply to this session (first session of fresh project).

### ASCII Reminder
All output files must use ASCII-only characters (0-127).

---

## 9. Testing Strategy

### Unit Tests
- Run full `pnpm test` suite to verify no regressions
- Specifically verify `src/macos/relay-smoke.test.ts` removal doesn't break test discovery

### Integration Tests
- Not applicable for this removal session

### Manual Testing
- Verify `pnpm install` from clean state
- Verify `pnpm build` produces valid dist/
- Verify `pnpm lint` passes
- Verify `pnpm test` passes

### Edge Cases
- Ensure no dynamic imports reference `src/macos/` paths
- Ensure no runtime path construction builds `apps/` paths

---

## 10. Dependencies

### External Libraries
- None added or removed in this session (dependency cleanup is Session 05)

### Other Sessions
- **Depends on**: None (first session)
- **Depended by**: All subsequent Phase 00 sessions (02-08) benefit from reduced codebase complexity

---

## Next Steps

Run `/tasks` to generate the implementation task checklist.
