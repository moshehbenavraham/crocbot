# Implementation Summary

**Session ID**: `phase00-session05-remove-dependencies`
**Completed**: 2026-01-30
**Duration**: ~30 minutes

---

## Overview

Removed 8 npm dependencies that were orphaned after sessions 01-04 eliminated their consuming code. This session reduced `node_modules` size by 71.8 MB (5.3%) and removed dead Discord retry code from the codebase.

---

## Deliverables

### Files Modified
| File | Changes |
|------|---------|
| `package.json` | Removed 8 dependencies (7 runtime, 1 dev) |
| `pnpm-lock.yaml` | Regenerated automatically |
| `src/infra/retry-policy.ts` | Removed 26 lines of dead Discord retry code |

### Files Deleted
| File | Purpose |
|------|---------|
| `src/types/qrcode-terminal.d.ts` | Orphaned type definition for removed WhatsApp QR code rendering |

---

## Technical Decisions

1. **Conservative removal approach**: Removed dependencies one category at a time (Discord, Slack, WhatsApp, Line), verifying build after each removal to catch hidden usages.

2. **Scope deviation for active code**: Two dependencies (`@homebridge/ciao`, `node-edge-tts`) were retained because thorough codebase analysis revealed active usage in 9 and 12 files respectively. These belong in a future session that removes their consuming features.

3. **Dead code cleanup**: Removed `createDiscordRetryRunner` function from `retry-policy.ts` as it was the only remaining reference to `@buape/carbon`.

---

## Test Results

| Metric | Value |
|--------|-------|
| Test Files | 649 |
| Passed Files | 648 |
| Total Tests | 3656 |
| Passed Tests | 3656 |
| Skipped Tests | 2 |
| Pre-existing Issues | 1 flaky test (unrelated) |

---

## Dependencies Removed

| Package | Type | Purpose |
|---------|------|---------|
| `@buape/carbon` | Runtime | Discord SDK |
| `discord-api-types` | Runtime | Discord types |
| `@slack/bolt` | Runtime | Slack SDK |
| `@slack/web-api` | Runtime | Slack API client |
| `@whiskeysockets/baileys` | Runtime | WhatsApp client |
| `qrcode-terminal` | Runtime | QR code rendering |
| `@types/qrcode-terminal` | Dev | QR code types |
| `@line/bot-sdk` | Runtime | Line SDK |

### Dependencies Retained (Scope Deviation)

| Package | Files Using | Reason |
|---------|-------------|--------|
| `@homebridge/ciao` | 9 | Gateway Bonjour/mDNS discovery |
| `node-edge-tts` | 12 | Text-to-speech functionality |

---

## Size Reduction Metrics

| Metric | Value |
|--------|-------|
| Before | 1,343,208,747 bytes (1.34 GB) |
| After | 1,271,386,594 bytes (1.27 GB) |
| Reduction | 71,822,153 bytes (71.8 MB) |
| Percentage | 5.3% |

---

## Lessons Learned

1. **Verify before remove**: Always search codebase for imports before removing dependencies - two deps had active code despite session 01-04 removals.

2. **Incremental verification**: Removing one category at a time allowed catching issues early and maintained a known-good state.

3. **Dead code lives in unexpected places**: Discord retry code survived in infrastructure module despite channel removal.

---

## Future Considerations

Items for future sessions:

1. **Session 07**: Remove `@homebridge/ciao` and `node-edge-tts` along with their consuming code (Bonjour discovery, TTS features).

2. **Dead code audit**: The Discord retry code suggests there may be other dead code in infrastructure modules referencing removed channels.

---

## Session Statistics

- **Tasks**: 18 completed
- **Files Modified**: 2
- **Files Deleted**: 1
- **Code Lines Removed**: 26 (dead Discord retry code)
- **Dependencies Removed**: 8
- **Blockers**: 0
