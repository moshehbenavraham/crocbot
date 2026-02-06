# src/pairing/

Device pairing state management — tracks pairing codes for DM authentication.

## How It Works

When `dmPolicy="pairing"` (the default), unknown Telegram senders receive a short pairing code. Once approved via `crocbot pairing approve telegram <code>`, the sender is added to the local allowlist.

## Related

- Security: [Security guide](https://aiwithapex.mintlify.app/gateway/security)
- Channel allowlists: `src/channels/allowlists/`
