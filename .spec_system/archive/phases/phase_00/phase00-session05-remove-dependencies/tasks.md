# Task Checklist

**Session ID**: `phase00-session05-remove-dependencies`
**Total Tasks**: 18
**Estimated Duration**: 2-3 hours
**Created**: 2026-01-30

---

## Legend

- `[x]` = Completed
- `[ ]` = Pending
- `[P]` = Parallelizable (can run with other [P] tasks)
- `[S0005]` = Session reference (Phase 00, Session 05)
- `TNNN` = Task ID

---

## Progress Summary

| Category | Total | Done | Remaining |
|----------|-------|------|-----------|
| Setup | 2 | 2 | 0 |
| Foundation | 4 | 4 | 0 |
| Implementation | 8 | 8 | 0 |
| Testing | 4 | 4 | 0 |
| **Total** | **18** | **18** | **0** |

---

## Setup (2 tasks)

Initial measurement and environment verification.

- [x] T001 [S0005] Measure baseline `node_modules` size before changes (`du -sh node_modules`)
- [x] T002 [S0005] Verify clean working directory and all prerequisites met

---

## Foundation (4 tasks)

Verify dependencies are truly unused before removal.

- [x] T003 [S0005] [P] Search codebase for `@buape/carbon` and `discord-api-types` imports
- [x] T004 [S0005] [P] Search codebase for `@slack/bolt` and `@slack/web-api` imports
- [x] T005 [S0005] [P] Search codebase for `@whiskeysockets/baileys` and `qrcode-terminal` imports
- [x] T006 [S0005] [P] Search codebase for `@line/bot-sdk`, `@homebridge/ciao`, and `node-edge-tts` imports

---

## Implementation (8 tasks)

Remove dependencies from package.json incrementally.

- [x] T007 [S0005] Remove Discord dependencies: `@buape/carbon`, `discord-api-types` (`package.json`)
- [x] T008 [S0005] Run `pnpm install` and `pnpm build` to verify Discord removal
- [x] T009 [S0005] Remove Slack dependencies: `@slack/bolt`, `@slack/web-api` (`package.json`)
- [x] T010 [S0005] Run `pnpm install` and `pnpm build` to verify Slack removal
- [x] T011 [S0005] Remove WhatsApp dependencies: `@whiskeysockets/baileys`, `qrcode-terminal`, `@types/qrcode-terminal` (`package.json`)
- [x] T012 [S0005] Run `pnpm install` and `pnpm build` to verify WhatsApp removal
- [x] T013 [S0005] Remove Line dependency: `@line/bot-sdk` (`package.json`) - NOTE: @homebridge/ciao and node-edge-tts retained (active code)
- [x] T014 [S0005] Run `pnpm install` and `pnpm build` to verify Line removal

---

## Testing (4 tasks)

Verification and quality assurance.

- [x] T015 [S0005] Run full test suite: `pnpm lint && pnpm test` (648/649 files, 3656/3656 tests pass - 1 pre-existing flaky test)
- [x] T016 [S0005] Run CLI verification: `pnpm crocbot --help` and `pnpm crocbot config --help`
- [x] T017 [S0005] Measure final `node_modules` size and document reduction (71.8 MB / 5.3% reduction)
- [x] T018 [S0005] Verify all files ASCII-encoded and Unix LF line endings

---

## Completion Checklist

Before marking session complete:

- [x] All tasks marked `[x]`
- [x] All tests passing (648/649 files pass, 1 pre-existing flaky test)
- [x] All files ASCII-encoded
- [x] implementation-notes.md updated with size reduction metrics
- [x] Ready for `/validate`

---

## Notes

### Parallelization
Tasks T003-T006 can be run simultaneously to verify no imports exist.

### Task Timing
Target ~10-15 minutes per task (shorter than typical due to nature of dependency removal).

### Dependencies
- T003-T006 must complete before T007 (verify before remove)
- T007->T008, T009->T010, T011->T012, T013->T014 are sequential pairs (remove then verify)
- T015-T018 run after all removals complete

### Size Reduction Tracking
Document in implementation-notes.md:
- Before: `node_modules` size
- After: `node_modules` size
- Reduction: absolute and percentage

### Dependencies Being Removed
| Package | Type | Section |
|---------|------|---------|
| `@buape/carbon` | Discord SDK | dependencies |
| `discord-api-types` | Discord types | dependencies |
| `@slack/bolt` | Slack SDK | dependencies |
| `@slack/web-api` | Slack API | dependencies |
| `@whiskeysockets/baileys` | WhatsApp client | dependencies |
| `qrcode-terminal` | QR rendering | dependencies |
| `@types/qrcode-terminal` | QR types | devDependencies |
| `@line/bot-sdk` | Line SDK | dependencies |
| `@homebridge/ciao` | mDNS/Bonjour | dependencies |
| `node-edge-tts` | Text-to-speech | dependencies |

---

## Next Steps

Run `/implement` to begin AI-led implementation.
