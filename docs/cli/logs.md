---
summary: "CLI reference for `crocbot logs` (tail gateway logs via RPC)"
read_when:
  - You need to tail Gateway logs remotely (without SSH)
  - You want JSON log lines for tooling
---

# `crocbot logs`

Tail Gateway file logs over RPC (works in remote mode).

Related:
- Logging overview: [Logging](/help/logging)

## Examples

```bash
crocbot logs
crocbot logs --follow
crocbot logs --json
crocbot logs --limit 500
```

