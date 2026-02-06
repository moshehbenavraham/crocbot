# scripts/

Development, build, and operations scripts.

## Structure

```
scripts/
  build/          # Build pipeline scripts (bundling, codegen, docs)
  debug/          # Debugging and benchmarking utilities
  docker/         # Dockerfiles and Docker-based test runners
  e2e/            # End-to-end test helpers
  pre-commit/     # Pre-commit hook scripts (sync, docs)
  sync/           # Synchronization utilities
```

## Key Scripts

| Script | Purpose |
|--------|---------|
| `committer` | Scoped git staging and commit helper — use for all commits |
| `run-node.mjs` | Runs crocbot via tsx (TypeScript directly) |
| `watch-node.mjs` | File-watching dev server with auto-reload |
| `test-parallel.mjs` | Parallel test runner (used by `pnpm test`) |
| `backup.sh` | Automated backup of state and config |
| `postinstall.js` | Post-install hook (git hooks setup, etc.) |
| `format-staged.js` | Formats only staged files for pre-commit |
| `setup-git-hooks.js` | Installs git hooks from `git-hooks/` |
| `docker-setup.sh` | Docker environment bootstrapping |
| `check-ts-max-loc.ts` | Enforces max 500 lines per TypeScript file |
| `release-check.ts` | Pre-release validation |

## Build Scripts (`build/`)

| Script | Purpose |
|--------|---------|
| `bundle-a2ui.sh` | Bundles agent-to-UI renderer assets |
| `compile-pi-extensions.ts` | Compiles pi-extensions to JS |
| `protocol-gen.ts` | Generates protocol schema JSON |
| `write-build-info.ts` | Writes build metadata (version, git SHA) |
| `build-docs-list.mjs` | Generates documentation index |

## Docker Scripts (`docker/`)

Contains the main `Dockerfile` and shell scripts for running Docker-based E2E tests (onboarding, gateway networking, plugins, QR import, cleanup).
