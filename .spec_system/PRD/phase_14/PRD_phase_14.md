# PRD Phase 14: Projects and Isolated Workspaces

**Status**: Complete
**Sessions**: 5
**Estimated Duration**: 10-20 days

**Progress**: 5/5 sessions (100%)

---

## Overview

Add project-scoped workspaces with isolated memory, MEMORY.md, knowledge base, and prompt overrides. Each project gets its own sqlite-vec index, session transcripts, and workspace directory so conversations about different topics never cross-contaminate. Project switching via CLI flag (`crocbot --project <name>`) and Telegram command (`/project <name>`).

Currently everything is scoped by `agentId` with a 1:1 agent-to-workspace mapping. This phase layers a `projectId` dimension beneath the agent scope: `agent -> project -> {memory, sessions, workspace, prompts}`. A default project provides backward compatibility for existing agents.

---

## Progress Tracker

| Session | Name | Status | Est. Tasks | Validated |
|---------|------|--------|------------|-----------|
| 01 | Research and Architecture Design | Complete | 20 | 2026-02-16 |
| 02 | Project Configuration and Storage Layer | Complete | 20 | 2026-02-16 |
| 03 | Workspace and Memory Isolation | Complete | 20 | 2026-02-16 |
| 04 | CLI and Telegram Project Switching | Complete | 20 | 2026-02-16 |
| 05 | Integration Testing and Validation | Complete | 20 | 2026-02-16 |

---

## Completed Sessions

### Session 01: Research and Architecture Design
- **Completed**: 2026-02-16
- **Tasks**: 20/20
- **Deliverables**: ADR 0009, codebase audit, schema design, session plan refinements
- **Notes**: Research-only session. No code changes. Produced architecture decision record, annotated codebase audit of all files requiring modification, TypeScript type definitions design, and refined session 02-05 task distribution.

---

### Session 02: Project Configuration and Storage Layer
- **Completed**: 2026-02-16
- **Tasks**: 20/20
- **Deliverables**: ProjectConfig types, project-scope resolution functions, config extensions, unit tests
- **Notes**: First code-producing session. Created type definitions (ProjectConfig, ProjectMetadata, ProjectScopedPaths, ResolvedProjectContext), 10 exported functions in project-scope.ts, 59 unit tests. Extended AgentConfig and SessionEntry with project fields. Full backward compatibility maintained -- 5402 existing tests pass unchanged.

### Session 03: Workspace and Memory Isolation
- **Completed**: 2026-02-16
- **Tasks**: 20/20
- **Deliverables**: Project-scoped memory isolation, session transcript paths, MemoryIndexManager cache keying, auto-memorize and session-memory hook project awareness, integration tests
- **Notes**: Core isolation layer. Threaded `projectId` through `resolveStorePath`, `resolveMemorySearchConfig`, `MemoryIndexManager.get()`, `listSessionFilesForAgent`, `runAutoMemorize`, and session-memory hook handler. Default project delegates to agent-level paths for backward compatibility. 34 new tests (6 memory-search, 12 paths, 16 isolation). All 216 tests pass. Fixed 3 pre-existing Unicode ellipsis in manager.ts during validation.

### Session 04: CLI and Telegram Project Switching
- **Completed**: 2026-02-16
- **Tasks**: 20/20
- **Deliverables**: CLI --project flag, Telegram /project command (list/switch/create/current), 5 gateway JSON-RPC methods, extended session key format, project-aware prompt resolution, unit tests
- **Notes**: User-facing surface for project isolation. Created 6 new files (858 lines implementation, 858 lines tests). Extended session key format with backward-compatible project segment. Per-file prompt fallback from project to agent workspace. All 5554 tests pass.

### Session 05: Integration Testing and Validation
- **Completed**: 2026-02-16
- **Tasks**: 20/20
- **Deliverables**: Integration tests (lifecycle + backward-compat), extended unit tests (session-key, project-command, gateway projects), user-facing documentation, CONSIDERATIONS.md update
- **Notes**: Final validation session. Created 2 integration test files (45 tests) and extended 3 existing test files (+23 tests). Added user-facing documentation at docs/features/projects.md. Full audit: 763 test files, 5622 tests, zero build/lint errors, all files ASCII/LF.

---

## Objectives

