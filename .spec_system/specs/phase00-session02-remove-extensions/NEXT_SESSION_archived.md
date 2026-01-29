# NEXT_SESSION.md

## Session Recommendation

**Generated**: 2026-01-30
**Project State**: Phase 00 - Strip Moltbot to minimal footprint for VPS/Coolify/Ubuntu deployment
**Completed Sessions**: 1

---

## Recommended Next Session

**Session ID**: `phase00-session02-remove-extensions`
**Session Name**: Remove Extensions
**Estimated Duration**: 2-3 hours
**Estimated Tasks**: 12-18

---

## Why This Session Next?

### Prerequisites Met
- [x] Session 01 completed (native apps removed)
- [x] `pnpm install` completes successfully
- [x] `pnpm build` completes successfully

### Dependencies
- **Builds on**: `phase00-session01-remove-native-apps` (completed)
- **Enables**: `phase00-session03-remove-channels`, `phase00-session05-remove-dependencies`

### Project Progression

Session 02 is the natural next step following the PRD's implementation order. The extensions directory is isolated from core functionality and can be removed with minimal risk to the core Telegram gateway. Removing extensions early reduces the codebase complexity before tackling the more intricate channel removal in Session 03.

Per PRD ordering: Native apps (done) -> Extensions (now) -> Channels -> Build -> Dependencies -> Refactoring -> Mobile code -> Docs

---

## Session Overview

### Objective

Remove all extension packages from the repository, eliminating the plugin/extension system complexity for the minimal deployment target.

### Key Deliverables
1. `extensions/` directory removed entirely (~200+ files)
2. Workspace configuration cleaned of extension entries
3. Extension loading code disabled or removed
4. CLI extension commands updated or removed
5. CI/labeler configs updated
6. Build verification passed

### Scope Summary
- **In Scope (MVP)**: Remove `extensions/` directory, clean workspace config, update CLI commands, update CI/labeler, verify build
- **Out of Scope**: Channel code removal (Session 03), dependency cleanup (Session 05), code refactoring (Session 06)

---

## Technical Considerations

### Technologies/Patterns
- pnpm workspaces (need to remove extension workspace entries)
- Plugin loading system (may need to stub or remove)
- CLI argument parsing (extension commands)

### Potential Challenges
- Extension loading code may be deeply integrated with the plugin system
- Some CLI commands may reference extension management
- Workspace removal may require dependency resolution changes

### Relevant Considerations

No active concerns or lessons learned in CONSIDERATIONS.md apply to this session yet. This is only the second session in Phase 00.

---

## Alternative Sessions

If this session is blocked:
1. **phase00-session04-simplify-build** - Could parallelize build simplification if extension removal encounters unexpected blockers
2. **phase00-session08-update-documentation** - Documentation updates can proceed independently

---

## Next Steps

Run `/sessionspec` to generate the formal specification.
