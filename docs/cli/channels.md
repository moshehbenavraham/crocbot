---
summary: "CLI reference for `crocbot channels` (accounts, status, login/logout, logs)"
read_when:
  - You want to add/remove channel accounts (Telegram)
  - You want to check channel status or tail channel logs
---

# `crocbot channels`

Manage chat channel accounts and their runtime status on the Gateway.

Related docs:
- Channel guides: [Channels](/channels/index)
- Gateway configuration: [Configuration](/gateway/configuration)

## Common commands

```bash
crocbot channels list
crocbot channels status
crocbot channels capabilities
crocbot channels capabilities --channel telegram
crocbot channels logs --channel all
```

## Add / remove accounts

```bash
crocbot channels add --channel telegram --token <bot-token>
crocbot channels remove --channel telegram --delete
```

Tip: `crocbot channels add --help` shows per-channel flags.

## Troubleshooting

- Run `crocbot status --deep` for a broad probe.
- Use `crocbot doctor` for guided fixes.
- `crocbot channels list` prints `Claude: HTTP 403 ... user:profile` -> usage snapshot needs the `user:profile` scope. Use `--no-usage`, or provide a claude.ai session key (`CLAUDE_WEB_SESSION_KEY` / `CLAUDE_WEB_COOKIE`), or re-auth via Claude Code CLI.

## Capabilities probe

Fetch provider capability hints plus static feature support:

```bash
crocbot channels capabilities
crocbot channels capabilities --channel telegram
```

Notes:
- `--channel` is optional; omit it to list every channel (including extensions).
- Probes are provider-specific: Telegram bot flags + webhook. Channels without probes report `Probe: unavailable`.