1. Prevent cross-contamination between projects with full workspace isolation (memory, sessions, prompts)
2. Scope sqlite-vec memory indexes per project so recall only returns project-relevant memories
3. Enable seamless project switching via CLI flag and Telegram command with context propagation
4. Maintain backward compatibility -- existing agents work without configuration changes via a default project

---

## Prerequisites

- Phase 13 completed (Reasoning Model Support -- provides the full feature stack)
- Phase 11 model-role system available for per-project model selection
- Phase 12 memory consolidation available for per-project consolidation
- Existing multi-agent support in `src/agents/agent-scope.ts`
- Gateway agent CRUD API in `src/gateway/server-methods/agents.ts`

---

## Technical Considerations

### Architecture

**Current scope model**: Everything is scoped by `agentId`. Agent scope resolution (`resolveAgentWorkspaceDir`, `resolveAgentDir`, `resolveAgentConfig`) returns a single workspace per agent. MemoryIndexManager is constructed with `(agentId, workspaceDir, settings)` as cache key.

**Target model**: Add `projectId` as a second scope dimension beneath agent. Pattern: `{STATE_DIR}/agents/{agentId}/projects/{projectId}/` with subdirectories for `memory/`, `sessions/`, `workspace/`. Session key format extends to include project context.

**Key files to modify**:
- `src/agents/agent-scope.ts` -- project resolution functions
- `src/agents/memory-search.ts` -- `resolveMemorySearchConfig` needs `projectId` parameter
- `src/memory/manager.ts` -- MemoryIndexManager cache key includes `projectId`
- `src/config/sessions/paths.ts` -- project-scoped session storage
- `src/gateway/server-methods/agents.ts` -- extend for project awareness

**New files expected**:
- `src/config/types.projects.ts` -- Project type definitions
- `src/agents/project-scope.ts` -- Project resolution, switching, validation
- `src/gateway/server-methods/projects.ts` -- Project CRUD API methods

### Technologies
- SQLite (sqlite-vec) -- per-project memory indexes
- TypeScript strict mode with ESM
- grammy -- Telegram command handler for `/project`
- Commander.js -- CLI `--project` flag

### Risks
- **Migration complexity**: Existing agents have no project concept. Default project must silently wrap current behavior. Risk: edge cases in path resolution when projectId is undefined.
- **Memory index proliferation**: Each project creates a new sqlite-vec database. Risk: resource usage if many projects created. Mitigation: lazy initialization, only create index on first memory save.
- **Session key format change**: Adding project to session keys may break existing session routing. Mitigation: backward-compatible parsing that treats missing project as default project.
- **Workspace bootstrapping**: Each project needs its own MEMORY.md and prompt files. Risk: duplicated content, confusing defaults. Mitigation: minimal bootstrap (empty MEMORY.md, inherit agent-level prompts unless overridden).

### Relevant Considerations
- [P00] **Telegram-only channel registry + plugin system intact**: Project switching must work in both Telegram and CLI channels. Plugin system may need project context propagation.
- [P09] **Secrets masking pipeline**: Project-scoped credentials (if any) must be registered with SecretsRegistry. Initial scope: projects inherit agent-level secrets.
- [P12] **Memory consolidation**: Consolidation engine must operate within project scope -- consolidation only merges memories within the same project.
- [P13] **Reasoning trace storage**: Reasoning traces should be scoped to project for debugging. The `reasoning_traces` table needs a `project_id` column or project-scoped database.

---

## Success Criteria

Phase complete when:
- [x] All 5 sessions completed
- [x] Projects have isolated memory indexes (no cross-project recall)
- [x] Project switching works via CLI flag (`--project`) and Telegram command (`/project`)
- [x] Default project provides backward compatibility for existing agents
- [x] Per-project workspace with MEMORY.md and prompt overrides functional
- [x] Session transcripts scoped to active project
- [x] Memory consolidation operates within project scope
- [x] Gateway API supports project CRUD operations
- [x] All existing tests pass without modification (backward compatibility)

---

## Dependencies

### Depends On
- Phase 13: Reasoning Model Support (complete feature stack)
- Phase 11: 4-Model-Role Architecture (per-project model selection)
- Phase 12: AI-Powered Memory Consolidation (project-scoped consolidation)

### Enables
- Phase 15: Knowledge Base Import Pipeline (project-scoped knowledge storage)
