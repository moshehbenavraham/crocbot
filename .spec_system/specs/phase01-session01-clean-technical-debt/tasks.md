# Task Checklist

**Session ID**: `phase01-session01-clean-technical-debt`
**Total Tasks**: 20
**Estimated Duration**: 6-8 hours
**Created**: 2026-01-30

---

## Legend

- `[x]` = Completed
- `[ ]` = Pending
- `[P]` = Parallelizable (can run with other [P] tasks)
- `[S0101]` = Session reference (Phase 01, Session 01)
- `TNNN` = Task ID

---

## Progress Summary

| Category | Total | Done | Remaining |
|----------|-------|------|-----------|
| Setup | 2 | 2 | 0 |
| Foundation | 4 | 4 | 0 |
| Implementation | 10 | 10 | 0 |
| Testing | 4 | 4 | 0 |
| **Total** | **20** | **20** | **0** |

---

## Setup (2 tasks)

Initial verification and reference tracing.

- [x] T001 [S0101] Verify all tests currently pass (`pnpm test`)
- [x] T002 [S0101] Trace all TTS/pairing/device-pairing imports with grep for deletion plan

---

## Foundation (4 tasks)

Remove leaf stub files that have no dependents.

- [x] T003 [S0101] [P] Delete `src/tts/tts.ts` and remove `src/tts/` directory
- [x] T004 [S0101] [P] Delete `src/pairing/pairing-messages.ts`
- [x] T005 [S0101] [P] Delete `src/infra/device-pairing.ts`
- [x] T006 [S0101] [P] Delete `src/config/types.whatsapp.ts`

---

## Implementation (10 tasks)

Update consumers and remove dead code references.

- [x] T007 [S0101] Remove TTS imports from agent files (`src/agents/pi-embedded-runner/run/attempt.ts`, `src/agents/pi-embedded-runner/compact.ts`, `src/agents/cli-runner/helpers.ts`)
- [x] T008 [S0101] Remove or delete `src/agents/tools/tts-tool.ts`
- [x] T009 [S0101] Remove TTS imports from auto-reply files (`src/auto-reply/reply/commands-context-report.ts`, `src/auto-reply/reply/dispatch-from-config.ts`, `src/auto-reply/status.ts`)
- [x] T010 [S0101] Remove or delete `src/auto-reply/reply/commands-tts.ts`
- [x] T011 [S0101] Remove TTS and pairing imports from plugin runtime (`src/plugins/runtime/index.ts`)
- [x] T012 [S0101] Remove pairing re-exports from plugin SDK (`src/plugin-sdk/index.ts`)
- [x] T013 [S0101] Remove pairing imports from Telegram files (`src/telegram/bot-message-context.ts`, `src/telegram/bot-native-commands.ts`, `src/telegram/bot-handlers.ts`)
- [x] T014 [S0101] Remove pairing imports from security and allowlist files (`src/auto-reply/reply/commands-allowlist.ts`, `src/commands/doctor-security.ts`, `src/security/audit.ts`, `src/security/fix.ts`)
- [x] T015 [S0101] Delete `src/pairing/pairing-store.ts` and clean `src/pairing/` directory
- [x] T016 [S0101] Remove device-pairing imports from gateway files (`src/gateway/server.auth.e2e.test.ts`, `src/gateway/server/ws-connection/message-handler.ts`)

---

## Cleanup (2 tasks)

Remove Bonjour/mDNS and verify BlueBubbles/WhatsApp cleanup.

- [x] T017 [S0101] Remove Bonjour/mDNS references from config files (`src/config/schema.ts`, `src/config/types.gateway.ts`, `src/config/zod-schema.ts`)
- [x] T018 [S0101] Remove WhatsApp type imports and verify BlueBubbles references (`src/config/types.ts`, `src/config/types.channels.ts`)

---

## Testing (2 tasks)

Verification and quality assurance.

- [x] T019 [S0101] Run full build/lint/test validation (`pnpm build && pnpm lint && pnpm test`)
- [x] T020 [S0101] Manual testing - verify CLI and gateway functionality (`crocbot --help`, `crocbot channels status`)

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
Tasks T003-T006 (Foundation) can be worked on simultaneously as they delete independent stub files.

### Task Timing
Target ~20-25 minutes per task.

### Dependencies
- T003-T006 must complete before T007-T016 (consumers need stubs deleted first to see errors)
- T007-T016 can be done in flexible order but T015 depends on T011-T014 completing
- T017-T018 are independent of TTS/pairing cleanup
- T019-T020 must run after all implementation tasks

### Deletion Order Strategy
1. Delete leaf stub files (T003-T006) - these have no internal dependents
2. Update consumers in groups by feature (TTS: T007-T010, Pairing: T011-T016)
3. Clean config files (T017-T018)
4. Validate everything (T019-T020)

### Risk Mitigation
- Run `pnpm build` incrementally after each group of changes
- If dynamic imports exist, they will surface during test runs
- Plugin SDK changes may break external plugins (acceptable per spec)

---

## Session Complete

All 20 tasks completed. Run `/validate` to verify session completeness.
