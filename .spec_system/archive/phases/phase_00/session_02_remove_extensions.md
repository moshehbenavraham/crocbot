# Session 02: Remove Extensions

**Session ID**: `phase00-session02-remove-extensions`
**Status**: Not Started
**Estimated Tasks**: ~12-18
**Estimated Duration**: 2-3 hours

---

## Objective

Remove all extension packages from the repository, eliminating the plugin/extension system complexity for the minimal deployment target.

---

## Scope

### In Scope (MVP)
- Remove `extensions/` directory entirely (~200+ files)
- Remove extension-related workspace entries from `pnpm-workspace.yaml`
- Remove extension loading code from core if present
- Update any CLI commands that list/manage extensions
- Remove extension-related entries from `.github/labeler.yml`
- Remove extension-related CI workflows if any
- Verify build still works after removal

### Out of Scope
- Channel code removal (Session 03)
- Native app removal (Session 01)
- Dependency cleanup (Session 05)
- Code refactoring for extension references (Session 06)

---

## Prerequisites

- [ ] Session 01 completed (native apps removed)
- [ ] `pnpm install` completes successfully
- [ ] `pnpm build` completes successfully

---

## Deliverables

1. `extensions/` directory removed entirely
2. Workspace configuration cleaned of extension entries
3. Extension loading code disabled or removed
4. CLI extension commands updated or removed
5. CI/labeler configs updated
6. Build verification passed

---

## Success Criteria

- [ ] `extensions/` directory no longer exists
- [ ] `pnpm install` completes without errors
- [ ] `pnpm build` completes without errors
- [ ] `pnpm lint` passes
- [ ] `pnpm test` passes
- [ ] No TypeScript errors referencing extension code
- [ ] CLI help shows no extension-related commands (or they error gracefully)
