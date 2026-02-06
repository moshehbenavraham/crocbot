# src/cli/

CLI entry point and argument parsing for the `crocbot` binary.

## Structure

```
cli/
  browser-cli-actions-input/  # Browser action CLI input handling
  cron-cli/                   # Cron management CLI
  daemon-cli/                 # Daemon (systemd/launchd) management
  gateway-cli/                # Gateway control CLI
  node-cli/                   # Node management CLI
  nodes-cli/                  # Multi-node management
  program/                    # Commander.js program definition
    message/                  # Message subcommand
```

## Key Files

| File | Purpose |
|------|---------|
| `argv.ts` | CLI argument parsing and validation |
| `banner.ts` | ASCII banner and CLI output formatting |
| `channel-auth.ts` | Channel authentication flow |
| `acp-cli.ts` | ACP protocol CLI interactions |
| `browser-cli.ts` | Browser debugging CLI |

## Usage

```bash
crocbot gateway          # Start the gateway
crocbot agent            # Run agent commands
crocbot onboard          # Interactive setup wizard
crocbot doctor           # Health check
crocbot status           # Show current status
```

## Related

- Command implementations: `src/commands/`
- Program definition: `src/cli/program/`
