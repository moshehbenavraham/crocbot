# UI Removal Plan

Remove the browser-based Control UI (`ui/`) entirely. The CLI covers all gateway operations — the UI is unused overhead.

---

## Phase 1: Sever build integration — DONE (verified)

- [x] Remove `ui:install`, `ui:dev`, `ui:build`, `test:ui` scripts from root `package.json`
- [x] Remove `dist/control-ui/**` from `files` array in root `package.json`
- [x] Remove `prepack` dependency on `ui:build`
- [x] Remove UI-only devDependencies (`@lit-labs/signals`, `@lit/context`, `@mariozechner/mini-lit`, `lit`, `lucide`)
- [x] Delete `scripts/ui.js`

## Phase 2: Remove gateway UI serving — DONE (verified)

- [x] Delete `src/gateway/control-ui.ts` (static file HTTP handler)
- [x] Delete `src/gateway/control-ui-shared.ts` (URL utilities)
- [x] Delete `src/gateway/control-ui.test.ts`
- [x] Remove UI route handling from `src/gateway/server-http.ts`
- [x] Remove `controlUiEnabled` / `controlUiBasePath` from `server-runtime-config.ts`, `server-runtime-state.ts`, `server.impl.ts`
- [x] Remove `controlUiBasePath` from `server-tailscale.ts`
- [x] Remove `resolveAssistantAvatarUrl` import from `server-methods/agent.ts` (simplified to use identity directly)
- [x] Remove `controlUiEnabled: false` from all e2e/live test files (including `test/provider-timeout.e2e.test.ts` — missed in original pass, fixed 2026-02-06)

## Phase 3: Remove UI references from commands/wizard — DONE (verified)

- [x] `src/commands/configure.wizard.ts` — removed `ensureControlUiAssetsBuilt()`, replaced `resolveControlUiLinks` with `resolveGatewayWsUrl`, removed Control UI note section
- [x] `src/wizard/onboarding.finalize.ts` — removed `ensureControlUiAssetsBuilt()`, removed Web UI hatch option, removed all `openUrl`/`formatControlUiSshHint` logic, simplified to TUI-only hatch; removed unused `baseConfig` destructuring
- [x] `src/commands/status-all.ts` — removed dashboard row, removed `normalizeControlUiBasePath` import
- [x] `src/commands/status.scan.ts` — removed `normalizeControlUiBasePath` import, simplified tailscale URL
- [x] `src/commands/onboard-helpers.ts` — renamed `resolveControlUiLinks` → `resolveGatewayWsUrl` (returns `string`), removed `formatControlUiSshHint`, removed `normalizeControlUiBasePath` import
- [x] `src/infra/control-ui-assets.ts` + test — deleted
- [x] `src/commands/doctor-ui.ts` — gutted to no-op (was entirely about UI asset repair)

## Phase 4: Delete UI directory and built output — DONE (verified)

- [x] `rm -rf ui/`
- [x] `rm -rf dist/control-ui/`

## Phase 5: Verify — DONE

- [x] `pnpm build` passes
- [x] `pnpm lint` passes
- [x] `pnpm test` passes (656 + 34 test files, 4141 tests, 0 failures)
- [ ] Gateway starts without errors (manual verification needed on deployment)
- [ ] CLI commands work normally (manual verification needed on deployment)

## Phase 5.5: Test & dead-code cleanup (done 2026-02-06) — DONE

Fixes applied during verification session:

- [x] `src/commands/dashboard.test.ts` — full rewrite to match simplified `dashboardCommand` (no browser, no clipboard, no SSH hints)
- [x] `src/commands/configure.wizard.test.ts:106` — mock `resolveGatewayWsUrl` returns plain string, not `{ wsUrl: ... }` object
- [x] `test/provider-timeout.e2e.test.ts:233` — removed stale `controlUiEnabled: false` property
- [x] `src/infra/update-runner.ts` — removed `:!dist/control-ui/` exclusion from git status, removed `ui:build` step and `restore control-ui` checkout step, adjusted step counts (-2)
- [x] `src/infra/update-runner.test.ts` — updated test mock commands to match (removed `dist/control-ui/` exclusions, `ui:build`, and `checkout -- dist/control-ui/`)
- [x] `src/infra/update-check.ts` — removed `:!dist/control-ui/` exclusion from git status
- [x] `src/cron/cron-protocol-conformance.test.ts` — removed 2 tests that read deleted `ui/src/ui/types.ts`; kept schema extraction test
- [x] `src/commands/status.test.ts` — removed assertion for "Dashboard" line (dashboard row was removed in Phase 3)
- [x] `src/wizard/onboarding.finalize.ts` — removed unused `baseConfig` from destructuring (lint error)

---

## Remaining references (deferred — low priority)

These are functional but reference the `controlUi` config type that still exists in the schema. Removing the config type cascades broadly. Tackle in a dedicated follow-up session.

- `src/gateway/test-helpers.mocks.ts:411` — `fileGateway.controlUi = testState.gatewayControlUi` (config type still exists; harmless)
- `src/gateway/protocol/client-info.ts:3` — `CONTROL_UI` constant in `GATEWAY_CLIENT_IDS` (still used by WS auth logic in `message-handler.ts` and auth e2e tests)
- `src/gateway/server/ws-connection/message-handler.ts` — references `controlUi.allowInsecureAuth` and `controlUi.dangerouslyDisableDeviceAuth` (WS auth config — keep until auth config is refactored)
- `src/security/audit.ts` — references `controlUi` config for security checks (keep until config type is cleaned)
- `src/config/types.gateway.ts`, `src/config/schema.ts`, `src/config/zod-schema.ts` — `gateway.controlUi` config type/schema still exists. Removing it cascades to many consumers.
- `src/commands/gateway-status/helpers.ts` — reads `controlUi` from gateway status response
- `src/cli/daemon-cli/status.gather.ts` — reads `controlUi` from config

### Recommended approach for config type removal

1. Remove `controlUi` from `types.gateway.ts` / `schema.ts` / `zod-schema.ts`
2. Move WS auth flags (`allowInsecureAuth`, `dangerouslyDisableDeviceAuth`) to a standalone `gateway.auth` sub-config
3. Update `security/audit.ts` to read from the new location
4. Update `message-handler.ts` to read from the new auth config
5. Remove `CONTROL_UI` from `GATEWAY_CLIENT_IDS` and update e2e tests that use it as a client ID
6. Clean up `test-helpers.mocks.ts`, `gateway-status/helpers.ts`, `status.gather.ts`
