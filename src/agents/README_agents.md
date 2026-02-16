# src/agents/

Pi agent runtime — the core AI execution engine. Manages agent sessions, tool invocation, and LLM provider communication.

## Structure

```
agents/
  auth-profiles/        # Auth profile management for LLM providers
  cli-runner/           # CLI-based agent runner
  pi-embedded-helpers/  # Helper utilities for embedded Pi runtime
  pi-embedded-runner/   # Embedded Pi agent runner (RPC mode)
    run/                # Run-loop implementation
  pi-extensions/        # Pi extension source (compiled to /pi-extensions/)
    context-pruning/    # Context window pruning logic
  sandbox/              # Docker sandbox for non-main sessions
  schema/               # TypeBox schemas for agent configuration
  skills/               # Skill discovery and loading
  test-helpers/         # Agent-specific test utilities
  tools/                # Agent tool definitions and implementations
```

## Key Concepts

- **Pi Runtime** — the agent execution loop based on `@mariozechner/pi-agent-core`
- **RPC Mode** — agents communicate with the gateway over JSON-RPC
- **Tool Streaming** — tools emit results as they execute
- **Session Repair** — crash-resilient transcript and file recovery (`session-transcript-repair.ts`, `session-file-repair.ts`)
- **Model Routing** — 2-role architecture (reasoning + utility) routes background tasks to cheap models (`model-router.ts`, `task-classifier.ts`, `model-roles.ts`)

## Memory Consolidation

The agent integrates with the memory consolidation system via two pathways:

- **Consolidation engine** (`src/memory/consolidation.ts`) -- When a new memory chunk is stored, the engine finds similar existing chunks using vector search, asks the utility model to decide an action (MERGE, REPLACE, KEEP_SEPARATE, UPDATE, SKIP), and applies it atomically. All decisions are logged to `consolidation_log` for audit.
- **Auto-memorize lifecycle hook** (`src/memory/auto-memorize.ts`) -- At session end, extracts problem/solution pairs, key facts, and tool references from the conversation transcript. Three extraction types run independently via `Promise.allSettled` (partial failures do not block others). Each type checks budget before calling the utility model, skipping gracefully when rate-limited. Extracted items are stored with area metadata (solutions, fragments, instruments) and trigger consolidation for dedup.

All consolidation and extraction LLM calls use `taskType: "consolidation"` to route through the utility model role (cheap model), not the reasoning model.

## Related

- Agent configuration: `src/config/`
- Session management: `src/sessions/`
- Memory subsystem: `src/memory/`
- Compiled extensions output: `/pi-extensions/`
