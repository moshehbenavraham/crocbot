# src/auto-reply/

Message dispatch engine — routes inbound messages to the appropriate handler, manages command detection, and orchestrates reply delivery.

## Structure

```
auto-reply/
  reply/          # Reply execution pipeline
    exec/         # Reply execution strategies
```

## Key Files

| File                   | Purpose                                                      |
| ---------------------- | ------------------------------------------------------------ |
| `dispatch.ts`          | Main message routing and dispatch                            |
| `commands-registry.ts` | Chat command definitions (`/status`, `/new`, `/think`, etc.) |
| `commands-args.ts`     | Command argument parsing                                     |
| `command-detection.ts` | Identifies commands in messages                              |
| `envelope.ts`          | Message envelope wrapping                                    |
| `chunk.ts`             | Response chunking for channel limits                         |

## How It Works

1. Inbound message arrives from a channel (Telegram)
2. `command-detection.ts` checks if it's a chat command
3. If command: dispatched to the registered handler
4. If regular message: routed to the agent for processing
5. Response is chunked if needed and delivered back to the channel
