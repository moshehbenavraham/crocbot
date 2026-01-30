---
summary: "CLI reference for `crocbot config` (get/set/unset config values)"
read_when:
  - You want to read or edit config non-interactively
---

# `crocbot config`

Config helpers: get/set/unset values by path. Run without a subcommand to open
the configure wizard (same as `crocbot configure`).

## Examples

```bash
crocbot config get browser.executablePath
crocbot config set browser.executablePath "/usr/bin/google-chrome"
crocbot config set agents.defaults.heartbeat.every "2h"
crocbot config set agents.list[0].tools.exec.node "node-id-or-name"
crocbot config unset tools.web.search.apiKey
```

## Paths

Paths use dot or bracket notation:

```bash
crocbot config get agents.defaults.workspace
crocbot config get agents.list[0].id
```

Use the agent list index to target a specific agent:

```bash
crocbot config get agents.list
crocbot config set agents.list[1].tools.exec.node "node-id-or-name"
```

## Values

Values are parsed as JSON5 when possible; otherwise they are treated as strings.
Use `--json` to require JSON5 parsing.

```bash
crocbot config set agents.defaults.heartbeat.every "0m"
crocbot config set gateway.port 19001 --json
crocbot config set channels.telegram.groups '["*"]' --json
```

Restart the gateway after edits.
