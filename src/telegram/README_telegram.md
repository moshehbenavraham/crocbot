# src/telegram/

Telegram bot implementation — the primary chat channel for crocbot.

## Structure

```
telegram/
  bot/          # Bot creation and lifecycle
```

## Key Files

| File | Purpose |
|------|---------|
| `bot-handlers.ts` | Message and callback handlers |
| `model-buttons.ts` | Inline keyboard for model selection |
| `network-errors.ts` | grammY timeout and network error recovery |
| `monitor.ts` | Scoped rejection handler |
| `context.ts` | Telegram context management |
| `updates.ts` | Update processing pipeline |
| `audit.ts` | Telegram-specific auditing |

## Tech Stack

- **grammY** — Telegram Bot API framework
- **@grammyjs/runner** — Long-polling runner with graceful shutdown
- **@grammyjs/transformer-throttler** — Rate limiting for Telegram API calls

## Features

- Full bot integration: DMs, groups, media, inline keyboards
- DM pairing for security (unknown senders get a pairing code)
- Group routing with mention gating
- Media handling (photos, voice messages, documents, video)
- Chat commands (`/status`, `/new`, `/think`, `/compact`, etc.)

## Related

- Channel abstraction: `src/channels/`
- Telegram config: `channels.telegram` in crocbot.json
- Telegram docs: [Telegram guide](https://aiwithapex.mintlify.app/channels/telegram)
