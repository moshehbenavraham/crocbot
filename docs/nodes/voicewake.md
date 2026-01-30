---
summary: "Global voice wake words (Gateway-owned) and how they sync across nodes"
read_when:
  - Changing voice wake words behavior or defaults
  - Adding new node platforms that need wake word sync
---
# Voice Wake (Global Wake Words)

crocbot treats **wake words as a single global list** owned by the **Gateway**.

- There are **no per-node custom wake words**.
- **Any node/app UI may edit** the list; changes are persisted by the Gateway and broadcast to everyone.
- Each device still keeps its own **Voice Wake enabled/disabled** toggle (local UX + permissions differ).

## Storage (Gateway host)

Wake words are stored on the gateway machine at:

- `~/.clawdbot/settings/voicewake.json`

Shape:

```json
{ "triggers": ["clawd", "claude", "computer"], "updatedAtMs": 1730000000000 }
```

## Protocol

### Methods

- `voicewake.get` returns `{ triggers: string[] }`
- `voicewake.set` with params `{ triggers: string[] }` returns `{ triggers: string[] }`

Notes:
- Triggers are normalized (trimmed, empties dropped). Empty lists fall back to defaults.
- Limits are enforced for safety (count/length caps).

### Events

- `voicewake.changed` payload `{ triggers: string[] }`

Who receives it:
- All WebSocket clients (WebChat, etc.)
- All connected nodes, and also on node connect as an initial "current state" push.

## Client behavior

Nodes use the global list for wake word trigger detection. Editing "Trigger words" in settings calls `voicewake.set` and relies on the broadcast to keep other clients in sync.
