# 🐊 Crocbot — Personal AI Assistant

> **v0.1.164**

<p align="center">
  <strong>Cold-blooded patience, chrome-laced synapses.</strong>
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

```bash
# Build the image (requires dist/ from pnpm build)
pnpm build
docker build -t crocbot:local .

# Start the gateway
docker compose up -d crocbot-gateway

# CLI access
docker compose run --rm crocbot-cli status
```

Environment variables (`ANTHROPIC_API_KEY`, `TELEGRAM_BOT_TOKEN`, etc.) are read from `.env` or exported. Volumes mount `~/.crocbot` (config) and `~/croc` (workspace).

See [`Dockerfile`](Dockerfile) and [`docker-compose.yml`](docker-compose.yml). Full docs: [Docker install](https://aiwithapex.mintlify.app/install/docker)

---

## Architecture

```
              Telegram
             (grammY bot)
                  |
                  v
     +------------------------+
     |        Gateway         |
     |   (WebSocket + HTTP)   |
     |  ws://127.0.0.1:18789  |
     +------------+-----------+
                  |
     +------+-----+------+---------+
     |      |            |         |
     v      v            v         v
  Agents  Sessions     Cron    MCP Server
  (Pi RT) (Storage)   (Jobs)  (SSE + HTTP)
     |                              ^
     +---> Model Router              |
     |    (reasoning / utility)   External AI
     +---> Rate Limiter + KeyPool  Systems
     |         |
     |    LLM Providers
     |   (Claude, GPT, Gemini)
     +---> MCP Client
     |    (stdio, SSE, HTTP)
     +---> Reasoning Adapter
     |    (reasoning_delta / tags)
     +---> Project Workspaces
     |    (isolated memory/prompts)
     +---> Knowledge Import
          (parse/chunk/embed/dedup)
```

The Gateway is the single control plane. Telegram messages flow in, get routed to agent sessions, and responses stream back. The CLI connects to the same Gateway over WebSocket. The Model Router classifies each LLM call as reasoning or utility and routes utility tasks (compaction, memory flush, heartbeat, consolidation) to a cheaper model. At session end, the auto-memorize pipeline extracts solutions, facts, and instruments from the conversation transcript and stores them as categorized memories. The consolidation engine deduplicates on every save via LLM-driven analysis. The MCP client connects to external tool servers (stdio/SSE/HTTP); MCP server mode exposes crocbot as infrastructure for other AI systems. The Reasoning Adapter handles native `reasoning_delta` streams from o1/o3, DeepSeek-R1, and Claude extended thinking, with tag-based fallback and dedicated trace storage. Project Workspaces provide isolated memory, prompts, and knowledge base per project, switchable via CLI (`--project`) or Telegram (`/project`). The Knowledge Import Pipeline ingests external documents and URLs via `crocbot knowledge import`, parsing (text, markdown, PDF, HTML), chunking with heading-aware boundaries, embedding, deduplicating, and storing into the project-scoped vector knowledge base with incremental re-import support.

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
- **[MCP integration](https://aiwithapex.mintlify.app/concepts/mcp)** — native MCP client (stdio/SSE/HTTP) and server mode with SSRF-guarded transports
- **[Memory system](https://aiwithapex.mintlify.app/concepts/memory)** — conversation memory with semantic search, AI-powered consolidation (dedup on save), 4-area categorization (facts, solutions, preferences, instruments), and auto-extraction of solutions/facts post-conversation
- **[Model roles](docs/concepts/model-roles)** — 2-role architecture (reasoning + utility) routes background tasks to cheap models for cost savings
- **[Rate limiting](docs/ARCHITECTURE)** — per-provider RPM/TPM throttling, API key round-robin rotation, transient error retry with backoff
- **[Reasoning models](docs/features/reasoning)** — native `reasoning_delta` parsing for o1/o3, DeepSeek-R1, Claude extended thinking; tag-based fallback; trace storage and budget tracking
- **[Project workspaces](docs/features/projects)** — isolated memory, prompts, and knowledge per project; CLI (`--project`) and Telegram (`/project`) switching
- **[Knowledge import](docs/features/knowledge-import)** — ingest URLs, PDFs, markdown, and text into project-scoped vector knowledge base with incremental re-import, deduplication, and heading-aware chunking
- **[Security layer](https://aiwithapex.mintlify.app/gateway/security)** — SSRF protection, path traversal validation, exec allowlisting, secrets masking, DM pairing

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
| `/project <name>` | Switch active project |
| `/help` | Show available commands |

Groups: configure `channels.telegram.groups` for allowlisting, mention gating, and activation modes.

Docs: [Telegram](https://aiwithapex.mintlify.app/channels/telegram) · [Groups](https://aiwithapex.mintlify.app/concepts/groups)

---

## Security Defaults

Crocbot connects to real messaging surfaces — treat inbound DMs as **untrusted input**.

- **DM pairing** (`dmPolicy="pairing"`) — unknown senders must pair before the bot responds
- **Exec allowlisting** — shell commands are gated by an allowlist; shell expansion blocked in safe binaries
- **SSRF protection** — private IP/hostname blocking on all outbound fetches, including IPv6-mapped bypass prevention
- **Secrets masking** — credentials never appear in logs, LLM context, or Telegram output
- **Security headers** — CSP, X-Frame-Options, nosniff, path traversal and null byte filtering on HTTP endpoints
- **Auth rate limiting** — sliding-window per-IP rate limiting with lockout on auth endpoints
- **Input validation** — oversized base64 rejection, bounded HTTP body reading, Unicode homoglyph detection
- **ACP tool safety** — dangerous tool deny list, safe-kind inference, auto-approval only for read/search operations
- **Runtime stability** — compaction deadlock prevention with safety timeouts, AsyncMutex session locking, bounded memory growth (diagnostic state, directory cache, shell buffers, abort maps), heartbeat hardening
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
| @modelcontextprotocol/sdk | MCP client and server |
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
# Local
pnpm build && node dist/index.js gateway

# Docker
pnpm build && docker build -t crocbot:local . && docker compose up -d
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
