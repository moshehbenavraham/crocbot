# E2E Test Fixture Dependency Map

**Session ID**: `phase07-session01-e2e-test-audit-and-triage`
**Generated**: 2026-02-06
**Last Updated**: 2026-02-06

---

## Overview

This document maps shared fixtures and test utilities used across E2E test files
to identify coupling risks before remediation begins in Sessions 02-03.

Total E2E test files: 52 (35 gateway, 14 auto-reply, 1 hooks, 2 top-level)
Shared infrastructure files: 13

---

## Shared Test Infrastructure

### Global Setup

| File | Purpose |
|------|---------|
| `vitest.e2e.config.ts` | E2E vitest config: pool=forks, max 4 workers, setupFiles=test/setup.ts |
| `test/setup.ts` | Global test setup: installs process warning filter, creates test plugin registry with stub channel plugins (discord, slack, telegram, whatsapp, signal, imessage) |
| `test/test-env.ts` | Isolates test env from developer config: snapshots/clears HOME, CROCBOT_STATE_DIR, etc. |
| `test/global-setup.ts` | Vitest global setup hook: calls `installTestEnv()` once before all workers |

### Test Helper Modules (test/helpers/)

| File | Purpose | Used By |
|------|---------|---------|
| `test/helpers/temp-home.ts` | Creates isolated temp HOME directories with configurable env vars, auto-creates `.crocbot/agents/main/sessions` structure | All 14 auto-reply E2E tests |
| `test/helpers/normalize-text.ts` | Strips ANSI codes, normalizes line endings, replaces Unicode for cross-platform comparison | 3 auto-reply tests |
| `test/helpers/envelope-timestamp.ts` | Format/escape timestamps for test assertions | Not used by current E2E tests |
| `test/helpers/poll.ts` | Poll async functions until condition met or timeout | Not used by current E2E tests |
| `test/helpers/inbound-contract.ts` | Validate message context objects match inbound contract | Not used by current E2E tests |
| `test/helpers/paths.ts` | Platform-independent path traversal validation | Not used by E2E tests |

### Gateway Test Helpers (src/gateway/test-helpers*)

| File | Purpose | Used By |
|------|---------|---------|
| `src/gateway/test-helpers.ts` | Re-exports hub for test-helpers.mocks and test-helpers.server | Most gateway E2E tests |
| `src/gateway/test-helpers.mocks.ts` | Mocks gateway infrastructure: PI SDK, cron, tailnet, sessions, config, embedded agent, auto-reply, CLI deps. Sets `CROCBOT_SKIP_CHANNELS=1`, `CROCBOT_SKIP_CRON=1`. Exports: `testState`, `agentCommand`, `getReplyFromConfig`, `embeddedRunMock`, `cronIsolatedRun` | 10+ gateway E2E tests |
| `src/gateway/test-helpers.server.ts` | Gateway server lifecycle: `startGatewayServer()`, `startServerWithClient()`, `connectReq()`, `connectOk()`, `rpcReq()`, `onceMessage()`, `getFreePort()`, `installGatewayTestHooks()`, `writeSessionStore()`, `waitForSystemEvent()` | Most gateway E2E tests |
| `src/gateway/test-helpers.e2e.ts` | High-level gateway client operations: `connectGatewayClient()`, `connectDeviceAuthReq()`, `getFreeGatewayPort()` | gateway.e2e.test.ts, provider-timeout.e2e.test.ts |
| `src/gateway/test-helpers.openai-mock.ts` | Mock OpenAI /v1/responses endpoint with fetch interception. Returns `{ baseUrl, restore() }` | gateway.e2e.test.ts, openai-http.e2e.test.ts, openresponses-http.e2e.test.ts |

### Test Utilities (src/test-utils/)

| File | Purpose | Used By |
|------|---------|---------|
| `src/test-utils/channel-plugins.ts` | Test plugin factories: `createTestRegistry()`, `createOutboundTestPlugin()`, `createGenericTestPlugin()` | test/setup.ts (global), server.channels, server.models, hooks tests |
| `src/test-utils/ports.ts` | Deterministic free port allocation per worker to avoid parallel test collisions | All gateway E2E tests (via test-helpers.server) |

---

## Per-File Dependency Matrix

### Failing Gateway Tests

