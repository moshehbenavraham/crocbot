# Implementation Notes

**Session ID**: `phase00-session02-remove-extensions`
**Started**: 2026-01-30 00:44
**Last Updated**: 2026-01-30 01:10

---

## Session Progress

| Metric | Value |
|--------|-------|
| Tasks Completed | 14 / 15 |
| Estimated Remaining | Complete (T015 pending) |
| Blockers | 0 |

---

## Extension Inventory (Audit Trail)

**Total Packages**: 30
**Total Files**: 547

### Channel Plugins (19)
- bluebubbles
- discord
- googlechat
- imessage
- line
- matrix
- mattermost
- msteams
- nextcloud-talk
- nostr
- signal
- slack
- telegram
- tlon
- twitch
- voice-call
- whatsapp
- zalo
- zalouser

### Auth Extensions (4)
- copilot-proxy
- google-antigravity-auth
- google-gemini-cli-auth
- qwen-portal-auth

### Utility Extensions (7)
- diagnostics-otel
- llm-task
- lobster
- memory-core
- memory-lancedb
- open-prose

---

## Analysis Results

### pnpm-workspace.yaml (T003)
- Line 5: `- extensions/*` - REMOVED
- Line 10: `@matrix-org/matrix-sdk-crypto-nodejs` - REMOVED (extension-only)

### .github/labeler.yml (T004)
- Lines 167-206: 10 `extensions: *` labels - REMOVED entirely
- Lines 1-95: 18 `channel: *` labels contained `extensions/**` paths - REMOVED those paths
- Channel-only labels removed: bluebubbles, googlechat, line, matrix, mattermost, msteams, nextcloud-talk, nostr, tlon, voice-call, zalo, zalouser

### onlyBuiltDependencies (T005)
- `@matrix-org/matrix-sdk-crypto-nodejs` - extension-only (matrix) - REMOVED
- `@whiskeysockets/baileys` - root package.json - KEPT
- `@lydell/node-pty` - root package.json - KEPT
- `authenticate-pam` - not in any package.json but kept for safety
- `esbuild`, `protobufjs`, `sharp` - core dependencies - KEPT

---

## Additional Changes Required

### Vitest Configuration
- Removed `extensions/**/*.test.ts` from `vitest.config.ts` include patterns
- Removed `extensions/**` exclude from `vitest.unit.config.ts`
- Deleted `vitest.extensions.config.ts` (no longer needed)
- Removed extensions run from `scripts/test-parallel.mjs`

### Plugin Slot Default
- Changed `src/plugins/slots.ts` DEFAULT_SLOT_BY_KEY memory from "memory-core" to undefined
- This prevents config validation from failing when no memory plugin is configured
- Updated related tests in `config-state.test.ts` and `slots.test.ts`

### Status Scan
- Updated `src/commands/status.scan.ts` to handle missing memory plugin gracefully
- Updated `src/commands/status.test.ts` to expect no default memory plugin

### Catalog Tests
- Skipped `catalog.test.ts` tests that expected msteams plugin to be discoverable

---

## Known Test Failures (Deferred to Session 06)

The following tests have import errors or failures due to dead code references to extensions. These are documented here for Session 06 (refactor dead code).

### Tests with Direct Extension Imports (cannot load)
These test files import directly from `extensions/` and cannot even load:
- `src/infra/outbound/message-action-runner.test.ts`
- `src/infra/outbound/message-action-runner.threading.test.ts`
- `src/infra/outbound/targets.test.ts`
- `src/commands/channels.adds-non-default-telegram-account.test.ts`
- `src/commands/channels.surfaces-signal-runtime-errors-channels-status-output.test.ts`
- `src/commands/onboard-channels.test.ts`
- `src/commands/agent.test.ts`
- `src/commands/health.snapshot.test.ts`
- `src/cron/isolated-agent.skips-delivery-without-whatsapp-recipient-besteffortdeliver-true.test.ts`
- `src/security/audit.test.ts`
- `src/infra/heartbeat-runner.respects-ackmaxchars-heartbeat-acks.test.ts`
- `src/infra/heartbeat-runner.returns-default-unset.test.ts`
- `src/infra/heartbeat-runner.sender-prefers-delivery-target.test.ts`
- `src/plugins/voice-call.plugin.test.ts`
- `src/agents/pi-embedded-subscribe.tools.test.ts`

