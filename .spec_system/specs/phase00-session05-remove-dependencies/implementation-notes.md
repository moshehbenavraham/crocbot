# Implementation Notes

**Session ID**: `phase00-session05-remove-dependencies`
**Started**: 2026-01-30 03:22
**Last Updated**: 2026-01-30 03:50
**Status**: COMPLETE

---

## Session Progress

| Metric | Value |
|--------|-------|
| Tasks Completed | 18 / 18 |
| Blockers | 0 |

---

## Size Reduction Tracking

| Metric | Value |
|--------|-------|
| Before | 1,343,208,747 bytes (1.34 GB) |
| After | 1,271,386,594 bytes (1.27 GB) |
| Reduction | 71,822,153 bytes (71.8 MB) = **5.3%** |

---

## Task Log

### [2026-01-30] - Session Start

**Environment verified**:
- [x] Prerequisites confirmed (jq, git available)
- [x] .spec_system directory valid
- [x] Clean state.json

---

### T001 - Measure baseline node_modules size

**Completed**: 2026-01-30 03:22
**Duration**: 1 minute

**Notes**:
- Baseline node_modules size: 1,343,208,747 bytes (1.4GB)

---

### T002 - Verify prerequisites

**Completed**: 2026-01-30 03:23
**Duration**: 2 minutes

**Notes**:
- Node 22.19.0 available via nvm
- pnpm 10.23.0 available

---

### T003-T006 - Search codebase for dependency imports

**Started**: 2026-01-30 03:24
**Completed**: 2026-01-30 03:30
**Duration**: 6 minutes

**CRITICAL FINDING - Scope Deviation**:

The spec assumed all consuming code was removed in prior sessions. Analysis revealed:

**Dependencies with ACTIVE code (CANNOT remove):**
- `@homebridge/ciao` - Used by 9 files for gateway Bonjour/mDNS discovery
- `node-edge-tts` - Used by 12 files for TTS functionality

**Dependencies with NO active code (safe to remove):**
- `@buape/carbon` - Only dead Discord retry code (will refactor first)
- `discord-api-types` - No imports
- `@slack/bolt`, `@slack/web-api` - No imports
- `@whiskeysockets/baileys` - No imports
- `qrcode-terminal`, `@types/qrcode-terminal` - Only orphan type defs
- `@line/bot-sdk` - No imports

**Decision**: Proceeding with conservative approach - remove only unused dependencies.

**Files Changed**: None yet (analysis phase)

---

### T007-T008 - Remove Discord dependencies

**Completed**: 2026-01-30 03:35
**Duration**: 5 minutes

**Notes**:
- Removed dead Discord retry code from `src/infra/retry-policy.ts`
- Removed `@buape/carbon` import and `createDiscordRetryRunner` function
- Removed `@buape/carbon` and `discord-api-types` from package.json
- Build verified successfully

**Files Changed**:
- `src/infra/retry-policy.ts` - Removed 26 lines of dead Discord retry code
- `package.json` - Removed 2 dependencies

---

### T009-T010 - Remove Slack dependencies

**Completed**: 2026-01-30 03:37
**Duration**: 2 minutes

**Notes**:
- Removed `@slack/bolt` and `@slack/web-api` from package.json
- Build verified successfully

**Files Changed**:
- `package.json` - Removed 2 dependencies

---

### T011-T012 - Remove WhatsApp dependencies

**Completed**: 2026-01-30 03:39
**Duration**: 2 minutes

**Notes**:
- Removed `@whiskeysockets/baileys`, `qrcode-terminal`, `@types/qrcode-terminal`
- Deleted orphan type definitions file `src/types/qrcode-terminal.d.ts`
- Build verified successfully

**Files Changed**:
- `package.json` - Removed 2 runtime deps, 1 dev dep
- `src/types/qrcode-terminal.d.ts` - Deleted

---

### T013-T014 - Remove Line SDK

**Completed**: 2026-01-30 03:41
**Duration**: 2 minutes

**Notes**:
- Removed `@line/bot-sdk` from package.json
- Build verified successfully

**Files Changed**:
- `package.json` - Removed 1 dependency

---

### T015 - Full test suite

**Completed**: 2026-01-30 03:45
**Duration**: 4 minutes (includes test execution ~2 min)

**Notes**:
- Lint: 0 warnings, 0 errors
- Tests: 648/649 test files pass, 3656/3656 tests pass
- Pre-existing flaky test in `session-write-lock.test.ts` (file descriptor GC issue, not related to changes)

---

### T016 - CLI verification

**Completed**: 2026-01-30 03:46
**Duration**: 1 minute

**Notes**:
- `pnpm crocbot --help` works correctly
- `pnpm crocbot config --help` works correctly

---

### T017 - Size reduction measurement

**Completed**: 2026-01-30 03:48
**Duration**: 2 minutes

**Notes**:
- Fresh install performed to get accurate measurement
- Reduction: 71.8 MB (5.3%)

---

### T018 - Verify encoding and line endings

**Completed**: 2026-01-30 03:50
**Duration**: 1 minute

**Notes**:
- All modified files are ASCII-encoded
- All files use Unix LF line endings

---

## Summary

**Dependencies Removed:**
| Package | Type |
|---------|------|
| `@buape/carbon` | Discord SDK |
| `discord-api-types` | Discord types |
| `@slack/bolt` | Slack SDK |
| `@slack/web-api` | Slack API |
| `@whiskeysockets/baileys` | WhatsApp client |
| `qrcode-terminal` | QR rendering |
| `@types/qrcode-terminal` | QR types |
| `@line/bot-sdk` | Line SDK |

**Dependencies Retained (active code):**
| Package | Reason |
|---------|--------|
| `@homebridge/ciao` | Gateway Bonjour/mDNS discovery (9 files) |
| `node-edge-tts` | TTS functionality (12 files) |

**Code Refactored:**
- Removed dead Discord retry code from `src/infra/retry-policy.ts`
- Deleted orphan `src/types/qrcode-terminal.d.ts`

---
