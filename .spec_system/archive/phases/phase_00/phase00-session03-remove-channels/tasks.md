# Task Checklist

**Session ID**: `phase00-session03-remove-channels`
**Total Tasks**: 20
**Estimated Duration**: 6-8 hours
**Created**: 2026-01-30

---

## Legend

- `[x]` = Completed
- `[ ]` = Pending
- `[P]` = Parallelizable (can run with other [P] tasks)
- `[S0003]` = Session reference (Phase 00, Session 03)
- `TNNN` = Task ID

---

## Progress Summary

| Category | Total | Done | Remaining |
|----------|-------|------|-----------|
| Setup | 2 | 2 | 0 |
| Foundation | 5 | 5 | 0 |
| Implementation | 9 | 9 | 0 |
| Testing | 4 | 4 | 0 |
| **Total** | **20** | **20** | **0** |

---

## Setup (2 tasks)

Initial verification and environment preparation.

- [x] T001 [S0003] Verify prerequisites: sessions 01 and 02 completed, clean working tree
- [x] T002 [S0003] Create backup checkpoint with git stash or branch for rollback safety

---

## Foundation (5 tasks)

Remove channel implementation directories (bulk deletion phase).

- [x] T003 [S0003] [P] Remove `src/discord/` directory (~61 files, Discord bot implementation)
- [x] T004 [S0003] [P] Remove `src/slack/` directory (~65 files, Slack bot implementation)
- [x] T005 [S0003] [P] Remove `src/signal/` directory (~24 files, Signal REST implementation)
- [x] T006 [S0003] [P] Remove `src/imessage/` directory (~16 files, iMessage implementation)
- [x] T007 [S0003] [P] Remove `src/web/` directory (~77 files, WhatsApp Web implementation), `src/whatsapp/` (~2 files), `src/line/` (~34 files)

---

## Implementation (9 tasks)

Update channel system to Telegram-only architecture.

- [x] T008 [S0003] Update `src/channels/registry.ts`: reduce `CHAT_CHANNEL_ORDER` to telegram-only, update `DEFAULT_CHAT_CHANNEL`, remove `CHAT_CHANNEL_META` entries, clear `CHAT_CHANNEL_ALIASES`
- [x] T009 [S0003] [P] Remove channel plugin action files: `src/channels/plugins/actions/discord.ts`, `discord.test.ts`, `discord/` directory, `signal.ts`, `signal.test.ts`
- [x] T010 [S0003] [P] Remove channel plugin normalize files: `src/channels/plugins/normalize/discord.ts`, `imessage.ts`, `imessage.test.ts`, `signal.ts`, `signal.test.ts`, `slack.ts`, `whatsapp.ts`
- [x] T011 [S0003] [P] Remove channel plugin outbound files: `src/channels/plugins/outbound/discord.ts`, `imessage.ts`, `signal.ts`, `slack.ts`, `whatsapp.ts`
- [x] T012 [S0003] [P] Remove channel plugin onboarding files: `src/channels/plugins/onboarding/discord.ts`, `imessage.ts`, `signal.ts`, `slack.ts`, `whatsapp.ts`
- [x] T013 [S0003] [P] Remove channel plugin status-issues files: `src/channels/plugins/status-issues/discord.ts`, `whatsapp.ts`, `bluebubbles.ts`
- [x] T014 [S0003] Remove channel plugin auxiliary files: `src/channels/plugins/slack.actions.ts`, `slack.actions.test.ts`, `bluebubbles-actions.ts`, `whatsapp-heartbeat.ts`, `agent-tools/whatsapp-login.ts`
- [x] T015 [S0003] Update channel plugin shared files: `src/channels/plugins/index.ts`, `load.ts`, `outbound/load.ts` - remove non-Telegram imports and references
- [x] T016 [S0003] Update `.github/labeler.yml`: remove channel labels for discord, imessage, signal, slack, whatsapp-web

---

## Testing (4 tasks)

Verification and quality assurance.

- [x] T017 [S0003] Run `pnpm build` and fix any TypeScript compilation errors from removed imports
- [x] T018 [S0003] Run `pnpm lint` and fix any linting errors
- [x] T019 [S0003] Run `pnpm test` and verify all tests pass (Telegram tests should remain functional)
- [x] T020 [S0003] Validate ASCII encoding on all modified files, verify Unix LF line endings

---

## Completion Checklist

Before marking session complete:

- [x] All tasks marked `[x]`
- [x] All tests passing
- [x] All files ASCII-encoded
- [x] implementation-notes.md updated
- [x] Ready for `/validate`

---

## Notes

### Parallelization
Tasks T003-T007 can be run in parallel (directory deletions are independent).
Tasks T009-T013 can be run in parallel (plugin file removals are independent).

### Task Dependencies
- T001-T002 must complete before directory deletions
- T003-T007 must complete before T008-T016 (registry/plugin updates depend on directories being gone)
- T017-T019 are sequential (build -> lint -> test)

### Key Files to Preserve
- `src/telegram/` - Telegram implementation (DO NOT MODIFY)
- `src/channels/` shared infrastructure - preserve channel-agnostic code
- `src/channels/plugins/actions/telegram.ts` - keep Telegram action handler
- `src/channels/plugins/normalize/telegram.ts` - keep Telegram normalizer
- `src/channels/plugins/outbound/telegram.ts` - keep Telegram outbound
- `src/channels/plugins/onboarding/telegram.ts` - keep Telegram onboarding
- `src/channels/plugins/status-issues/telegram.ts` - keep Telegram status

### Critical Changes
- `DEFAULT_CHAT_CHANNEL` changes from "whatsapp" to "telegram"
- `CHAT_CHANNEL_ORDER` reduces to single entry: ["telegram"]
- `CHAT_CHANNEL_ALIASES` becomes empty object

### Files Removed Summary
- ~279 files across 7 channel directories
- ~15 plugin action/normalize/outbound/onboarding files
- Total: ~300 files removed

### Additional Fixes Performed
- Created `src/media/load.ts` with `loadWebMedia` function relocated from deleted `src/web/media.ts`
- Updated imports across all files that referenced `../../web/media.js`
- Rewrote `src/plugins/runtime/index.ts` to remove all non-Telegram channel imports
- Rewrote `src/plugins/runtime/types.ts` to remove all non-Telegram channel types
- Rewrote `src/auto-reply/reply/normalize-reply.ts` without LINE-specific directive parsing
- Rewrote `src/auto-reply/reply/commands-allowlist.ts` to only support Telegram
- Rewrote `src/commands/channels/capabilities.ts` to remove Discord/Slack specific code
- Rewrote `src/config/plugin-auto-enable.ts` to only keep Telegram auto-enable logic
- Rewrote `src/infra/outbound/outbound-session.ts` to remove all non-Telegram session resolution functions
- Fixed `src/infra/outbound/message-action-runner.ts` to remove Slack auto-threading
- Fixed `src/gateway/test-helpers.mocks.ts` to remove WhatsApp/Discord/Slack/Signal/iMessage/BlueBubbles mocks
- Fixed `src/gateway/test-helpers.server.ts` to remove WhatsApp allowFrom reference
- Fixed `src/agents/pi-embedded-runner/compact.ts` to remove Signal reaction level import
- Fixed `src/agents/pi-embedded-runner/run/attempt.ts` to remove Signal reaction level import
- Fixed `src/agents/tools/message-tool.ts` to remove BlueBubbles group actions import
- Added `createGenericTestPlugin` to `src/test-utils/channel-plugins.ts` for backward compatibility
- Deleted/updated ~40 test files that referenced removed channels

---

## Next Steps

Run `/implement` to begin AI-led implementation.
