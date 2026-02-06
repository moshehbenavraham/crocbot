# E2E Test Failure Audit

**Session ID**: `phase07-session01-e2e-test-audit-and-triage`
**Generated**: 2026-02-06
**Last Updated**: 2026-02-06

---

## Baseline Summary

| Metric | Value |
|--------|-------|
| Total E2E Tests | 235 |
| Passing | 215 |
| Failing | 18 |
| Skipped | 2 |
| Failed Suites (import/setup) | 2 |
| Total Test Files | 52 |
| Failing Test Files | 16 |

---

## Root Cause Summary

| Category | Count | Session Assignment |
|----------|-------|--------------------|
| Config Redaction | 1 | Session 02 |
| Behavior Change | 6 | Session 02 |
| Auth/Connection Drift | 8 | Session 03 |
| Removed Feature | 1 | Session 03 |
| Reference Error | 1 | Session 03 |
| Timeout/Infrastructure | 1 | Session 03 |
| **Total** | **18** | |

---

## Skipped Tests (2)

### S001: `server.ios-client-id.e2e.test.ts` -- "accepts crocbot-ios as a valid gateway client id"
- **File**: `src/gateway/server.ios-client-id.e2e.test.ts:57`
- **Skip Mechanism**: Dynamic -- `beforeAll` hook fails, vitest skips remaining tests
- **Root Cause**: `startGatewayServer()` throws "gateway auth mode is token, but no token was configured" because no `CROCBOT_GATEWAY_TOKEN` is set and no token is passed in server options
- **Recommendation**: **FIX** -- pass `auth: { mode: "token", token }` to `startGatewayServer()` in beforeAll, matching other E2E test files

### S002: `server.ios-client-id.e2e.test.ts` -- "accepts crocbot-android as a valid gateway client id"
- **File**: `src/gateway/server.ios-client-id.e2e.test.ts:76`
- **Skip Mechanism**: Dynamic -- same `beforeAll` failure as S001
- **Recommendation**: **FIX** -- same fix as S001 (single beforeAll change fixes both)

---

## Failed Suites (2 files fail at import/setup, not individual test level)

### FS001: `server.agent.gateway-server-agent-b.e2e.test.ts` -- Import Error
- **File**: `src/gateway/server.agent.gateway-server-agent-b.e2e.test.ts:11`
- **Error**: `Cannot find module '/extensions/whatsapp/src/channel.js'`
- **Import**: `import { whatsappPlugin } from "../../extensions/whatsapp/src/channel.js"`
- **Root Cause**: **REMOVED_FEATURE** -- The WhatsApp extension (`extensions/whatsapp/`) was removed during Phase 00 strip-down
- **Tests Affected**: All 9 tests in the file (entire suite fails)
- **Session Assignment**: Session 03

### FS002: `server.ios-client-id.e2e.test.ts` -- Setup Error
- **File**: `src/gateway/server.ios-client-id.e2e.test.ts:12`
- **Error**: `TypeError: Cannot read properties of undefined (reading 'close')` in afterAll
- **Root Cause**: **AUTH_DRIFT** -- beforeAll calls `startGatewayServer(port)` without auth config; gateway now requires auth token, so `server` is undefined when afterAll tries `server.close()`
- **Tests Affected**: Both tests skipped (2 skipped, 1 setup error = 3 total entries)
- **Session Assignment**: Session 03

---

## Per-File Failure Classifications

### F001: `server.config-patch.e2e.test.ts`
- **Test**: "merges patches without clobbering unrelated config"
- **File**: `src/gateway/server.config-patch.e2e.test.ts:120`
- **Error**: `AssertionError: expected '[REDACTED]' to be 'token-1'`
- **Assertion**: `expect(get2Res.payload?.config?.channels?.telegram?.botToken).toBe("token-1")`
- **Root Cause**: **CONFIG_REDACTION** -- Test writes `botToken: "token-1"` to config, then reads it back via gateway API. The config redaction feature (added Phase 00/01) now replaces sensitive fields like `botToken` with `[REDACTED]` before returning to clients.
- **Fix Strategy**: Update test to expect `[REDACTED]` for sensitive fields, or verify the value through a non-redacted path (direct file read)
- **Session Assignment**: Session 02

