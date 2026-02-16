# Implementation Summary

**Session ID**: `phase14-session04-cli-and-telegram-project-switching`
**Completed**: 2026-02-16
**Duration**: ~3 hours

---

## Overview

Wired the project isolation infrastructure (built in sessions 01-03) to user-facing interfaces: CLI `--project` flag, Telegram `/project` command with 4 subcommands, 5 gateway JSON-RPC methods for programmatic CRUD, extended session key format with backward-compatible project context, and per-project prompt override resolution with per-file fallback.

---

## Deliverables

### Files Created
| File | Purpose | Lines |
|------|---------|-------|
| `src/gateway/server-methods/projects.ts` | Gateway JSON-RPC methods for project CRUD (list, create, switch, delete, current) | ~436 |
| `src/gateway/server-methods/projects.test.ts` | Unit tests for gateway project CRUD methods | ~466 |
| `src/telegram/project-command.ts` | Telegram `/project` command handler with subcommand dispatch | ~271 |
| `src/telegram/project-command.test.ts` | Unit tests for Telegram project command parsing and dispatch | ~267 |
| `src/routing/session-key.test.ts` | Unit tests for extended session key builder and parser | ~125 |
| `src/gateway/protocol/schema/projects.ts` | JSON-RPC protocol schemas for project methods | ~124 |

### Files Modified
| File | Changes |
|------|---------|
| `src/cli/gateway-cli/run.ts` | Added `--project <name>` CLI flag to gateway command; threaded through startup |
| `src/routing/session-key.ts` | Added `buildProjectAwareSessionKey()` and `extractProjectFromSessionKey()` |
| `src/sessions/session-key-utils.ts` | Extended `ParsedAgentSessionKey` return type with optional `projectId` |
| `src/telegram/bot-native-commands.ts` | Registered `/project` command in native command list and wired persistent per-chat state |
| `src/agents/pi-embedded-runner/run.ts` | Threaded `projectId` through runner; resolved project workspace |
| `src/agents/pi-embedded-runner/run/params.ts` | Added `projectId` to `RunEmbeddedPiAgentParams` interface |
| `src/agents/pi-embedded-runner/run/types.ts` | Updated type definitions for project context |
| `src/agents/pi-embedded-runner/system-prompt.ts` | Updated system prompt for project awareness |
| `src/agents/workspace.ts` | Extended `loadWorkspaceBootstrapFiles()` with per-file project-to-agent fallback |
| `src/agents/system-prompt.ts` | Accepted project context for prompt override resolution |
| `src/auto-reply/reply/model-selection.ts` | Read active project from session entry metadata |
| `src/auto-reply/reply/get-reply.ts` | Propagated project context through reply pipeline |
| `src/auto-reply/reply/get-reply-run.ts` | Threaded project context to embedded runner |
| `src/auto-reply/commands-registry.data.ts` | Registered `/project` command alias |
| `src/gateway/protocol/index.ts` | Added project method schemas to protocol validation |
| `src/gateway/protocol/schema.ts` | Added project schema exports |
| `src/gateway/protocol/schema/types.ts` | Added project-related type definitions |
| `src/gateway/server-methods.ts` | Registered project server methods |
| `src/memory/manager.ts` | Updated memory manager for project awareness |
| `src/agents/memory-search.ts` | Updated memory search for project context |
| `docs/tools/slash-commands.md` | Added `/project` command documentation |

---

## Technical Decisions

1. **Per-file prompt fallback**: Project workspace overrides are per-file, not all-or-nothing. A project can have `SOUL.md` but no `AGENTS.md`, and the agent-level `AGENTS.md` still loads. Rationale: maximum flexibility without requiring projects to duplicate all workspace files.
2. **Session key backward compatibility**: Project segment is optional in session keys. Parser returns `undefined` for `projectId` when absent, which normalizes to `DEFAULT_PROJECT_ID` ("default"). Rationale: zero-disruption upgrade path for existing agents.
3. **Persistent per-chat project state**: Active project per Telegram chat is stored in session entry metadata using the same pattern as model overrides. Rationale: survives bot restarts without additional storage layer.
4. **Subcommand dispatch pattern**: Telegram `/project` command uses argument parsing with subcommand dispatch following the existing `/model` handler pattern. Rationale: consistency with existing codebase patterns.

---

## Test Results

| Metric | Value |
|--------|-------|
| Total Test Files | 761 |
| Passed | 760 |
| Flaky (pre-existing) | 1 |
| Total Tests | 5554 |
| Passed | 5553 |
| Skipped | 1 |
| New Test Files | 3 |
| New Tests | ~59 |

---

## Lessons Learned

1. Documentation tests (`slash-commands-doc.test.ts`) catch undocumented commands automatically -- adding `/project` to `commands-registry.data.ts` without updating `docs/tools/slash-commands.md` caused a test failure. Good safety net.
2. Per-file workspace loading fallback is simpler than expected -- a single `Promise.allSettled` with per-file path resolution handles the overlay cleanly.

---

## Future Considerations

Items for future sessions:
1. Session 05 (Integration Testing) should test full project lifecycle end-to-end: create -> switch -> verify memory isolation -> switch back -> verify context restoration
2. Per-project model selection configuration could be layered on top of the model-role system in a future phase
3. Project deletion confirmation flow in Telegram would improve UX (currently only gateway API has delete)

---

## Session Statistics

- **Tasks**: 20 completed
- **Files Created**: 6
- **Files Modified**: 21
- **Tests Added**: ~59 across 3 test files
- **Blockers**: 0 resolved
