# Voice-Call Live Testing Guide

> Instructions for configuring, deploying, and live-testing the voice-call
> extension on crocbot. All security hardening from the upstream sync is
> complete (Phases 1-4, Sessions 1-5, 2026-02-06).

---

## Prerequisites

1. **Build the project**
   ```bash
   pnpm install && pnpm build
   ```

2. **Provider account** — you need at least one of:
   - **Twilio** account with a phone number, Account SID, and Auth Token
   - **Telnyx** account with an API key, Connection ID, and (optionally) Public Key
   - **Plivo** account with Auth ID and Auth Token
   - **Mock** provider (no account needed — for local dev/testing without network)

3. **OpenAI API key** — needed for STT (Whisper) and TTS (gpt-4o-mini-tts).
   Set `OPENAI_API_KEY` in `.env`.

4. **Webhook reachability** — the telephony provider must be able to reach your
   webhook server. Options:
   - **Coolify/Docker** with a public URL (production)
   - **Tailscale Funnel** (`crocbot voicecall expose --mode funnel`)
   - **ngrok** tunnel
   - **publicUrl** config override (if you handle routing yourself)

---

## Configuration

Add the voice-call plugin to your `crocbot.json` under `plugins.entries`:

### Minimal Twilio Example

```jsonc
{
  "plugins": {
    "entries": {
      "voice-call": {
        "config": {
          "enabled": true,
          "provider": "twilio",
          "fromNumber": "+15550001234",   // Your Twilio number (E.164)
          "toNumber": "+15550009999",     // Default outbound target (E.164)
          "twilio": {
            "accountSid": "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
            "authToken": "your-auth-token"
          }
        }
      }
    }
  }
}
```

Credentials can also come from environment variables:
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`
- `TELNYX_API_KEY`, `TELNYX_CONNECTION_ID`, `TELNYX_PUBLIC_KEY`
- `PLIVO_AUTH_ID`, `PLIVO_AUTH_TOKEN`

### Minimal Telnyx Example

```jsonc
{
  "plugins": {
    "entries": {
      "voice-call": {
        "config": {
          "enabled": true,
          "provider": "telnyx",
          "fromNumber": "+15550001234",
          "toNumber": "+15550009999",
          "telnyx": {
            "apiKey": "KEY...",
            "connectionId": "uuid-here"
          }
        }
      }
    }
  }
}
```

### Mock Provider (No Network)

```jsonc
{
  "plugins": {
    "entries": {
      "voice-call": {
        "config": {
          "enabled": true,
          "provider": "mock"
        }
      }
    }
  }
}
```

---

## Webhook Exposure

The telephony provider sends HTTP callbacks to your webhook server. The server
listens on `127.0.0.1:3334` by default (configurable via `serve.port` /
`serve.bind` / `serve.path`).

### Option A: Tailscale Funnel (Recommended for Dev)

```bash
crocbot voicecall expose --mode funnel
```

This prints a JSON response with `publicUrl` — set that as your Twilio/Telnyx
webhook URL in the provider dashboard, or use it as the `publicUrl` config field.

To stop:
```bash
crocbot voicecall expose --mode off
```

### Option B: ngrok

Set in config:
```jsonc
"tunnel": {
  "provider": "ngrok",
  "ngrokAuthToken": "your-token",       // or NGROK_AUTHTOKEN env
  "ngrokDomain": "your-domain.ngrok.io" // optional paid feature
}
```

For free-tier ngrok (loopback bypass):
```jsonc
"tunnel": {
  "provider": "ngrok",
  "allowNgrokFreeTierLoopbackBypass": true
}
```

### Option C: Public URL (Coolify/Docker/Manual)

If your server is already internet-facing:
```jsonc
"publicUrl": "https://your-domain.com/voice/webhook"
```

### Webhook Security (Production)

When behind a reverse proxy (Coolify, nginx, Caddy), configure:
```jsonc
"webhookSecurity": {
  "allowedHosts": ["your-domain.com"],
  "trustForwardingHeaders": true,
  "trustedProxyIPs": ["172.17.0.1"]  // Your proxy's IP
}
```

This prevents attackers from forging `X-Forwarded-Host` headers to bypass
signature verification.

---

## Inbound Calls

By default, inbound calls are blocked (`inboundPolicy: "disabled"`).

### Allowlist Mode

Only accept calls from specific numbers:
```jsonc
"inboundPolicy": "allowlist",
"allowFrom": ["+15550001111", "+15550002222"],
"inboundGreeting": "Hello, you've reached crocbot."
```

Phone number matching is exact (digits only, after stripping formatting).

### Open Mode (Dangerous)

Accept all inbound calls:
```jsonc
"inboundPolicy": "open"
```

**Note:** For Telnyx with `allowlist` or `pairing` inbound policy, you must
also set `telnyx.publicKey` for webhook signature verification.

---

## CLI Commands

All commands are under `crocbot voicecall`:

### Make an Outbound Call

```bash
# Uses configured toNumber
crocbot voicecall call --message "Hello from crocbot"

