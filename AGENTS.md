# AGENTS.md

**CLAUDE.md and GEMINI.md are symlinks to this file (AGENTS.md)**

> **Active Deployment**: `.env` contains paths, credentials, and config for the current crocbot instance (state dir, workspace, API keys, Telegram bot, gateway).

## Project Snapshot
- crocbot is a Telegram-first personal AI assistant and gateway CLI (`crocbot` binary).
- Chat channels: Telegram only (`src/channels/registry.ts`). Other channels and native apps were removed during the strip-down.
- Plugin runtime remains (`src/plugins`, `src/plugin-sdk`); there are no bundled `extensions/`.

## Codebase Map
- Core TypeScript: `src/` (CLI in `src/cli`, commands in `src/commands`, gateway in `src/gateway`, extensions in `extension/`, and Telegram in `src/telegram`).
- UI: `ui/`
- Docs: `docs/` (Mintlify navigation in `docs/docs.json`).
- Tests: colocated `*.test.ts` plus shared/e2e in `test/`.

## Dev Workflow
- Runtime: Node 22+. Install: `pnpm install`.
- Build: `pnpm build`; Lint/format: `pnpm lint`, `pnpm format`; Tests: `pnpm test`.
- TypeScript is ESM; use `.js` extensions in imports and avoid `any`.
- Use `scripts/committer "<msg>" <file...>` for commits (scoped staging).

## Deploy
- Rebuild and restart: `pnpm build && systemctl --user restart crocbot-gateway`
- Check status: `systemctl --user status crocbot-gateway`

## Docs Rules
- Internal links in `docs/**/*.md`: root-relative, no `.md`/`.mdx`.
- Keep docs generic (no real hostnames/tokens). Update `docs/docs.json` when adding/removing pages.

## Source of Truth
- Follow `.spec_system/CONVENTIONS.md` for coding conventions.
- Check `.spec_system/CONSIDERATIONS.md` for current strip-down scope and known stubs.