### F002: `server.auth.e2e.test.ts` -- "rejects invalid password"
- **File**: `src/gateway/server.auth.e2e.test.ts:213`
- **Error**: `AssertionError: expected true to be false`
- **Assertion**: `expect(res.ok).toBe(false)` after `connectReq(ws, { password: "wrong" })`
- **Root Cause**: **AUTH_DRIFT** -- Password validation logic changed. Invalid password "wrong" is being accepted (res.ok=true) when it should be rejected.
- **Fix Strategy**: Investigate gateway auth changes; update test or fix auth validation
- **Session Assignment**: Session 03

### F003: `server.auth.e2e.test.ts` -- "rejects invalid token"
- **File**: `src/gateway/server.auth.e2e.test.ts:243`
- **Error**: `AssertionError: expected true to be false`
- **Assertion**: `expect(res.ok).toBe(false)` after `connectReq(ws, { token: "wrong" })`
- **Root Cause**: **AUTH_DRIFT** -- Token validation logic changed. Invalid token is being accepted.
- **Fix Strategy**: Same as F002; likely shared root cause in auth validation
- **Session Assignment**: Session 03

### F004: `server.auth.e2e.test.ts` -- "accepts device token auth for paired device"
- **File**: `src/gateway/server.auth.e2e.test.ts:436`
- **Error**: `AssertionError: expected undefined to be defined`
- **Assertion**: `expect(deviceToken).toBeDefined()` where `deviceToken = paired?.tokens?.operator?.token`
- **Root Cause**: **AUTH_DRIFT** -- Device pairing flow is not producing operator tokens. `getPairedDevice()` returns a device without tokens.
- **Fix Strategy**: Investigate device pairing token generation; may need pairing flow updates
- **Session Assignment**: Session 03

### F005: `server.auth.e2e.test.ts` -- "requires pairing for scope upgrades"
- **File**: `src/gateway/server.auth.e2e.test.ts:508`
- **Error**: `AssertionError: the given combination of arguments (undefined and string) is invalid`
- **Assertion**: `expect(paired?.scopes).toContain("operator.read")` where `paired?.scopes` is undefined
- **Root Cause**: **AUTH_DRIFT** -- Device pairing is not recording scopes. The paired device record lacks a `scopes` array.
- **Fix Strategy**: Same root cause as F004; device pairing infrastructure
- **Session Assignment**: Session 03

### F006: `server.auth.e2e.test.ts` -- "rejects revoked device token"
- **File**: `src/gateway/server.auth.e2e.test.ts:551`
- **Error**: `AssertionError: expected undefined to be defined`
- **Assertion**: `expect(deviceToken).toBeDefined()` -- device token not created before revocation test
- **Root Cause**: **AUTH_DRIFT** -- Same underlying issue as F004/F005; device pairing tokens not generated
- **Fix Strategy**: Fix device pairing first (F004), then this test should work
- **Session Assignment**: Session 03

### F007: `server.health.e2e.test.ts` -- "presence includes client fingerprint"
- **File**: `src/gateway/server.health.e2e.test.ts:263` (via `connectOk` at test-helpers.server.ts:447)
- **Error**: `AssertionError: expected false to be true`
- **Assertion**: `connectOk(ws)` fails -- connection request returns `ok: false`
- **Root Cause**: **AUTH_DRIFT** -- The `openClient` helper at line 50 calls `connectOk(ws)` without providing auth credentials. The gateway now requires authentication that was previously optional.
- **Fix Strategy**: Update `openClient()` to pass auth token, matching other test helpers
- **Session Assignment**: Session 03

### F008: `server.models-voicewake-misc.e2e.test.ts` -- "send dedupes by idempotencyKey"
- **File**: `src/gateway/server.models-voicewake-misc.e2e.test.ts:369`
- **Error**: `AssertionError: expected false to be true`
- **Assertion**: `expect(res1.ok).toBe(true)` -- first send request returns `ok: false`
- **Root Cause**: **AUTH_DRIFT** -- The send RPC method is failing because the connection or session state is not properly established. The test's server setup may be missing auth configuration.
- **Fix Strategy**: Investigate server setup in this test file; likely needs auth token in config
- **Session Assignment**: Session 03

### F009: `server.roles-allowlist-update.e2e.test.ts` -- "enforces command allowlists across node clients"
- **File**: `src/gateway/server.roles-allowlist-update.e2e.test.ts`
- **Error**: `Error: unauthorized: gateway token missing (provide gateway auth token)`
- **Assertion**: Gateway client connection fails during test setup
- **Root Cause**: **AUTH_DRIFT** -- The test's `GatewayClient` is connecting without providing a gateway auth token. The gateway now requires token auth.
- **Fix Strategy**: Add `CROCBOT_GATEWAY_TOKEN` or pass token in client connection options
- **Session Assignment**: Session 03

