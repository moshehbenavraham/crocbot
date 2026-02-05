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
| `nano-pdf` | `/skill nano-pdf` | — | ⬜ |
| `notion` | `/skill notion` | Notion API | ⬜ |
| `openai-image-gen` | `/skill openai-image-gen a cat` | OpenAI | ✅ |
| `openai-whisper-api` | *(send voice note)* | OpenAI | ⬜ |
| `sag` | `/skill sag hello world` | ElevenLabs | ⬜ |
| `session-logs` | `/skill session-logs` | — | ⬜ |
| `skill-creator` | `/skill skill-creator` | — | ✅ |
| `tmux` | `/skill tmux` | — | ⬜ |
| `trello` | `/skill trello` | — | ⬜ |
| `weather` | `/skill weather Modiin Ilit` | — | ✅ |

### Extensions

| Extension | Tested |
|-----------|--------|
| `google-gemini-cli-auth` | ⬜ |
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
- Remaining audit issues: canvas (no node), message react target

---

## TODO

- [x] Install `lobster` binary
- [x] Configure web search (Brave API key)
- [x] Configure headless browser (Playwright Chromium)
- [x] Fix `crocbot` CLI PATH for orchestration/exec tools
- [ ] Run security audit: `crocbot security audit --deep`
- [ ] Remove canvas system (unused - no Mac/iOS/Android node apps in this deployment)
