# Crocbot Deployment Log

> Sessions 1-14: [active-deploy_session01-14.md](active-deploy_session01-14.md)

---

## Current State

| Component | Value |
|-----------|-------|
| Version | `2026.1.54` |
| Gateway | `ws://127.0.0.1:34219` |
| Telegram | `@KroxTheBot` |
| Primary Model | `google-gemini-cli/gemini-3-flash-preview` |
| Fallback | `openai-codex/gpt-5.1-codex-mini` |
| TTS | ElevenLabs (`ZD29qZCdYhhdqzBLRKNH`) |
| Voice Transcription | OpenAI `gpt-4o-mini-transcribe` |

### Skills

| Skill | Test Command | API Key | Tested |
|-------|--------------|---------|--------|
| `bird` | `/skill bird` | — | ⚠️ considering removal |
| `coding-agent` | `/skill coding-agent` | — | ✅ |
| `gifgrep` | `/skill gifgrep cats` | — | ✅ |
| `github` | `/skill github` | — | ✅ |
| `goplaces` | `/skill goplaces coffee near me` | Google Places | ✅ |
| `nano-banana-pro` | `/skill nano-banana-pro` | Google Places | ✅ |
| `nano-pdf` | `/skill nano-pdf` | — | ✅ |
| `openai-image-gen` | `/skill openai-image-gen a cat` | OpenAI | ✅ |
| `openai-whisper-api` | *(send voice note)* | OpenAI | ✅ |
| `sag` | `/skill sag hello world` | ElevenLabs | ✅ |
| `skill-creator` | `/skill skill-creator` | — | ✅ |
| `weather` | `/skill weather Modiin Ilit` | — | ✅ |
| `notion` | `/skill notion` | Notion API | ✅ |
| `trello` | `/skill trello` | — | ✅ |
| `tmux` | `/skill tmux` | — | ✅ |
| `session-logs` | `/skill session-logs` | — | ✅ |
| `self-repair` | `/skill self-repair` | Claude Code | ✅ |

In process of checking still:
       📦 mcporter
       💎 obsidian
       🛵 ordercli
       🌊 songsee
       🎞️ video-frames
       💬 slack (config: channels.slack)
       🧾 summarize (bins: summarize)
       📞 voice-call (config: plugins.entries.voice-call.enabled)



### Extensions

| Extension | Tested |
|-----------|--------|
| `google-gemini-cli-auth` | ✅ |
| `lobster` | ✅ |
| `memory-lancedb` | ✅ |

---

## Session 15

- Added exec approvals for all skill binaries (`~/.crocbot/exec-approvals.json`)
- *(himalaya email skill removed — replaced by Gmail hook integration)*

---

## Session 16

- Installed `lobster` CLI binary globally via `npm install -g @clawdbot/lobster` (v2026.1.24)
- Binary available at `/home/aiwithapex/.local/bin/lobster`

---

## Session 17

- Configured Brave Search API key (`BRAVE_API_KEY`) in both `.env` locations (`~/.crocbot/.env` and project `.env`)
- Configured headless browser: set `browser.executablePath` to Playwright Chromium (`~/.cache/ms-playwright/chromium-1200/chrome-linux64/chrome`) with `headless: true` and `noSandbox: true` in `crocbot.json`
- Symlinked `crocbot` CLI to `~/.local/bin/crocbot` → `dist/entry.js` (fixes orchestration tools, cron, session_status)
- Remaining audit issues: message react target

---

## Session 18

- Completely removed the canvas system (unused — no Mac/iOS/Android node apps in this deployment)
- Deleted `skills/canvas/`, `src/canvas-host/`, `src/infra/canvas-host-url.ts`, `src/infra/control-ui-assets.ts`, `src/gateway/control-ui.ts`, `scripts/build/canvas-a2ui-copy.ts`, `scripts/build/bundle-a2ui.sh`, and the entire `vendor/a2ui/` directory
- Stripped canvas references from gateway server, CLI registration, system prompt, tool policy, and config schemas

---

## Session 19

- Completely removed the web UI (`ui/` directory and all supporting code)
- Deleted `ui/` (Vite + Lit app), `src/gateway/control-ui.ts`, `scripts/ui.js`, and related test files
- Removed UI build scripts, UI asset serving from the gateway HTTP server, and `ui:build`/`ui:dev` package.json scripts

---

## Session 20

- Ran `crocbot security audit --deep` — **0 critical, 1 warn, 1 info**
- **WARN** `gateway.trusted_proxies_missing`: reverse proxy headers not trusted. Gateway bind is loopback and `gateway.trustedProxies` is empty. Not actionable unless Control UI is exposed through a reverse proxy.
- **INFO** attack surface: groups open=0, allowlist=1; tools.elevated enabled; hooks disabled; browser control enabled.

---

## TODO

- [x] Install `lobster` binary
- [x] Configure web search (Brave API key)
- [x] Configure headless browser (Playwright Chromium)
- [x] Fix `crocbot` CLI PATH for orchestration/exec tools
- [x] Run security audit: `crocbot security audit --deep`
- [x] Remove canvas system (unused - no Mac/iOS/Android node apps in this deployment)

---

## Session 21

- Updated `tar` from `7.5.4` → `7.5.7` (direct dep + overrides) — fixes deprecated security warning
- Added `cmake-js` override to `^8.0.0` — eliminates deprecated `npmlog`, `are-we-there-yet`, `gauge` subdeps
- Remaining: `node-domexception@1.0.0` (transitive via `gaxios` → `node-fetch@3`; no CVEs, zero risk on Node 22, awaiting upstream fix)
- Clean rebuild (`dist/` purged, `pnpm install --force`, `pnpm build`) and redeployed gateway

---

## Session 22 — Voice-Call Live Testing

- Configured voice-call plugin end-to-end: Twilio provider, `toNumber`, `OPENAI_API_KEY`, ngrok tunnel (`krox.ngrok.io`)
- Added `OPENAI_API_KEY` to `.env` (reused existing key from `openai-image-gen`)
- Updated `.env` Twilio creds from placeholders to real values
- Added ngrok tunnel config to `crocbot.json` (`tunnel.provider: "ngrok"`, `ngrokDomain: "krox.ngrok.io"`)
- Updated stale ngrok authtoken in `crocbot.json`, `.env`, and `~/.config/ngrok/ngrok.yml`
- Rebuilt and restarted gateway — tunnel came up, webhook server listening
- First live test: call placed to `+972525936481`, phone rang and was answered, but **dropped immediately (~1.8s) with no audio** — likely webhook signature verification or TwiML serving issue
- Documented status and next steps in `docs/ongoing-projects/voice-call-upstream-sync.md`
- **Next session**: add request-level webhook logging, test with `skipSignatureVerification: true`, inspect ngrok traffic