### F010: `server.agent.gateway-server-agent-a.e2e.test.ts` -- "agent falls back to whatsapp when delivery requested and no last channel exists"
- **File**: `src/gateway/server.agent.gateway-server-agent-a.e2e.test.ts:486`
- **Error**: `AssertionError: expected 'telegram' to be 'whatsapp'`
- **Assertion**: `expect(call.channel).toBe("whatsapp")` but got "telegram"
- **Root Cause**: **BEHAVIOR_CHANGE** -- The agent delivery channel fallback logic changed. During Phase 00 strip-down, telegram became the primary/default channel. The test expects whatsapp as fallback but the system now defaults to telegram.
- **Fix Strategy**: Update test expectation to "telegram" or verify the intended fallback behavior
- **Session Assignment**: Session 02

### F011: `server.chat.gateway-server-chat.e2e.test.ts` -- "routes chat.send slash commands without agent runs"
- **File**: `src/gateway/server.chat.gateway-server-chat.e2e.test.ts:318`
- **Error**: `ReferenceError: agentCommand is not defined`
- **Assertion**: `const spy = vi.mocked(agentCommand)` -- `agentCommand` is not imported
- **Root Cause**: **REFERENCE_ERROR** -- The test file uses `agentCommand` from `test-helpers.mocks.ts` but does not import it. The import was likely lost during a refactor.
- **Fix Strategy**: Add `import { agentCommand } from "./test-helpers.js"` to the test file
- **Session Assignment**: Session 02

### F012: `server.chat.gateway-server-chat-b.e2e.test.ts` -- "handles history, abort, idempotency, and ordering flows"
- **File**: `src/gateway/server.chat.gateway-server-chat-b.e2e.test.ts` (via test-helpers.server.ts:256)
- **Error**: `Error: timeout`
- **Assertion**: `onceMessage()` times out waiting for a WS response
- **Root Cause**: **AUTH_DRIFT** -- The gateway server is not processing chat requests because the connection is not properly authenticated or the session state is invalid.
- **Fix Strategy**: Investigate server setup and auth configuration in this test file
- **Session Assignment**: Session 03

### F013: `test/gateway.multi.e2e.test.ts` -- "spins up two gateways and exercises WS + HTTP + node pairing"
- **File**: `test/gateway.multi.e2e.test.ts:357`
- **Error**: `Error: timeout waiting for node status for <nodeId>`
- **Assertion**: `waitForNodeStatus()` polls CLI `nodes status --json` but never sees connected+paired
- **Root Cause**: **AUTH_DRIFT** -- The multi-instance test spawns actual gateway processes via `node dist/index.js gateway`. The `runCliJson` helper for `nodes status` may not be authenticating correctly, or the node pairing protocol has changed.
- **Fix Strategy**: Complex -- requires investigating the full gateway spawn + node pairing flow
- **Session Assignment**: Session 03

### F014: `reply.directive...lists-allowlisted-models-model-list.e2e.test.ts` -- "lists config-only providers when catalog is present"
- **File**: `src/auto-reply/reply.directive.directive-behavior.lists-allowlisted-models-model-list.e2e.test.ts:209`
- **Error**: `AssertionError: expected 'Models (minimax) -- showing 1-1...' to contain 'Model set to minimax'`
- **Assertion**: `expect(text).toContain("Model set to minimax")`
- **Root Cause**: **BEHAVIOR_CHANGE** -- The `/models minimax` command response format changed. Previously returned "Model set to minimax" confirmation; now returns paginated model list.
- **Fix Strategy**: Update test expectation to match new response format (check for "Models (minimax)" instead)
- **Session Assignment**: Session 02

### F015: `reply.triggers.group-intro-prompts.e2e.test.ts` -- "keeps WhatsApp labeling for WhatsApp group chats"
- **File**: `src/auto-reply/reply.triggers.group-intro-prompts.e2e.test.ts:159`
- **Error**: `AssertionError: expected '...' to be '...'` (missing WhatsApp IDs section)
- **Assertion**: `expect(extraSystemPrompt).toBe(...)` with WhatsApp IDs text
- **Root Cause**: **BEHAVIOR_CHANGE** -- The WhatsApp group system prompt template was simplified. The "WhatsApp IDs: SenderId is the participant JID..." section was removed from the prompt.
- **Fix Strategy**: Update test to match the new (shorter) prompt format
- **Session Assignment**: Session 02

