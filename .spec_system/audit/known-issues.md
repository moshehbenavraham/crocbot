# Known Issues

## Skipped Workflows

None.

## GitHub Actions Billing Blocker

As of 2026-02-06, all GitHub Actions workflows fail with:
> "The job was not started because recent account payments have failed or your spending limit needs to be increased."

**Resolution**: Fix billing in GitHub Settings → Billing & plans for the `moshehbenavraham` account.

## CodeQL Requires "Code Scanning" Enabled

The CodeQL Analysis job in `security.yml` fails with:
> "Code scanning is not enabled for this repository."

**Resolution**: Enable code scanning in repo Settings → Code security and analysis → Code scanning.
CodeQL actions were upgraded from v3 to v4 (v3 deprecated Dec 2026).

## npm Audit Vulnerabilities (informational)

`pnpm audit` reports 7 vulnerabilities (3 high, 4 moderate) in transitive dependencies:
- `node-tar` — Arbitrary File vulnerability
- `fast-xml-parser` — RangeError DoS
- `@isaacs/brace-expansion` — Uncontrolled Resource

The npm Audit job uses `continue-on-error: true` so this does not block CI.

## E2E Test Failures (Pre-existing)

18 E2E tests across 16 files are currently failing. These are pre-existing issues
predating the Integration workflow and are not surfaced by existing CI (which runs
only unit tests via `pnpm test`).

### Root Causes

1. **Config redaction** - Tests written before the config redaction feature expect
   plaintext token values but now receive `[REDACTED]`. Affects tests that call
   `config.get` and assert on sensitive fields like `botToken`.

2. **Node stub response change** - `node.invoke.result` was changed from rejecting
   with `FEATURE_DISABLED_ERROR` to gracefully accepting with `{ ok: true, ignored: true }`.
   Tests expecting the error response now fail.

3. **Connection/auth drift** - Some E2E tests have stale auth or connection
   expectations that no longer match current gateway behavior.

### Affected Files

- `server.agent.gateway-server-agent-a.e2e.test.ts` (1 failure)
- `server.config-patch.e2e.test.ts` (redaction)
- `server.health.e2e.test.ts` (connection)
- `server.models-voicewake-misc.e2e.test.ts` (idempotency)
- `server.roles-allowlist-update.e2e.test.ts` (auth token)
- Plus 11 additional files with similar patterns

### Resolution

These tests need to be updated to match current gateway behavior. Until then,
the Integration workflow will report failures that are not regressions.

### Impact

- Unit tests (`pnpm test`): All passing (192/192)
- E2E tests (`pnpm test:e2e`): 215 passing, 18 failing, 2 skipped
