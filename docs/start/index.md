---
summary: "Top-level overview of crocbot, features, and purpose"
read_when:
  - Introducing crocbot to newcomers
---
# crocbot 🐊

> *"Cold-blooded patience, chrome-laced synapses."* — The crocodile in the datastream

<p align="center">
  <img src="/assets/showcase/pr-review-telegram.jpg" alt="crocbot on Telegram" width="420" />
</p>

<p align="center">
  <strong>Telegram gateway for AI agents (Pi).</strong><br />
  Send a message, get an agent response.
</p>

<p align="center">
  <a href="https://github.com/moshehbenavraham/crocbot">GitHub</a> ·
  <a href="https://github.com/moshehbenavraham/crocbot/releases">Releases</a> ·
  <a href="/">Docs</a> ·
  <a href="/start/croc">crocbot assistant setup</a>
</p>

crocbot bridges Telegram (Bot API / grammY) to coding agents like [Pi](https://github.com/badlogic/pi-mono).

# THS IS A FORK OF OPENCLAW ()

## Start here

- **New install from zero:** [Getting Started](/start/getting-started)
- **Guided setup (recommended):** [Wizard](/start/wizard) (`crocbot onboard`)
- **Open the dashboard (local Gateway):** http://127.0.0.1:18789/ (or http://localhost:18789/)

If the Gateway is running on the same computer, that link opens the browser Control UI
immediately. If it fails, start the Gateway first: `crocbot gateway`.

## Dashboard (browser Control UI)

The dashboard is the browser Control UI for chat, config, nodes, sessions, and more.
Local default: http://127.0.0.1:18789/
Remote access: [Web surfaces](/web) and [Tailscale](/gateway/tailscale)

## How it works

```
              Telegram
                 │
                 ▼
  ┌───────────────────────────┐
  │          Gateway          │  ws://127.0.0.1:18789 (loopback-only)
  │     (single source)       │
  └───────────┬───────────────┘
              │
              ├─ Pi agent (RPC)
              ├─ CLI (crocbot ...)
              └─ WebChat UI
```

Most operations flow through the **Gateway** (`crocbot gateway`), a single long-running process that owns the Telegram connection and the WebSocket control plane.

## Network model

- **One Gateway per host (recommended)**: If you need a rescue bot or strict isolation, run multiple gateways with isolated profiles and ports; see [Multiple gateways](/gateway/multiple-gateways).
- **Loopback-first**: Gateway WS defaults to `ws://127.0.0.1:18789`.
  - The wizard now generates a gateway token by default (even for loopback).
  - For Tailnet access, run `crocbot gateway --bind tailnet --token ...` (token is required for non-loopback binds).
- **Remote use**: SSH tunnel or tailnet/VPN; see [Remote access](/gateway/remote) and [Discovery](/gateway/discovery).

## Features (high level)

- **Telegram Bot** - DMs + groups via grammY
- **Agent bridge** - Pi (RPC mode) with tool streaming
- **Streaming + chunking** - Block streaming + Telegram draft streaming details ([/concepts/streaming](/concepts/streaming))
- **Multi-agent routing** - Route peers to isolated agents (workspace + per-agent sessions)
- **Subscription auth** - Anthropic (Claude Pro/Max) + OpenAI (ChatGPT/Codex) via OAuth
- **Sessions** - Direct chats collapse into shared `main` (default); groups are isolated
- **Group Chat Support** - Mention-based by default; owner can toggle `/activation always|mention`
- **Media Support** - Send and receive images, audio, documents
- **Voice notes** - Optional transcription hook
- **WebChat** - Local UI for chat and ops

Note: legacy Claude/Codex/Gemini/Opencode paths have been removed; Pi is the only coding-agent path.

## Quick start

Runtime requirement: **Node ≥ 22**.

```bash
# Recommended: global install (npm/pnpm)
npm install -g crocbot@latest
# or: pnpm add -g crocbot@latest

# Onboard + install the service (launchd/systemd user service)
crocbot onboard --install-daemon

# Gateway runs via the service after onboarding; manual run is still possible:
crocbot gateway --port 18789
```

Switching between npm and git installs later is easy: install the other flavor and run `crocbot doctor` to update the gateway service entrypoint.

From source (development):

```bash
git clone https://github.com/moshehbenavraham/crocbot.git
cd crocbot
pnpm install
pnpm ui:build # auto-installs UI deps on first run
pnpm build
crocbot onboard --install-daemon
```

If you don’t have a global install yet, run the onboarding step via `pnpm crocbot ...` from the repo.

Multi-instance quickstart (optional):

```bash
CROCBOT_CONFIG_PATH=~/.crocbot/a.json \
CROCBOT_STATE_DIR=~/.crocbot-a \
crocbot gateway --port 19001
```

Send a test message (requires a running Gateway):

```bash
crocbot message send --channel telegram --target @your_username --message "Hello from crocbot"
```

## Configuration (optional)

Config lives at `~/.crocbot/crocbot.json`.

- If you **do nothing**, crocbot uses the bundled Pi binary in RPC mode with per-sender sessions.
- If you want to lock it down, start with `channels.telegram.allowFrom` and (for groups) mention rules.

Example:

```json5
{
  channels: {
    telegram: {
      botToken: "123456:ABCDEF",
      allowFrom: ["123456789"],
      groups: { "*": { requireMention: true } }
    }
  },
  messages: { groupChat: { mentionPatterns: ["@croc"] } }
}
```

## Docs

- Start here:
  - [Docs hubs (all pages linked)](/start/hubs)
  - [Help](/help) ← *common fixes + troubleshooting*
  - [Configuration](/gateway/configuration)
  - [Configuration examples](/gateway/configuration-examples)
  - [Slash commands](/tools/slash-commands)
  - [Multi-agent routing](/concepts/multi-agent)
  - [Updating / rollback](/install/updating)
  - [Nix mode](/install/nix)
  - [crocbot assistant setup (Croc)](/start/croc)
  - [Skills](/tools/skills)
  - [Skills config](/tools/skills-config)
  - [Workspace templates](/reference/templates/AGENTS)
  - [RPC adapters](/reference/rpc)
  - [Gateway runbook](/gateway)
  - [Nodes](/nodes)
  - [Web surfaces (Control UI)](/web)
  - [Discovery + transports](/gateway/discovery)
  - [Remote access](/gateway/remote)
- Providers and UX:
  - [WebChat](/web/webchat)
  - [Control UI (browser)](/web/control-ui)
  - [Telegram](/channels/telegram)
  - [Groups](/concepts/groups)
  - [Group messages](/concepts/group-messages)
  - [Media: images](/nodes/images)
  - [Media: audio](/nodes/audio)
- Platform guides:
  - [Windows (WSL2)](/platforms/windows)
  - [Linux](/platforms/linux)
- Ops and safety:
  - [Sessions](/concepts/session)
  - [Cron jobs](/automation/cron-jobs)
  - [Webhooks](/automation/webhook)
  - [Gmail hooks (Pub/Sub)](/automation/gmail-pubsub)
  - [Security](/gateway/security)
  - [Troubleshooting](/gateway/troubleshooting)

## The name

**crocbot = CROC + BOT** — Nature's apex predator, jacked into the grid. 200 million years of evolution + sub-second API calls.

---

*"We're all just playing with our own prompts."* — an AI, probably high on tokens

## Credits

- **Peter Steinberger** ([@steipete](https://twitter.com/steipete)) — Creator, crocodile whisperer
- **Mario Zechner** ([@badlogicc](https://twitter.com/badlogicgames)) — Pi creator, security pen-tester
- **Croc** — The chrome crocodile who was already waiting

## Core Contributors

- **Maxim Vovshin** (@Hyaxia, 36747317+Hyaxia@users.noreply.github.com) — Blogwatcher skill
- **Nacho Iacovino** (@nachoiacovino) — Location parsing

## License

MIT — Patient as a crocodile in the datastream 🐊

---

*"We're all just playing with our own prompts."* — An AI, probably high on tokens
