# Considerations

> Institutional memory for AI assistants. Updated between phases via /carryforward.
> **Line budget**: 600 max | **Last updated**: Phase 01 (2026-01-30)

---

## Active Concerns

Items requiring attention in upcoming phases. Review before each session.

### Technical Debt
<!-- Max 5 items -->

- [P00] **Stub files for disabled features**: API-compatible stubs remain for TTS, pairing, Bonjour (`src/tts/tts.ts`, `src/pairing/`, `src/infra/device-pairing.ts`, etc.). Functional code removed but stubs maintain type compatibility. Consider full removal in future cleanup phase.

- [P01] **Internal docs cleanup complete**: 130+ files cleaned of stale channel/platform references. Only 2 files retain historical context (lore.md, device-models.md).

### External Dependencies
<!-- Max 5 items -->

- [P00] **WhatsApp types retained**: `src/config/types.whatsapp.ts` kept because WhatsApp web provider (`src/provider-web.ts`) still in use. Assess if this provider is still needed.

### Performance / Security
<!-- Max 5 items -->

*None yet - add items when thresholds or security requirements emerge.*

### Architecture
<!-- Max 5 items -->

- [P00] **Telegram-only channel registry**: Codebase now assumes single-channel (Telegram). Any future channel additions need registry reconstruction in `src/channels/registry.ts`.

- [P00] **Wide-area DNS-SD kept, mDNS removed**: Gateway discovery uses pure DNS operations for wide-area DNS-SD. Local network mDNS (Bonjour/ciao) removed. If LAN discovery needed again, will require re-adding `@homebridge/ciao`.

- [P00] **Plugin system intact**: Core plugin system (`src/plugins/`) preserved for runtime plugin loading even though bundled extensions removed. Future plugins can still be loaded.

---

## Lessons Learned

Proven patterns and anti-patterns. Reference during implementation.

### What Worked
<!-- Max 15 items -->

- [P00] **Incremental verification**: Running build/lint/test after each major deletion catches issues early and builds confidence. Remove one category at a time.

- [P00] **Reference tracing before deletion**: Grep for all imports/references before deleting code. Prevents dangling imports and broken CI dependencies.

- [P00] **Scope discipline**: Defer out-of-scope cleanups to later sessions (e.g., dead code deferred from Session 02 to Session 06). Keeps sessions focused and manageable.

- [P00] **TypeScript as refactoring guide**: Strict typing effectively identifies necessary updates after removing implementations. Let compiler errors guide the cleanup.

- [P00] **Stub approach for feature removal**: Creating API-compatible stubs that return disabled/empty responses minimizes cascading changes while completely disabling functionality.

- [P00] **Bottom-up deletion order**: Delete leaf files (no dependents) first, then work up to widely-imported files. Minimizes TypeScript error cascades.

- [P00] **Workspace isolation**: pnpm workspace packages are self-contained. Deleting entire extension directories is clean without cascading breakage in core.

- [P00] **Conservative dependency removal**: Remove one dependency category at a time (Discord deps, then Slack deps, etc.). Verify build after each removal to catch hidden usages.

### What to Avoid
<!-- Max 10 items -->

- [P00] **Test coupling to fixtures**: Many tests had indirect dependencies on removed channels through shared fixtures and plugin utilities. Test failures revealed hidden dependencies.

- [P00] **Dead code in unexpected places**: Infrastructure modules may retain code referencing removed features (e.g., Discord retry code survived in `retry-policy.ts` after channel removal). Do a secondary pass.

- [P00] **Underestimating scope**: Session 03 originally estimated ~300 files but touched 50+ additional dependent files. Plan for scope expansion on removal work.

- [P00] **Removing types still in use**: WhatsApp types were listed for deletion but web provider still uses them. Always verify actual usage before deleting type definitions.

- [P00] **Spec inconsistency**: Ensure "Out of Scope" section matches "In Scope" deletion lists. Contradictions cause confusion during implementation.

### Tool/Library Notes
<!-- Max 5 items -->

- [P00] **Extension tests isolated**: Extension test failures don't block core functionality - they depend on published npm package. Can complete sessions despite extension test failures.

- [P00] **Mintlify docs.json sync**: When deleting documentation pages, always update `docs/docs.json` navigation entries to prevent broken links and navigation errors.

- [P00] **pnpm patches require exact versions**: Any dependency with `pnpm.patchedDependencies` must use exact version (no `^`/`~`). Check this when modifying dependencies.

---

## Resolved

Recently closed items (buffer - rotates out after 2 phases).

| Phase | Item | Resolution |
|-------|------|------------|
| P00 | Native apps (iOS/Android/macOS) | Deleted ~548 files in Session 01 |
| P00 | Extension packages (30 plugins) | Deleted 547 files in Session 02 |
| P00 | Non-Telegram channels (7 channels) | Deleted 279 files in Session 03 |
| P00 | Unused scripts (24 files) | Deleted in Session 04 |
| P00 | Orphaned dependencies (8 packages) | Removed in Session 05 |
| P00 | Dead channel config types | Deleted in Session 06 |
| P00 | Mobile infrastructure (TTS/Bonjour/pairing) | Stubbed/disabled in Session 07 |
| P00 | User-facing documentation | Updated for Telegram-only in Session 08 |
| P01 | Internal docs cleanup | Cleaned 130+ files in Session 05 |
| P02 | BlueBubbles provider removal | Removed from config schemas and code in Session 03 |

---

*Auto-generated by /carryforward. Manual edits allowed but may be overwritten.*
