# src/gateway/

Gateway control plane — the central server that orchestrates sessions, channels, tools, and events.

## Structure

```
gateway/
  protocol/           # WebSocket protocol definition
    schema/           # Protocol JSON schemas
  server/             # HTTP/WS server implementation
    __tests__/        # Server tests
    ws-connection/    # WebSocket connection management
  server-methods/     # RPC method handlers
```

## Key Files

| File                       | Purpose                            |
| -------------------------- | ---------------------------------- |
| `server.impl.ts`           | Main gateway server implementation |
| `server-http.ts`           | HTTP endpoint handlers             |
| `server-tailscale.ts`      | Tailscale Serve/Funnel integration |
| `server-runtime-config.ts` | Runtime configuration management   |
| `server-runtime-state.ts`  | Runtime state tracking             |
| `server-methods/agent.ts`  | Agent RPC method handlers          |

## Architecture

```
Telegram / CLI / WebChat
         │
         ▼
   ┌─────────────┐
   │   Gateway    │  ws://127.0.0.1:18789
   │  HTTP + WS   │
   └──────┬──────┘
          │
   ┌──────┴──────┐
   │ RPC Methods  │  (agent, session, config, cron, etc.)
   └──────┬──────┘
          │
   ┌──────┴──────┐
   │  Pi Agent    │  (tool streaming, block streaming)
   └─────────────┘
```

## Related

- Gateway CLI: `src/cli/gateway-cli/`
- Gateway docs: [Gateway runbook](https://aiwithapex.mintlify.app/gateway)
- Protocol: `src/gateway/protocol/`