# Call a specific number
crocbot voicecall call --to +15550009999 --message "Testing voice call"

# Notify mode (auto-hangup after message)
crocbot voicecall call --to +15550009999 --message "Quick alert" --mode notify

# Conversation mode (stays open)
crocbot voicecall call --to +15550009999 --message "Let's chat" --mode conversation
```

Output: `{ "callId": "..." }`

### Interact with Active Call

```bash
# Speak and wait for response
crocbot voicecall continue --call-id <id> --message "How are you?"

# Speak without waiting
crocbot voicecall speak --call-id <id> --message "One moment please"

# Hang up
crocbot voicecall end --call-id <id>
```

### Check Call Status

```bash
crocbot voicecall status --call-id <id>
```

### Tail Call Logs

```bash
# Tail the JSONL call log (default: last 25 lines, poll every 250ms)
crocbot voicecall tail
crocbot voicecall tail --since 50 --poll 500
crocbot voicecall tail --file /custom/path/calls.jsonl
```

Call logs are stored at `~/.crocbot/voice-calls/calls.jsonl` by default (or
`config.store` if set).

---

## Gateway RPC Methods

When the gateway is running, these RPC methods are available over WebSocket:

| Method | Params | Description |
|--------|--------|-------------|
| `voicecall.initiate` | `{ message, to?, mode? }` | Start outbound call |
| `voicecall.continue` | `{ callId, message }` | Speak and wait for response |
| `voicecall.speak` | `{ callId, message }` | Speak without waiting |
| `voicecall.end` | `{ callId }` | Hang up |
| `voicecall.status` | `{ callId }` | Get call state |
| `voicecall.start` | `{ to, message? }` | Start call (to required) |

---

## Live Test Checklist

### Smoke Test (Mock Provider)

- [ ] Set `provider: "mock"`, `enabled: true` in config
- [ ] `pnpm build && systemctl --user restart crocbot-gateway`
- [ ] `crocbot voicecall call --message "test"` — should return a callId

### Outbound Call (Real Provider)

- [ ] Set provider credentials (Twilio/Telnyx/Plivo)
- [ ] Set `fromNumber` to your provider phone number
- [ ] Set `toNumber` to your personal phone
- [ ] Ensure webhook is reachable (Tailscale funnel, ngrok, or publicUrl)
- [ ] Configure provider dashboard webhook URL to point to your server
- [ ] `crocbot voicecall call --message "Hello from crocbot"` — phone should ring
- [ ] Answer the call — you should hear the message via TTS
- [ ] Check `crocbot voicecall status --call-id <id>` for call state
- [ ] `crocbot voicecall end --call-id <id>` — call should hang up

### Inbound Call

- [ ] Set `inboundPolicy: "allowlist"` and add your phone to `allowFrom`
- [ ] Call the provider phone number from your personal phone
- [ ] Verify the call connects and you hear the `inboundGreeting`
- [ ] Verify calls from non-allowlisted numbers are rejected

### Webhook Security

- [ ] Verify logs show webhook signature verification passing
- [ ] Test with `skipSignatureVerification: false` (default, production)
- [ ] If behind a proxy, set `webhookSecurity.allowedHosts` and
      `webhookSecurity.trustedProxyIPs`

### Streaming (Optional)

If testing real-time audio streaming:
```jsonc
"streaming": {
  "enabled": true,
  "openaiApiKey": "sk-...",  // or use OPENAI_API_KEY env
  "sttModel": "gpt-4o-transcribe"
}
```

---

## Troubleshooting

| Symptom | Check |
|---------|-------|
| "provider is required" | Set `config.provider` to twilio/telnyx/plivo/mock |
| "fromNumber is required" | Set E.164 number (e.g. `+15550001234`) |
| "accountSid is required" | Set Twilio creds in config or env vars |
| Webhook 413 error | Request body exceeded 1 MB limit (normal protection) |
| Inbound call rejected | Check `inboundPolicy` and `allowFrom` list |
| "Unknown call" on stream | Media stream auth token validation failed (expected) |
| Webhook sig verification fail | Check `publicUrl`, `webhookSecurity`, proxy config |

### Logs

```bash
# Gateway logs
journalctl --user -u crocbot-gateway --since "1 hour ago"

