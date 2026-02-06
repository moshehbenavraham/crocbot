# src/config/

Configuration loading, parsing, and validation for crocbot.

## Structure

```
config/
  sessions/         # Session-specific configuration
```

## Key Files

| File | Purpose |
|------|---------|
| `config.ts` | Main configuration loader |
| `config-paths.ts` | Safe path resolution for config files |
| `agent-limits.ts` | Agent concurrency and rate limits |
| `commands.ts` | Command configuration definitions |
| `channel-capabilities.ts` | Feature availability per channel |
| `defaults.ts` | Default configuration values |

## Configuration Files

The primary config file is `crocbot.json`, located at `CROCBOT_CONFIG_PATH` (typically `~/.crocbot/crocbot.json`). It uses JSON5 syntax and contains:

- `agent` — model selection, workspace, sandbox settings
- `channels.telegram` — bot token, groups, allowlists
- `gateway` — port, bind, auth, Tailscale
- `skills` — enabled skills list
- `plugins` — plugin configuration

## Related

- Config reference: [Gateway configuration docs](https://aiwithapex.mintlify.app/gateway/configuration)
- Environment variables: `.env` file at project root
