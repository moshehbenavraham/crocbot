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

## Related

- Agent configuration: `src/config/`
- Session management: `src/sessions/`
- Compiled extensions output: `/pi-extensions/`
