# Prioritized Remediation Plan

**Session ID**: `phase07-session01-e2e-test-audit-and-triage`
**Generated**: 2026-02-06
**Last Updated**: 2026-02-06

---

## Overview

| Session | Category | Failures | Complexity |
|---------|----------|----------|------------|
| Session 02 | Config Redaction + Behavior Change (mechanical) | 7 | Low-Medium |
| Session 03 | Auth Drift + Removed Feature + Complex | 11 | Medium-High |
| **Total** | | **18** | |

---

## Session 02 Scope: Config Redaction and Behavior Change Fixes

These are mechanical fixes where the production code behavior is correct and only
the test expectations need updating. No investigation of production code required.

### Priority 1: Reference Error (instant fix)

| ID | File | Fix |
|----|------|-----|
| F011 | `server.chat.gateway-server-chat.e2e.test.ts` | Add missing `import { agentCommand } from "./test-helpers.js"` |

### Priority 2: Config Redaction (assertion update)

| ID | File | Fix |
|----|------|-----|
| F001 | `server.config-patch.e2e.test.ts` | Change `expect(...botToken).toBe("token-1")` to `expect(...botToken).toBe("[REDACTED]")` |

### Priority 3: Behavior Change -- Response Format (assertion update)

| ID | File | Fix |
|----|------|-----|
| F010 | `server.agent.gateway-server-agent-a.e2e.test.ts` | Update fallback channel expectation from `"whatsapp"` to `"telegram"` |
| F014 | `reply.directive...lists-allowlisted-models-model-list.e2e.test.ts` | Update assertion to match new paginated model list format |
| F015 | `reply.triggers.group-intro-prompts.e2e.test.ts` | Remove WhatsApp IDs text from expected system prompt |
| F017 | `reply.triggers...keeps-inline-status-unauthorized-senders.e2e.test.ts` | Replace `"Shortcuts"` check with new help section names |

### Priority 4: Behavior Change -- Logic Investigation Required

| ID | File | Fix |
|----|------|-----|
| F016 | `reply.triggers...allows-activation-from-allowfrom-groups.e2e.test.ts` | Investigate `requireMention: false` -> "always-on" vs "trigger-only" mapping; update test or fix logic |
| F018 | `reply.triggers...runs-greeting-prompt-bare-reset.e2e.test.ts` | Investigate `/reset` owner authorization check; update test if behavior change is intentional |

### Session 02 Estimated Effort

- 7 test files to modify
- ~2-4 hours total
- No production code changes expected (except possibly F016/F018 if logic bugs found)
- Risk: Low -- isolated test-only changes

---

## Session 03 Scope: Auth Drift and Remaining Complex Failures

These failures require investigation of the gateway auth infrastructure and
potentially production code changes to restore correct behavior.

### Priority 1: Removed Feature (delete or rewrite)

| ID | File | Fix |
|----|------|-----|
| FS001 | `server.agent.gateway-server-agent-b.e2e.test.ts` | Remove `whatsappPlugin` import; replace with test stub channel or delete tests that depend on WhatsApp extension |

### Priority 2: Auth Token Missing (server setup fixes)

| ID | File | Fix |
|----|------|-----|
| FS002/S001/S002 | `server.ios-client-id.e2e.test.ts` | Add `auth: { mode: "token", token }` to `startGatewayServer()` in beforeAll |
| F007 | `server.health.e2e.test.ts` | Update `openClient()` helper to pass auth credentials to `connectOk()` |
| F008 | `server.models-voicewake-misc.e2e.test.ts` | Add auth token to server setup |
| F009 | `server.roles-allowlist-update.e2e.test.ts` | Add `CROCBOT_GATEWAY_TOKEN` or pass token in `GatewayClient` options |
| F012 | `server.chat.gateway-server-chat-b.e2e.test.ts` | Add auth configuration to server setup |

### Priority 3: Auth Validation Logic (deeper investigation)

| ID | File | Fix |
|----|------|-----|
| F002 | `server.auth.e2e.test.ts` -- "rejects invalid password" | Investigate why invalid password is accepted (res.ok=true) |
| F003 | `server.auth.e2e.test.ts` -- "rejects invalid token" | Investigate why invalid token is accepted (res.ok=true) |

### Priority 4: Device Pairing Infrastructure (shared root cause)

| ID | File | Fix |
|----|------|-----|
| F004 | `server.auth.e2e.test.ts` -- "accepts device token auth" | Investigate device pairing token generation |
| F005 | `server.auth.e2e.test.ts` -- "requires pairing for scope upgrades" | Same root cause as F004 |
| F006 | `server.auth.e2e.test.ts` -- "rejects revoked device token" | Same root cause as F004 |

### Priority 5: Multi-Instance Integration (most complex)

| ID | File | Fix |
|----|------|-----|
| F013 | `test/gateway.multi.e2e.test.ts` | Investigate full gateway spawn + node pairing + CLI status flow |

### Session 03 Estimated Effort

- 8 test files to modify (some with multiple fixes)
- ~4-6 hours total
- May require production code investigation for auth validation (F002/F003) and device pairing (F004-F006)
- Risk: Medium -- auth changes could affect production behavior

### Shared Root Cause Groups

**Group A: Gateway auth token not provided in test setup** (5 failures: FS002, F007, F008, F009, F012)
- All share the same pattern: tests start a gateway server without providing auth credentials
- Fix pattern: Add `auth: { mode: "token", token: "test-token" }` to server config and pass token to client connections
- Fixing one establishes the pattern for all

**Group B: Auth validation accepting invalid credentials** (2 failures: F002, F003)
- Both in the same test file, same describe block
- Likely a single change in auth validation logic
- Need to check if `connectReq` with wrong password/token should fail at the WS level or at the protocol level

**Group C: Device pairing token generation** (3 failures: F004, F005, F006)
- All in the same test file, sequential tests that build on each other
- Fix F004 first (token generation); F005/F006 likely resolve automatically

---

## Recommended Implementation Order

### Session 02 (7 failures -- mechanical fixes)
1. F011 -- missing import (instant fix, validates test infrastructure works)
2. F001 -- config redaction (simple assertion change)
3. F010 -- channel fallback (simple assertion change)
4. F014, F015, F017 -- response format changes (assertion updates)
5. F016, F018 -- logic investigation + assertion update

### Session 03 (11 failures -- complex fixes)
1. FS001 -- removed feature (delete/rewrite, clears import errors)
2. FS002/S001/S002 -- ios-client-id setup (establishes auth pattern)
3. F007, F008, F009, F012 -- auth token in setup (apply pattern from step 2)
4. F002, F003 -- auth validation investigation
5. F004, F005, F006 -- device pairing investigation
6. F013 -- multi-instance integration (most complex, do last)

---

## Expected Outcome After Sessions 02+03

| Metric | Before | After Session 02 | After Session 03 |
|--------|--------|------------------|------------------|
| Passing | 215 | 222 | 233 |
| Failing | 18 | 11 | 0 |
| Skipped | 2 | 2 | 0 |
| Total | 235 | 235 | 233-235 |

Note: Total may decrease if some tests in `server.agent.gateway-server-agent-b` are
removed rather than rewritten (tests that specifically require the WhatsApp extension).