| Test File | test-helpers.mocks | test-helpers.server | Other Shared |
|-----------|-------------------|--------------------|--------------|
| `server.config-patch.e2e.test.ts` | yes (via test-helpers) | yes (installGatewayTestHooks) | resolveConfigSnapshotHash |
| `server.auth.e2e.test.ts` | yes (via test-helpers) | yes (connectReq, getFreePort, installGatewayTestHooks, testState) | buildDeviceAuthPayload, PROTOCOL_VERSION |
| `server.health.e2e.test.ts` | yes (via test-helpers) | yes (connectOk, getFreePort, installGatewayTestHooks) | buildDeviceAuthPayload, emitAgentEvent, emitHeartbeatEvent |
| `server.models-voicewake-misc.e2e.test.ts` | yes (via test-helpers) | yes (installGatewayTestHooks) | createOutboundTestPlugin, getChannelPlugin |
| `server.roles-allowlist-update.e2e.test.ts` | yes (via test-helpers) | yes (installGatewayTestHooks, connectReq, getFreePort) | GatewayClient |
| `server.agent.gateway-server-agent-a.e2e.test.ts` | yes (via test-helpers) | yes (installGatewayTestHooks, rpcReq) | setActivePluginRegistry, emitAgentEvent |
| `server.agent.gateway-server-agent-b.e2e.test.ts` | yes (via test-helpers) | yes (installGatewayTestHooks) | **whatsappPlugin (MISSING: extensions/whatsapp removed)** |
| `server.chat.gateway-server-chat.e2e.test.ts` | yes (via test-helpers) | yes (installGatewayTestHooks) | emitAgentEvent, registerAgentRunContext |
| `server.chat.gateway-server-chat-b.e2e.test.ts` | yes (via test-helpers) | yes (installGatewayTestHooks) | emitAgentEvent, __setMaxChatHistoryMessagesBytesForTest |
| `server.ios-client-id.e2e.test.ts` | no | yes (getFreePort, onceMessage, startGatewayServer) | PROTOCOL_VERSION |

### Failing Auto-Reply Tests

| Test File | temp-home | pi-embedded mock | model-catalog mock | Other Shared |
|-----------|-----------|-----------------|-------------------|--------------|
| `reply.directive...lists-allowlisted-models-model-list.e2e.test.ts` | yes | yes | yes | getReplyFromConfig |
| `reply.triggers.group-intro-prompts.e2e.test.ts` | yes | yes | yes | getReplyFromConfig |
| `reply.triggers...allows-activation-from-allowfrom-groups.e2e.test.ts` | yes | yes | yes | getReplyFromConfig |
| `reply.triggers...keeps-inline-status-unauthorized-senders.e2e.test.ts` | yes | yes | yes | getReplyFromConfig |
| `reply.triggers...runs-greeting-prompt-bare-reset.e2e.test.ts` | yes | yes | yes | getReplyFromConfig |

### Failing Top-Level Tests

| Test File | Shared Deps |
|-----------|-------------|
| `test/gateway.multi.e2e.test.ts` | loadOrCreateDeviceIdentity, GatewayClient, GATEWAY_CLIENT_MODES/NAMES, getDeterministicFreePortBlock |
| `test/provider-timeout.e2e.test.ts` | GatewayClient, startGatewayServer, getDeterministicFreePortBlock |

---

## Coupling Risk Assessment

### HIGHEST RISK (changes affect 15+ E2E test files)

1. **test/setup.ts** -- Global vitest setup file; creates stub plugin registry used by ALL tests. Any change to stub plugin behavior cascades everywhere.
2. **test/test-env.ts** -- Global env isolation; any env var changes affect entire suite.
3. **src/gateway/test-helpers.mocks.ts** -- vi.mock hooks apply per-worker; used by 10+ gateway E2E tests. Changes to mock behavior (e.g., `agentCommand`, `getReplyFromConfig`, `testState`) cascade across all gateway tests.

### HIGH RISK (changes affect 8-14 E2E test files)

4. **src/gateway/test-helpers.server.ts** -- Gateway server lifecycle helpers. Changes to `connectReq()`, `connectOk()`, `installGatewayTestHooks()` affect most gateway tests.
5. **test/helpers/temp-home.ts** -- Used by ALL 14 auto-reply E2E tests. Changes to home directory setup or env var management cascade to all auto-reply tests.

### MEDIUM RISK (changes affect 4-7 E2E test files)

6. **src/test-utils/ports.ts** -- Port allocation strategy; algorithmic changes could cause parallel test collisions.
7. **src/test-utils/channel-plugins.ts** -- Plugin factories used by setup and several gateway tests.

### LOW RISK (changes affect 1-3 E2E test files)

8. **src/gateway/test-helpers.openai-mock.ts** -- Used by only 3 tests.
9. **src/gateway/test-helpers.e2e.ts** -- Used by only 2 tests.
10. **test/helpers/normalize-text.ts** -- Used by 3 auto-reply tests.

---

## Key Observations for Remediation

1. **Gateway tests share deeply coupled mocks** -- The `test-helpers.mocks.ts` file applies `vi.mock()` at module scope, meaning all tests in the same worker fork share mock behavior. Fixing one test's expected behavior could break another test's assertions.

2. **Auto-reply tests are more isolated** -- Each auto-reply E2E test creates its own temp home and mock setup. Changes to one test are unlikely to cascade, but changes to `test/helpers/temp-home.ts` would affect all of them.

3. **The `whatsappPlugin` import in server.agent.gateway-server-agent-b.e2e.test.ts is broken** -- It imports from `../../extensions/whatsapp/src/channel.js` which was removed during Phase 00. This causes the entire test suite file to fail at import time.

4. **Port allocation is deterministic per-worker** -- Tests use `getDeterministicFreePortBlock()` to avoid collisions in the `forks` pool. This is robust but means tests cannot be reordered freely.

5. **The `agentCommand` mock in test-helpers.mocks.ts** is used by `server.chat.gateway-server-chat.e2e.test.ts` which fails with `ReferenceError: agentCommand is not defined`. This suggests the mock export may have drifted from the test's expected interface.
