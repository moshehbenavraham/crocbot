# Session 04: Simplify Build and CI

**Session ID**: `phase00-session04-simplify-build`
**Status**: Not Started
**Estimated Tasks**: ~15-20
**Estimated Duration**: 2-4 hours

---

## Objective

Simplify the build system and CI pipelines by removing workflows, scripts, and configurations related to removed native apps, extensions, and channels.

---

## Scope

### In Scope (MVP)
- Remove app-related CI workflows (iOS, Android, macOS builds)
- Remove extension-related CI jobs
- Remove channel-specific CI jobs for removed channels
- Simplify `package.json` scripts
- Remove unused build scripts from `scripts/`
- Update Dockerfile for minimal build
- Remove release workflows for native apps
- Simplify test matrix in CI
- Update `.github/labeler.yml` for remaining code

### Out of Scope
- Dependency changes (Session 05)
- Code refactoring (Session 06)
- Documentation updates (Session 08)

---

## Prerequisites

- [ ] Session 01 completed (native apps removed)
- [ ] Session 02 completed (extensions removed)
- [ ] Session 03 completed (channels removed)
- [ ] `pnpm build` completes successfully

---

## Deliverables

1. CI workflows cleaned up (only CLI/gateway/Telegram workflows remain)
2. `package.json` scripts simplified
3. Unused build scripts removed from `scripts/`
4. Dockerfile optimized for minimal build
5. Test CI matrix simplified
6. All CI checks pass

---

## Success Criteria

- [ ] No CI workflows for iOS/Android/macOS apps
- [ ] No CI workflows for removed channels
- [ ] `pnpm install` completes without errors
- [ ] `pnpm build` completes without errors
- [ ] `pnpm lint` passes
- [ ] `pnpm test` passes
- [ ] CI pipeline runs successfully (if testable locally)
- [ ] Dockerfile builds successfully
- [ ] Docker image size reduced
