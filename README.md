# 🐊 Crocbot — Personal AI Assistant

<p align="center">
  <strong>Cold-blooded patience, chrome-laced synapses.</strong>
</p>

<p align="center">
  <a href="https://github.com/moshehbenavraham/crocbot/actions/workflows/ci.yml?branch=main"><img src="https://img.shields.io/github/actions/workflow/status/moshehbenavraham/crocbot/ci.yml?branch=main&style=for-the-badge" alt="CI status"></a>
  <a href="https://github.com/moshehbenavraham/crocbot/releases"><img src="https://img.shields.io/github/v/release/moshehbenavraham/crocbot?include_prereleases&style=for-the-badge" alt="GitHub release"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge" alt="MIT License"></a>
</p>

**Crocbot** is a *personal AI assistant* you run on your own VPS or server.
It answers you on Telegram with full bot integration via grammY. The Gateway is the control plane for your always-on assistant.

**This is a Fork of the OpenClaw Project:  https://openclaw.ai/**

If you want a personal, single-user assistant that is lean, fast, and always-on, this is it.

[Repository](https://github.com/moshehbenavraham/crocbot) · [Docs](https://aiwithapex.mintlify.app) · [Getting Started](https://aiwithapex.mintlify.app/start/getting-started) · [Docker](https://aiwithapex.mintlify.app/install/docker)

Preferred setup: run the onboarding wizard (`crocbot onboard`). It walks through gateway, workspace, Telegram configuration, and skills. The CLI wizard is the recommended path and works on **Linux and Windows (via WSL2; strongly recommended)**.
Works with npm, pnpm, or bun.
New install? Start here: [Getting started](https://aiwithapex.mintlify.app/start/getting-started)

**Subscriptions (OAuth):**
- **[Anthropic](https://www.anthropic.com/)** (Claude Pro/Max)
- **[OpenAI](https://openai.com/)** (ChatGPT/Codex)

Model note: while any model is supported, I strongly recommend **Anthropic Pro/Max (100/200) + Opus 4.5** for long‑context strength and better prompt‑injection resistance. See [Onboarding](https://aiwithapex.mintlify.app/start/onboarding).

## Models (selection + auth)

- Models config + CLI: [Models](https://aiwithapex.mintlify.app/concepts/models)
- Auth profile rotation (OAuth vs API keys) + fallbacks: [Model failover](https://aiwithapex.mintlify.app/concepts/model-failover)

## Install (recommended)

Runtime: **Node ≥22**.

```bash
npm install -g crocbot@latest
# or: pnpm add -g crocbot@latest

crocbot onboard --install-daemon
```

The wizard installs the Gateway daemon (launchd/systemd user service) so it stays running.
Legacy note: `crocbot` remains available as a compatibility shim.

## Quick start (TL;DR)

Runtime: **Node ≥22**.

Full beginner guide (auth, pairing, channels): [Getting started](https://aiwithapex.mintlify.app/start/getting-started)

```bash
crocbot onboard --install-daemon

crocbot gateway --port 18789 --verbose

# Talk to the assistant (optionally deliver back to Telegram)
crocbot agent --message "Ship checklist" --thinking high
```

Upgrading? [Updating guide](https://aiwithapex.mintlify.app/install/updating) (and run `crocbot doctor`).

## Development channels

- **stable**: tagged releases (`vYYYY.M.D` or `vYYYY.M.D-<patch>`), npm dist-tag `latest`.
- **beta**: prerelease tags (`vYYYY.M.D-beta.N`), npm dist-tag `beta` (macOS app may be missing).
- **dev**: moving head of `main`, npm dist-tag `dev` (when published).

Switch channels (git + npm): `crocbot update --channel stable|beta|dev`.
Details: [Development channels](https://aiwithapex.mintlify.app/install/development-channels).

## From source (development)

Prefer `pnpm` for builds from source. Bun is optional for running TypeScript directly.

```bash
git clone https://github.com/moshehbenavraham/crocbot.git
cd crocbot

pnpm install
pnpm ui:build # auto-installs UI deps on first run
pnpm build

pnpm crocbot onboard --install-daemon

# Dev loop (auto-reload on TS changes)
pnpm gateway:watch
```

Note: `pnpm crocbot ...` runs TypeScript directly (via `tsx`). `pnpm build` produces `dist/` for running via Node / the packaged `crocbot` binary.

## Security defaults (DM access)

Crocbot connects to real messaging surfaces. Treat inbound DMs as **untrusted input**.

Full security guide: [Security](https://aiwithapex.mintlify.app/gateway/security)

Default behavior on Telegram:
- **DM pairing** (`dmPolicy="pairing"`): unknown senders receive a short pairing code and the bot does not process their message.
- Approve with: `crocbot pairing approve telegram <code>` (then the sender is added to a local allowlist store).
- Public inbound DMs require an explicit opt-in: set `dmPolicy="open"` and include `"*"` in `channels.telegram.allowFrom`.

Run `crocbot doctor` to surface risky/misconfigured DM policies.

## Highlights

- **[Local-first Gateway](https://aiwithapex.mintlify.app/gateway)** - single control plane for sessions, Telegram, tools, and events.
- **[Telegram integration](https://aiwithapex.mintlify.app/channels/telegram)** - full bot integration via grammY with groups, DMs, and media support.
- **[Multi-agent routing](https://aiwithapex.mintlify.app/gateway/configuration)** - route inbound messages to isolated agents (workspaces + per-agent sessions).
- **[First-class tools](https://aiwithapex.mintlify.app/tools)** - browser, cron, sessions, and automation.
- **[Onboarding](https://aiwithapex.mintlify.app/start/wizard) + [skills](https://aiwithapex.mintlify.app/tools/skills)** - wizard-driven setup with bundled/managed/workspace skills.

## Everything we built so far

### Core platform
- [Gateway WS control plane](https://aiwithapex.mintlify.app/gateway) with sessions, presence, config, cron, webhooks, and [Control UI](https://aiwithapex.mintlify.app/web).
- [CLI surface](https://aiwithapex.mintlify.app/tools/agent-send): gateway, agent, send, [wizard](https://aiwithapex.mintlify.app/start/wizard), and [doctor](https://aiwithapex.mintlify.app/gateway/doctor).
- [Pi agent runtime](https://aiwithapex.mintlify.app/concepts/agent) in RPC mode with tool streaming and block streaming.
- [Session model](https://aiwithapex.mintlify.app/concepts/session): `main` for direct chats, group isolation, activation modes, queue modes, reply-back. Group rules: [Groups](https://aiwithapex.mintlify.app/concepts/groups).
- [Media pipeline](https://aiwithapex.mintlify.app/nodes/images): images/audio/video, transcription hooks, size caps, temp file lifecycle. Audio details: [Audio](https://aiwithapex.mintlify.app/nodes/audio).

### Channels
- [Telegram](https://aiwithapex.mintlify.app/channels/telegram) (grammY) - full bot integration with groups, DMs, and media support.
- [Group routing](https://aiwithapex.mintlify.app/concepts/group-messages): mention gating, reply tags, chunking and routing.

### Tools + automation
- [Browser control](https://aiwithapex.mintlify.app/tools/browser): dedicated croc Chrome/Chromium, snapshots, actions, uploads, profiles.
- [Cron + wakeups](https://aiwithapex.mintlify.app/automation/cron-jobs); [webhooks](https://aiwithapex.mintlify.app/automation/webhook); [Gmail Pub/Sub](https://aiwithapex.mintlify.app/automation/gmail-pubsub).
- [Skills platform](https://aiwithapex.mintlify.app/tools/skills): bundled, managed, and workspace skills with install gating + UI.

### Runtime + safety
- [Channel routing](https://aiwithapex.mintlify.app/concepts/channel-routing), [retry policy](https://aiwithapex.mintlify.app/concepts/retry), and [streaming/chunking](https://aiwithapex.mintlify.app/concepts/streaming).
- [Presence](https://aiwithapex.mintlify.app/concepts/presence), [typing indicators](https://aiwithapex.mintlify.app/concepts/typing-indicators), and [usage tracking](https://aiwithapex.mintlify.app/concepts/usage-tracking).
- [Models](https://aiwithapex.mintlify.app/concepts/models), [model failover](https://aiwithapex.mintlify.app/concepts/model-failover), and [session pruning](https://aiwithapex.mintlify.app/concepts/session-pruning).
- [Security](https://aiwithapex.mintlify.app/gateway/security) and [troubleshooting](https://aiwithapex.mintlify.app/channels/troubleshooting).

### Ops + packaging
- [Control UI](https://aiwithapex.mintlify.app/web) + [WebChat](https://aiwithapex.mintlify.app/web/webchat) served directly from the Gateway.
- [Tailscale Serve/Funnel](https://aiwithapex.mintlify.app/gateway/tailscale) or [SSH tunnels](https://aiwithapex.mintlify.app/gateway/remote) with token/password auth.
- [Nix mode](https://aiwithapex.mintlify.app/install/nix) for declarative config; [Docker](https://aiwithapex.mintlify.app/install/docker)-based installs.
- [Doctor](https://aiwithapex.mintlify.app/gateway/doctor) migrations, [logging](https://aiwithapex.mintlify.app/logging).

## How it works (short)

```
                Telegram
                   │
                   ▼
┌───────────────────────────────┐
│            Gateway            │
│       (control plane)         │
│     ws://127.0.0.1:18789      │
└──────────────┬────────────────┘
               │
               ├─ Pi agent (RPC)
               ├─ CLI (crocbot ...)
               └─ WebChat UI
```

## Key subsystems

- **[Gateway WebSocket network](https://aiwithapex.mintlify.app/concepts/architecture)** - single WS control plane for clients, tools, and events (plus ops: [Gateway runbook](https://aiwithapex.mintlify.app/gateway)).
- **[Tailscale exposure](https://aiwithapex.mintlify.app/gateway/tailscale)** - Serve/Funnel for the Gateway dashboard + WS (remote access: [Remote](https://aiwithapex.mintlify.app/gateway/remote)).
- **[Browser control](https://aiwithapex.mintlify.app/tools/browser)** - croc-managed Chrome/Chromium with CDP control.

## Tailscale access (Gateway dashboard)

Crocbot can auto-configure Tailscale **Serve** (tailnet-only) or **Funnel** (public) while the Gateway stays bound to loopback. Configure `gateway.tailscale.mode`:

- `off`: no Tailscale automation (default).
- `serve`: tailnet-only HTTPS via `tailscale serve` (uses Tailscale identity headers by default).
- `funnel`: public HTTPS via `tailscale funnel` (requires shared password auth).

Notes:
- `gateway.bind` must stay `loopback` when Serve/Funnel is enabled (Crocbot enforces this).
- Serve can be forced to require a password by setting `gateway.auth.mode: "password"` or `gateway.auth.allowTailscale: false`.
- Funnel refuses to start unless `gateway.auth.mode: "password"` is set.
- Optional: `gateway.tailscale.resetOnExit` to undo Serve/Funnel on shutdown.

Details: [Tailscale guide](https://aiwithapex.mintlify.app/gateway/tailscale) · [Web surfaces](https://aiwithapex.mintlify.app/web)

## Remote Gateway (Linux VPS)

Running the Gateway on a small Linux VPS is the recommended deployment. Clients (CLI, WebChat) can connect over **Tailscale Serve/Funnel** or **SSH tunnels**.

- **Gateway host** runs the exec tool and Telegram connection.

Details: [Remote access](https://aiwithapex.mintlify.app/gateway/remote) · [Security](https://aiwithapex.mintlify.app/gateway/security)

## Agent to Agent (sessions_* tools)

- Use these to coordinate work across sessions without jumping between chat surfaces.
- `sessions_list` — discover active sessions (agents) and their metadata.
- `sessions_history` — fetch transcript logs for a session.
- `sessions_send` — message another session; optional reply‑back ping‑pong + announce step (`REPLY_SKIP`, `ANNOUNCE_SKIP`).

Details: [Session tools](https://aiwithapex.mintlify.app/concepts/session-tool)

## Chat commands

Send these in Telegram or WebChat (group commands are owner-only):

- `/status` — compact session status (model + tokens, cost when available)
- `/new` or `/reset` — reset the session
- `/compact` — compact session context (summary)
- `/think <level>` — off|minimal|low|medium|high|xhigh (GPT-5.2 + Codex models only)
- `/verbose on|off`
- `/usage off|tokens|full` — per-response usage footer
- `/restart` — restart the gateway (owner-only in groups)
- `/activation mention|always` — group activation toggle (groups only)

## Agent workspace + skills

- Workspace root: `~/croc` (configurable via `agents.defaults.workspace`).
- Injected prompt files: `AGENTS.md`, `SOUL.md`, `TOOLS.md`.
- Skills: `~/croc/skills/<skill>/SKILL.md`.

## Configuration

Minimal `~/.crocbot/crocbot.json` (model + defaults):

```json5
{
  agent: {
    model: "anthropic/claude-opus-4-5"
  }
}
```

[Full configuration reference (all keys + examples).](https://aiwithapex.mintlify.app/gateway/configuration)

## Security model (important)

- **Default:** tools run on the host for the **main** session, so the agent has full access when it's just you.
- **Group/channel safety:** set `agents.defaults.sandbox.mode: "non-main"` to run **non-main sessions** (groups) inside per-session Docker sandboxes; bash then runs in Docker for those sessions.
- **Sandbox defaults:** allowlist `bash`, `process`, `read`, `write`, `edit`, `sessions_list`, `sessions_history`, `sessions_send`, `sessions_spawn`; denylist `browser`, `cron`, `gateway`.

Details: [Security guide](https://aiwithapex.mintlify.app/gateway/security) · [Docker + sandboxing](https://aiwithapex.mintlify.app/install/docker) · [Sandbox config](https://aiwithapex.mintlify.app/gateway/configuration)

### [Telegram](https://aiwithapex.mintlify.app/channels/telegram)

- Set `TELEGRAM_BOT_TOKEN` or `channels.telegram.botToken` (env wins).
- Optional: set `channels.telegram.groups` (with `channels.telegram.groups."*".requireMention`); when set, it is a group allowlist (include `"*"` to allow all). Also `channels.telegram.allowFrom` or `channels.telegram.webhookUrl` as needed.

```json5
{
  channels: {
    telegram: {
      botToken: "123456:ABCDEF"
    }
  }
}
```

### [WebChat](https://aiwithapex.mintlify.app/web/webchat)

- Uses the Gateway WebSocket; no separate WebChat port/config.

Browser control (optional):

```json5
{
  browser: {
    enabled: true,
    color: "#FF4500"
  }
}
```

## Docs

Use these when you’re past the onboarding flow and want the deeper reference.
- [Start with the docs index for navigation and “what’s where.”](https://aiwithapex.mintlify.app)
- [Read the architecture overview for the gateway + protocol model.](https://aiwithapex.mintlify.app/concepts/architecture)
- [Use the full configuration reference when you need every key and example.](https://aiwithapex.mintlify.app/gateway/configuration)
- [Run the Gateway by the book with the operational runbook.](https://aiwithapex.mintlify.app/gateway)
- [Learn how the Control UI/Web surfaces work and how to expose them safely.](https://aiwithapex.mintlify.app/web)
- [Understand remote access over SSH tunnels or tailnets.](https://aiwithapex.mintlify.app/gateway/remote)
- [Follow the onboarding wizard flow for a guided setup.](https://aiwithapex.mintlify.app/start/wizard)
- [Wire external triggers via the webhook surface.](https://aiwithapex.mintlify.app/automation/webhook)
- [Set up Gmail Pub/Sub triggers.](https://aiwithapex.mintlify.app/automation/gmail-pubsub)
- [Platform guides: Windows (WSL2)](https://aiwithapex.mintlify.app/platforms/windows), [Linux](https://aiwithapex.mintlify.app/platforms/linux)
- [Debug common failures with the troubleshooting guide.](https://aiwithapex.mintlify.app/channels/troubleshooting)
- [Review security guidance before exposing anything.](https://aiwithapex.mintlify.app/gateway/security)

## Advanced docs (discovery + control)

- [Discovery + transports](https://aiwithapex.mintlify.app/gateway/discovery)
- [Bonjour/mDNS](https://aiwithapex.mintlify.app/gateway/bonjour)
- [Gateway pairing](https://aiwithapex.mintlify.app/gateway/pairing)
- [Remote gateway README](https://aiwithapex.mintlify.app/gateway/remote-gateway-readme)
- [Control UI](https://aiwithapex.mintlify.app/web/control-ui)
- [Dashboard](https://aiwithapex.mintlify.app/web/dashboard)

## Operations & troubleshooting

- [Health checks](https://aiwithapex.mintlify.app/gateway/health)
- [Gateway lock](https://aiwithapex.mintlify.app/gateway/gateway-lock)
- [Background process](https://aiwithapex.mintlify.app/gateway/background-process)
- [Browser troubleshooting (Linux)](https://aiwithapex.mintlify.app/tools/browser-linux-troubleshooting)
- [Logging](https://aiwithapex.mintlify.app/logging)

## Deep dives

- [Agent loop](https://aiwithapex.mintlify.app/concepts/agent-loop)
- [Presence](https://aiwithapex.mintlify.app/concepts/presence)
- [TypeBox schemas](https://aiwithapex.mintlify.app/concepts/typebox)
- [RPC adapters](https://aiwithapex.mintlify.app/reference/rpc)
- [Queue](https://aiwithapex.mintlify.app/concepts/queue)

## Workspace & skills

- [Skills config](https://aiwithapex.mintlify.app/tools/skills-config)
- [Default AGENTS](https://aiwithapex.mintlify.app/reference/AGENTS.default)
- [Templates: AGENTS](https://aiwithapex.mintlify.app/reference/templates/AGENTS)
- [Templates: BOOTSTRAP](https://aiwithapex.mintlify.app/reference/templates/BOOTSTRAP)
- [Templates: IDENTITY](https://aiwithapex.mintlify.app/reference/templates/IDENTITY)
- [Templates: SOUL](https://aiwithapex.mintlify.app/reference/templates/SOUL)
- [Templates: TOOLS](https://aiwithapex.mintlify.app/reference/templates/TOOLS)
- [Templates: USER](https://aiwithapex.mintlify.app/reference/templates/USER)

## Platform guides

- [Linux](https://aiwithapex.mintlify.app/platforms/linux)

## Email hooks (Gmail)

- [aiwithapex.mintlify.app/gmail-pubsub](https://aiwithapex.mintlify.app/automation/gmail-pubsub)

## Community

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines, maintainers, and how to submit PRs.
AI/vibe-coded PRs welcome! 🤖

Special thanks to all contributors!  May this project grow and stay open-source and serve the public well!