### Tests with Logic Failures (3 tests)
- `src/agents/skills.loadworkspaceskillentries.test.ts` - expects "prose" skill from open-prose extension
- `src/config/config.plugin-validation.test.ts` - validation test expects discord plugin
- `src/config/plugin-auto-enable.test.ts` - expects bluebubbles preferOver logic

### Production Code with Extension Imports
These source files also import from `extensions/` and will need attention in Session 06:
- `src/agents/pi-embedded-runner/extensions.ts`
- `src/plugins/bundled-dir.ts`

---

## Test Results Summary

| Category | Count |
|----------|-------|
| Test Files Passed | 770 |
| Test Files Failed | 18 |
| Tests Passed | 4573 |
| Tests Failed | 3 |
| Tests Skipped | 2 |

**Pass Rate**: 97.7% of test files, 99.9% of individual tests

---

## Task Log

### [2026-01-30] - Session Start

**Environment verified**:
- [x] Prerequisites confirmed (jq, git available)
- [x] Spec system initialized
- [x] Session 01 completed

### T001 - Verify prerequisites
**Completed**: 2026-01-30 00:44
- Session 01 commit verified: 31bfab478
- Build passes

### T002 - Document extension inventory
**Completed**: 2026-01-30 00:45
- 30 extension packages documented
- 547 files total

### T003-T005 - Foundation Analysis
**Completed**: 2026-01-30 00:46
- pnpm-workspace.yaml analyzed
- labeler.yml analyzed
- onlyBuiltDependencies analyzed

### T006 - Delete extensions/ directory
**Completed**: 2026-01-30 00:47
- 30 packages deleted
- 547 files removed

### T007-T010 - Configuration Cleanup
**Completed**: 2026-01-30 00:48
- pnpm-workspace.yaml updated
- labeler.yml updated (reduced from 207 lines to 101 lines)

### T011 - pnpm install
**Completed**: 2026-01-30 00:49
- Workspace reduced to 3 projects (from 34)
- No dependency errors

### T012 - pnpm build
**Completed**: 2026-01-30 00:50
- TypeScript compilation successful

### T013 - pnpm lint
**Completed**: 2026-01-30 00:51
- 0 warnings, 0 errors

### T014 - pnpm test
**Completed**: 2026-01-30 01:10
- 770/788 test files pass (97.7%)
- 4573/4578 tests pass (99.9%)
- Remaining failures documented for Session 06

---

## Design Decisions

### Decision 1: Default Memory Slot
**Context**: Config validation was failing because default memory slot "memory-core" no longer exists
**Options**:
1. Keep default, fix validation to be lenient - would mask other validation issues
2. Change default to undefined - clean, explicit, no false assumptions
**Chosen**: Option 2
**Rationale**: Better to have no default than a default that doesn't exist

### Decision 2: Test Failures
**Context**: Some tests import directly from deleted extensions
**Options**:
1. Delete failing tests now - would reduce scope creep but touches many files
2. Document and defer to Session 06 - keeps Session 02 focused on extension removal
**Chosen**: Option 2
**Rationale**: Session 06 is explicitly for dead code cleanup; keeping scope tight

---

## Files Changed

### Deleted
- `extensions/` - 30 packages, 547 files
- `vitest.extensions.config.ts`

### Modified
- `pnpm-workspace.yaml` - removed extensions/* and matrix dependency
- `.github/labeler.yml` - removed extension labels and channel extension paths
- `vitest.config.ts` - removed extensions pattern from include
- `vitest.unit.config.ts` - removed extensions pattern
- `scripts/test-parallel.mjs` - removed extensions test run
- `src/plugins/slots.ts` - default memory slot to undefined
- `src/plugins/config-state.test.ts` - updated for undefined default
- `src/plugins/slots.test.ts` - updated for undefined default
- `src/commands/status.scan.ts` - handle no memory plugin gracefully
- `src/commands/status.test.ts` - updated for no default memory
- `src/channels/plugins/catalog.test.ts` - skipped msteams tests

---
