# Crocbot Deployment Log

## Environment

| Component | Value |
|-----------|-------|
| OS | Ubuntu 24.04.3 LTS on WSL2 (kernel 6.6.87.2) |
| Node.js | v22.22.0 |
| pnpm | 10.23.0 |
| Version | `2026.1.46` |
| Approach | From-source (not Docker) |

---

## Session 1: Initial Build (2026-01-30)

### Build Issues Fixed

| Issue | Fix |
|-------|-----|
| `types.clawdbot.ts` not found | Renamed to `types.crocbot.ts` |
| Duplicate property in `loader.ts` | Removed duplicate line |
| Duplicate bin entry in `package.json` | Removed duplicate |
| `packages/clawdbot/` directory | Renamed to `packages/crocbot/` |
| Legacy compat layer causing TS errors | Deleted `src/compat/` entirely |

**Build command:** `pnpm build` ✅

---

## Session 2: Onboarding (2026-01-30)

### Configuration Summary

| Setting | Value |
|---------|-------|
| Workspace | `/home/aiwithapex/croc` |
| Model | `openai-codex/gpt-5.1-codex-mini` |
| Gateway | `ws://127.0.0.1:34219` (loopback, token auth) |
| Tailscale | Off |
| Agent | `main` (default) |

### Agent Identity

| Field | Value |
|-------|-------|
| Name | **Krox** |
| Creature | Gunmetal crocodile, exposed circuitry, CRT eyes |
| User | Max (Israel timezone) |
| Emoji | 🐊 |

### Hooks Enabled
- `boot-md` - Load context on session start
- `command-logger` - Log agent commands
- `session-memory` - Persist session context

### Systemd Service
```bash
# Service file
~/.config/systemd/user/crocbot-gateway.service

# Commands
systemctl --user start|stop|restart|status crocbot-gateway
```

---

## Session 3: Post-Deployment Fixes (2026-01-31)

| Fix | Command/Action |
|-----|----------------|
| Gateway token was `"undefined"` | Regenerated with `crypto.randomBytes(32)` |
| pnpm global bin missing | `pnpm config set global-bin-dir ~/.local/share/pnpm` |
| State dir permissions | `chmod 700 ~/.crocbot` |
| OAuth dir missing | `mkdir -p ~/.crocbot/credentials && chmod 700` |
| bird/mcporter install failed | `pnpm install -g @steipete/bird mcporter` |

---

## Session 4: Telegram Plugin Restoration (2026-01-31)

### Problem
`crocbot configure --section channels` showed "telegram plugin not available" because the `extensions/telegram/` directory was deleted in commit `af3ee9cee` during the extensions removal phase.

### Fix Applied

1. **Restored `extensions/telegram/`** from git history:
   ```
   extensions/telegram/
   ├── crocbot.plugin.json
   ├── index.ts
   ├── package.json
   └── src/
       ├── channel.ts
       └── runtime.ts
   ```

2. **Updated `pnpm-workspace.yaml`** - added `extensions/*`

3. **Updated `src/plugins/config-state.ts`** - added `"telegram"` to `BUNDLED_ENABLED_BY_DEFAULT`

4. **Rebuilt:** `pnpm install && pnpm build`

### Authorization Fix

Initial `dmPolicy: "pairing"` blocked all messages with "You are not authorized".

**Config change** (`~/.crocbot/crocbot.json`):
```json
"channels": {
  "telegram": {
    "dmPolicy": "allowlist",
    "allowFrom": ["1415494277"],
    ...
  }
}
```

---

## Session 5: Skills Allowlist Fix (2026-02-01)

### Problem
32 skills registered but many were irrelevant for Telegram-only deployment (canvas, discord, slack, etc.) or had missing binaries (spogo, summarize).

### Analysis

**Installed binaries (working):**
- `bird`, `mcporter`, `gh`, `curl`, `python3`, `jq`, `rg`, `ffmpeg`, `tmux`, `uv`, `whisper`, `himalaya`, `ordercli`, `gifgrep`, `gog`, `goplaces`, `nano-pdf`, `obsidian-cli`, `sag`, `songsee`

**Missing binaries:**
- `spogo` (spotify-player) - not installed
- `summarize` (summarize) - not installed

**Skills auto-filtered by config requirements:**
- `discord` - needs `channels.discord`
- `slack` - needs `channels.slack`
- `voice-call` - needs `plugins.entries.voice-call.enabled`

### Fix Applied

Added `skills.allowBundled` to `~/.crocbot/crocbot.json` to only load useful skills:

```json
"skills": {
  "allowBundled": [
    "bird", "coding-agent", "gifgrep", "github", "goplaces",
    "himalaya", "local-places", "nano-banana-pro", "nano-pdf",
    "notion", "openai-image-gen", "openai-whisper-api", "sag",
    "session-logs", "skill-creator", "tmux", "trello", "weather"
  ]
}
```

