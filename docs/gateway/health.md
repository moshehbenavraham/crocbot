---
summary: "Health check steps for channel connectivity"
read_when:
  - Diagnosing Telegram channel health
---
# Health Checks (CLI)

Short guide to verify channel connectivity without guessing.

## Quick checks
- `crocbot status` — local summary: gateway reachability/mode, update hint, linked channel auth age, sessions + recent activity.
- `crocbot status --all` — full local diagnosis (read-only, color, safe to paste for debugging).
- `crocbot status --deep` — also probes the running Gateway (per-channel probes when supported).
- `crocbot health --json` — asks the running Gateway for a full health snapshot.
- Send `/status` as a standalone message to get a status reply without invoking the agent.
- Logs: tail `/tmp/crocbot/crocbot-*.log` and filter for relevant channel events.

## Deep diagnostics
- Session store: `ls -l ~/.crocbot/agents/<agentId>/sessions/sessions.json` (path can be overridden in config). Count and recent recipients are surfaced via `status`.
- Relink flow: `crocbot channels logout && crocbot channels login --verbose` when authentication issues appear in logs.

## When something fails
- Authentication issues → relink with `crocbot channels logout` then `crocbot channels login`.
- Gateway unreachable → start it: `crocbot gateway --port 18789` (use `--force` if the port is busy).
- No inbound messages → confirm the sender is allowed (`channels.telegram.allowFrom`); for group chats, ensure allowlist + mention rules match (`channels.telegram.groups`, `agents.list[].groupChat.mentionPatterns`).

## Dedicated "health" command
`crocbot health --json` asks the running Gateway for its health snapshot (no direct channel sockets from the CLI). It reports linked creds/auth age when available, per-channel probe summaries, session-store summary, and a probe duration. It exits non-zero if the Gateway is unreachable or the probe fails/timeouts. Use `--timeout <ms>` to override the 10s default.
