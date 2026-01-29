---
summary: "CLI reference for `crocbot reset` (reset local state/config)"
read_when:
  - You want to wipe local state while keeping the CLI installed
  - You want a dry-run of what would be removed
---

# `crocbot reset`

Reset local config/state (keeps the CLI installed).

```bash
crocbot reset
crocbot reset --dry-run
crocbot reset --scope config+creds+sessions --yes --non-interactive
```

