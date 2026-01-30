---
summary: "Messaging platform crocbot connects to"
read_when:
  - You want to set up the Telegram channel for crocbot
  - You need a quick overview of the supported messaging platform
---
# Chat Channels

crocbot connects to Telegram via the Gateway. Text, media, and reactions are fully supported.

## Supported channel

- [Telegram](/channels/telegram) - Bot API via grammY; supports groups, DMs, and media.
- [WebChat](/web/webchat) - Gateway WebChat UI over WebSocket.

## Notes

- Fastest setup is **Telegram** (simple bot token via BotFather).
- Group behavior: see [Groups](/concepts/groups).
- DM pairing and allowlists are enforced for safety; see [Security](/gateway/security).
- Telegram internals: [grammY notes](/channels/grammy).
- Troubleshooting: [Channel troubleshooting](/channels/troubleshooting).
- Model providers are documented separately; see [Model Providers](/providers/models).
