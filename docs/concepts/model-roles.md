---
title: Model Roles
description: Route different task types to specialized models for cost optimization and latency reduction.
---

# Model Roles

Model roles let you assign different LLM models to different task types. The primary reasoning model handles user-facing conversations, while a cheaper utility model handles background tasks like compaction, memory flushing, and heartbeat checks.

## Architecture

The model roles system has three layers:

1. **Configuration** -- `agents.defaults.model.roles` maps role names to provider/model pairs
2. **Classification** -- each LLM call site declares a fixed task type; the classifier maps it to a role
3. **Routing** -- the model router resolves the role to a concrete provider/model pair

```
  Task Type          Role          Provider/Model
  ---------          ----          --------------
  reasoning    -->   reasoning --> anthropic/claude-sonnet-4-5  (primary)
  compaction   -->   utility   --> openai/gpt-4o-mini           (configured)
  memory-flush -->   utility   --> openai/gpt-4o-mini           (configured)
  heartbeat    -->   utility   --> openai/gpt-4o-mini           (configured)
  llm-task     -->   utility   --> openai/gpt-4o-mini           (configured)
```

## Task Types

| Task Type      | Role        | Description |
|---------------|-------------|-------------|
| `reasoning`    | reasoning   | User-facing agent turns (chat, cron jobs, followup) |
| `compaction`   | utility     | Context window compaction (summarization) |
| `memory-flush` | utility     | Memory indexing and flush operations |
| `heartbeat`    | utility     | Periodic heartbeat checks |
| `llm-task`     | utility     | Generic LLM tasks from plugins |

## Configuration

Add the `roles` key under `agents.defaults.model` in your config:

### String shorthand

```json5
{
  agents: {
    defaults: {
      model: {
        primary: "anthropic/claude-sonnet-4-5",
        roles: {
          utility: "openai/gpt-4o-mini"
        }
      }
    }
  }
}
```

### Object form with params

```json5
{
  agents: {
    defaults: {
      model: {
        primary: "anthropic/claude-sonnet-4-5",
        roles: {
          utility: {
            model: "openai/gpt-4o-mini",
            params: { temperature: 0.1 }
          }
        }
      }
    }
  }
}
```

### Both roles configured

```json5
{
  agents: {
    defaults: {
      model: {
        primary: "anthropic/claude-sonnet-4-5",
        roles: {
          reasoning: "anthropic/claude-opus-4-6",
          utility: "openai/gpt-4o-mini"
        }
      }
    }
  }
}
```

## Fallback Behavior

When a role is not configured or references an invalid model, the system falls back to the primary reasoning model (`agents.defaults.model.primary`):

- **No `roles` key** -- all tasks use the primary model (zero-config backward compatible)
- **Empty `roles: {}`** -- same as no roles; all tasks use primary
- **Invalid model reference** -- falls back to primary (e.g. `"invalid-no-slash"`)
- **Utility not configured** -- utility tasks use the primary model
- **Reasoning not configured** -- reasoning tasks always use the primary model

This means existing deployments without roles configuration continue to work with zero behavioral change.

## Rate Limiting

When per-provider rate limiting is enabled, the model router passes the resolved role as a label to the rate limiter middleware. This provides per-role visibility in rate limit logs:

```
rate-limit usage recorded: provider=openai tokens=150 role=utility
rate-limit usage recorded: provider=anthropic tokens=500 role=reasoning
```

Usage is tracked per provider (not per role), so utility and reasoning calls to the same provider share the same RPM/TPM budget.

## Related

- [Models](/concepts/models) -- model catalog and configuration
- [Model Selection](/concepts/model-selection) -- how models are selected for agent turns
- [Model Failover](/concepts/model-failover) -- fallback chains when models are unavailable
- [ADR-0006: 4-Model Role Architecture](/adr/0006-4-model-role-architecture) -- architecture decision record
