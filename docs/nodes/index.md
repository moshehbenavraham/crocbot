---
summary: "Nodes: pairing, capabilities, permissions, and CLI helpers for canvas/camera/screen/system"
read_when:
  - Pairing nodes to a gateway
  - Using node canvas/camera for agent context
  - Adding new node commands or CLI helpers
---

# Nodes

A **node** is a companion device (headless) that connects to the Gateway **WebSocket** (same port as operators) with `role: "node"` and exposes a command surface (e.g. `canvas.*`, `camera.*`, `system.*`) via `node.invoke`. Protocol details: [Gateway protocol](/gateway/protocol).

Legacy transport: [Bridge protocol](/gateway/bridge-protocol) (TCP JSONL; deprecated/removed for current nodes).

Notes:
- Nodes are **peripherals**, not gateways. They don't run the gateway service.
- Telegram messages land on the **gateway**, not on nodes.

## Pairing + status

**WS nodes use device pairing.** Nodes present a device identity during `connect`; the Gateway
creates a device pairing request for `role: node`. Approve via the devices CLI (or UI).

Quick CLI:

```bash
crocbot devices list
crocbot devices approve <requestId>
crocbot devices reject <requestId>
crocbot nodes status
crocbot nodes describe --node <idOrNameOrIp>
```

Notes:
- `nodes status` marks a node as **paired** when its device pairing role includes `node`.
- `node.pair.*` (CLI: `crocbot nodes pending/approve/reject`) is a separate gateway-owned
  node pairing store; it does **not** gate the WS `connect` handshake.

## Remote node host (system.run)

Use a **node host** when your Gateway runs on one machine and you want commands
to execute on another. The model still talks to the **gateway**; the gateway
forwards `exec` calls to the **node host** when `host=node` is selected.

### What runs where
- **Gateway host**: receives messages, runs the model, routes tool calls.
- **Node host**: executes `system.run`/`system.which` on the node machine.
- **Approvals**: enforced on the node host via `~/.clawdbot/exec-approvals.json`.

### Start a node host (foreground)

On the node machine:

```bash
crocbot node run --host <gateway-host> --port 18789 --display-name "Build Node"
```

### Start a node host (service)

```bash
crocbot node install --host <gateway-host> --port 18789 --display-name "Build Node"
crocbot node restart
```

### Pair + name

On the gateway host:

```bash
crocbot nodes pending
crocbot nodes approve <requestId>
crocbot nodes list
```

Naming options:
- `--display-name` on `crocbot node run` / `crocbot node install` (persists in `~/.clawdbot/node.json` on the node).
- `crocbot nodes rename --node <id|name|ip> --name "Build Node"` (gateway override).

### Allowlist the commands

Exec approvals are **per node host**. Add allowlist entries from the gateway:

```bash
crocbot approvals allowlist add --node <id|name|ip> "/usr/bin/uname"
crocbot approvals allowlist add --node <id|name|ip> "/usr/bin/sw_vers"
```

Approvals live on the node host at `~/.clawdbot/exec-approvals.json`.

### Point exec at the node

Configure defaults (gateway config):

```bash
crocbot config set tools.exec.host node
crocbot config set tools.exec.security allowlist
crocbot config set tools.exec.node "<id-or-name>"
```

Or per session:

```
/exec host=node security=allowlist node=<id-or-name>
```

Once set, any `exec` call with `host=node` runs on the node host (subject to the
node allowlist/approvals).

Related:
- [Node host CLI](/cli/node)
- [Exec tool](/tools/exec)
- [Exec approvals](/tools/exec-approvals)

## Invoking commands

Low-level (raw RPC):

```bash
crocbot nodes invoke --node <idOrNameOrIp> --command canvas.eval --params '{"javaScript":"location.href"}'
```

Higher-level helpers exist for the common "give the agent a MEDIA attachment" workflows.

## Screenshots (canvas snapshots)

If the node is showing the Canvas (WebView), `canvas.snapshot` returns `{ format, base64 }`.

CLI helper (writes to a temp file and prints `MEDIA:<path>`):

```bash
crocbot nodes canvas snapshot --node <idOrNameOrIp> --format png
crocbot nodes canvas snapshot --node <idOrNameOrIp> --format jpg --max-width 1200 --quality 0.9
```

### Canvas controls

```bash
crocbot nodes canvas present --node <idOrNameOrIp> --target https://example.com
crocbot nodes canvas hide --node <idOrNameOrIp>
crocbot nodes canvas navigate https://example.com --node <idOrNameOrIp>
crocbot nodes canvas eval --node <idOrNameOrIp> --js "document.title"
```

