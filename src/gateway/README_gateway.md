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

| File                       | Purpose                                                                                 |
| -------------------------- | --------------------------------------------------------------------------------------- |
| `server.impl.ts`           | Main gateway server implementation                                                      |
| `server-http.ts`           | HTTP endpoint handlers                                                                  |
| `server-tailscale.ts`      | Tailscale Serve/Funnel integration                                                      |
| `server-runtime-config.ts` | Runtime configuration management                                                        |
| `server-runtime-state.ts`  | Runtime state tracking                                                                  |
| `server-methods/agent.ts`  | Agent RPC method handlers                                                               |
| `security-headers.ts`      | Security headers (CSP, X-Frame-Options, nosniff) and path traversal/null byte filtering |
| `auth-rate-limit.ts`       | Sliding-window per-IP auth rate limiting with lockout                                   |
| `rate-limit.ts`            | General per-IP request rate limiting                                                    |

## Stability (Phase 17)

- Session reset aborts active agent runs before proceeding
- Config merge uses array-by-id merging (preserves ordering)
- Session keys normalized to lowercase (prevents ghost sessions from case mismatches)
- WebSocket max payload increased to 5 MB
- Agent run sequence map bounded (prevents unbounded memory growth)
- Expired hook auth state pruned automatically
- Deferred restart until all replies sent

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
