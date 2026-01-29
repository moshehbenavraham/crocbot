---
summary: "CLI reference for `crocbot voicecall` (voice-call plugin command surface)"
read_when:
  - You use the voice-call plugin and want the CLI entry points
  - You want quick examples for `voicecall call|continue|status|tail|expose`
---

# `crocbot voicecall`

`voicecall` is a plugin-provided command. It only appears if the voice-call plugin is installed and enabled.

Primary doc:
- Voice-call plugin: [Voice Call](/plugins/voice-call)

## Common commands

```bash
crocbot voicecall status --call-id <id>
crocbot voicecall call --to "+15555550123" --message "Hello" --mode notify
crocbot voicecall continue --call-id <id> --message "Any questions?"
crocbot voicecall end --call-id <id>
```

## Exposing webhooks (Tailscale)

```bash
crocbot voicecall expose --mode serve
crocbot voicecall expose --mode funnel
crocbot voicecall unexpose
```

Security note: only expose the webhook endpoint to networks you trust. Prefer Tailscale Serve over Funnel when possible.

