---
summary: "CLI reference for `crocbot directory` (self, peers, groups)"
read_when:
  - You want to look up contacts/groups/self ids for a channel
  - You are developing a channel directory adapter
---

# `crocbot directory`

Directory lookups for channels that support it (contacts/peers, groups, and “me”).

## Common flags
- `--channel <name>`: channel id/alias (required when multiple channels are configured; auto when only one is configured)
- `--account <id>`: account id (default: channel default)
- `--json`: output JSON

## Notes
- `directory` is meant to help you find IDs you can paste into other commands (especially `crocbot message send --target ...`).
- For many channels, results are config-backed (allowlists / configured groups) rather than a live provider directory.
- Default output is `id` (and sometimes `name`) separated by a tab; use `--json` for scripting.

## Using results with `message send`

```bash
crocbot directory peers list --channel telegram --query "@"
crocbot message send --channel telegram --target 123456789 --message "hello"
```

## ID formats (by channel)

- Telegram: `@username` or numeric chat id; groups are numeric ids

## Self (“me”)

```bash
crocbot directory self --channel zalouser
```

## Peers (contacts/users)

```bash
crocbot directory peers list --channel zalouser
crocbot directory peers list --channel zalouser --query "name"
crocbot directory peers list --channel zalouser --limit 50
```

## Groups

```bash
crocbot directory groups list --channel zalouser
crocbot directory groups list --channel zalouser --query "work"
crocbot directory groups members --channel zalouser --group-id <id>
```
