---
summary: "Nodes: capabilities, permissions, and CLI helpers for camera/screen/system"
read_when:
  - Connecting nodes to a gateway
  - Using node camera for agent context
  - Adding new node commands or CLI helpers
---

# Nodes

A **node** is a companion device (headless) that connects to the Gateway **WebSocket** (same port as operators) with `role: "node"` and exposes a command surface (e.g. `camera.*`, `system.*`) via `node.invoke`. Protocol details: [Gateway protocol](/gateway/protocol).

Legacy transport: [Bridge protocol](/gateway/bridge-protocol) (TCP JSONL; deprecated/removed for current nodes).

Notes:
- Nodes are **peripherals**, not gateways. They don't run the gateway service.
- Telegram messages land on the **gateway**, not on nodes.

## Status + identity

Nodes connect over the Gateway WebSocket with `role: "node"`. Use the CLI to inspect:

```bash
crocbot nodes status
crocbot nodes describe --node <idOrNameOrIp>
```

Notes:
- `nodes status` shows connection state and capabilities.
- Use `--display-name` when starting a node to set a friendly name.

## Remote node host (system.run)

Use a **node host** when your Gateway runs on one machine and you want commands
to execute on another. The model still talks to the **gateway**; the gateway
forwards `exec` calls to the **node host** when `host=node` is selected.

### What runs where
- **Gateway host**: receives messages, runs the model, routes tool calls.
- **Node host**: executes `system.run`/`system.which` on the node machine.
- **Approvals**: enforced on the node host via `~/.crocbot/exec-approvals.json`.

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

### Naming

Naming options:
- `--display-name` on `crocbot node run` / `crocbot node install` (persists in `~/.crocbot/node.json` on the node).
- `crocbot nodes rename --node <id|name|ip> --name "Build Node"` (gateway override).

### Allowlist the commands

Exec approvals are **per node host**. Add allowlist entries from the gateway:

```bash
crocbot approvals allowlist add --node <id|name|ip> "/usr/bin/uname"
crocbot approvals allowlist add --node <id|name|ip> "/usr/bin/sw_vers"
```

Approvals live on the node host at `~/.crocbot/exec-approvals.json`.

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
crocbot nodes invoke --node <idOrNameOrIp> --command system.run --params '{"command":["echo","hello"]}'
```

Higher-level helpers exist for the common "give the agent a MEDIA attachment" workflows.

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
- The node must be **foregrounded** for `camera.*` (background calls return `NODE_BACKGROUND_UNAVAILABLE`).
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
- On headless node host, `system.run` is gated by exec approvals (`~/.crocbot/exec-approvals.json`).

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
- Ensure gateway auth is configured for non-loopback connections.
- The node host stores its node id, token, display name, and gateway connection info in `~/.crocbot/node.json`.
- Exec approvals are enforced locally via `~/.crocbot/exec-approvals.json`
  (see [Exec approvals](/tools/exec-approvals)).
- Add `--tls` / `--tls-fingerprint` when the Gateway WS uses TLS.
