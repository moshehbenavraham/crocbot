---
summary: "First-run onboarding flow for crocbot CLI"
read_when:
  - Understanding the onboarding process
  - Implementing auth or identity setup
---
# Onboarding (CLI)

This doc describes the **current** first-run onboarding flow. The goal is a
smooth "day 0" experience: configure the Gateway, connect auth, run the
wizard, and let the agent bootstrap itself.

## Onboarding flow

Run the onboarding wizard:

```bash
crocbot onboard --install-daemon
```

The wizard walks through:

1. **Gateway configuration** - Set up the gateway bind, port, and token
2. **Auth setup** - Configure Anthropic OAuth or API keys
3. **Telegram bot setup** - Configure your Telegram bot token
4. **Service installation** - Install the gateway as a launchd/systemd user service

## Auth setup

### Anthropic OAuth (Claude Pro/Max)

The CLI supports Anthropic OAuth (PKCE flow):

```bash
crocbot auth login --provider anthropic
```

This opens the browser for OAuth and writes credentials to `~/.clawdbot/credentials/oauth.json`.

### API Keys

Alternatively, configure API keys via environment variables or config:

```bash
crocbot config set anthropic.apiKey "sk-ant-..."
```

## Telegram bot configuration

Configure your Telegram bot token:

```bash
crocbot config set channels.telegram.botToken "123456:ABCDEF"
```

See [Telegram setup](/channels/telegram) for full details.

## Agent bootstrap ritual

On the first agent run, crocbot bootstraps a workspace (default `~/clawd`):

- Seeds `AGENTS.md`, `BOOTSTRAP.md`, `IDENTITY.md`, `USER.md`
- Runs a short Q&A ritual (one question at a time)
- Writes identity + preferences to `IDENTITY.md`, `USER.md`, `SOUL.md`
- Removes `BOOTSTRAP.md` when finished so it only runs once

## Remote mode notes

When the Gateway runs on another machine, credentials and workspace files live
**on that host**. Create:

- `~/.clawdbot/credentials/oauth.json`
- `~/.clawdbot/agents/<agentId>/agent/auth-profiles.json`

on the gateway host.
