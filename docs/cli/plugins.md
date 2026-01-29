---
summary: "CLI reference for `crocbot plugins` (list, install, enable/disable, doctor)"
read_when:
  - You want to install or manage in-process Gateway plugins
  - You want to debug plugin load failures
---

# `crocbot plugins`

Manage Gateway plugins/extensions (loaded in-process).

Related:
- Plugin system: [Plugins](/plugin)
- Plugin manifest + schema: [Plugin manifest](/plugins/manifest)
- Security hardening: [Security](/gateway/security)

## Commands

```bash
crocbot plugins list
crocbot plugins info <id>
crocbot plugins enable <id>
crocbot plugins disable <id>
crocbot plugins doctor
crocbot plugins update <id>
crocbot plugins update --all
```

Bundled plugins ship with crocbot but start disabled. Use `plugins enable` to
activate them.

All plugins must ship a `crocbot.plugin.json` file with an inline JSON Schema
(`configSchema`, even if empty). Missing/invalid manifests or schemas prevent
the plugin from loading and fail config validation.

### Install

```bash
crocbot plugins install <path-or-spec>
```

Security note: treat plugin installs like running code. Prefer pinned versions.

Supported archives: `.zip`, `.tgz`, `.tar.gz`, `.tar`.

Use `--link` to avoid copying a local directory (adds to `plugins.load.paths`):

```bash
crocbot plugins install -l ./my-plugin
```

### Update

```bash
crocbot plugins update <id>
crocbot plugins update --all
crocbot plugins update <id> --dry-run
```

Updates only apply to plugins installed from npm (tracked in `plugins.installs`).
