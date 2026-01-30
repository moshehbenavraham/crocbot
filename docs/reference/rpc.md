---
summary: "RPC adapter patterns for external CLIs and gateway integrations"
read_when:
  - Adding or changing external CLI integrations
  - Understanding RPC adapter patterns
---
# RPC adapters

crocbot can integrate external CLIs via JSON-RPC. Common patterns are documented here.

## Pattern A: HTTP daemon
- External CLI runs as a daemon with JSON-RPC over HTTP.
- Event stream via SSE.
- Health probe endpoint for diagnostics.
- crocbot owns lifecycle when `autoStart=true`.

## Pattern B: stdio child process
- crocbot spawns the CLI as a child process.
- JSON-RPC is line-delimited over stdin/stdout (one JSON object per line).
- No TCP port, no daemon required.

Core method patterns:
- `watch.subscribe` for notifications
- `watch.unsubscribe`
- `send`
- `list` (probe/diagnostics)

## Adapter guidelines
- Gateway owns the process (start/stop tied to provider lifecycle).
- Keep RPC clients resilient: timeouts, restart on exit.
- Prefer stable IDs over display strings.
