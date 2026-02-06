# docs/

Public documentation site powered by [Mintlify](https://mintlify.com/).

Published at: https://aiwithapex.mintlify.app

## Structure

```
docs/
  _layouts/             # Mintlify layout overrides
  adr/                  # Architecture Decision Records
  assets/               # Images and showcase screenshots
  automation/           # Cron, webhooks, Gmail Pub/Sub guides
  channels/             # Channel setup guides (Telegram)
  cli/                  # CLI command reference
  concepts/             # Core concepts (agent, session, models, etc.)
  debug/                # Debugging guides
  diagnostics/          # Health checks and diagnostics
  experiments/          # Research proposals and experiment plans
  gateway/              # Gateway configuration, security, remote access
  help/                 # Help and FAQ
  hooks/                # Hook system documentation
  images/               # Documentation images
  install/              # Installation guides (Docker, Nix, updating)
  nodes/                # Node-specific docs (images, audio)
  ongoing-projects/     # Active project tracking
  platforms/            # Platform guides (Linux, Windows/WSL2)
  plugins/              # Plugin development docs
  providers/            # LLM provider docs
  reference/            # Configuration reference and templates
  refactor/             # Refactoring notes
  runbooks/             # Operational runbooks
  security/             # Security documentation
  start/                # Getting started and onboarding
  tools/                # Tool documentation (browser, skills, etc.)
  web/                  # Web surfaces (Control UI, WebChat)
  docs.json             # Mintlify navigation and sidebar config
```

## Conventions

- Internal links: use root-relative paths, no `.md`/`.mdx` extensions
- Keep content generic and safe for public publishing (no real hostnames or tokens)
- Update `docs.json` when adding or removing pages
- Run `pnpm docs:dev` for local preview, `pnpm docs:build` to check for broken links
