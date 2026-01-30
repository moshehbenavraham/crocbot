---
summary: "CLI reference for `crocbot status` (diagnostics, probes, usage snapshots)"
read_when:
  - You want a quick diagnosis of channel health + recent session recipients
  - You want a pasteable “all” status for debugging
---

# `crocbot status`

Diagnostics for channels + sessions.

```bash
crocbot status
crocbot status --all
crocbot status --deep
crocbot status --usage
```

Notes:
- `--deep` runs live probes (Telegram).
- Output includes per-agent session stores when multiple agents are configured.
- Overview includes Gateway + node host service install/runtime status when available.
- Overview includes update channel + git SHA (for source checkouts).
- Update info surfaces in the Overview; if an update is available, status prints a hint to run `crocbot update` (see [Updating](/install/updating)).
