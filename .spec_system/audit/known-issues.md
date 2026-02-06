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

18 E2E tests across 16 files are currently failing + 2 skipped. Comprehensive
audit completed in Phase 07 Session 01 (see `.spec_system/specs/phase07-session01-e2e-test-audit-and-triage/audit.md`).

### Root Cause Summary

| Category | Count | Session |
|----------|-------|---------|
| Config Redaction | 1 | Session 02 |
| Behavior Change | 6 | Session 02 |
| Auth/Connection Drift | 8 | Session 03 |
| Removed Feature | 1 | Session 03 |
| Reference Error | 1 | Session 02 |
| Timeout/Infrastructure | 1 | Session 03 |

### Per-File Classification

**Session 02 -- Mechanical Fixes (7 failures)**
- `server.chat.gateway-server-chat.e2e.test.ts` -- missing `agentCommand` import (REFERENCE_ERROR)
- `server.config-patch.e2e.test.ts` -- expects plaintext, gets `[REDACTED]` (CONFIG_REDACTION)
- `server.agent.gateway-server-agent-a.e2e.test.ts` -- expects "whatsapp", gets "telegram" (BEHAVIOR_CHANGE)
- `reply.directive...lists-allowlisted-models-model-list.e2e.test.ts` -- model list format changed (BEHAVIOR_CHANGE)
- `reply.triggers.group-intro-prompts.e2e.test.ts` -- WhatsApp IDs removed from prompt (BEHAVIOR_CHANGE)
- `reply.triggers...keeps-inline-status-unauthorized-senders.e2e.test.ts` -- help text restructured (BEHAVIOR_CHANGE)
- `reply.triggers...allows-activation-from-allowfrom-groups.e2e.test.ts` -- activation mode logic (BEHAVIOR_CHANGE)
- `reply.triggers...runs-greeting-prompt-bare-reset.e2e.test.ts` -- /reset owner check (BEHAVIOR_CHANGE)

**Session 03 -- Complex Fixes (11 failures + 2 skipped)**
- `server.agent.gateway-server-agent-b.e2e.test.ts` -- imports removed WhatsApp extension (REMOVED_FEATURE, 9 tests blocked)
- `server.ios-client-id.e2e.test.ts` -- server setup fails without auth token (AUTH_DRIFT, 2 skipped + 1 error)
- `server.auth.e2e.test.ts` -- 5 auth validation failures (AUTH_DRIFT)
- `server.health.e2e.test.ts` -- connection without auth credentials (AUTH_DRIFT)
- `server.models-voicewake-misc.e2e.test.ts` -- server setup missing auth (AUTH_DRIFT)
- `server.roles-allowlist-update.e2e.test.ts` -- gateway token missing (AUTH_DRIFT)
- `server.chat.gateway-server-chat-b.e2e.test.ts` -- timeout due to auth issues (AUTH_DRIFT)
- `test/gateway.multi.e2e.test.ts` -- node pairing timeout (AUTH_DRIFT)

### Resolution Plan

- **Session 02** (`phase07-session02-e2e-config-redaction-and-stub-fixes`): Fix 7 mechanical failures (test assertion updates)
- **Session 03** (`phase07-session03-e2e-auth-drift-and-remaining-failures`): Fix 11 complex failures (auth infrastructure + removed feature)
- Full audit: `.spec_system/specs/phase07-session01-e2e-test-audit-and-triage/audit.md`
- Remediation plan: `.spec_system/specs/phase07-session01-e2e-test-audit-and-triage/remediation-plan.md`

### Impact

- Unit tests (`pnpm test`): All passing (3946 + 206 gateway = 4152 total, 2 skipped)
- Security integration tests: All passing (43/43)
- E2E tests (`pnpm test:e2e`): 215 passing, 18 failing, 2 skipped (235 total)