**Excluded skills:** canvas (needs native nodes), discord, slack, voice-call (wrong channels), food-order, gog, obsidian, songsee, spotify-player, summarize, video-frames, mcporter, openai-whisper

### Result
Skills reduced from 32 to 18 active. Gateway restarts cleanly.

---

## Session 6: Extensions Restoration (2026-02-01)

### Extensions Restored
Restored 9 extensions from git history (`af3ee9cee^`):

| Category | Extensions |
|----------|------------|
| Providers | copilot-proxy, google-antigravity-auth, google-gemini-cli-auth |
| Memory | memory-lancedb |
| Tools | voice-call, lobster, llm-task, open-prose |
| Diagnostics | diagnostics-otel |

### Extensions Status

| Extension | Enabled | Ready | Notes |
|-----------|---------|-------|-------|
| telegram | ✅ | ✅ | Running as `@KroxTheBot` |
| memory-lancedb | ✅ | ✅ | Auto-capture, auto-recall |
| lobster | ✅ | ⚠️ | Needs `lobster` binary |
| copilot-proxy | ❌ | - | GitHub Copilot token proxy |
| google-antigravity-auth | ❌ | - | Google experimental AI auth |
| google-gemini-cli-auth | ❌ | - | Gemini CLI OAuth |
| voice-call | ❌ | - | Twilio/Telnyx/Plivo calling |
| llm-task | ❌ | - | JSON-only LLM tasks |
| open-prose | ❌ | - | OpenProse writing assistant |
| diagnostics-otel | ❌ | - | OpenTelemetry exporter |

### Other Changes
- Created `upstream-extensions-catalog.md` documenting all 29 original extensions
- Removed `docs/ongoing-projects/` from `.gitignore` (now tracked by git)
- Bumped version to `2026.1.46`, committed and pushed all changes

---

## Known Issues

### pnpm Global Binaries in Systemd
Node-based skills (bird, mcporter) may fail with "node: not found" if systemd service doesn't include correct PATH.

**Workaround:** The systemd service should source the user's shell profile or explicitly set PATH to include `~/.local/share/pnpm` and linuxbrew paths.

---

## Current Status: ✅ OPERATIONAL

| Component | Status |
|-----------|--------|
| Version | `2026.1.46` |
| Gateway | Running on `ws://127.0.0.1:34219` |
| Telegram | Connected as `@KroxTheBot` |
| Model | `openai-codex/gpt-5.1-codex-mini` |
| Concurrency | 2 agents / 4 subagents |
| Skills | 18 active (allowlist configured) |
| Plugins | memory-lancedb, lobster enabled |
| Extensions | 10 total (telegram + 9 restored) |

---

## Quick Reference

```bash
# Health check
pnpm crocbot health

# Start TUI
pnpm crocbot tui

# View dashboard
pnpm crocbot dashboard

# Configure
pnpm crocbot configure

# Diagnostics
pnpm crocbot doctor

# Gateway service
systemctl --user status crocbot-gateway
systemctl --user restart crocbot-gateway
```

---

## Session 7: Pending Fixes (2026-02-01)

### Issues Found

| Issue | Fix | Status |
|-------|-----|--------|
| Node v22.0.0, requires >=22.12.0 | `nvm install 22`, renamed old `~/.local/bin/node` | ✅ v22.22.0 |
| `punycode` deprecation warning | Fixed by Node upgrade | ✅ |
| Systemd used old Node path | Updated to `/home/aiwithapex/.nvm/versions/node/v22.22.0/bin/node` | ✅ |
| `models scan` requires `OPENROUTER_API_KEY` | Use manual fallback config or set key | Pending |

### Model Fallbacks (Manual Config)

`models scan` requires OpenRouter. To configure fallbacks manually, edit `~/.crocbot/crocbot.json`:

```json
{
  "agents": {
    "defaults": {
      "model": {
        "primary": "openai-codex/gpt-5.1-codex-mini",
        "fallbacks": ["anthropic/claude-opus-4-5"]
      }
    }
  }
}
```

Or use CLI:
```bash
pnpm crocbot models fallbacks add anthropic/claude-opus-4-5
```

---

## TODO

- [x] Fix skills probing (added `skills.allowBundled` config) ✅
- [x] Restore needed extensions ✅
- [x] Enable memory-lancedb ✅
- [x] Upgrade Node to >=22.12.0 ✅ (v22.22.0)
- [ ] Configure model fallbacks
- [ ] Install `lobster` binary
- [ ] Configure web search (Brave API key)
- [ ] Run security audit: `crocbot security audit --deep`
