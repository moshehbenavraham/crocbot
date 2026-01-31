---
summary: "Setup guide: keep your crocbot setup tailored while staying up-to-date"
read_when:
  - Setting up a new machine
  - You want “latest + greatest” without breaking your personal setup
---

# Setup

Last updated: 2026-01-01

## TL;DR
- **Tailoring lives outside the repo:** `~/croc` (workspace) + `~/.crocbot/crocbot.json` (config).
- **Stable workflow:** run `crocbot onboard --install-daemon` and let the service manage the Gateway.
- **Bleeding edge workflow:** run the Gateway via `pnpm gateway:watch`, then use the Control UI or TUI.

## Prereqs (from source)
- Node `>=22`
- `pnpm`
- Docker (optional; only for containerized setup/e2e — see [Docker](/install/docker))

## Tailoring strategy (so updates don’t hurt)

If you want “100% tailored to me” *and* easy updates, keep your customization in:

- **Config:** `~/.crocbot/crocbot.json` (JSON/JSON5-ish)
- **Workspace:** `~/croc` (skills, prompts, memories; make it a private git repo)

Bootstrap once:

```bash
crocbot setup
```

If you don’t have a global install yet, run it via `pnpm crocbot setup`.

## Stable workflow (CLI + service)

1) Install crocbot (npm/pnpm or from source).
2) Run onboarding and install the user service:

```bash
crocbot onboard --install-daemon
```

3) Link surfaces (example: Telegram):

```bash
crocbot channels login
```

4) Sanity check:

```bash
crocbot health
```

## Bleeding edge workflow (Gateway in a terminal)

Goal: work on the TypeScript Gateway, get hot reload, keep the UI attached.

### 1) Start the dev Gateway

```bash
pnpm install
pnpm gateway:watch
```

`gateway:watch` runs the gateway in watch mode and reloads on TypeScript changes.

### 2) Open a UI

- Control UI: http://127.0.0.1:18789/
- TUI: `crocbot tui`

### Common footguns
- **Wrong port:** Gateway WS defaults to `ws://127.0.0.1:18789`; keep UI + CLI on the same port.
- **Where state lives:**
  - Credentials: `~/.crocbot/credentials/`
  - Sessions: `~/.crocbot/agents/<agentId>/sessions/`
  - Logs: `/tmp/crocbot/`

## Credential storage map

Use this when debugging auth or deciding what to back up:

- **Telegram bot token**: config/env or `channels.telegram.tokenFile`
- **Model auth profiles**: `~/.crocbot/agents/<agentId>/agent/auth-profiles.json`
- **Legacy OAuth import**: `~/.crocbot/credentials/oauth.json`

More detail: [Security](/gateway/security#credential-storage-map).

## Updating (without wrecking your setup)

- Keep `~/croc` and `~/.crocbot/` as “your stuff”; don’t put personal prompts/config into the `crocbot` repo.
- Updating source: `git pull` + `pnpm install` (when lockfile changed) + keep using `pnpm gateway:watch`.

## Linux (systemd user service)

Linux installs use a systemd **user** service. By default, systemd stops user
services on logout/idle, which kills the Gateway. Onboarding attempts to enable
lingering for you (may prompt for sudo). If it’s still off, run:

```bash
sudo loginctl enable-linger $USER
```

For always-on or multi-user servers, consider a **system** service instead of a
user service (no lingering needed). See [Gateway runbook](/gateway) for the systemd notes.

## Related docs

- [Gateway runbook](/gateway) (flags, supervision, ports)
- [Gateway configuration](/gateway/configuration) (config schema + examples)
- [Telegram](/channels/telegram) (reply tags + replyToMode settings)
- [crocbot assistant setup](/start/croc)
