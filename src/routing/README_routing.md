# src/routing/

Message routing — resolves which session and agent handle each inbound message.

## Key Files

| File | Purpose |
|------|---------|
| `resolve.ts` | Route resolution logic |
| `session-binding.ts` | Binds messages to sessions |

## How It Works

When a message arrives, the routing module:
1. Identifies the source channel and sender
2. Resolves the target session (main, group, or named)
3. Binds the message to the appropriate agent instance

## Related

- Auto-reply dispatch: `src/auto-reply/`
- Session management: `src/sessions/`
- Channel registry: `src/channels/`
