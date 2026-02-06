---
summary: "Bridge protocol (legacy nodes): TCP JSONL, scoped RPC"
read_when:
  - Building or debugging node clients
  - Investigating legacy bridge auth failures
  - Auditing the node surface exposed by the gateway
---

# Bridge protocol (legacy node transport)

The Bridge protocol is a **legacy** node transport (TCP JSONL). New node clients
should use the unified Gateway WebSocket protocol instead.

If you are building an operator or node client, use the
[Gateway protocol](/gateway/protocol).

**Note:** Current crocbot builds no longer ship the TCP bridge listener; this document is kept for historical reference.
Legacy `bridge.*` config keys are no longer part of the config schema.

## Why we have both

- **Security boundary**: the bridge exposes a small allowlist instead of the
  full gateway API surface.
- **Node identity**: node admission is owned by the gateway and tied
  to a per-node token.
- **Discovery UX**: legacy Bonjour discovery (removed) or manual tailnet targeting.
- **Loopback WS**: the full WS control plane stays local unless tunneled via SSH.

## Transport

- TCP, one JSON object per line (JSONL).
- Optional TLS (when `bridge.tls.enabled` is true).
- Legacy default listener port was `18790` (current builds do not start a TCP bridge).

When TLS is enabled, discovery TXT records include `bridgeTls=1` plus
`bridgeTlsSha256` so nodes can pin the certificate.

## Handshake (legacy)

1) Client sends `hello` with node metadata + token.  
2) If unauthorized, gateway replies `error` and closes the connection.  

`hello-ok` returns `serverName`.

## Frames

Client → Gateway:
- `req` / `res`: scoped gateway RPC (chat, sessions, config, health, voicewake, skills.bins)
- `event`: node signals (voice transcript, agent request, chat subscribe, exec lifecycle)

Gateway → Client:
- `invoke` / `invoke-res`: node commands (`camera.*`, `screen.record`,
  `location.get`, `sms.send`)
- `event`: chat updates for subscribed sessions
- `ping` / `pong`: keepalive

Legacy allowlist enforcement lived in `src/gateway/server-bridge.ts` (removed).

## Exec lifecycle events

Nodes can emit `exec.finished` or `exec.denied` events to surface system.run activity.
These are mapped to system events in the gateway. (Legacy nodes may still emit `exec.started`.)

Payload fields (all optional unless noted):
- `sessionKey` (required): agent session to receive the system event.
- `runId`: unique exec id for grouping.
- `command`: raw or formatted command string.
- `exitCode`, `timedOut`, `success`, `output`: completion details (finished only).
- `reason`: denial reason (denied only).

## Tailnet usage

- Bind the bridge to a tailnet IP: `bridge.bind: "tailnet"` in
  `~/.crocbot/crocbot.json`.
- Clients connect via MagicDNS name or tailnet IP.
- Local Bonjour discovery has been removed; use manual host/port or wide-area DNS‑SD
  when needed.

## Versioning

Bridge is currently **implicit v1** (no min/max negotiation). Backward‑compat
is expected; add a bridge protocol version field before any breaking changes.
