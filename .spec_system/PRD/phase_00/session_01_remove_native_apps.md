# Session 01: Remove Native Apps

**Session ID**: `phase00-session01-remove-native-apps`
**Status**: Not Started
**Estimated Tasks**: ~15-20
**Estimated Duration**: 2-4 hours

---

## Objective

Remove all native application code (macOS, iOS, Android) from the repository while ensuring core CLI and gateway functionality remains intact.

---

## Scope

### In Scope (MVP)
- Remove `apps/android/` directory (80+ Kotlin files)
- Remove `apps/ios/` directory (100+ Swift files)
- Remove `apps/macos/` directory (150+ Swift files)
- Remove `apps/shared/` directory (shared app code)
- Remove `src/macos/` directory (macOS helpers)
- Update root `package.json` to remove app-related scripts
- Update pnpm workspace config if apps are listed
- Remove app-related entries from `.github/labeler.yml`
- Verify build still works after removal

### Out of Scope
- Channel code removal (Session 03)
- Extension removal (Session 02)
- Dependency cleanup (Session 05)
- Documentation updates beyond immediate breakage (Session 08)

---

## Prerequisites

- [ ] Fresh clone or clean working tree
- [ ] `pnpm install` completes successfully before changes
- [ ] `pnpm build` completes successfully before changes

---

## Deliverables

1. `apps/` directory removed entirely
2. `src/macos/` directory removed
3. `package.json` cleaned of app-related scripts
4. Workspace configuration updated
5. GitHub labeler config updated
6. Build verification passed

---

## Success Criteria

- [ ] `apps/` directory no longer exists
- [ ] `src/macos/` directory no longer exists
- [ ] `pnpm install` completes without errors
- [ ] `pnpm build` completes without errors
- [ ] `pnpm lint` passes
- [ ] `pnpm test` passes (existing tests still work)
- [ ] No TypeScript compilation errors referencing removed code
