# CONVENTIONS.md

## Guiding Principles

- Optimize for readability over cleverness
- Code is written once, read many times
- Consistency beats personal preference
- If it can be automated, automate it
- When writing code: Make NO assumptions. Pattern match precisely. Validate systematically.

## TypeScript

- Strict mode always; avoid `any` - use `unknown` with type guards
- Prefer `interface` for object shapes, `type` for unions/intersections
- Use explicit return types on exported functions
- ESM only - use `.js` extensions in imports (TypeScript resolves to .ts)
- Prefer `const` assertions for literal types: `as const`

## Naming

- camelCase for variables, functions, parameters
- PascalCase for types, interfaces, classes, enums
- SCREAMING_SNAKE_CASE for true constants only
- Prefix interfaces with `I` only if collision with implementation
- Boolean variables: `isActive`, `hasPermission`, `shouldRetry`
- Async functions: prefer verb without `async` suffix (`fetchUser` not `fetchUserAsync`)

## Files & Structure

- One concept per file; file name matches primary export
- Group by feature: `src/telegram/`, `src/gateway/`, `src/cli/`
- Colocate tests: `foo.ts` with `foo.test.ts`
- Index files only for public API re-exports, not barrel files
- Keep files under 500 LOC; split when clarity improves

## CLI Conventions

- Exit code 0 for success, 1 for user error, 2 for system error
- stdout for data/results, stderr for logs/errors/progress
- Use `src/cli/progress.ts` for spinners and progress (never hand-roll)
- Flag names: kebab-case (`--dry-run`, `--verbose`)
- Subcommands: noun-verb pattern (`channels status`, `config set`)

## Functions & Modules

- Functions do one thing
- Prefer pure functions; isolate side effects
- Use dependency injection via `createDefaultDeps` pattern
- Async/await over raw promises; avoid `.then()` chains
- Keep functions short enough to read without scrolling

## Error Handling

- Fail fast in development, gracefully in production
- Use typed errors with context: `new Error('message', { cause })`
- Never swallow errors silently
- Prefer early returns for guard clauses
- Log errors with actionable context before re-throwing

## Testing

- Framework: Vitest with V8 coverage (70% threshold)
- Test files: `*.test.ts` colocated; e2e in `*.e2e.test.ts`
- Test behavior, not implementation
- Describe blocks match module structure
- Mock external dependencies; avoid mocking internal modules

## Async Patterns

- Always handle promise rejections
- Use `Promise.all` for concurrent independent operations
- Use `for...of` with `await` for sequential dependent operations
- Prefer `AbortController` for cancellation
- Set timeouts on external calls

## Imports

- Group: Node builtins, external packages, internal modules
- Sort alphabetically within groups
- Prefer named imports over default imports
- No circular imports - restructure if needed

## Git & Version Control

- Commit messages: imperative mood, concise (`Add user validation`)
- Use `scripts/committer` for commits (scoped staging)
- One logical change per commit
- Branch names: `type/short-description` (e.g., `feat/telegram-retry`)

## Dependencies

- Fewer dependencies = less risk
- Pin exact versions for patched dependencies (no `^`/`~`)
- Patching requires explicit approval
- Never update Carbon dependency
- Keep Telegram deps: grammy, @grammyjs/runner, @grammyjs/transformer-throttler

## Docker & Deployment

- No secrets in images; use environment variables
- Production: `npm install --omit=dev`
- Base image: `node:22-slim`
- Entry point: `node dist/entry.js`

## Local Dev Tools

| Category | Tool | Config |
|----------|------|--------|
| Formatter | oxfmt | `pnpm format` |
| Linter | oxlint | `pnpm lint` |
| Type Safety | TypeScript (strict) | tsconfig.json |
| Testing | Vitest | vitest.config.ts |
| Observability | tslog | src/logging/ |
| Git Hooks | git-hooks/ | `git config core.hooksPath` |
| Runtime | Node 22+ / Bun | scripts/run-node.mjs |

## CI/CD Workflows

Platform: GitHub Actions

| Bundle | Status | Workflow |
|--------|--------|----------|
| Code Quality | configured | `.github/workflows/ci.yml` (lint, format, typecheck) |
| Build & Test | configured | `.github/workflows/ci.yml` (build, test with coverage) |
| Security | configured | `.github/workflows/ci.yml` (detect-secrets), `.github/workflows/security.yml` (CodeQL, dependency-review, npm-audit) |
| Integration | configured | `.github/workflows/integration.yml` (E2E tests on PR to main) |
| Operations | configured | `.github/workflows/docker-release.yml`, `.github/dependabot.yml` |

Additional workflows:
- `.github/workflows/workflow-sanity.yml` - Validates workflow files
- `.github/workflows/labeler.yml` - Auto-labels PRs
- `.github/workflows/auto-response.yml` - Automated issue/PR responses

## Infrastructure

| Component | Provider | Details |
|-----------|----------|---------|
| Hosting | Coolify / Docker | `docker-compose.coolify.yml`, `docker-compose.yml` |
| Health Endpoint | HTTP `/health` | `src/gateway/server-http.ts`, returns `{status, timestamp, uptime, memory}` |
| Health Probes | Docker healthcheck | 30s interval, 3 retries, 10s timeout |
| Security (CI) | GitHub Actions | CodeQL, dependency-review, npm-audit (`.github/workflows/security.yml`) |
| Rate Limiting | In-memory per-IP | `src/gateway/rate-limit.ts`, 60 req/min default, configurable via `gateway.rateLimit` |
| Deploy (CD) | GitHub Actions | Docker images on push to main (`.github/workflows/docker-release.yml`) |
| Deploy Trigger | Manual / Coolify | Auto-deploy webhook not yet configured; requires Coolify webhook setup |
| Backup | Docker volume / config export | `scripts/backup.sh`, config export via `/setup/export`, docs: `docs/runbooks/backup-restore.md` |
| Config Export | HTTP `/setup/export` | `src/gateway/setup-http.ts`, Bearer token auth, returns redacted config snapshot |

## When In Doubt

- Read existing code first; match patterns
- Ask rather than guess
- Ship, learn, iterate
