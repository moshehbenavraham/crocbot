---
summary: "CLI reference for `crocbot doctor` (health checks + guided repairs)"
read_when:
  - You have connectivity/auth issues and want guided fixes
  - You updated and want a sanity check
---

# `crocbot doctor`

Health checks + quick fixes for the gateway and channels.

Related:
- Troubleshooting: [Troubleshooting](/gateway/troubleshooting)
- Security audit: [Security](/gateway/security)

## Examples

```bash
crocbot doctor
crocbot doctor --repair
crocbot doctor --deep
```

Notes:
- Interactive prompts (like keychain/OAuth fixes) only run when stdin is a TTY and `--non-interactive` is **not** set. Headless runs (cron, Telegram, no terminal) will skip prompts.
- `--fix` (alias for `--repair`) writes a backup to `~/.crocbot/crocbot.json.bak` and drops unknown config keys, listing each removal.

## Environment overrides

If you set environment variables like `CROCBOT_GATEWAY_TOKEN` or `CROCBOT_GATEWAY_PASSWORD`, those values override your config file and can cause persistent "unauthorized" errors. Check and clear these if needed.
