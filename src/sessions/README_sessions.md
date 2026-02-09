# src/sessions/

Session management — model overrides, send policies, transcript events, and labels.

## Key Files

| File                   | Purpose                                   |
| ---------------------- | ----------------------------------------- |
| `model-overrides.ts`   | Per-session model selection overrides     |
| `send-policy.ts`       | Controls when/how responses are delivered |
| `transcript-events.ts` | Session transcript event handling         |
| `labels.ts`            | Session labeling and metadata             |

## Session Model

- **main** — the default session for direct chats
- **group** — isolated sessions per Telegram group
- **named** — custom sessions for specific workflows

Each session maintains its own conversation history, model selection, and memory state.

## Related

- Session tools: [Session tools docs](https://aiwithapex.mintlify.app/concepts/session-tool)
- Agent runtime: `src/agents/`
- Routing: `src/routing/`
