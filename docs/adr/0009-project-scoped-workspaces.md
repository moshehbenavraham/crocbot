# 9. Project-Scoped Workspaces

**Status:** Accepted
**Date:** 2026-02-16

## Context

Crocbot currently scopes all runtime state -- memory indexes, session transcripts, workspace files, and prompt overrides -- by a single `agentId` dimension. Each agent has exactly one workspace, one memory database, and one set of session transcripts. This 1:1 mapping prevents users from maintaining isolated contexts within the same agent. A developer using a single crocbot agent for multiple projects gets cross-contaminated memory results, interleaved session history, and no way to scope prompt instructions per project.

Phase 14 introduces `projectId` as a second scope dimension nested beneath the agent scope. Each agent can manage multiple isolated projects, where each project owns its own memory index, session transcripts, workspace directory, and system prompt overrides. This enables use cases like:

- A developer working on three codebases with the same agent, each with isolated memory
- A team agent that separates work contexts without creating separate agents
- Project-specific instructions and knowledge bases (Phase 15 prerequisite)

The design is informed by Agent Zero's `projects.py` reference implementation, which provides directory-based project isolation with metadata files, memory mode selection, and context activation/deactivation patterns.

## Decision

### 1. Scope nesting: agent -> project -> {memory, sessions, workspace}

Projects nest beneath agents, not alongside them. Every project belongs to exactly one agent. The scope hierarchy is:

```
agent:{agentId}
  project:{projectId}
    memory/        -- sqlite-vec database
    sessions/      -- transcript files
    workspace/     -- prompt files (SOUL.md, USER.md, etc.)
```

This preserves the existing agent-level scope for all cross-project operations (agent config, model selection, credentials, rate limiting) while isolating project-specific state.

### 2. Storage layout

Project data is stored under the agent's state directory:

```
{CROCBOT_STATE_DIR}/agents/{agentId}/projects/{projectId}/
  project.json                            -- metadata
  memory/{agentId}-{projectId}.sqlite     -- memory index
  sessions/sessions.json                  -- session store
  sessions/{sessionId}.jsonl              -- transcripts
  workspace/                              -- prompt override files
```

### 3. Default project backward compatibility

A "default" project is implicitly available for all existing agents without any configuration changes. When `projectId` is `undefined`, `null`, `""`, or `"default"`:

- Memory resolves to the existing agent-level path: `{STATE_DIR}/memory/{agentId}.sqlite`
- Sessions resolve to the existing path: `{STATE_DIR}/agents/{agentId}/sessions/`
- Workspace resolves to the existing agent workspace directory

No `projects/default/` directory is created. Existing agents continue to work identically.

### 4. Memory isolation modes

Each project specifies a memory mode:

- **"own"** (default): Separate sqlite-vec database in the project directory. Memory search, consolidation, and indexing operate within the project scope. The `MemoryIndexManager` INDEX_CACHE naturally differentiates instances because the `settings.store.path` differs.
- **"shared"**: Uses the agent-level memory database. Memory search returns results from all projects. Useful when project isolation is for workspace/session separation only.

### 5. Session key format unchanged

Session keys retain the existing `agent:{agentId}:{rest}` format. Project context is stored as metadata in the session store entry (`projectId` field), not embedded in the session key. This avoids modifying the 16+ functions that parse and build session keys across the codebase.

### 6. Lazy initialization

Project directories and databases are created on first use:
- `projects.create` RPC creates `project.json` and the top-level project directory
- Subdirectories (`memory/`, `sessions/`, `workspace/`) are created on demand when first accessed
- sqlite-vec databases are created when `MemoryIndexManager.get()` is first called for a project

### 7. Project-scoped prompt overrides

When a project is active, workspace file resolution checks the project workspace first, then falls back to the agent workspace:

```
project workspace/SOUL.md  >  agent workspace/SOUL.md  >  default
```

Project instructions from `ProjectMetadata.instructions` are injected into the system prompt as a dedicated context block.

### 8. Companion functions (not signature changes)

Existing agent-scope functions are NOT modified. New project-scoped companion functions are created alongside them:

| Existing | New Companion |
|----------|--------------|
| `resolveAgentWorkspaceDir(cfg, agentId)` | `resolveProjectWorkspaceDir(cfg, agentId, projectId?)` |
| `resolveAgentDir(cfg, agentId)` | `resolveProjectDir(cfg, agentId, projectId)` |
| `resolveMemorySearchConfig(cfg, agentId)` | `resolveProjectMemorySearchConfig(cfg, agentId, projectId?)` |
| `resolveSessionTranscriptsDirForAgent(agentId)` | `resolveProjectSessionsDir(agentId, projectId?)` |

When `projectId` is default, companion functions delegate to the existing functions.

## Consequences

### Enables

- Per-project memory isolation with separate sqlite-vec databases
- Per-project session transcript storage
- Per-project workspace files and prompt overrides
- Project activation/deactivation via Telegram (`/project`) and CLI (`--project`)
- Foundation for Phase 15 knowledge base import pipeline (per-project knowledge storage)
- Shared memory mode for agents that want project organization without memory isolation

### Preserves

- All existing agent-level behavior (zero changes for agents without projects)
- Session key format (no parsing changes)
- Memory consolidation engine (operates on injected database handle)
- Rate limiting, secrets masking, and model routing (agent-level, unchanged)
- All existing tests (no functional changes in this session)

### Trade-offs

- **Storage growth**: Each project with "own" memory creates an additional sqlite database. Mitigated by lazy initialization (databases created only when needed) and the "shared" mode option.
- **No default project directory**: The implicit default project has no on-disk representation. This simplifies backward compatibility but means there is no `project.json` for the default project. If a user later wants to configure the default project, they would need to create it explicitly.
- **Session key does not encode project**: Project context must be resolved from session metadata, adding one extra lookup step during session initialization. This is a minor performance cost traded for format stability.
- **Companion functions pattern**: Creates parallel function sets (agent-scope and project-scope). This avoids breaking changes but increases the API surface. The project-scope functions can eventually replace the agent-scope ones if the codebase migrates fully to project-aware paths.

### Dependencies

- Phase 11 (ADR-0006): Model role routing (per-project model overrides are a future enhancement)
- Phase 12 (ADR-0007): Memory consolidation (automatically project-scoped via database injection)
- Phase 13 (ADR-0008): Reasoning traces (may need `project_id` column in Session 03)
- Phase 15: Knowledge Base Import Pipeline (requires per-project storage from this design)
