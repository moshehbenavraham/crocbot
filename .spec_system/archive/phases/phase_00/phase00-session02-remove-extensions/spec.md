# Session Specification

**Session ID**: `phase00-session02-remove-extensions`
**Phase**: 00 - Strip Moltbot to minimal footprint for VPS/Coolify/Ubuntu deployment
**Status**: Not Started
**Created**: 2026-01-30

---

## 1. Session Overview

This session removes all extension packages from the crocbot repository, eliminating the plugin/extension system complexity to create a minimal deployment target. The `extensions/` directory contains 31 workspace packages with 547 total files covering channel plugins (telegram, discord, slack, signal, matrix, etc.), authentication extensions (google-antigravity-auth, google-gemini-cli-auth, copilot-proxy), memory extensions (memory-core, memory-lancedb), and utility plugins (lobster, llm-task, diagnostics-otel).

Removing extensions is a critical step toward the lean CLI + Telegram gateway architecture. While the core plugin system in `src/plugins/` will remain (it provides the runtime infrastructure), the actual extension packages are not needed for the minimal deployment. This removal follows naturally after Session 01's native app removal and paves the way for Session 03's channel code removal.

The session focuses on surgical deletion of the `extensions/` directory and workspace references, with careful attention to CI configurations and build verification. The core plugin loading code will continue to work but will simply find no bundled extensions to load.

---

## 2. Objectives

1. Remove the entire `extensions/` directory (31 packages, 547 files)
2. Clean pnpm workspace configuration to remove extension entries
3. Update CI labeler configuration to remove extension-related labels
4. Verify build, lint, and tests pass after removal

---

## 3. Prerequisites

### Required Sessions
- [x] `phase00-session01-remove-native-apps` - Native apps removed, build passing

### Required Tools/Knowledge
- pnpm workspace management
- GitHub labeler configuration

### Environment Requirements
- Node 22+ / Bun runtime
- pnpm for workspace operations

---

## 4. Scope

### In Scope (MVP)
- Delete `extensions/` directory entirely
- Remove `extensions/*` from `pnpm-workspace.yaml`
- Remove extension-related labels from `.github/labeler.yml`
- Remove extension-only entries from `onlyBuiltDependencies` in `pnpm-workspace.yaml` (if any)
- Run full build gate verification

### Out of Scope (Deferred)
- Channel code in `src/` - *Reason: Session 03 scope*
- Plugin system code in `src/plugins/` - *Reason: Core infrastructure still needed*
- Dependency cleanup - *Reason: Session 05 scope*
- Dead code references to extensions - *Reason: Session 06 scope*

---

## 5. Technical Approach

### Architecture
The extension system uses pnpm workspaces to manage plugin packages under `extensions/`. Each extension is an independent npm package that can be installed globally or loaded from the workspace. The core `src/plugins/` directory handles discovery, loading, and runtime management.

By removing the `extensions/` workspace entry, pnpm will no longer include these packages. The plugin discovery code will continue to function but will find no bundled plugins - a valid zero-plugins state.

### Design Patterns
- **Workspace isolation**: Extensions are self-contained packages, making removal clean
- **Configuration-driven labels**: GitHub labeler uses glob patterns, removal is straightforward

### Technology Stack
- pnpm 9.x (workspace management)
- GitHub Actions (labeler workflow)

---

## 6. Deliverables

### Files to Create
| File | Purpose | Est. Lines |
|------|---------|------------|
| None | Session is deletion-focused | - |

### Files to Modify
| File | Changes | Est. Lines |
|------|---------|------------|
| `pnpm-workspace.yaml` | Remove `extensions/*` entry | -1 |
| `.github/labeler.yml` | Remove extension label rules | -80 |

### Files to Delete
| File/Directory | Purpose | Est. Files |
|----------------|---------|------------|
| `extensions/` | All extension packages | 547 |

---

## 7. Success Criteria

### Functional Requirements
- [ ] `extensions/` directory no longer exists
- [ ] No workspace errors when running pnpm commands

### Testing Requirements
- [ ] `pnpm install` completes without errors
- [ ] `pnpm build` completes without TypeScript errors
- [ ] `pnpm lint` passes
- [ ] `pnpm test` passes

### Quality Gates
- [ ] All files ASCII-encoded
- [ ] Unix LF line endings
- [ ] Code follows project conventions

---

## 8. Implementation Notes

### Key Considerations
- The core plugin system (`src/plugins/`) remains intact - only the bundled extensions are removed
- Some `onlyBuiltDependencies` entries in `pnpm-workspace.yaml` may be extension-only (e.g., `@matrix-org/matrix-sdk-crypto-nodejs`) - these can be removed
- The labeler config has both `channel: *` labels (which reference `extensions/`) and `extensions: *` labels - both need updating

### Potential Challenges
- **Build dependencies**: Some extension packages have native dependencies; verify lockfile resolves cleanly after removal
- **Test coverage**: Some tests in `src/` may reference extension behavior - these may fail and need investigation

### Relevant Considerations
No active concerns or lessons learned in CONSIDERATIONS.md apply yet - this is the second session in Phase 00.

### ASCII Reminder
All output files must use ASCII-only characters (0-127).

---

## 9. Testing Strategy

### Unit Tests
- Run existing test suite to verify no regressions
- Tests referencing extension-specific functionality may need attention

### Integration Tests
- Verify plugin discovery works with empty extensions list
- Verify CLI plugin commands handle zero plugins gracefully

### Manual Testing
- `pnpm install` from clean state
- `pnpm build` completes
- `crocbot plugins list` shows no bundled extensions (expected)

### Edge Cases
- Clean install on fresh clone after removal
- Plugin commands with no extensions available

---

## 10. Dependencies

### External Libraries
- None specific to this session

### Other Sessions
- **Depends on**: `phase00-session01-remove-native-apps` (completed)
- **Depended by**: `phase00-session03-remove-channels`, `phase00-session05-remove-dependencies`

---

## Next Steps

Run `/tasks` to generate the implementation task checklist.
