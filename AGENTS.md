# AGENTS.md

**CLAUDE.md and GEMINI.md are symlinks to this file (AGENTS.md)**

## `.env` to Determine Project Specifics

It's important to look at the `.env` file in order to get context of how our particular CrocBot Agent is deployed (for example docker versus local).

> **Active Deployment**: The project `.env` defines three paths:
> - `CROCBOT_STATE_DIR` — runtime state: `crocbot.json` (main config), `credentials/`, `identity/`, `logs/`, `media/`, `memory/`, `settings/`, `telegram/`, `cron/`
> - `CROCBOT_CONFIG_PATH` — main config file (auth, channels, skills, plugins)
> - `CROCBOT_WORKSPACE` — agent working directory: `AGENTS.md`, `SOUL.md`, `USER.md`, `MEMORY.md`, `TOOLS.md`, `memory/`, `hooks/`
>
> **API Keys & Secrets**: Copy `.env.example` to `.env` and fill in your own keys. Do NOT grep the codebase for credentials. Please note the Agent has most if not all its keys in its "State" directory.

## Main Entry Point of App
 - run `crocbot -h`: you will see all the systems of the assistant

## Project Snapshot
- crocbot is a strip-down, simplification and customization of OpenClaw.ai (details in "Source Project" below) specifically for only two interaction channels with crocbot (CLI & Telegram) and two deployment paths: local (Node) and Docker
- crocbot is a gateway CLI (`crocbot` binary)
- Chat channels: Telegram only (`src/channels/registry.ts`).
- Plugin runtime remains (`src/plugins`, `src/plugin-sdk`); there are also bundled `extensions/` and `skills/`

## Source Project
- Upstream: `openclaw/openclaw` (https://github.com/openclaw/openclaw)
- Local copy saved (.gitignored) in: `.001_ORIGINAL/` - though it may not be the latest pull

## Codebase Map
- Core TypeScript: `src/` (CLI in `src/cli`, commands in `src/commands`, gateway in `src/gateway`, extensions in `extensions/`, and Telegram in `src/telegram`).
- Docs: `docs/` (Mintlify navigation in `docs/docs.json`).
- Tests: colocated `*.test.ts` plus shared/e2e in `test/`.

## Dev Workflow
- NEVER add attributions or co-authors to commits or pushes
- Runtime: Node 22+. Install: `pnpm install`.
- Build: `pnpm build`, UI: `pnpm ui:build`; Lint/format: `pnpm lint`, `pnpm format`; Tests: `pnpm test`.
- TypeScript is ESM; use `.js` extensions in imports and avoid `any`.
- Use `scripts/committer "<msg>" <file...>` for commits (scoped staging).
- **Audit**: `pnpm build` (type errors), `pnpm lint` (code quality), `pnpm test` (tests).

## Deploy
- **Local**: `pnpm build && node dist/index.js gateway`
- **Docker**: `pnpm build && docker build -t crocbot:local . && docker compose up -d`

## Docs Rules
- Internal links in `docs/**/*.md`: root-relative, no `.md`/`.mdx`.
- Keep docs generic/safe to publish to public (no real hostnames/tokens). Update `docs/docs.json` when adding/removing pages.

## Active Development Sources of Truth
- Follow `.spec_system/CONVENTIONS.md` for coding conventions.
- Check `.spec_system/CONSIDERATIONS.md` for current scope and known stubs.
