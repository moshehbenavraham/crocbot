# Agent Setup: Crocbot vs Upstream (OpenClaw)

> **Generated**: 2026-02-07
> **Upstream copy**: `.001_ORIGINAL/`

---

## Summary

Crocbot is a deliberate strip-down of upstream OpenClaw into a Telegram-first, single-user personal AI assistant deployed via Coolify/Docker. The agent *runtime* (Pi agent core, plugin system, skills engine) is largely preserved; what changed is the surface area — fewer channels, fewer skills, no native-app tooling, and a rewritten AGENTS.md.

---

## 1. AGENTS.md / CLAUDE.md / GEMINI.md

| Metric | Crocbot | Upstream |
|--------|---------|----------|
| AGENTS.md line count | 49 | 186 |
| Symlinks | CLAUDE.md, GEMINI.md → AGENTS.md | CLAUDE.md → AGENTS.md only |
| Focus | Telegram + CLI, Docker deploy | Multi-channel, Mac app, iOS/Android, web |

The current AGENTS.md is fully rewritten — no shared text with upstream. It references `CROCBOT_STATE_DIR`, `CROCBOT_CONFIG_PATH`, `CROCBOT_WORKSPACE` instead of upstream's generic paths. Upstream's AGENTS.md covers macOS packaging, App Store release, multi-platform SDKs, and 16+ channel details that don't apply here.

---

## 2. Skills (32 vs 49)

### 17 skills removed

| Skill | Reason |
|-------|--------|
| `apple-notes`, `apple-reminders`, `bear-notes`, `things-mac`, `peekaboo` | macOS-only |
| `blucli`, `eightctl`, `himalaya`, `sonoscli`, `wacli`, `openhue`, `local-places` | Mac/hardware CLI utilities |
| `bluebubbles`, `imsg` | iMessage dependencies |
| `canvas`, `clawhub` | Web canvas / upstream branding |
| `gemini`, `oracle` | Alternate LLM wrappers |
| `healthcheck`, `model-usage` | Upstream monitoring |
| `sherpa-onnx-tts` | On-device TTS (macOS) |
| `blogwatcher`, `camsnap`, `spotify-player` | Niche utilities |

### 0 skills added

Every skill in crocbot also exists in upstream. Two skills present in crocbot but **not commonly expected**: `voice-agents` and `sound-effects` — these exist in both trees under slightly different paths.

---

## 3. Extensions (11 vs 30)

### 19 extensions removed

**Chat-channel extensions cut (16):**
`bluebubbles`, `discord`, `feishu`, `googlechat`, `imessage`, `line`, `matrix`, `mattermost`, `msteams`, `nextcloud-talk`, `nostr`, `signal`, `tlon`, `twitch`, `whatsapp`, `zalo`/`zalouser`

**Other extensions cut (3):**
`memory-core`, `minimax-portal-auth`, `qwen-portal-auth`

### Extensions kept (11)
`copilot-proxy`, `diagnostics-otel`, `google-antigravity-auth`, `google-gemini-cli-auth`, `llm-task`, `lobster`, `memory-lancedb`, `open-prose`, `slack`, `telegram`, `voice-call`

> **Note**: `slack` extension is still present even though the Slack *skill* is also present. This may be intentional (Slack webhooks/notifications without full channel support) or an oversight worth reviewing.

---

## 4. Source-code modules (`src/`)

### Modules removed from upstream

| Module | Purpose |
|--------|---------|
| `src/discord/` | Direct Discord channel implementation |
| `src/slack/` | Direct Slack channel implementation |
| `src/imessage/` | iMessage integration |
| `src/signal/` | Signal integration |
| `src/feishu/` | Feishu/Lark integration |
| `src/line/` | LINE integration |
| `src/whatsapp/` | WhatsApp (Baileys) integration |
| `src/canvas-host/` | Web-based canvas/UI rendering |
| `src/channel-web/` | Unified web channel |
| `src/web/` | Web provider |
| `src/macos/` | macOS-specific code |
| `src/compat/` | Cross-platform compatibility layer |
| `src/extensionAPI/` | Extension API surface |

### Agent tools removed

Upstream has channel-specific agent action tools that are absent in crocbot:
- `discord-actions-guild.ts`, `discord-actions-messaging.ts`, `discord-actions-moderation.ts`, `discord-actions-presence.ts`, `discord-actions.ts`
- `slack-actions.ts`
- `whatsapp-actions.ts`
- `canvas-tool.ts`

Crocbot keeps only `telegram-actions.ts`.

### File counts

| Area | Crocbot | Upstream | Delta |
|------|---------|----------|-------|
| Non-test `.ts` in `src/` | ~217 | ~231 | −14 |
| Agent tools | 1 channel tool | 5+ channel tools | −4+ |

---

## 5. `.pi/` Agent Prompts & Extensions

Upstream ships a `.pi/` directory containing:
- `prompts/` — system prompts (`reviewpr`, `landpr`, `cl`, `is`)
- `extensions/` — Pi agent extensions (`prompt-url-widget`, `files`, `diff`, `redraws`)
- `git/.gitignore`

**Crocbot removes the entire `.pi/` directory.** The agent runtime still functions (Pi core is intact), but the self-service prompts and built-in agent extensions for PR review, code landing, etc. are not present.

---

## 6. Package-level Differences

| Field | Crocbot | Upstream |
|-------|---------|----------|
| `description` | "Telegram gateway CLI with Pi RPC agent" | "WhatsApp gateway CLI (Baileys web) with Pi RPC agent" |
| RPC script name | `crocbot:rpc` | `openclaw:rpc` |
| `@mariozechner/pi-agent-core` | 0.49.3 | 0.51.1 |
| `@mariozechner/pi-coding-agent` | 0.49.3 | 0.51.1 |

**Pi agent core is 2 minor versions behind upstream** (0.49.3 → 0.51.1). This may be intentional stability pinning or an update that hasn't been pulled yet.

---

## 7. Plugin System

The plugin runtime (`src/plugins/`, `src/plugin-sdk/`) is structurally the same in both trees. Crocbot has 36 plugin `.ts` files vs upstream's 38 — the delta is channel-specific hook infrastructure that was removed alongside the channels themselves.

---

## 8. Measurable Deltas at a Glance

| Metric | Crocbot | Upstream | Delta |
|--------|---------|----------|-------|
| AGENTS.md lines | 49 | 186 | −137 (−74%) |
| Skills | 32 | 49 | −17 (−35%) |
| Extensions | 11 | 30 | −19 (−63%) |
| src/ modules | ~35 dirs | ~48 dirs | −13 dirs |
| Channel action tools | 1 | 6+ | −5 |
| Pi agent core version | 0.49.3 | 0.51.1 | −2 minor |
| `.pi/` prompts/extensions | 0 | 7+ files | removed |

---

## 9. Items Worth Reviewing

1. **Pi agent core version lag** (0.49.3 vs 0.51.1) — check upstream changelog for bug fixes or features that matter.
2. **Slack extension still present** — if Slack isn't a supported channel, consider removing the extension to reduce surface area.
3. **`.pi/` prompts removed** — the `reviewpr` and `landpr` prompts could be useful for development workflows even in a single-user setup.
4. **GEMINI.md symlink** added in crocbot but absent in upstream — minor but intentional.
