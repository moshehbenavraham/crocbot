# Implementation Notes

**Session ID**: `phase00-session07-remove-mobile-code`
**Started**: 2026-01-30 04:25
**Last Updated**: 2026-01-30 05:30
**Completed**: 2026-01-30 05:30

---

## Session Progress

| Metric | Value |
|--------|-------|
| Tasks Completed | 20 / 20 |
| Estimated Remaining | 0 |
| Blockers | 0 - All resolved |

---

## Task Log

### [2026-01-30] - Session Start

**Environment verified**:
- [x] Prerequisites confirmed
- [x] Tools available
- [x] Directory structure ready

---

### T001 - Verify build passes and capture baseline

**Completed**: 2026-01-30 04:30
**Notes**:
- Build passes (647 tests pass)
- One flaky test with worker termination (unrelated)

### T002 - Audit imports

**Completed**: 2026-01-30 04:35
**Notes**:
- Found all pairing, TTS, and Bonjour imports
- Key modules: src/pairing/, src/tts/, src/infra/bonjour*.ts

### T003-T007 - Delete core modules

**Completed**: 2026-01-30 04:40
**Files Deleted**:
- `src/pairing/` directory
- `src/tts/` directory
- `src/infra/bonjour.ts`, `bonjour-ciao.ts`, `bonjour-errors.ts`, `bonjour-discovery.ts`
- `src/infra/device-pairing.ts`, `device-pairing.test.ts`, `node-pairing.ts`

### T008-T010 - Remove CLI commands

**Completed**: 2026-01-30 04:45
**Files Deleted**:
- `src/cli/pairing-cli.ts`, `pairing-cli.test.ts`
- `src/cli/devices-cli.ts`
- `src/cli/gateway-cli/discover.ts`

### T011 - Update register.subclis.ts

**Completed**: 2026-01-30 04:50
**Notes**:
- Removed `devices` and `pairing` subcli entries
- Updated gateway-cli/register.ts to remove discover command

### T012-T013 - Update gateway startup/close

**Completed**: 2026-01-30 05:00
**Notes**:
- Removed bonjourStop from server-close.ts
- Simplified server-discovery-runtime.ts to wide-area DNS-SD only
- Updated server.impl.ts to remove Bonjour startup

### T014 - Update gateway server-methods

**Completed**: 2026-01-30 05:05
**Notes**:
- Deleted devices.ts, nodes.ts, tts.ts from server-methods/
- Updated server-methods.ts to remove handlers
- Created stub files for nodes.helpers.ts

### T015 - Update config schema

**Completed**: 2026-01-30 05:07
**Notes**:
- Schema doesn't have TTS/pairing-specific config
- Updated dns-cli.ts description

### T016 - Remove pairing plugin

**Completed**: 2026-01-30 05:10
**Notes**:
- Stubbed src/channels/plugins/pairing.ts
- Stubbed src/channels/plugins/pairing-message.ts

### T017 - Remove dependencies

**Completed**: 2026-01-30 05:12
**Notes**:
- Removed `@homebridge/ciao` from package.json
- Removed `node-edge-tts` from package.json
- pnpm install successful

### T018-T020 - Final verification

**Completed**: 2026-01-30 05:30
**Notes**:
- Fixed all 88 TypeScript errors by updating stub type signatures
- Fixed lint errors in telegram/pairing-store.ts
- Removed obsolete tests for removed functionality
- All verification passes:
  - Build: PASS
  - Lint: PASS (0 warnings, 0 errors)
  - Tests: 3589 passed, 2 skipped

**Files Created as Stubs**:
- `src/tts/tts.ts` - TTS stub with disabled functionality
- `src/pairing/pairing-store.ts` - Pairing store stub
- `src/pairing/pairing-messages.ts` - Pairing messages stub
- `src/infra/device-pairing.ts` - Device pairing stub
- `src/infra/node-pairing.ts` - Node pairing stub
- `src/gateway/server-methods/nodes.helpers.ts` - Node helpers stub
- `src/telegram/pairing-store.ts` - Telegram pairing wrapper stub

**Tests Updated**:
- Removed gateway discover tests from gateway-cli.coverage.test.ts
- Deleted telegram/pairing-store.test.ts

---

## Blockers & Solutions

### Blocker 1: TypeScript type compatibility (RESOLVED)

**Description**: Stub files need to export types that match caller expectations exactly
**Impact**: Build failed with 88 TypeScript errors
**Resolution**:
1. Updated `textToSpeech` to accept object parameter and return `TtsResult` type
2. Updated `maybeApplyTtsToPayload` to return `T & { mediaUrl?: string; audioAsVoice?: boolean }`
3. Added config parameter to `buildTtsSystemPromptHint`
4. Updated all TTS config functions to match expected signatures
5. Updated `respondUnavailableOnThrow` to use proper `RespondFn` type

---

## Design Decisions

### Decision 1: Stub vs Full Removal

**Context**: Many modules have deep dependencies on pairing/TTS
**Options Considered**:
1. Full removal - delete all importing code
2. Stub approach - provide no-op implementations

**Chosen**: Stub approach
**Rationale**: Minimizes code changes and maintains API compatibility. Callers continue to work but get disabled functionality.

### Decision 2: mDNS vs Wide-Area DNS-SD

**Context**: Bonjour provides both mDNS and wide-area DNS-SD
**Chosen**: Keep wide-area DNS-SD, remove mDNS (Bonjour library)
**Rationale**: Wide-area DNS-SD is pure DNS operations, doesn't need the Bonjour library

---

## Summary

Session `phase00-session07-remove-mobile-code` completed successfully.

**Removed**:
- TTS (Text-to-Speech) module and dependencies
- Bonjour/mDNS discovery (kept wide-area DNS-SD)
- Device/Node pairing infrastructure
- Related CLI commands (pairing, devices, discover)
- Related gateway RPC handlers

**Approach**:
- Created API-compatible stubs to minimize code changes
- Stubs return disabled/empty responses
- Callers continue to work without modifications

**Verification**:
- Build passes
- Lint passes
- 3589 tests pass (2 skipped)
