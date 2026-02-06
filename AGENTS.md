# AGENTS.md

**CLAUDE.md and GEMINI.md are symlinks to this file (AGENTS.md)**

> **Active Deployment**: The project `.env` defines three paths:
> - `CROCBOT_STATE_DIR` — runtime state: `crocbot.json` (main config), `credentials/`, `identity/`, `logs/`, `media/`, `memory/`, `settings/`, `telegram/`, `cron/`
> - `CROCBOT_CONFIG_PATH` — main config file (auth, channels, skills, plugins)
> - `CROCBOT_WORKSPACE` — agent working directory: `AGENTS.md`, `SOUL.md`, `USER.md`, `MEMORY.md`, `TOOLS.md`, `memory/`, `hooks/`
>
> **API Keys & Secrets**: Read `.env` in this repo — it contains credentials and paths to external config. Do NOT grep the codebase for credentials.

## Main Entry Point of App
 - run `crocbot -h`: you will see all the sysems of the assistant

## Project Snapshot
- crocbot is a strip-down, sipmlification and customization of OpenClaw (details in "Source Project" below) specifically for only two interaction channels with crocobt (CLI & Telegram) and primary deployment is Coolify/Docker on a remote server
- crocbot is a Telegram-first personal AI assistant and gateway CLI (`crocbot` binary).
- Chat channels: Telegram only (`src/channels/registry.ts`). Other channels and native apps were removed during the strip-down.
- Plugin runtime remains (`src/plugins`, `src/plugin-sdk`); there are also bundled `extensions/`.

## Source Project
- Upstream: `openclaw/openclaw` (https://github.com/openclaw/openclaw)
- Local copy saved (.gitignored) in: `.001_ORIGINAL/` - though it may not be the latest pull

## Codebase Map
- Core TypeScript: `src/` (CLI in `src/cli`, commands in `src/commands`, gateway in `src/gateway`, extensions in `extension/`, and Telegram in `src/telegram`).
- UI: `ui/`
- Docs: `docs/` (Mintlify navigation in `docs/docs.json`).
- Tests: colocated `*.test.ts` plus shared/e2e in `test/`.

## Dev Workflow
- Runtime: Node 22+. Install: `pnpm install`.
- Build: `pnpm build`, UI: `pnpm ui:build`; Lint/format: `pnpm lint`, `pnpm format`; Tests: `pnpm test`.
- TypeScript is ESM; use `.js` extensions in imports and avoid `any`.
- Use `scripts/committer "<msg>" <file...>` for commits (scoped staging).
- **Audit**: `pnpm build` (type errors), `pnpm lint` (code quality), `pnpm test` (tests).
- **Logs**: `journalctl --user -u crocbot-gateway --since "1 hour ago"`

## Deploy
- Rebuild and restart: `pnpm build && systemctl --user restart crocbot-gateway`
- Check status: `systemctl --user status crocbot-gateway`

## Docs Rules
- Internal links in `docs/**/*.md`: root-relative, no `.md`/`.mdx`.
- Keep docs generic/safe to publish to public (no real hostnames/tokens). Update `docs/docs.json` when adding/removing pages.

## Source of Truth
- Follow `.spec_system/CONVENTIONS.md` for coding conventions.
- Check `.spec_system/CONSIDERATIONS.md` for current strip-down scope and known stubs.
