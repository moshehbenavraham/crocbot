# 🐊 Crocbot — Personal AI Assistant

<p align="center">
  <strong>Cold-blooded patience, chrome-laced synapses.</strong>
</p>

<p align="center">
  <a href="https://github.com/moshehbenavraham/crocbot/actions/workflows/ci.yml?branch=main"><img src="https://img.shields.io/github/actions/workflow/status/moshehbenavraham/crocbot/ci.yml?branch=main&style=for-the-badge" alt="CI status"></a>
  <a href="https://github.com/moshehbenavraham/crocbot/releases"><img src="https://img.shields.io/github/v/release/moshehbenavraham/crocbot?include_prereleases&style=for-the-badge" alt="GitHub release"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge" alt="MIT License"></a>
</p>

**Crocbot** is a personal AI assistant you run on your own VPS. It answers you on **Telegram** via a full grammY bot integration, with an always-on **Gateway** control plane managing sessions, agents, tools, and automation.

Fork of [OpenClaw](https://openclaw.ai/), stripped down to **CLI + Telegram** for lean, single-user deployment.

[Repository](https://github.com/moshehbenavraham/crocbot) · [Docs](https://aiwithapex.mintlify.app) · [Getting Started](https://aiwithapex.mintlify.app/start/getting-started) · [Docker](https://aiwithapex.mintlify.app/install/docker)

---

## What is Crocbot?

Crocbot is a Telegram-first personal AI assistant that runs as a background service on your server. The Gateway is the always-on control plane — it manages your Telegram bot connection, agent sessions, cron jobs, webhooks, and tools. You interact with it via Telegram DMs/groups or the `crocbot` CLI.

---

## Quick Start

**Runtime:** Node >= 22

```bash
npm install -g crocbot@latest
# or: pnpm add -g crocbot@latest

crocbot onboard --install-daemon
```

The onboarding wizard walks through API keys, Telegram bot setup, workspace configuration, and skills. It installs the Gateway as a systemd user service so it stays running.

```bash
# Start the gateway manually (if not using the daemon)
crocbot gateway --port 18789 --verbose

# Send a message from the CLI
crocbot agent --message "Ship checklist" --thinking high
```

Full beginner guide: [Getting Started](https://aiwithapex.mintlify.app/start/getting-started) · Upgrading? [Update guide](https://aiwithapex.mintlify.app/install/updating) + `crocbot doctor`

---

## Install from Source

Prefer **pnpm** for source builds. Bun is optional for running TypeScript directly.

```bash
git clone https://github.com/moshehbenavraham/crocbot.git
cd crocbot

pnpm install
pnpm build

pnpm crocbot onboard --install-daemon

# Dev loop (auto-reload on TS changes)
pnpm gateway:watch
```

`pnpm crocbot ...` runs TypeScript directly via `tsx`. `pnpm build` produces `dist/` for the packaged `crocbot` binary.

---

## Docker

### Local testing

```bash
docker compose up -d crocbot-gateway

# CLI access
docker compose run --rm crocbot-cli status
```

Environment variables (`ANTHROPIC_API_KEY`, `TELEGRAM_BOT_TOKEN`, etc.) are read from `.env` or exported. Volumes mount `~/.crocbot` (config) and `~/croc` (workspace).

### Coolify production deployment

The repo includes a Coolify-optimized compose file:

```bash
# docker-compose.coolify.yml
# - Multi-stage build from Dockerfile
# - Persistent volume at /data
# - Health checks, memory limits, auto-restart
# - Set CROCBOT_GATEWAY_TOKEN + ANTHROPIC_API_KEY in Coolify UI
```

See [`Dockerfile`](Dockerfile), [`docker-compose.yml`](docker-compose.yml), and [`docker-compose.coolify.yml`](docker-compose.coolify.yml). Full docs: [Docker install](https://aiwithapex.mintlify.app/install/docker)

---

## Architecture

```
              Telegram
             (grammY bot)
                  │
                  ▼
     ┌────────────────────────┐
     │        Gateway         │
     │   (WebSocket + HTTP)   │
     │  ws://127.0.0.1:18789  │
     └────────────┬───────────┘
                  │
     ┌────────────┼────────────┐
     │            │            │
     ▼            ▼            ▼
  Agents      Sessions       Cron
  (Pi RT)     (Storage)     (Jobs)
     │
     ▼
    LLM Providers
  (Claude, GPT, Gemini, …)
```

The Gateway is the single control plane. Telegram messages flow in, get routed to agent sessions, and responses stream back. The CLI connects to the same Gateway over WebSocket.

Full architecture: [Architecture overview](https://aiwithapex.mintlify.app/concepts/architecture)

---

## Highlights

- **[Gateway control plane](https://aiwithapex.mintlify.app/gateway)** — single WebSocket + HTTP server for sessions, tools, events, presence, and config
- **[Telegram integration](https://aiwithapex.mintlify.app/channels/telegram)** — full grammY bot with groups, DMs, media support, and inline model selection
- **[Agent runtime](https://aiwithapex.mintlify.app/concepts/agent)** — Pi embedded runtime with tool streaming and block streaming (RPC mode)
- **[Browser automation](https://aiwithapex.mintlify.app/tools/browser)** — dedicated Chrome/Chromium via CDP with snapshots, actions, uploads, and profiles
- **[Cron scheduler](https://aiwithapex.mintlify.app/automation/cron-jobs)** + **[webhooks](https://aiwithapex.mintlify.app/automation/webhook)** — scheduled jobs and external triggers
- **[Skills platform](https://aiwithapex.mintlify.app/tools/skills)** — 31 bundled skills (weather, GitHub, Spotify, PDF, image gen, transcription, and more)
- **[Plugin system](https://aiwithapex.mintlify.app/tools/plugins)** — extensible runtime with SDK (`crocbot/plugin-sdk`)
- **[Multi-model support](https://aiwithapex.mintlify.app/concepts/models)** — Anthropic, OpenAI, Google Gemini, Bedrock, Ollama, OpenRouter, and more
- **[Media pipeline](https://aiwithapex.mintlify.app/nodes/images)** — image/audio/video processing with AI understanding and transcription
- **[Memory system](https://aiwithapex.mintlify.app/concepts/memory)** — conversation memory with semantic search
- **[Security layer](https://aiwithapex.mintlify.app/gateway/security)** — SSRF protection, path traversal validation, exec allowlisting, DM pairing

---

## Models

Crocbot supports multiple LLM providers with auth profile rotation and failover:

| Provider | Examples |
|----------|----------|
| **Anthropic** | Claude Opus, Sonnet, Haiku |
| **OpenAI** | GPT-4o, o3, Codex |
| **Google Gemini** | Gemini 2.5 Pro/Flash |
| **AWS Bedrock** | Claude via Bedrock |
| **Ollama** | Local models |
| **OpenRouter** | Multi-provider gateway |
| + more | GitHub Copilot, Moonshot, Qwen, Venice, … |

**Recommended:** Anthropic Pro/Max subscription + Opus for long-context strength and prompt-injection resistance.

Docs: [Models](https://aiwithapex.mintlify.app/concepts/models) · [Model failover](https://aiwithapex.mintlify.app/concepts/model-failover) · [Onboarding](https://aiwithapex.mintlify.app/start/onboarding)

---

## Configuration

Minimal `~/.crocbot/crocbot.json`:

```json5
{
  agent: {
    model: "anthropic/claude-opus-4-5"
  }
}
```

Key environment variables:

| Variable | Purpose |
|----------|---------|
| `CROCBOT_STATE_DIR` | Runtime state directory (config, credentials, logs, memory) |
| `CROCBOT_CONFIG_PATH` | Path to main config file |
| `CROCBOT_WORKSPACE` | Agent working directory (prompts, skills, hooks) |
| `ANTHROPIC_API_KEY` | Anthropic API key |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token |

Full reference: [Configuration](https://aiwithapex.mintlify.app/gateway/configuration)

---

## Telegram Setup

Set your bot token via environment or config:

```json5
{
  channels: {
    telegram: {
      botToken: "123456:ABCDEF"
    }
  }
}
```

Or set `TELEGRAM_BOT_TOKEN` in your environment (env takes precedence).

### DM security

Default: **pairing mode** — unknown senders receive a pairing code. Approve with:

```bash
crocbot pairing approve telegram <code>
```

### Chat commands

| Command | Description |
|---------|-------------|
| `/status` | Session status (model, tokens, cost) |
| `/new` / `/reset` | Reset the session |
| `/compact` | Compact session context (summary) |
| `/think <level>` | Set thinking level (off/minimal/low/medium/high/xhigh) |
| `/verbose on\|off` | Toggle verbose output |
| `/usage off\|tokens\|full` | Per-response usage footer |
| `/tts on\|off` | Control text-to-speech |
| `/skill <name>` | Run a skill by name |
| `/whoami` | Show your sender ID |
| `/help` | Show available commands |

Groups: configure `channels.telegram.groups` for allowlisting, mention gating, and activation modes.

Docs: [Telegram](https://aiwithapex.mintlify.app/channels/telegram) · [Groups](https://aiwithapex.mintlify.app/concepts/groups)

---

## Security Defaults

Crocbot connects to real messaging surfaces — treat inbound DMs as **untrusted input**.

- **DM pairing** (`dmPolicy="pairing"`) — unknown senders must pair before the bot responds
- **Exec allowlisting** — shell commands are gated by an allowlist
- **SSRF protection** — private IP/hostname blocking on all outbound fetches
- **Sandbox mode** — run non-main sessions (groups) in per-session Docker sandboxes
- **`crocbot doctor`** — audit tool that surfaces risky or misconfigured policies

Details: [Security](https://aiwithapex.mintlify.app/gateway/security) · [Sandboxing](https://aiwithapex.mintlify.app/install/docker)

---

## Agent Workspace & Skills

- **Workspace root:** `~/croc` (configurable via `agents.defaults.workspace`)
- **Prompt files:** `AGENTS.md`, `SOUL.md`, `USER.md`, `MEMORY.md`, `TOOLS.md`
- **Skills:** `~/croc/skills/<skill>/SKILL.md`
- **31 bundled skills** including weather, GitHub, Spotify, Notion, Trello, Obsidian, PDF generation, image generation, transcription, browser automation, and more

Docs: [Skills](https://aiwithapex.mintlify.app/tools/skills) · [Skills config](https://aiwithapex.mintlify.app/tools/skills-config)

---

## Tech Stack

| Technology | Purpose |
|------------|---------|
| Node.js 22+ | Runtime (ESM) |
| TypeScript (ES2023) | Strict mode, NodeNext modules |
| tsdown (rolldown) | Bundler (~5s builds) |
| pnpm | Package manager |
| grammY | Telegram SDK |
| Vitest | Testing |
| oxlint + oxfmt | Lint + format (Rust-based, fast) |

---

## Development

| Command | Description |
|---------|-------------|
| `pnpm install` | Install dependencies |
| `pnpm build` | Production build (~5s via tsdown) |
| `pnpm gateway:watch` | Dev loop with auto-reload |
| `pnpm check` | Type check + lint + format |
| `pnpm lint` | Lint (oxlint, type-aware) |
| `pnpm lint:fix` | Auto-fix lint issues |
| `pnpm format` | Check formatting (oxfmt) |
| `pnpm format:fix` | Auto-fix formatting |
| `pnpm test` | Run all tests (Vitest, parallel) |
| `pnpm test:e2e` | End-to-end tests |
| `pnpm test:coverage` | Coverage report |
| `pnpm docs:dev` | Local Mintlify docs server |

### Commit convention

Use [conventional commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`). The repo provides a scoped staging helper:

```bash
scripts/committer "feat: add cron retry logic" src/cron/retry.ts
```

### Deploy

```bash
pnpm build && systemctl --user restart crocbot-gateway
systemctl --user status crocbot-gateway
```

Docs: [Development reference](https://aiwithapex.mintlify.app/reference/development)

---

## Documentation

- [Getting started](https://aiwithapex.mintlify.app/start/getting-started) — onboarding flow
- [Architecture](https://aiwithapex.mintlify.app/concepts/architecture) — gateway + protocol model
- [Configuration](https://aiwithapex.mintlify.app/gateway/configuration) — full reference (all keys + examples)
- [Telegram](https://aiwithapex.mintlify.app/channels/telegram) — bot setup, groups, media
- [Security](https://aiwithapex.mintlify.app/gateway/security) — DM policies, sandboxing, exec guards
- [Models](https://aiwithapex.mintlify.app/concepts/models) — provider setup, failover, rotation
- [Skills](https://aiwithapex.mintlify.app/tools/skills) — bundled, managed, and workspace skills
- [Browser](https://aiwithapex.mintlify.app/tools/browser) — CDP automation
- [Cron & webhooks](https://aiwithapex.mintlify.app/automation/cron-jobs) — scheduled jobs, triggers
- [Docker](https://aiwithapex.mintlify.app/install/docker) — container deployment
- [Troubleshooting](https://aiwithapex.mintlify.app/channels/troubleshooting) — common failures
- [Doctor](https://aiwithapex.mintlify.app/gateway/doctor) — health audit tool
- [Platform: Linux](https://aiwithapex.mintlify.app/platforms/linux) — VPS deployment guide

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines, branch conventions, and how to submit PRs.

AI-assisted PRs welcome.

---

## License & Attribution

[MIT License](LICENSE) — Copyright (c) 2025 Peter Steinberger

Forked from [OpenClaw](https://openclaw.ai/) ([github.com/openclaw/openclaw](https://github.com/openclaw/openclaw)). Crocbot is an independent fork stripped down for single-user Telegram deployment.
