# src/channels/

Channel abstraction layer — registers communication channels and manages their lifecycle.

## Structure

```
channels/
  allowlists/     # Sender allowlist management
  plugins/        # Channel plugin system
    actions/      # Channel action handlers
    normalize/    # Message normalization
    onboarding/   # Channel-specific onboarding
    outbound/     # Outbound message delivery
    status-issues/ # Channel health checks
```

## Key Files

| File | Purpose |
|------|---------|
| `registry.ts` | Channel registration and docking |
| `channel-config.ts` | Channel configuration schema |
| `ack-reactions.ts` | Acknowledgment reactions (read receipts, etc.) |
| `command-gating.ts` | Permission checks for channel commands |
| `mention-gating.ts` | @mention filtering for group messages |

## Active Channels

Crocbot currently supports **Telegram only** as its chat channel. The channel abstraction remains for future extensibility.

## Related

- Telegram implementation: `src/telegram/`
- Message routing: `src/routing/`
- Auto-reply dispatch: `src/auto-reply/`
