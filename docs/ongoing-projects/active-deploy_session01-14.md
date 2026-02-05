# Crocbot Deployment Log

## Environment

| Component | Value |
|-----------|-------|
| OS | Ubuntu 24.04.3 LTS on WSL2 (kernel 6.6.87.2) |
| Node.js | v22.22.0 |
| pnpm | 10.23.0 |
| Version | `2026.1.50` |
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

### Agent Identity, Soul, etc Set in Markdown files

/home/aiwithapex/croc/

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
- `bird`, `mcporter`, `gh`, `curl`, `python3`, `jq`, `rg`, `ffmpeg`, `tmux`, `uv`, `whisper`, `ordercli`, `gifgrep`, `gog`, `goplaces`, `nano-pdf`, `obsidian-cli`, `sag`, `songsee`

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
    "nano-banana-pro", "nano-pdf",
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
| Version | `2026.1.50` |
| Gateway | Running on `ws://127.0.0.1:34219` |
| Telegram | Connected as `@KroxTheBot` |
| Model | `google-gemini-cli/gemini-3-flash-preview` (fallback: `openai-codex`) |
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

## Session 8: Google Gemini Primary Model (2026-02-01)

### Model Configuration

| Setting | Value |
|---------|-------|
| Primary | `google-gemini-cli/gemini-3-flash-preview` |
| Fallback | `openai-codex/gpt-5.1-codex-mini` |
| Auth | OAuth via `google-gemini-cli-auth` plugin |

### Setup Steps

1. Enabled plugin: `crocbot plugins enable google-gemini-cli-auth`
2. Authenticated: `crocbot models auth login --provider google-gemini-cli --set-default`
3. OAuth flow completed (WSL2 manual URL paste mode)

### Other Changes

- Enabled `/restart` command: added `commands.restart: true` to config
- Enabled `/config`, `/debug`, `/bash` commands
- Configured `tools.elevated` with Telegram allowlist

### Code Changes

- Modified `src/auto-reply/reply/commands-session.ts`: `/restart` command now writes a restart sentinel with delivery context, enabling post-restart notifications back to the originating channel

### Deployment

After code changes, rebuild and restart:
```bash
pnpm build && systemctl --user restart crocbot-gateway
```

### Restart Timing (from logs)

| Phase | Duration |
|-------|----------|
| SIGUSR1 → Gateway started | ~40ms |
| Telegram reconnect | ~370ms |
| **Total** | **~400-500ms** |

---

## Session 9: TTS Restoration (2026-02-01)

### Problem
TTS (Text-to-Speech) functionality was not working. The entire TTS subsystem was deleted during a technical debt cleanup phase (commit `23a860ecb`).

### Files Restored
Restored from git history (commit `481bd333e`):

| File | Description |
|------|-------------|
| `src/tts/tts.ts` | Core TTS module with Edge/OpenAI/ElevenLabs providers |
| `src/auto-reply/reply/commands-tts.ts` | TTS command handler (/tts on/off/status/audio) |
| `src/agents/tools/tts-tool.ts` | TTS agent tool for AI-invoked TTS |

### Changes Made

1. **Restored TTS module** - Updated imports from `ClawdbotConfig` to `crocbotConfig`
2. **Restored command handler** - Wired into `commands-core.ts`
3. **Restored auto-TTS** - Wired `maybeApplyTtsToPayload` into `dispatch-from-config.ts`
4. **Installed dependency** - `pnpm add -w node-edge-tts`

### Auto-TTS Modes

| Mode | Behavior |
|------|----------|
| `off` | Disabled (default) |
| `always` | All replies converted to speech |
| `inbound` | Only when user sends audio/voice |
| `tagged` | Only when reply includes `[[tts]]` tags |

Enable via `/tts on` or config `messages.tts.auto: "always"`

### TTS Providers Available

| Provider | API Key Required | Config Path |
|----------|------------------|-------------|
| Edge (default) | No | `messages.tts.edge.enabled` |
| OpenAI | Yes (`OPENAI_API_KEY`) | `messages.tts.openai.apiKey` |
| ElevenLabs | Yes (`ELEVENLABS_API_KEY`) | `messages.tts.elevenlabs.apiKey` |

### TTS Commands

```
/tts status   - Show current TTS settings
/tts on       - Enable TTS for replies
/tts off      - Disable TTS
/tts provider - View/change provider
/tts limit    - Set max text length
/tts summary  - Toggle auto-summarization
/tts audio    - Generate audio from text
```

---

## Session 10: TTS Voice Configuration (2026-02-01)

### Problem
TTS voice notes were not using the configured ElevenLabs voice. Investigation revealed **two separate TTS systems**:

| System | Purpose | Voice Config Location |
|--------|---------|----------------------|
| Auto-TTS | Automatic voice conversion of replies | `src/tts/tts.ts` / `messages.tts.elevenlabs.voiceId` |
| sag skill | Agent-invoked TTS via `sag` CLI | `skills/sag/SKILL.md` |

### Fix Applied

1. **Updated default voice** in `src/tts/tts.ts`:
   - Old: `pMsXgVXv3BLzUgSXRplE`
   - New: `ZD29qZCdYhhdqzBLRKNH` ("Female Humanoid - Futuristic")

2. **Added config** to `~/.crocbot/crocbot.json`:
   ```json
   "messages": {
     "tts": {
       "auto": "always",
       "provider": "elevenlabs",
       "elevenlabs": {
         "voiceId": "ZD29qZCdYhhdqzBLRKNH"
       }
     }
   }
   ```