Notes:
- `canvas present` accepts URLs or local file paths (`--target`), plus optional `--x/--y/--width/--height` for positioning.
- `canvas eval` accepts inline JS (`--js`) or a positional arg.

### A2UI (Canvas)

```bash
crocbot nodes canvas a2ui push --node <idOrNameOrIp> --text "Hello"
crocbot nodes canvas a2ui push --node <idOrNameOrIp> --jsonl ./payload.jsonl
crocbot nodes canvas a2ui reset --node <idOrNameOrIp>
```

Notes:
- Only A2UI v0.8 JSONL is supported (v0.9/createSurface is rejected).

## Photos + videos (node camera)

Photos (`jpg`):

```bash
crocbot nodes camera list --node <idOrNameOrIp>
crocbot nodes camera snap --node <idOrNameOrIp>            # default: both facings (2 MEDIA lines)
crocbot nodes camera snap --node <idOrNameOrIp> --facing front
```

Video clips (`mp4`):

```bash
crocbot nodes camera clip --node <idOrNameOrIp> --duration 10s
crocbot nodes camera clip --node <idOrNameOrIp> --duration 3000 --no-audio
```

Notes:
- The node must be **foregrounded** for `canvas.*` and `camera.*` (background calls return `NODE_BACKGROUND_UNAVAILABLE`).
- Clip duration is clamped (currently `<= 60s`) to avoid oversized base64 payloads.

## Screen recordings (nodes)

Nodes expose `screen.record` (mp4). Example:

```bash
crocbot nodes screen record --node <idOrNameOrIp> --duration 10s --fps 10
crocbot nodes screen record --node <idOrNameOrIp> --duration 10s --fps 10 --no-audio
```

Notes:
- `screen.record` requires the node app to be foregrounded.
- Screen recordings are clamped to `<= 60s`.
- `--no-audio` disables microphone capture.
- Use `--screen <index>` to select a display when multiple screens are available.

## Location (nodes)

Nodes expose `location.get` when Location is enabled in settings.

CLI helper:

```bash
crocbot nodes location get --node <idOrNameOrIp>
crocbot nodes location get --node <idOrNameOrIp> --accuracy precise --max-age 15000 --location-timeout 10000
```

Notes:
- Location is **off by default**.
- "Always" requires system permission; background fetch is best-effort.
- The response includes lat/lon, accuracy (meters), and timestamp.

## System commands (node host)

The headless node host exposes `system.run`, `system.which`, and `system.execApprovals.get/set`.

Examples:

```bash
crocbot nodes run --node <idOrNameOrIp> -- echo "Hello from node"
crocbot nodes notify --node <idOrNameOrIp> --title "Ping" --body "Gateway ready"
```

Notes:
- `system.run` returns stdout/stderr/exit code in the payload.
- `system.run` supports `--cwd`, `--env KEY=VAL`, `--command-timeout`, and `--needs-screen-recording`.
- `system.notify` supports `--priority <passive|active|timeSensitive>` and `--delivery <system|overlay|auto>`.
- On headless node host, `system.run` is gated by exec approvals (`~/.clawdbot/exec-approvals.json`).

## Exec node binding

When multiple nodes are available, you can bind exec to a specific node.
This sets the default node for `exec host=node` (and can be overridden per agent).

Global default:

```bash
crocbot config set tools.exec.node "node-id-or-name"
```

Per-agent override:

```bash
crocbot config get agents.list
crocbot config set agents.list[0].tools.exec.node "node-id-or-name"
```

Unset to allow any node:

```bash
crocbot config unset tools.exec.node
crocbot config unset agents.list[0].tools.exec.node
```

## Permissions map

Nodes may include a `permissions` map in `node.list` / `node.describe`, keyed by permission name (e.g. `screenRecording`, `accessibility`) with boolean values (`true` = granted).

## Headless node host (cross-platform)

crocbot can run a **headless node host** (no UI) that connects to the Gateway
WebSocket and exposes `system.run` / `system.which`. This is useful on Linux/Windows
or for running a minimal node alongside a server.

Start it:

```bash
crocbot node run --host <gateway-host> --port 18789
```

Notes:
- Pairing is still required (the Gateway will show a node approval prompt).
- The node host stores its node id, token, display name, and gateway connection info in `~/.clawdbot/node.json`.
- Exec approvals are enforced locally via `~/.clawdbot/exec-approvals.json`
  (see [Exec approvals](/tools/exec-approvals)).
- Add `--tls` / `--tls-fingerprint` when the Gateway WS uses TLS.