### F016: `reply.triggers...allows-activation-from-allowfrom-groups.e2e.test.ts` -- "injects group activation context into the system prompt"
- **File**: `src/auto-reply/reply.triggers.trigger-handling.allows-activation-from-allowfrom-groups.e2e.test.ts:165`
- **Error**: `AssertionError: expected '...trigger-only...' to contain 'Activation: always-on'`
- **Assertion**: `expect(extra).toContain("Activation: always-on")`
- **Root Cause**: **BEHAVIOR_CHANGE** -- The group activation mode logic changed. Config `requireMention: false` should produce "always-on" but now produces "trigger-only". The mapping between config and prompt text drifted.
- **Fix Strategy**: Investigate the activation mode resolution in the reply pipeline; update test or fix logic
- **Session Assignment**: Session 02

### F017: `reply.triggers...keeps-inline-status-unauthorized-senders.e2e.test.ts` -- "returns help without invoking the agent"
- **File**: `src/auto-reply/reply.triggers.trigger-handling.keeps-inline-status-unauthorized-senders.e2e.test.ts:194`
- **Error**: `AssertionError: expected '...' to contain 'Shortcuts'`
- **Assertion**: `expect(text).toContain("Shortcuts")`
- **Root Cause**: **BEHAVIOR_CHANGE** -- The `/help` command output was restructured. The response now has sections: Session, Options, Status, Skills, More -- but no "Shortcuts" section.
- **Fix Strategy**: Update test to check for new section names (e.g., "Session", "Options", "/commands")
- **Session Assignment**: Session 02

### F018: `reply.triggers...runs-greeting-prompt-bare-reset.e2e.test.ts` -- "blocks /reset for non-owner senders"
- **File**: `src/auto-reply/reply.triggers.trigger-handling.runs-greeting-prompt-bare-reset.e2e.test.ts:197`
- **Error**: `AssertionError: expected { text: 'hello', ... } to be undefined`
- **Assertion**: `expect(res).toBeUndefined()`
- **Root Cause**: **BEHAVIOR_CHANGE** -- The `/reset` authorization check for non-owner senders changed. The test sends `From: "+1003"` with `allowFrom: ["+1999"]` and `CommandAuthorized: true`. The code now executes the command (returning greeting "hello") instead of blocking it.
- **Fix Strategy**: Investigate the owner check logic in the reply pipeline; either fix the auth check or update test expectations if the behavior change is intentional
- **Session Assignment**: Session 02

---

## Cross-Reference: Known Issues vs Actual

| Known Issue Category | Expected Count | Actual Count | Notes |
|---------------------|---------------|-------------|-------|
| Config Redaction | "Affects tests that call config.get" | 1 | Only server.config-patch confirmed |
| Node Stub Response | "Tests expecting error response" | 0 | No pure stub response failures found; reclassified |
| Auth/Connection Drift | "Stale auth or connection expectations" | 8 | Confirmed as largest category |
| Behavior Change | Not previously identified | 6 | New category -- production code changed |
| Removed Feature | Not previously identified | 1 | WhatsApp extension import |
| Reference Error | Not previously identified | 1 | Missing import |
| **Total** | **18** | **18** | Count matches exactly |

### Key Differences from Previous Classification
1. **Node stub response** category from known-issues.md had 0 confirmed instances. The failures previously attributed to stub response changes are actually auth drift (servers rejecting connections) or behavior changes (response format changes).
2. **Behavior change** is a new major category (6 failures) not in the original known-issues.md. These are auto-reply pipeline changes where production code was updated but tests were not.
3. **Removed feature** (1) and **reference error** (1) are new categories.

---

## Additional Findings

1. **No new failures beyond the known 18** -- The E2E suite reports exactly 18 failing tests, matching the known count.
2. **No previously-failing tests now pass** -- All 18 failures are confirmed active.
3. **2 skipped tests are dynamically skipped** -- Not explicitly marked with `.skip()` but skipped because `beforeAll` setup fails in `server.ios-client-id.e2e.test.ts`.
4. **The 2 failed suites account for 1 failure + 2 skips** -- `server.agent.gateway-server-agent-b` counts as 1 failed test (import error), `server.ios-client-id` counts as 1 failed test (setup TypeError) + 2 skipped.
