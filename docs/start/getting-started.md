---
summary: "Beginner guide: from zero to first message (wizard, auth, channels, pairing)"
read_when:
  - First time setup from zero
  - You want the fastest path from install → onboarding → first message
---

# Getting Started

Goal: go from **zero** → **first working chat** (with sane defaults) as quickly as possible.

Fastest chat: open the Control UI (no channel setup needed). Run `crocbot dashboard`
and chat in the browser, or open `http://127.0.0.1:18789/` on the gateway host.
Docs: [Dashboard](/web/dashboard) and [Control UI](/web/control-ui).

Recommended path: use the **CLI onboarding wizard** (`crocbot onboard`). It sets up:
- model/auth (OAuth recommended)
- gateway settings
- Telegram channel
- pairing defaults (secure DMs)
- workspace bootstrap + skills
- optional background service

If you want the deeper reference pages, jump to: [Wizard](/start/wizard), [Setup](/start/setup), [Pairing](/start/pairing), [Security](/gateway/security).

Sandboxing note: `agents.defaults.sandbox.mode: "non-main"` uses `session.mainKey` (default `"main"`),
so group/channel sessions are sandboxed. If you want the main agent to always
run on host, set an explicit per-agent override:

```json
{
  "routing": {
    "agents": {
      "main": {
        "workspace": "~/croc",
        "sandbox": { "mode": "off" }
      }
    }
  }
}
```

## 0) Prereqs

- Node `>=22`
- `pnpm` (optional; recommended if you build from source)
- **Recommended:** Brave Search API key for web search. Easiest path:
  `crocbot configure --section web` (stores `tools.web.search.apiKey`).
  See [Web tools](/tools/web).

Windows: use **WSL2** (Ubuntu recommended). WSL2 is strongly recommended; native Windows is untested, more problematic, and has poorer tool compatibility. Install WSL2 first, then run the Linux steps inside WSL. See [Windows (WSL2)](/platforms/windows).

## 1) Install the CLI (recommended)

```bash
curl -fsSL https://github.com/moshehbenavraham/crocbot/install.sh | bash
```

Installer options (install method, non-interactive, from GitHub): [Install](/install).

Windows (PowerShell):

```powershell
iwr -useb https://github.com/moshehbenavraham/crocbot/install.ps1 | iex
```

Alternative (global install):

```bash
npm install -g crocbot@latest
```

```bash
pnpm add -g crocbot@latest
```

## 2) Run the onboarding wizard (and install the service)

```bash
crocbot onboard --install-daemon
```

What you'll choose:
- **Local vs Remote** gateway
- **Auth**: OpenAI Code (Codex) subscription (OAuth) or API keys. For Anthropic we recommend an API key; `claude setup-token` is also supported.
- **Telegram**: bot token from BotFather
- **Daemon**: background install (systemd; WSL2 uses systemd)
  - **Runtime**: Node (recommended). Bun is **not recommended**.
- **Gateway token**: the wizard generates one by default (even on loopback) and stores it in `gateway.auth.token`.

Wizard doc: [Wizard](/start/wizard)

### Auth: where it lives (important)

- **Recommended Anthropic path:** set an API key (wizard can store it for service use). `claude setup-token` is also supported if you want to reuse Claude Code credentials.

- OAuth credentials (legacy import): `~/.crocbot/credentials/oauth.json`
- Auth profiles (OAuth + API keys): `~/.crocbot/agents/<agentId>/agent/auth-profiles.json`

Headless/server tip: do OAuth on a normal machine first, then copy `oauth.json` to the gateway host.

## 3) Start the Gateway

If you installed the service during onboarding, the Gateway should already be running:

```bash
crocbot gateway status
```

Manual run (foreground):

```bash
crocbot gateway --port 18789 --verbose
```

Dashboard (local loopback): `http://127.0.0.1:18789/`
If a token is configured, paste it into the Control UI settings (stored as `connect.params.auth.token`).

Note: **Node** is the recommended runtime for the Gateway.

## 3.5) Quick verify (2 min)

```bash
crocbot status
crocbot health
crocbot security audit --deep
```

## 4) Connect Telegram

### Telegram bot token

The wizard can write tokens/config for you. If you prefer manual config:
- Create a bot via [@BotFather](https://t.me/BotFather) on Telegram
- Set `TELEGRAM_BOT_TOKEN` or add to config: `channels.telegram.botToken`
- Telegram doc: [Telegram](/channels/telegram)

**Telegram DM tip:** your first DM returns a pairing code. Approve it (see next step) or the bot won't respond.

## 5) DM safety (pairing approvals)

Default posture: unknown DMs get a short code and messages are not processed until approved.
If your first DM gets no reply, approve the pairing:

```bash
crocbot pairing list telegram
crocbot pairing approve telegram <code>
```

Pairing doc: [Pairing](/start/pairing)

## From source (development)

If you’re hacking on crocbot itself, run from source:

```bash
git clone https://github.com/moshehbenavraham/crocbot.git
cd crocbot
pnpm install
pnpm ui:build # auto-installs UI deps on first run
pnpm build
crocbot onboard --install-daemon
```

If you don’t have a global install yet, run the onboarding step via `pnpm crocbot ...` from the repo.
`pnpm build` also bundles A2UI assets; if you need to run just that step, use `pnpm canvas:a2ui:bundle`.

Gateway (from this repo):

```bash
node dist/entry.js gateway --port 18789 --verbose
```

## 7) Verify end-to-end

In a new terminal, send a test message:

```bash
crocbot message send --target +15555550123 --message "Hello from crocbot"
```

If `crocbot health` shows “no auth configured”, go back to the wizard and set OAuth/key auth — the agent won’t be able to respond without it.

Tip: `crocbot status --all` is the best pasteable, read-only debug report.
Health probes: `crocbot health` (or `crocbot status --deep`) asks the running gateway for a health snapshot.

## Next steps (optional, but great)

- Remote access (SSH tunnel / Tailscale Serve): [Remote access](/gateway/remote) and [Tailscale](/gateway/tailscale)
- VPS hosting: [exe.dev](/platforms/exe-dev), [Hetzner](/platforms/hetzner), [Fly.io](/platforms/fly)
