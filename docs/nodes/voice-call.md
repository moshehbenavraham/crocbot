# Voice-Call Extension: Status & Reference

> Self-hosted voice-call extension using Twilio + OpenAI. Functional as a
> **backup/fallback** — primary voice agent will be a commercial platform
> (Retell AI, VAPI, or ElevenLabs).
>
> Last updated: 2026-02-20.

---

## Current Status — FUNCTIONAL, PERFORMANCE-LIMITED

**Full conversation loop works**: phone rings, user answers, hears TTS
greeting, speaks, STT transcribes, AI generates response, TTS plays it back,
multi-turn conversation sustained.

| Component | Status | Details |
|-----------|--------|---------|
| Twilio telephony | Working | Outbound calls, webhooks, media streams |
| STT | Working | OpenAI Realtime API (`gpt-4o-transcribe`), WebSocket |
| TTS | Working | OpenAI TTS (`gpt-4o-mini-tts`), streamed via media stream |
| AI responses | Working | Embedded Pi agent via `core-bridge.ts` → `extensionAPI.js` |
| ngrok tunnel | Working | Paid domain, webhook + WebSocket passthrough |
| Notify mode | Untested | `<Say>` TwiML path not verified end-to-end |
| Inbound calls | Untested | Allowlist/pairing policy exists but not live-tested |
| Telegram trigger | Untested | `voice_call` tool invocation via chat agent |

### Performance Problem

**Latency: 2-12 seconds per turn** (vs 300-800ms on commercial platforms).

Root causes — all architectural, not fixable with tuning:

1. **Batch TTS** — `tts-openai.ts` makes a single REST call, waits for the
   entire audio buffer, then resamples and streams. No token-level streaming.
2. **Sequential LLM → TTS** — `response-generator.ts` waits for the full
   agent response before passing to `speak()`. No streaming LLM-to-TTS pipe.
3. **Agent overhead** — every turn runs the full embedded Pi agent pipeline:
   memory-lancedb similarity search + injection, hooks, tool calls (first turn
   reads 5 workspace files = ~10s), session management.
4. **Context bleed** — memory plugin injects irrelevant memories (threshold
   0.3 is too loose); agent reads SOUL.md/USER.md and dumps persona on first
   turn instead of responding conversationally.

Commercial platforms (Retell, VAPI, ElevenLabs) solve this with streaming
LLM→TTS, voice-optimized models, no agent framework overhead, and purpose-built
low-latency infra.

### Future Plan

This extension becomes a **backup/self-hosted fallback**. Primary voice agent
will use Retell AI, VAPI, or ElevenLabs, integrated as a separate extension
or provider.

---

## Architecture

```
Phone ↔ Twilio Media Streams ↔ ngrok ↔ crocbot webhook server (:3334)
                                            ├─ STT: OpenAI Realtime (gpt-4o-transcribe, WebSocket)
                                            ├─ LLM: gpt-4o-mini via embedded Pi agent
                                            └─ TTS: OpenAI TTS (gpt-4o-mini-tts, REST batch → mu-law 8kHz)
```

### Key Components

| File | Role |
|------|------|
| `index.ts` | Plugin entry: registers RPC, CLI, Tool, Service |
| `runtime.ts` | Creates Manager, Provider, Webhook, Tunnel |
| `manager.ts` + `manager/` | Call state machine, transcripts, JSONL persistence |
| `providers/twilio.ts` | Twilio REST + TwiML + Media Streams |
| `providers/mock.ts` | Zero-network dev/testing |
| `webhook.ts` | HTTP server + WebSocket upgrade for media streams |
| `webhook-security.ts` | HMAC-SHA1 signature verification, proxy header handling |
| `core-bridge.ts` | Bridge to crocbot core agent (imports `dist/extensionAPI.js`) |
| `response-generator.ts` | AI response via embedded Pi agent |
| `providers/stt-openai-realtime.ts` | OpenAI Realtime STT (WebSocket, VAD) |
| `providers/tts-openai.ts` | OpenAI TTS (REST batch, PCM → mu-law conversion) |
| `telephony-tts.ts` | TTS wrapper delegating to core `textToSpeechTelephony` |
| `media-stream.ts` | Twilio media stream WebSocket handler |
| `telephony-audio.ts` | PCM ↔ mu-law 8kHz codec conversion |

### Call Flow (Conversation Mode)

1. `voicecall.initiate` → Twilio REST API creates call
2. Twilio fetches TwiML from webhook → `<Connect><Stream>` opens media WebSocket
3. Initial message played via streaming TTS through media stream
4. User speaks → mu-law audio → OpenAI Realtime STT → transcript
5. Transcript → embedded Pi agent → AI response text
6. Response → OpenAI TTS → PCM → resample 8kHz → mu-law → 20ms chunks → media stream
7. Loop until hangup, "bye", or timeout

### Call States

```
Non-terminal:  initiated → ringing → answered → active → speaking / listening
Terminal:      completed | hangup-user | hangup-bot | timeout | error |
               failed | no-answer | busy | voicemail
```