3. **Updated sag skill** (`skills/sag/SKILL.md`):
   - Changed default voice to match auto-TTS
   - Added comprehensive v3 audio tags documentation
   - Added note explaining sag skill vs auto-TTS difference

4. **Added comments** to both locations explaining the distinction

### Voice Reference
- ID: `ZD29qZCdYhhdqzBLRKNH`
- Name: "Female Humanoid - Futuristic"
- URL: https://elevenlabs.io/app/voice-library?voiceId=ZD29qZCdYhhdqzBLRKNH

---

## Session 11: Environment Files Cleanup (2026-02-01)

### Problem
`.env` and `.env.example` were disorganized and missing critical path configuration variables.

### Investigation
- `.env.example` was orphaned documentation from the project's first commit (Nov 2025)
- Only contained Twilio vars for `voice-call` extension
- Never updated to reflect `~/.crocbot/` config system
- Twilio only used by optional `extensions/voice-call/`, not core codebase

### Fix Applied

Updated both files with:

| Section | Variables |
|---------|-----------|
| State & Config Paths | `CROCBOT_STATE_DIR`, `CROCBOT_CONFIG_PATH` |
| Twilio (voice-call) | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM` |
| ElevenLabs TTS | `ELEVENLABS_VOICE_ID`, `ELEVENLABS_VOICE_ID_LINK` |

### .env Loading Order
1. CWD `.env` (project root if running from there)
2. `~/.crocbot/.env` (global fallback)

Defined in `src/infra/dotenv.ts`.

---

## Session 12: TTS API Key Fix (2026-02-01)

### Problem
TTS configured for ElevenLabs but no API key was set, causing silent fallback to Edge TTS.

### Investigation
Traced voice note generation flow:
- Entry: `maybeApplyTtsToPayload()` in `src/tts/tts.ts:1345`
- Provider selection: `getTtsProvider()` → checks prefs then config
- API key resolution: `resolveTtsApiKey()` at line 476 checks `config.elevenlabs.apiKey` → `ELEVENLABS_API_KEY` → `XI_API_KEY`

### Fix Applied
Added ElevenLabs API key to `~/.crocbot/crocbot.json`:

```json
"messages": {
  "tts": {
    "auto": "always",
    "provider": "elevenlabs",
    "elevenlabs": {
      "apiKey": "sk_89c36ce3...",
      "voiceId": "ZD29qZCdYhhdqzBLRKNH"
    }
  }
}
```

User prefs at `~/.crocbot/settings/tts.json` already correct:
```json
{"tts": {"provider": "elevenlabs", "auto": "always"}}
```

### TTS Flow Summary
```
Telegram message → dispatch-from-config.ts
  → maybeApplyTtsToPayload()
  → resolveTtsAutoMode() returns "always"
  → getTtsProvider() returns "elevenlabs"
  → resolveTtsApiKey() returns API key
  → elevenLabsTTS() generates Opus 48kHz
  → Telegram sends as voice bubble
```

---

## Session 13: TTS Logging & Documentation URLs (2026-02-01)

### TTS Logging Added
Added structured logging to `src/tts/tts.ts` using `createSubsystemLogger("tts")`:

| Function | Log Points |
|----------|------------|
| `textToSpeech` | provider selected, api call, fallback, generated, failed |
| `maybeApplyTtsToPayload` | check, skipped (various reasons), summarizing, applied, failed |

### Mintlify Documentation Setup
Added to `.env` and `.env.example`:
- `MINTLIFY_API_KEY`
- `MINTLIFY_PROJECT_ID`

### Documentation URL Fix
Fixed 82 files with bogus docs URLs:
- Replaced with `aiwithapex.mintlify.app`
- Updated `docs/CNAME`
- Verified all 93 unique URLs return 200

---

## Session 14: Voice Transcription Setup (2026-02-01)

### Configuration

Enabled automatic transcription of incoming Telegram voice notes using OpenAI Whisper.

| File | Change |
|------|--------|
| `~/.crocbot/crocbot.json` | Added `tools.media.audio` config |
| `~/.crocbot/agents/main/auth-profiles.json` | Created with OpenAI API key |

### Config Added

**tools.media.audio** (`crocbot.json`):
```json
"tools": {
  "media": {
    "audio": {
      "enabled": true,
      "models": [{"provider": "openai", "model": "gpt-4o-mini-transcribe"}]
    }
  }
}
```

**auth-profiles.json** (new file):
```json
{
  "version": 1,
  "profiles": {
    "openai:default": {"type": "api_key", "provider": "openai", "key": "sk-proj-..."}
  }
}
```

### Flow
```
Telegram voice note → resolveMedia() downloads → MediaPath set
  → applyMediaUnderstanding() → OpenAI transcription
  → {{Transcript}} available in context
```

---

## TODO

- [x] Fix skills probing (added `skills.allowBundled` config)
- [x] Restore needed extensions
- [x] Enable memory-lancedb
- [x] Upgrade Node to >=22.12.0 (v22.22.0)
- [x] Configure model fallbacks
- [x] Restore TTS functionality
- [x] Configure TTS voice (ElevenLabs `ZD29qZCdYhhdqzBLRKNH`)
- [x] Clean up `.env` and `.env.example` with proper sections
- [x] Add ElevenLabs API key to TTS config
- [x] Add TTS structured logging
- [x] Fix documentation URLs (Mintlify)
- [x] Enable voice note transcription (OpenAI Whisper)
- [ ] Install `lobster` binary
- [ ] Configure web search (Brave API key)
- [ ] Run security audit: `crocbot security audit --deep`
