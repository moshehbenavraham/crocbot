# Known Issues

## Skipped Workflows

None.

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
