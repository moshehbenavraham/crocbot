---
summary: "Node discovery and transports (Tailnet DNS-SD, SSH) for finding the gateway"
read_when:
  - Designing gateway discovery for remote clients or nodes
  - Choosing between direct WS and SSH access
---

# Discovery & transports

crocbot has two related problems that look similar on the surface:

1) **Operator remote control**: clients controlling a gateway running elsewhere.
2) **Node connectivity**: nodes finding and connecting to a gateway.

The goal is to keep discovery and transport logic in the **Gateway** and keep
clients/nodes as consumers.

## Terms

- **Gateway**: a single long-running process that owns state and runs channels.
- **Gateway WS (control plane)**: WebSocket endpoint on `127.0.0.1:18789` by default; can be bound to LAN/tailnet via `gateway.bind`.
- **Direct WS transport**: a LAN/tailnet-facing Gateway WS endpoint (no SSH).
- **SSH transport (fallback)**: remote control by forwarding `127.0.0.1:18789` over SSH.
- **Legacy TCP bridge (deprecated/removed)**: older node transport (see [Bridge protocol](/gateway/bridge-protocol)); no longer advertised for discovery.

Protocol details:
- [Gateway protocol](/gateway/protocol)
- [Bridge protocol (legacy)](/gateway/bridge-protocol)

## Discovery inputs (how clients learn where the gateway is)

### 1) Tailnet DNS-SD (recommended)

crocbot supports **wide‑area DNS‑SD** over Tailnet for discovery. This replaces
local mDNS/Bonjour, which has been removed from the Telegram-only build.

High‑level flow:
1) Run a DNS server on the gateway host (reachable over Tailnet).
2) Publish DNS‑SD records for `_crocbot-gw._tcp` under `crocbot.internal.`.
3) Configure Tailscale split DNS so clients resolve `crocbot.internal.` via that DNS server.

Gateway config (recommended):

```json5
{
  gateway: { bind: "tailnet" },
  discovery: { wideArea: { enabled: true } }
}
```

One‑time DNS server setup on the gateway host:

```bash
crocbot dns setup --apply
```

### 2) Manual direct WS (LAN/tailnet)

If you already know the gateway host, connect directly over LAN or Tailnet:

- `ws://<host>:18789` (or whatever port you configured)
- Use `gateway.auth.token` or `gateway.auth.password` for non-loopback binds.

### 3) SSH tunnel (fallback)

When direct access is not possible, use SSH to forward the loopback port:

```bash
ssh -N -L 18789:127.0.0.1:18789 user@host
```

See [Remote access](/gateway/remote).

## Transport selection (client policy)

Recommended client behavior:

1) If a direct endpoint is configured and reachable, use it.
2) Else, if Tailnet DNS-SD discovery is enabled, offer a one-tap “Use this gateway”.
3) Else, fall back to SSH.

## Authentication

The gateway enforces auth on all non-loopback connections:

- **Token auth** (`gateway.auth.token`) or **password auth** (`gateway.auth.password`)
- Scope/ACLs enforced by the gateway
- Rate limits and per-method guards still apply

See [Gateway security](/gateway/security).

## Responsibilities by component

- **Gateway**: advertises discovery beacons, owns auth, and hosts the WS endpoint.
- **Clients**: store direct endpoints, connect with auth, and use SSH as fallback.
- **Nodes**: connect to the paired gateway endpoint configured by the operator.