# Call event logs
crocbot voicecall tail
```

---

## Key Config Reference

| Field | Default | Description |
|-------|---------|-------------|
| `enabled` | `false` | Enable the voice-call extension |
| `provider` | — | `twilio`, `telnyx`, `plivo`, or `mock` |
| `fromNumber` | — | Your provider phone number (E.164) |
| `toNumber` | — | Default outbound target (E.164) |
| `inboundPolicy` | `"disabled"` | `disabled`, `allowlist`, `pairing`, `open` |
| `allowFrom` | `[]` | E.164 numbers allowed for inbound |
| `inboundGreeting` | — | Greeting message for inbound callers |
| `outbound.defaultMode` | `"notify"` | `notify` (auto-hangup) or `conversation` |
| `outbound.notifyHangupDelaySec` | `3` | Seconds after TTS before auto-hangup |
| `maxDurationSeconds` | `300` | Max call duration (5 min) |
| `maxConcurrentCalls` | `1` | Concurrent call limit |
| `serve.port` | `3334` | Webhook server port |
| `serve.bind` | `"127.0.0.1"` | Webhook server bind address |
| `serve.path` | `"/voice/webhook"` | Webhook URL path |
| `publicUrl` | — | Manual public URL override |
| `skipSignatureVerification` | `false` | Skip webhook sig checks (dev only) |
| `store` | — | Custom path for call logs |
| `responseModel` | `"openai/gpt-4o-mini"` | Model for voice responses |
| `responseTimeoutMs` | `30000` | Response generation timeout |

---

## Live Testing Status (2026-02-06) — NOT WORKING YET

### Configuration Complete

All config is wired up in `crocbot.json` and `.env`:

| Item | Status | Details |
|------|--------|---------|
| Twilio provider | Done | accountSid + authToken in config and `.env` |
| `fromNumber` | Done | `+18164514915` |
| `toNumber` | Done | `+972525936481` |
| `OPENAI_API_KEY` | Done | Added to `.env` |
| ngrok tunnel | Done | `krox.ngrok.io` (paid domain), authtoken in config + `.env` + `~/.config/ngrok/ngrok.yml` |
| Twilio dashboard | Done | Webhook URL set to `https://krox.ngrok.io/voice/webhook` |

### First Live Test Result

- Call initiated via `crocbot gateway call voicecall.initiate`
- Twilio successfully placed the call (phone rang)
- Call was answered — **but immediately dropped (~1.8s after answer)**
- No TTS audio was heard
- Call log shows full lifecycle: `initiated → ringing → answered → completed`
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

1. **Improve webhook logging** — add request-level logging to
   `webhook.ts:handleRequest()` so every incoming POST is visible (method, path,
   query params, response code, body preview). Currently there is zero visibility
   into what Twilio sends and what the webhook responds.
2. **Test with `skipSignatureVerification: true`** — temporarily bypass sig
   checks to isolate whether it's a verification issue vs. a TwiML serving issue.
3. **Inspect ngrok traffic** — use `ngrok inspect` or the ngrok dashboard
   (`https://dashboard.ngrok.com/traffic-inspector`) to see the raw
   request/response between Twilio and the webhook.
4. **Verify TwiML response** — curl the webhook locally with mock Twilio params
   to confirm it returns valid `<Response><Say>...</Say></Response>` XML.

---

## Upstream Sync Status (Complete)

All security hardening from upstream OpenClaw has been backported (Sessions 1-5):

- **Webhook security**: Forwarding header validation, hostname allowlist, trusted proxy IPs
- **Media stream auth**: Per-call random tokens with timing-safe validation
- **Body size limit**: 1 MB max webhook payload (HTTP 413 on overflow)
- **Config schema**: `webhookSecurity` config block, Telnyx `allowUnsignedWebhooks`
- **Allowlist**: Exact phone number matching (replaced old fuzzy `endsWith` matching)
- **Store path**: Smart resolution with existence checking (`~/.crocbot/voice-calls`)
- **Tests**: 14 allowlist unit tests + 6 plugin integration tests

Phase 4.3 (TTS gateway RPCs) was intentionally skipped — not needed for
Telegram-first deployment.
