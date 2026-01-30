---
summary: "CLI reference for `crocbot agents` (list/add/delete/set identity)"
read_when:
  - You want multiple isolated agents (workspaces + routing + auth)
---

# `crocbot agents`

Manage isolated agents (workspaces + auth + routing).

Related:
- Multi-agent routing: [Multi-Agent Routing](/concepts/multi-agent)
- Agent workspace: [Agent workspace](/concepts/agent-workspace)

## Examples

```bash
crocbot agents list
crocbot agents add work --workspace ~/croc-work
crocbot agents set-identity --workspace ~/croc --from-identity
crocbot agents set-identity --agent main --avatar avatars/croc.png
crocbot agents delete work
```

## Identity files

Each agent workspace can include an `IDENTITY.md` at the workspace root:
- Example path: `~/croc/IDENTITY.md`
- `set-identity --from-identity` reads from the workspace root (or an explicit `--identity-file`)

Avatar paths resolve relative to the workspace root.

## Set identity

`set-identity` writes fields into `agents.list[].identity`:
- `name`
- `theme`
- `emoji`
- `avatar` (workspace-relative path, http(s) URL, or data URI)

Load from `IDENTITY.md`:

```bash
crocbot agents set-identity --workspace ~/croc --from-identity
```

Override fields explicitly:

```bash
crocbot agents set-identity --agent main --name "Croc" --emoji "🐊" --avatar avatars/croc.png
```

Config sample:

```json5
{
  agents: {
    list: [
      {
        id: "main",
        identity: {
          name: "Croc",
          theme: "chrome crocodile",
          emoji: "🐊",
          avatar: "avatars/croc.png"
        }
      }
    ]
  }
}
```
