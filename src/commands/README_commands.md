# src/commands/

High-level CLI command implementations. Each command is invoked by the CLI layer (`src/cli/`).

## Structure

```
commands/
  agent/                    # Agent-specific subcommands
  channels/                 # Channel management commands
  gateway-status/           # Gateway status display
  models/                   # Model listing and selection
  onboard-non-interactive/  # Non-interactive onboarding
    local/                  # Local environment onboarding
  onboarding/               # Interactive onboarding flow
    __tests__/              # Onboarding tests
  status-all/               # Full system status
```

## Key Files

| File                  | Purpose                          |
| --------------------- | -------------------------------- |
| `agent.ts`            | Single agent invocation          |
| `agents.ts`           | Multi-agent management           |
| `configure.wizard.ts` | Interactive configuration wizard |
| `dashboard.ts`        | Status dashboard display         |
| `doctor.ts`           | Health check and diagnostics     |
| `status.command.ts`   | Status command entry point       |
| `status.scan.ts`      | System status scanning           |
| `onboard-helpers.ts`  | Onboarding utility functions     |

## Related

- CLI argument parsing: `src/cli/`
- Wizard flows: `src/wizard/`
