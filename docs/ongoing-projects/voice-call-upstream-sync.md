# Voice-Call Extension: Architecture & Upstream Sync

> Comprehensive reference for the voice-call extension — architecture, upstream
> comparison, configuration, and live-testing guide.
>
> Last updated: 2026-02-21.

---

## Table of Contents

- [System Architecture](#system-architecture)
- [Directory Structure](#directory-structure)
- [Provider Implementations](#provider-implementations)
- [Call Lifecycle & State Machine](#call-lifecycle--state-machine)
- [Webhook System & Security](#webhook-system--security)
- [Audio, Streaming & AI](#audio-streaming--ai)
- [CLI, RPC & Tool Interface](#cli-rpc--tool-interface)
- [Configuration Reference](#configuration-reference)
- [Test Coverage](#test-coverage)
- [Upstream Sync Status](#upstream-sync-status)
- [Live Testing Guide](#live-testing-guide)

---

## System Architecture

The voice-call system is an extension plugin (`extensions/voice-call/`) that adds
telephony capabilities to crocbot. It supports outbound and inbound phone calls
through multiple providers, with AI-powered conversation via STT/TTS and an
embedded agent for response generation.

```
                       CLI / Gateway RPC / Agent Tool
                                   |
                       +-----------v-----------+
                       |   Plugin Entry Point   |
                       |     (index.ts)         |
                       | Registers: RPC, CLI,   |
                       | Tool, Service           |
                       +-----------+------------+
                                   |
                       +-----------v-----------+
                       |   VoiceCallRuntime     |
                       |    (runtime.ts)        |
                       | Creates Manager,       |
                       | Provider, Webhook,     |
                       | Tunnel                 |
                       +-----------+------------+
                                   |
          +------------------------+------------------------+
          |                        |                        |
+---------v--------+   +-----------v-----------+   +--------v--------+
|  CallManager     |   |  Provider             |   | Webhook Server  |
|  (manager.ts +   |   |  (twilio/mock)        |   |  (webhook.ts)   |
|   manager/*.ts)  |   |                       |   |                 |
|                  |   |                       |   | HTTP on :3334   |
| - Call state map |   | - Initiate/hangup     |   | - Receives      |
| - Event process  |   | - TTS playback        |   |   provider      |
| - Transcripts   |   | - Webhook verify      |   |   callbacks     |
| - Timers        |   | - Event normalization |   | - WebSocket for |
| - JSONL store   |   |                       |   |   media streams |
+------------------+   +-----------------------+   +-----------------+
                                   |
                       +-----------v-----------+
                       |   Telecom Provider     |
                       |   (Twilio API)         |
                       |                        |
                       +-----------------------+
```

### Key Design Patterns

- **Event normalization** — all providers parse webhooks into a unified
  `NormalizedEvent` type (`call.initiated`, `call.answered`, `call.speech`,
  `call.ended`, etc.), decoupling the manager from provider-specific formats.
- **Idempotent event processing** — each call tracks `processedEventIds` to
  prevent duplicate handling.
- **Forward-only state machine** — call states only progress forward; terminal
  states gate all further processing.
- **JSONL persistence** — call records are appended to
  `~/.crocbot/voice-calls/calls.jsonl` on every state change, enabling recovery
  on restart and `tail` log streaming.

---

## Directory Structure

```
extensions/voice-call/
├── index.ts                     # Plugin entry: RPC, CLI, Tool, Service registration
├── package.json                 # @crocbot/voice-call v2026.1.26
├── crocbot.plugin.json          # UI hints & config schema
├── CHANGELOG.md
├── README.md
├── src/
│   ├── config.ts                # Zod schemas for all configuration
│   ├── config.test.ts
│   ├── manager.ts               # CallManager: central state machine & lifecycle
│   ├── manager.test.ts
│   ├── manager/                 # Manager sub-modules
│   │   ├── context.ts           #   Call context helpers
│   │   ├── events.ts            #   Event processing & dispatch
│   │   ├── lookup.ts            #   Call lookup by ID / provider SID
│   │   ├── outbound.ts          #   Outbound call initiation logic
│   │   ├── state.ts             #   State transition validation
│   │   ├── store.ts             #   JSONL persistence
│   │   ├── timers.ts            #   Max-duration & ring timeout timers
│   │   └── twiml.ts             #   TwiML generation helpers
│   ├── providers/
│   │   ├── base.ts              #   VoiceCallProvider interface
│   │   ├── index.ts             #   Provider exports
│   │   ├── twilio.ts            #   Twilio Programmable Voice + Media Streams
│   │   ├── twilio.test.ts
│   │   ├── twilio/
│   │   │   ├── api.ts           #     Twilio REST API wrapper
│   │   │   └── webhook.ts       #     Twilio signature verification
│   │   ├── mock.ts              #   Mock provider (local dev)
│   │   ├── stt-openai-realtime.ts # OpenAI Realtime STT (WebSocket)
│   │   └── tts-openai.ts        #   OpenAI TTS provider
│   ├── allowlist.ts             # Phone number normalization + allowlist matching
│   ├── allowlist.test.ts        # 14 unit tests (crocbot addition)
│   ├── cli.ts                   # CLI command registration
│   ├── core-bridge.ts           # Bridge to crocbot core agent infrastructure
│   ├── media-stream.ts          # WebSocket handler for Twilio media streams
│   ├── media-stream.test.ts
│   ├── response-generator.ts    # AI response generation via embedded Pi agent
│   ├── runtime.ts               # VoiceCallRuntime factory
│   ├── telephony-audio.ts       # PCM <-> mu-law 8kHz audio conversion
│   ├── telephony-tts.ts         # TTS wrapper for telephony output
│   ├── tunnel.ts                # ngrok / Tailscale tunnel setup
│   ├── types.ts                 # Zod type definitions (CallState, CallRecord, etc.)
│   ├── utils.ts                 # Utility functions
│   ├── voice-mapping.ts         # Voice name mapping (OpenAI -> Polly)
│   ├── voice-call.plugin.test.ts # Plugin integration tests
│   ├── webhook.ts               # HTTP webhook server + WebSocket upgrade
│   ├── webhook-security.ts      # Signature verification & proxy validation
│   └── webhook-security.test.ts
└── docs/                        # Extension-specific docs

# Related files at project root (not inside extension):
skills/voice-call/SKILL.md                       # Skill definition (exists in upstream too)
skills/voice-agents/SKILL.md                     # Agent-focused skill (crocbot addition)
skills/voice-agents/references/outbound-calls.md # Outbound call reference (crocbot addition)
```

---

## Provider Implementations

Two telephony providers, conforming to the `VoiceCallProvider` interface
(`src/providers/base.ts`):

| Provider | API Style | Webhook Auth | Key Feature |
|----------|-----------|-------------|-------------|
| **Twilio** | REST + TwiML + Media Streams | HMAC-SHA1 | Bidirectional WebSocket audio streaming |
| **Mock** | Local JSON events | None | Zero-network dev/testing |

### Twilio (`src/providers/twilio.ts`, ~650 lines)

- Outbound calls via Programmable Voice REST API
- TwiML-based call flow: `<Say>` for notify mode, Media Streams for conversation
- In-memory TwiML storage for notify-mode calls (keyed by callId)
- Per-call stream auth tokens (random, timing-safe validation)
- Barge-in support: clears TTS queue when user starts speaking
- ngrok free-tier compatibility mode (loopback bypass with explicit flag)

### Mock (`src/providers/mock.ts`, ~170 lines)

- Accepts JSON events via webhook POST: `{event: ...}` or `{events: [...]}`
- No signature verification, no network calls
- All mutating methods are no-ops

---

## Call Lifecycle & State Machine

### Call States

```
Non-terminal:  initiated -> ringing -> answered -> active -> speaking / listening
Terminal:      completed | hangup-user | hangup-bot | timeout | error |
               failed | no-answer | busy | voicemail
```

Any non-terminal state can transition to any terminal state. State transitions are
forward-only within the non-terminal chain.

### Call Record

Each call is tracked as a `CallRecord`:

```typescript
{
  callId: string;                  // Internal UUID
  providerCallId?: string;         // Provider's SID/UUID
  provider: "twilio"|"mock";
  direction: "outbound"|"inbound";
  state: CallState;
  from: string;                    // E.164
  to: string;                      // E.164
  sessionKey?: string;
  startedAt: number;               // Unix ms
  answeredAt?: number;
  endedAt?: number;
  endReason?: EndReason;
  transcript: TranscriptEntry[];   // { speaker, text, isFinal, timestamp }
  processedEventIds: string[];     // Deduplication
  metadata?: Record<string, unknown>;
}
```

### Outbound Flow (Notify Mode)

1. `manager.initiateCall(to, sessionKey, { message, mode: "notify" })`
2. Provider sends inline TwiML: `<Say voice="Polly.Joanna">message</Say>`
3. Twilio calls the number, fetches TwiML from webhook when answered
4. TTS plays, auto-hangup after `notifyHangupDelaySec` (default: 3s)

### Outbound Flow (Conversation Mode)

1. `manager.initiateCall(to, sessionKey, { message, mode: "conversation" })`
2. When answered, initial message played via streaming TTS
3. OpenAI Realtime STT transcribes user speech via WebSocket
4. Transcript sent to embedded Pi agent for response generation
5. Agent response played via streaming TTS
6. Loop continues until explicit end, "bye", or timeout

### Inbound Flow

1. Provider webhook arrives with incoming call event
2. `inboundPolicy` checked: `disabled` (reject), `allowlist` (check `allowFrom`),
   `pairing`, or `open`
3. If accepted, `inboundGreeting` played, then enters conversation mode
4. Phone number matching is exact (digits-only normalization)

### Timeouts

| Timer | Default | Purpose |
|-------|---------|---------|
| Ring | 30s | Abort unanswered outbound calls |
| Max duration | 300s | Hard limit on any call |
| Silence | 800ms | Detect end-of-speech (VAD) |
| Transcript | 180s | Wait for user response before timeout |
| Notify hangup | 3s | Delay after TTS before auto-hangup |

---

## Webhook System & Security

### Webhook Server (`src/webhook.ts`)

- Node.js `http` module on configurable port (default: 3334, bind: `127.0.0.1`)
- Path: configurable (default: `/voice/webhook`)
- WebSocket upgrade for Twilio media streams (on `/voice/stream`)
- 1 MB body size limit (HTTP 413 on overflow)
- Log sanitization: `sanitizeLogStr()` strips control characters and truncates
  external strings before logging (prevents log injection)

### Signature Verification (`src/webhook-security.ts`, ~400 lines)

| Provider | Algorithm | Details |
|----------|-----------|---------|
| Twilio | HMAC-SHA1 | URL + sorted body params; timing-safe comparison |

### Proxy/Forwarding Security

When behind a reverse proxy (nginx, Caddy, Coolify), the webhook must
reconstruct the original public URL for signature verification:

- **Header priority**: `X-Forwarded-{Proto,Host,Port}` -> `X-Original-Host`
  (nginx) -> `Ngrok-Forwarded-Host` -> `Host`
- **Hostname validation**: RFC 1123 format, max 253 chars, IPv6 `[::1]:port`
- **Allowlist**: `webhookSecurity.allowedHosts` whitelist
- **Trusted proxies**: `webhookSecurity.trustedProxyIPs` — only trust forwarding
  headers from these IPs
- **Explicit opt-in**: `webhookSecurity.trustForwardingHeaders` must be `true`

### Media Stream Auth (Twilio)

- Per-call random token generated at call initiation
- Passed as query parameter on WebSocket URL
- Timing-safe validation on connect
- Prevents unauthorized stream connections

---

## Audio, Streaming & AI

### TTS (Text-to-Speech)

- **Providers**: Delegates to core `messages.tts` system (supports OpenAI,
  ElevenLabs; Edge TTS ignored for telephony). Direct `tts-openai.ts` provider
  exists for the streaming media path.
- **Config**: Plugin-level TTS config deep-merges with core `messages.tts`
- **Audio pipeline**: TTS PCM output -> resample to 8kHz -> mu-law encoding ->
  20ms chunks (160 bytes) -> Twilio Media Stream WebSocket
- **Barge-in**: User speech immediately clears TTS playback queue
- **Queue**: Serialized playback prevents overlapping audio

### STT (Speech-to-Text)

- **Provider**: OpenAI Realtime API (via `stt-openai-realtime.ts`)
- **Model**: `gpt-4o-transcribe` (configurable)
- **Format**: g711_ulaw, 8kHz, mono (native Twilio format)
- **VAD**: Server-side voice activity detection
  - Threshold: 0-1 (0.5 default)
  - Silence duration: 800ms default
  - Prefix padding: 300ms
- **Output**: Partial transcripts + final transcript on speech end

### AI Response Generation (`src/response-generator.ts`)

- Uses embedded Pi agent from crocbot core
- Voice-specific session key: `voice:{normalized_phone}`
- Full tool access during response generation
- Configurable model (`responseModel`, default: `openai/gpt-4o-mini`)
- Configurable system prompt (`responseSystemPrompt`)
- Timeout: `responseTimeoutMs` (default: 30s)

### Audio Codec Conversion (`src/telephony-audio.ts`)

- PCM (any sample rate) -> mu-law 8kHz for telephony
- Linear interpolation resampling
- Chunked generator pattern (no full buffer in memory)

---

## CLI, RPC & Tool Interface

### CLI Commands (`crocbot voicecall ...`)

```bash
call   -m <msg> [--to <phone>] [--mode notify|conversation]  # Outbound call
start  --to <phone> [--message <msg>] [--mode ...]           # Alias for call
continue --call-id <id> --message <msg>                      # Speak + wait
speak  --call-id <id> --message <msg>                        # Speak (no wait)
end    --call-id <id>                                        # Hang up
status --call-id <id>                                        # Call state
tail   [--file <path>] [--since <n>] [--poll <ms>]           # Stream logs
expose --mode [off|serve|funnel]                             # Tailscale
```

### Gateway RPC Methods

| Method | Params | Returns |
|--------|--------|---------|
| `voicecall.initiate` | `{ message, to?, mode? }` | `{ ok, callId, initiated }` |
| `voicecall.continue` | `{ callId, message }` | `{ ok, success, transcript }` |
| `voicecall.speak` | `{ callId, message }` | `{ ok, success }` |
| `voicecall.end` | `{ callId }` | `{ ok, success }` |
| `voicecall.status` | `{ callId }` or `{ sid }` | `{ ok, found, call? }` |
| `voicecall.start` | `{ to, message?, mode? }` | `{ ok, callId, initiated }` |

### Agent Tool (`voice_call`)

Actions: `initiate_call`, `continue_call`, `speak_to_user`, `end_call`,
`get_status`. Legacy format (`{ mode: "call"|"status" }`) still supported.

---

## Configuration Reference

### Core Fields

| Field | Default | Description |
|-------|---------|-------------|
| `enabled` | `false` | Enable the voice-call extension |
| `provider` | — | `twilio` or `mock` |
| `fromNumber` | — | Your provider phone number (E.164) |
| `toNumber` | — | Default outbound target (E.164) |

### Provider Credentials

| Field | Env Var Fallback |
|-------|-----------------|
| `twilio.accountSid` | `TWILIO_ACCOUNT_SID` |
| `twilio.authToken` | `TWILIO_AUTH_TOKEN` |

### Inbound Call Policy

| Field | Default | Description |
|-------|---------|-------------|
| `inboundPolicy` | `"disabled"` | `disabled`, `allowlist`, `pairing`, `open` |
| `allowFrom` | `[]` | E.164 numbers for allowlist mode |
| `inboundGreeting` | — | Greeting message for accepted inbound calls |

### Outbound Behavior

| Field | Default | Description |
|-------|---------|-------------|
| `outbound.defaultMode` | `"notify"` | `notify` (auto-hangup) or `conversation` |
| `outbound.notifyHangupDelaySec` | `3` | Seconds after TTS before auto-hangup |

### Timing

| Field | Default | Description |
|-------|---------|-------------|
| `maxDurationSeconds` | `300` | Max call duration (5 min) |
| `maxConcurrentCalls` | `1` | Concurrent call limit |
| `silenceTimeoutMs` | `800` | End-of-speech detection |
| `transcriptTimeoutMs` | `180000` | Wait for user response |
| `ringTimeoutMs` | `30000` | Unanswered call timeout |
| `responseTimeoutMs` | `30000` | AI response generation timeout |
| `responseModel` | `"openai/gpt-4o-mini"` | Model for voice responses |

### Webhook Server

| Field | Default | Description |
|-------|---------|-------------|
| `serve.port` | `3334` | Webhook server port |
| `serve.bind` | `"127.0.0.1"` | Webhook bind address |
| `serve.path` | `"/voice/webhook"` | Webhook URL path |
| `publicUrl` | — | Manual public URL override |
| `skipSignatureVerification` | `false` | Skip sig checks (dev only) |
| `store` | — | Custom path for call logs |

### Webhook Security

| Field | Default | Description |
|-------|---------|-------------|
| `webhookSecurity.allowedHosts` | `[]` | Trusted hostnames |
| `webhookSecurity.trustForwardingHeaders` | `false` | Trust X-Forwarded-* |
| `webhookSecurity.trustedProxyIPs` | `[]` | IPs allowed to set X-Forwarded-* |

### Tunneling

| Field | Default | Description |
|-------|---------|-------------|
| `tunnel.provider` | `"none"` | `none`, `ngrok`, `tailscale-serve`, `tailscale-funnel` |
| `tunnel.ngrokAuthToken` | — | Or `NGROK_AUTHTOKEN` env |
| `tunnel.ngrokDomain` | — | Paid ngrok custom domain |
| `tunnel.allowNgrokFreeTierLoopbackBypass` | `false` | Dev: bypass sig verification on loopback |
| `tunnel.allowNgrokFreeTier` | — | Deprecated alias for above |

### Streaming (Real-Time Audio)

| Field | Default | Description |
|-------|---------|-------------|
| `streaming.enabled` | `false` | Enable real-time audio streaming |
| `streaming.sttProvider` | `"openai-realtime"` | STT provider |
| `streaming.openaiApiKey` | — | Or `OPENAI_API_KEY` env |
| `streaming.sttModel` | `"gpt-4o-transcribe"` | STT model |
| `streaming.silenceDurationMs` | `800` | VAD silence threshold |
| `streaming.vadThreshold` | `0.5` | VAD sensitivity (0-1) |
| `streaming.streamPath` | `"/voice/stream"` | WebSocket path |

---

## Test Coverage

| Test File | Focus | Tests |
|-----------|-------|-------|
| `config.test.ts` | Config parsing, env var fallback, provider validation | Config merging |
| `manager.test.ts` | Call lifecycle, transcript waiting, provider ID mapping | State machine |
| `allowlist.test.ts` | Phone normalization, allowlist checking | 14 tests |
| `providers/twilio.test.ts` | Twilio webhook parsing, signatures | Twilio-specific |
| `webhook-security.test.ts` | Signature verification edge cases, proxy headers | Security |
| `media-stream.test.ts` | WebSocket media handling, stream auth | Streaming |
| `voice-call.plugin.test.ts` | Plugin integration, gateway methods, CLI | 6 integration tests |

---

## Upstream Sync Status

### Source

Upstream: OpenClaw (`openclaw/openclaw`), local copy at `.001_ORIGINAL/`.
Upstream manifest: `openclaw.plugin.json`; ours: `crocbot.plugin.json`.

### Version Gap

| | Upstream | Current |
|---|---------|---------|
| Package version | `2026.2.10` | `2026.1.26` |
| `@sinclair/typebox` | `0.34.48` | `0.34.47` |

Upstream has 8 additional CHANGELOG entries (2026.1.29 through 2026.2.10) that
current lacks. These appear to be version bumps with no new voice-call features
— the functional code is aligned.

### Sync Completeness

All upstream source files exist in the current codebase. No files were dropped.

**Identical files** (no changes vs upstream, except branding):

- `src/allowlist.ts`
- `src/manager/twiml.ts`
- `src/providers/base.ts`

**Files added in crocbot** (not in upstream):

| File | Purpose |
|------|---------|
| `src/allowlist.test.ts` | 14 unit tests for phone normalization + allowlist |
| `skills/voice-agents/SKILL.md` (project root) | Agent-focused voice skill |
| `skills/voice-agents/references/outbound-calls.md` (project root) | Outbound call reference |

Note: `skills/voice-call/SKILL.md` exists in both codebases (branding diff only).

### Change Categories

#### Branding Only (`openclaw` -> `crocbot`)

Systematic rename across all files: package name, CLI commands, default paths
(`~/.openclaw` -> `~/.crocbot`), doc URLs (`docs.openclaw.ai` ->
`aiwithapex.mintlify.app`), comments, and env vars
(`OPENCLAW_ROOT` -> `crocbot_ROOT`).

#### Formatting Only (~80% of diff volume)

Prettier/ESLint reformatting: collapsed single-statement guards, import grouping
with blank line separators, line wrapping adjustments. **No logic changes.** This
affects most files including all provider implementations.

#### Security Hardening (crocbot additions)

These changes exist in crocbot but **not** in upstream:

| File | Change |
|------|--------|
| `webhook.ts` | `sanitizeLogStr()` — strips control chars, truncates to 500 chars before logging; diagnostic request/response logging |
| `providers/stt-openai-realtime.ts` | `sanitizeLogStr()` on event types, transcripts, errors |
| `providers/twilio/webhook.ts` | `sanitizeLogStr()` on verification reason and URL |
| `cli.ts` | TOCTOU race fix: replaced `existsSync()` + `readFileSync()` with single try/catch |
| `manager/store.ts` | TOCTOU race fix: replaced `existsSync()` + `readFileSync()` with single try/catch |

#### Functional Differences

| File | Change |
|------|--------|
| `core-bridge.ts` | **Major rewrite**: upstream imports from a single bundled `dist/extensionAPI.js`; crocbot imports 8 separate modules via `Promise.all()` (`agents/agent-scope.js`, `agents/defaults.js`, `agents/identity.js`, `agents/model-selection.js`, `agents/pi-embedded.js`, `agents/timeout.js`, `agents/workspace.js`, `config/sessions.js`) |
| `config.ts` | Added `allowNgrokFreeTier` as deprecated alias for `allowNgrokFreeTierLoopbackBypass` |
| `runtime.ts` | Supports `allowNgrokFreeTier` fallback; `debug` logger made non-optional |
| `index.ts` | Removed explicit SDK type annotations (`OpenClawPluginApi`, `GatewayRequestHandlerOptions`); uses inferred types |
| `cli.ts` | Inlined `sleep()` helper (removed `import { sleep } from "openclaw/plugin-sdk"`) |
| `telephony-tts.ts` | Null-safe: `coreConfig.messages ?? {}` instead of direct access |
| `response-generator.ts` | Removed optional chaining on `result.meta` (assumes always defined) |

### Missing from Current (Not Ported)

| Item | Notes |
|------|-------|
| `docs/plugins/voice-call.md` | Upstream Mintlify doc page |
| `docs/cli/voicecall.md` | Upstream CLI reference page |
| Chinese translations | `docs/zh-CN/plugins/voice-call.md` and related |

These are upstream documentation pages that were not ported because crocbot uses
a separate docs structure. The information is covered by this document.

### Previously Synced (Sessions 1-5, 2026-02-06)

All security hardening from upstream OpenClaw has been backported:

- **Webhook security**: Forwarding header validation, hostname allowlist, trusted
  proxy IPs
- **Media stream auth**: Per-call random tokens with timing-safe validation
- **Body size limit**: 1 MB max webhook payload (HTTP 413 on overflow)
- **Config schema**: `webhookSecurity` config block, Telnyx
  `allowUnsignedWebhooks`
- **Allowlist**: Exact phone number matching (replaced old fuzzy `endsWith`
  matching)
- **Store path**: Smart resolution with existence checking
  (`~/.crocbot/voice-calls`)
- **Tests**: 14 allowlist unit tests + 6 plugin integration tests

Phase 4.3 (TTS gateway RPCs) was intentionally skipped — not needed for
Telegram-first deployment.

### Current Sync Verdict (2026-02-21)

**No sync needed.** All 8 upstream CHANGELOG entries after 2026.1.26 (through
2026.2.10) are "Version alignment with core OpenClaw release numbers" — zero
code changes to the voice-call extension. crocbot is **ahead** of upstream with:

- `sanitizeLogStr()` log-injection hardening in 3 files (`webhook.ts`,
  `providers/stt-openai-realtime.ts`, `providers/twilio/webhook.ts`)
- TOCTOU race fixes in `cli.ts` and `manager/store.ts`
- Telnyx and Plivo providers removed (Twilio-only simplification)
- Webhook diagnostic logging added to `handleRequest()`

### Completed: Twilio-Only Simplification (2026-02-21)

Telnyx and Plivo providers were removed (~1,200 lines deleted across 3 deleted
files + 11 modified files). Only Twilio and Mock remain.

| Task | Status |
|------|--------|
| Delete Telnyx provider (`providers/telnyx.ts`) | Done |
| Delete Plivo provider (`providers/plivo.ts`, `providers/plivo.test.ts`) | Done |
| Remove Telnyx/Plivo config schemas | Done |
| Remove Telnyx/Plivo webhook verification (`webhook-security.ts`) | Done |
| Simplify provider enum to `["twilio", "mock"]` | Done |
| Update docs/env examples | Done |
| Update tests (config, manager, webhook-security) | Done |
| Update plugin metadata (`crocbot.plugin.json`, `index.ts`, `README.md`) | Done |

---

## Live Testing Guide

### Prerequisites

1. **Build**: `pnpm install && pnpm build`
2. **Provider account**: Twilio or Mock
3. **OpenAI API key**: Set `OPENAI_API_KEY` in `.env` (needed for STT/TTS)
4. **Webhook reachability**: ngrok, Tailscale Funnel, or public URL

### Quick Start (Mock Provider)

```jsonc
// In crocbot.json under plugins.entries:
"voice-call": {
  "config": {
    "enabled": true,
    "provider": "mock"
  }
}
```

```bash
pnpm build
crocbot voicecall call --message "test"  # Should return a callId
```

### Twilio Setup

```jsonc
"voice-call": {
  "config": {
    "enabled": true,
    "provider": "twilio",
    "fromNumber": "+15550001234",
    "toNumber": "+15550009999",
    "twilio": {
      "accountSid": "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
      "authToken": "your-auth-token"
    }
  }
}
```

### Webhook Exposure

**Option A: ngrok** (recommended for dev with paid domain)
```jsonc
"tunnel": {
  "provider": "ngrok",
  "ngrokAuthToken": "your-token",
  "ngrokDomain": "your-domain.ngrok.io"
}
```

**Option B: Tailscale Funnel**
```bash
crocbot voicecall expose --mode funnel
```

**Option C: Public URL** (production)
```jsonc
"publicUrl": "https://your-domain.com/voice/webhook"
```

### Live Test Checklist

#### Smoke Test (Mock)

- [ ] `provider: "mock"`, `enabled: true` in config
- [ ] Build and restart gateway
- [ ] `crocbot voicecall call --message "test"` returns a callId

#### Outbound Call (Real Provider)

- [ ] Provider credentials configured
- [ ] `fromNumber` set to provider phone number
- [ ] `toNumber` set to your personal phone
- [ ] Webhook reachable (tunnel or publicUrl)
- [ ] Provider dashboard webhook URL configured
- [ ] `crocbot voicecall call --message "Hello"` — phone rings
- [ ] Answer — hear TTS message
- [ ] `crocbot voicecall status --call-id <id>` shows state
- [ ] `crocbot voicecall end --call-id <id>` hangs up

#### Inbound Call

- [ ] `inboundPolicy: "allowlist"`, your phone in `allowFrom`
- [ ] Call provider number from your phone — connects, hear greeting
- [ ] Non-allowlisted number is rejected

#### Webhook Security

- [ ] Logs show signature verification passing
- [ ] `skipSignatureVerification: false` (default)
- [ ] If behind proxy: `webhookSecurity.allowedHosts` + `trustedProxyIPs` set

#### Streaming (Optional)

```jsonc
"streaming": {
  "enabled": true,
  "openaiApiKey": "sk-...",
  "sttModel": "gpt-4o-transcribe"
}
```

### Troubleshooting

| Symptom | Check |
|---------|-------|
| "provider is required" | Set `config.provider` to twilio/mock |
| "fromNumber is required" | Set E.164 number (e.g. `+15550001234`) |
| "accountSid is required" | Set Twilio creds in config or env vars |
| Webhook 413 error | Request body exceeded 1 MB limit (normal) |
| Inbound call rejected | Check `inboundPolicy` and `allowFrom` list |
| "Unknown call" on stream | Media stream auth token validation failed |
| Webhook sig verification fail | Check `publicUrl`, `webhookSecurity`, proxy config |
| Call drops immediately after answer | Webhook may be failing silently — see below |

### Logs

```bash
# Gateway logs
journalctl --user -u crocbot-gateway --since "1 hour ago"

# Call event logs
crocbot voicecall tail
```

---

## Live Testing Status (2026-02-06) — NOT WORKING YET

### Configuration Complete

All config is wired up in `crocbot.json` and `.env`:

| Item | Status | Details |
|------|--------|---------|
| Twilio provider | Done | accountSid + authToken in config and `.env` |
| `fromNumber` | Done | `+15550009876` |
| `toNumber` | Done | `+15550001234` |
| `OPENAI_API_KEY` | Done | Added to `.env` |
| ngrok tunnel | Done | `krox.ngrok.io` (paid domain), authtoken in config + `.env` |
| Twilio dashboard | Done | Webhook URL set to `https://krox.ngrok.io/voice/webhook` |

### First Live Test Result

- Call initiated via `crocbot gateway call voicecall.initiate`
- Twilio successfully placed the call (phone rang)
- Call was answered — **but immediately dropped (~1.8s after answer)**
- No TTS audio was heard
- Call log shows full lifecycle: `initiated -> ringing -> answered -> completed`
- **No webhook request logs** were emitted when Twilio fetched TwiML after answer

### Root Cause (Investigating)

The call uses notify mode with inline TwiML (`<Say>` with Polly.Joanna).
However, the Twilio provider always uses URL-based TwiML (`Url` param, not
inline `Twiml` param) — Twilio fetches TwiML from the webhook when the call
connects. The webhook may be:

1. **Silently failing signature verification** — ngrok changes the request
   host/URL, which can break Twilio's signature check. The webhook returns 401
   but no log line was visible in `journalctl`.
2. **Returning wrong TwiML** — the webhook may not recognize the TwiML-fetch
   request vs. a status callback, returning `OK` instead of XML.
3. **Logging gap** — the webhook handler logs errors to `console.error` but
   these may not be surfacing in `journalctl`.

### Next Steps

1. ~~**Improve webhook logging**~~ — Done (2026-02-21). Diagnostic `console.log`
   lines added to `webhook.ts:handleRequest()`: every incoming request logs
   method, path, query, remote address; early rejection returns (404/405/413) log
   the reason; responses log status code, event count, and body preview (200 chars).
   All external strings are sanitized via `sanitizeLogStr()`.
2. **Test with `skipSignatureVerification: true`** — temporarily bypass sig
   checks to isolate whether it's a verification issue vs. a TwiML serving issue.
3. **Inspect ngrok traffic** — use the ngrok dashboard traffic inspector to see
   the raw request/response between Twilio and the webhook.
4. **Verify TwiML response** — curl the webhook locally with mock Twilio params
   to confirm it returns valid `<Response><Say>...</Say></Response>` XML.
