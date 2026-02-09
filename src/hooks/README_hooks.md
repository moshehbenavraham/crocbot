# src/hooks/

Hook system — lifecycle hooks that execute at key points during agent operation.

## Structure

```
hooks/
  bundled/              # Built-in hooks shipped with crocbot
    boot-md/            # Injects boot markdown into sessions
    command-logger/     # Logs executed commands
    session-memory/     # Persists session memory across restarts
    soul-evil/          # Personality/soul injection hook
```

## How Hooks Work

Hooks are functions that run at specific lifecycle points:

- **Pre-message** — before the agent processes a message
- **Post-message** — after the agent responds
- **Boot** — when a session starts
- **Compaction** — during context compaction

## Bundled Hooks

| Hook             | Purpose                                                     |
| ---------------- | ----------------------------------------------------------- |
| `boot-md`        | Injects workspace markdown files (AGENTS.md, SOUL.md, etc.) |
| `command-logger` | Logs all executed commands for auditing                     |
| `session-memory` | Saves and restores session memory                           |
| `soul-evil`      | Personality injection (configurable tone/style)             |

## Related

- Hook metadata is copied during build: `scripts/copy-hook-metadata.ts`
- Plugin hooks: `src/plugins/`