---

## Configuration

In `crocbot.json` → `plugins.entries.voice-call.config`:

```jsonc
{
  "enabled": true,
  "provider": "twilio",
  "fromNumber": "+1TWILIO_FROM",
  "toNumber": "+1PERSONAL_PHONE",
  "outbound": { "defaultMode": "conversation" },
  "tunnel": { "provider": "ngrok" },
  "webhookSecurity": { "allowedHosts": ["YOUR_DOMAIN.ngrok.io"] },
  "streaming": { "enabled": true }
}
```

Twilio creds: `twilio.accountSid` / `twilio.authToken` or env vars
`TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN`. OpenAI key via `OPENAI_API_KEY`.

### Key Config Fields

| Field | Default | Notes |
|-------|---------|-------|
| `streaming.enabled` | `false` | **Must be `true`** for conversation mode |
| `outbound.defaultMode` | `"notify"` | `conversation` for two-way calls |
| `responseModel` | `openai/gpt-4o-mini` | Model for voice AI responses |
| `maxDurationSeconds` | `300` | 5 min hard limit |
| `silenceTimeoutMs` | `800` | VAD end-of-speech detection |
| `serve.port` | `3334` | Webhook server port |

---

## CLI & RPC

```bash
crocbot voicecall call -m "Hello" [--to +1...] [--mode conversation]
crocbot voicecall status --call-id <id>
crocbot voicecall end --call-id <id>
crocbot voicecall tail                    # Stream call logs
```

| RPC Method | Params |
|------------|--------|
| `voicecall.initiate` | `{ message, to?, mode? }` |
| `voicecall.end` | `{ callId }` |
| `voicecall.status` | `{ callId }` or `{ sid }` |
| `voicecall.speak` | `{ callId, message }` |

Agent tool: `voice_call` with actions `initiate_call`, `end_call`,
`get_status`, `speak_to_user`, `continue_call`.

---

## Test Coverage

30 tests across 6 files: config parsing, call lifecycle/state machine, phone
allowlist (14 tests), Twilio webhooks, signature verification, media stream
auth, plugin integration (6 tests).

---

## Upstream Sync

Source: OpenClaw (`openclaw/openclaw`), local copy at `.001_ORIGINAL/`.

**No sync needed** (as of 2026-02-21). Upstream CHANGELOG entries after
v2026.1.26 are version-only bumps with zero voice-call code changes.

Crocbot is **ahead** of upstream with:
- `sanitizeLogStr()` log-injection hardening (3 files)
- TOCTOU race fixes (`cli.ts`, `manager/store.ts`)
- Telnyx + Plivo providers removed (~1,200 lines; Twilio-only)
- Webhook diagnostic logging
- `core-bridge.ts` reverted to upstream's single-import approach (Session 3 fix)

---

## Work Completed (Sessions 1-3, 2026-02-20)

### Session 1 — Basic Setup
- Added `voice-call` plugin entry to `crocbot.json`
- Fixed `webhookSecurity` schema, env var loading, `fromNumber` config
- Result: Twilio call connects but no audio (notify mode TTS race)

### Session 2 — STT/TTS Pipeline
- Added `streaming.enabled: true` (required for conversation mode)
- Wired `tts.textToSpeechTelephony` into plugin runtime (`types.ts`, `index.ts`)
- Created `src/extensionAPI.ts` (build entry not yet added)
- Result: TTS greeting heard, STT transcribes speech, AI response fails
  (`Missing core module at dist/agents/agent-scope.js`)

### Session 3 — Full Loop Working
- Added `src/extensionAPI.ts` to `tsdown.config.ts` build entries
- Reverted `core-bridge.ts` to upstream's `importCoreExtensionAPI()` approach
- Fixed `result.meta?.aborted` crash in `response-generator.ts`
- Result: Full conversation loop verified — multi-turn voice conversation works
- Identified performance limitations → decision to use commercial platform as primary

### Earlier (2026-02-06, Sessions 1-5) — Upstream Sync
- Backported all upstream security hardening (webhook security, media stream
  auth, body size limits, allowlist matching)
- Removed Telnyx + Plivo providers (Twilio-only simplification)
- Added 14 allowlist unit tests + 6 plugin integration tests

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Silent calls / dead air | Set `streaming.enabled: true` in config |
| `Missing core module` | Run `pnpm build` — needs `dist/extensionAPI.js` |
| `Telephony TTS unavailable` | Check `textToSpeechTelephony` in `src/plugins/runtime/` |
| Webhook sig verification fail | Check `webhookSecurity.allowedHosts`, proxy config |
| Call drops after answer | Check webhook logs: `journalctl --user -u crocbot-gateway` |
| Irrelevant AI responses | Memory plugin injects context; agent reads workspace files |

```bash
# Logs
journalctl --user -u crocbot-gateway --since "1 hour ago"
crocbot voicecall tail
```
