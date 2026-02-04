# Task Checklist

**Session ID**: `phase02-session03-remaining-technical-debt`
**Total Tasks**: 15 (revised from 20)
**Estimated Duration**: 6-8 hours
**Created**: 2026-01-30
**Completed**: 2026-01-30

---

## Legend

- `[x]` = Completed
- `[ ]` = Pending
- `[P]` = Parallelizable (can run with other [P] tasks)
- `[S0203]` = Session reference (Phase 02, Session 03)
- `TNNN` = Task ID

---

## Progress Summary

| Category | Total | Done | Remaining |
|----------|-------|------|-----------|
| Setup | 1 | 1 | 0 |
| Analysis | 6 | 6 | 0 |
| Implementation | 4 | 4 | 0 |
| Testing | 4 | 4 | 0 |
| **Total** | **15** | **15** | **0** |

---

## Setup (1 task)

- [x] T001 [S0203] Verify build passes before changes (`pnpm build && pnpm lint && pnpm test`)

---

## Analysis (6 tasks)

Reference tracing to understand current state.

- [x] T002 [S0203] [P] Trace all pairing-store.ts imports with grep
- [x] T003 [S0203] [P] Trace all device-pairing.ts imports with grep
- [x] T004 [S0203] [P] Analyze pairing usage in bot-message-context.ts
- [x] T005 [S0203] [P] Analyze pairing usage in bot-native-commands.ts
- [x] T006 [S0203] [P] Analyze pairing usage in security files
- [x] T007 [S0203] Trace BlueBubbles references in config schemas and code

**Analysis Result**: Pairing stubs are actively imported and used throughout the codebase for API compatibility. They return empty/disabled values but cannot be removed without breaking imports. BlueBubbles was identified as fully removable.

---

## Implementation (4 tasks)

BlueBubbles removal (pairing stubs retained for API compatibility).

- [x] T008 [S0203] Remove BlueBubbles from config schemas (`zod-schema.providers*.ts`, `schema.ts`)
- [x] T009 [S0203] Clean up BlueBubbles references in outbound code (`message-action-runner.ts`, `target-resolver.ts`, `chat-sanitize.ts`)
- [x] T010 [S0203] Remove BlueBubbles from CLI options (`channels-cli.ts`)
- [x] T011 [S0203] Update tests that reference BlueBubbles (`chunk.test.ts`)

---

## Testing (4 tasks)

Verification and documentation.

- [x] T012 [S0203] Run full build/lint/test cycle and fix any errors
- [x] T013 [S0203] Validate ASCII encoding on all modified files
- [x] T014 [S0203] Update CONSIDERATIONS.md to close resolved items
- [x] T015 [S0203] Update implementation-notes.md with summary

---

## Completion Checklist

Before marking session complete:

- [x] All tasks marked `[x]`
- [x] All tests passing (3651 tests pass)
- [x] All files ASCII-encoded (pre-existing non-ASCII in schema.ts not introduced by this session)
- [x] implementation-notes.md updated
- [x] CONSIDERATIONS.md updated
- [x] Ready for `/validate`

---

## Notes

### Key Findings

1. **Pairing stubs cannot be removed**: Analysis revealed that pairing-store.ts and device-pairing.ts are actively imported by multiple files. They return empty/disabled values but maintain type compatibility. Removing them would break the build.

2. **BlueBubbles is fully removable**: BlueBubbles provider was defined in config schemas but has no active implementation. Safe to remove all references.

### Files Modified

**Config schemas**:
- `src/config/zod-schema.providers.ts` - Removed BlueBubbles import and schema reference
- `src/config/zod-schema.providers-core.ts` - Removed BlueBubbles schema definitions (~80 lines)
- `src/config/schema.ts` - Removed BlueBubbles display labels and help text

**Core code**:
- `src/gateway/chat-sanitize.ts` - Removed from ENVELOPE_CHANNELS list
- `src/infra/outbound/message-action-runner.ts` - Simplified resolveAttachmentMaxBytes (removed BlueBubbles-specific logic)
- `src/infra/outbound/target-resolver.ts` - Removed BlueBubbles from phone number detection comment

**CLI**:
- `src/cli/channels-cli.ts` - Updated webhook-path option description

**Tests**:
- `src/auto-reply/chunk.test.ts` - Changed bluebubbles references to signal/telegram

### Scope Change

Original session scope included removing pairing stub files. Analysis revealed this was not feasible:
- `src/pairing/pairing-store.ts` - Used by 6+ files for allowFrom/pairing operations
- `src/telegram/pairing-store.ts` - Used by Telegram bot handlers
- `src/infra/device-pairing.ts` - Used by gateway message handler

These stubs must remain until the consumers are refactored to not depend on pairing functionality.

---

## Next Steps

Run `/validate` to verify session completeness.
