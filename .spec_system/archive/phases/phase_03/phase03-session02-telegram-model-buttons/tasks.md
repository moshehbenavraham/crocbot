# Task Checklist

**Session ID**: `phase03-session02-telegram-model-buttons`
**Total Tasks**: 20
**Created**: 2026-02-05

---

## Legend

- `[x]` = Completed
- `[ ]` = Pending
- `[P]` = Parallelizable (can run with other [P] tasks)
- `[S0302]` = Session reference (Phase 03, Session 02)
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

Initial configuration and environment preparation.

- [x] T001 [S0302] Verify prerequisites: grammy ^1.39.3, required modules exist (`src/routing/`, `src/config/sessions.ts`, `src/auto-reply/reply/model-selection.ts`)
- [x] T002 [S0302] Review upstream `model-buttons.ts` and `bot-handlers.ts` model callback section in `.001_ORIGINAL/`

---

## Foundation (5 tasks)

Core structures and base implementations.

- [x] T003 [S0302] Create `src/telegram/model-buttons.ts` with type definitions: `ButtonRow`, `ParsedModelCallback`, `ProviderInfo`, `ModelsKeyboardParams`
- [x] T004 [S0302] Implement `parseModelCallbackData` function with `mdl_prov`, `mdl_back`, `mdl_list_*`, `mdl_sel_*` pattern parsing (`src/telegram/model-buttons.ts`)
- [x] T005 [S0302] [P] Implement `calculateTotalPages` and `getModelsPageSize` utilities (`src/telegram/model-buttons.ts`)
- [x] T006 [S0302] [P] Implement `truncateModelId` helper for display name truncation with ellipsis prefix (`src/telegram/model-buttons.ts`)
- [x] T007 [S0302] Add `ModelsProviderData` type and `buildModelsProviderData` export to `src/auto-reply/reply/commands-models.ts`

---

## Implementation (9 tasks)

Main feature implementation.

- [x] T008 [S0302] Implement `buildProviderKeyboard` function: 2 providers per row layout (`src/telegram/model-buttons.ts`)
- [x] T009 [S0302] Implement `buildModelsKeyboard` function: paginated model list with checkmark indicator (`src/telegram/model-buttons.ts`)
- [x] T010 [S0302] Add pagination row buttons (Prev/Page/Next) to `buildModelsKeyboard` (`src/telegram/model-buttons.ts`)
- [x] T011 [S0302] Implement `buildBrowseProvidersButton` function for single browse button (`src/telegram/model-buttons.ts`)
- [x] T012 [S0302] Add `resolveTelegramSessionModel` helper to `src/telegram/bot-handlers.ts` for current model resolution
- [x] T013 [S0302] Add model callback handler (`mdl_*` prefix routing) to `bot-handlers.ts` callback_query handler
- [x] T014 [S0302] Implement providers/back callback handling: editMessageText with provider keyboard (`src/telegram/bot-handlers.ts`)
- [x] T015 [S0302] Implement list callback handling: paginated model keyboard with current model marking (`src/telegram/bot-handlers.ts`)
- [x] T016 [S0302] Implement select callback handling: synthetic `/model` command via processMessage (`src/telegram/bot-handlers.ts`)

---

## Testing (4 tasks)

Verification and quality assurance.

- [x] T017 [S0302] [P] Create `src/telegram/model-buttons.test.ts` with unit tests for parsing, keyboard building, pagination
- [x] T018 [S0302] [P] Add tests for 64-byte callback data limit enforcement and model ID truncation (`src/telegram/model-buttons.test.ts`)
- [x] T019 [S0302] Run `pnpm build && pnpm lint && pnpm test` and fix any errors
- [x] T020 [S0302] Validate ASCII encoding on all created/modified files, verify Unix LF line endings

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
Tasks marked `[P]` can be worked on simultaneously:
- T005 + T006: Independent utility functions
- T017 + T018: Separate test categories

### Task Dependencies
- T003 must complete before T004-T011 (types needed)
- T007 must complete before T012-T016 (provider data needed)
- T004 must complete before T013-T016 (parsing needed)
- T008-T011 must complete before T013-T016 (keyboard functions needed)

### Key Implementation Notes
- Callback data limited to 64 bytes; skip models exceeding limit
- Model display names truncated to 38 chars with `\u2026` ellipsis prefix
- Answer callback query immediately before processing
- Catch "message is not modified" errors silently (re-tap same button)
- Unicode escape sequences: `\u2713` (checkmark), `\u25C0` (prev), `\u25B6` (next), `\u2026` (ellipsis)

### File Summary
| Action | File |
|--------|------|
| CREATE | `src/telegram/model-buttons.ts` |
| CREATE | `src/telegram/model-buttons.test.ts` |
| MODIFY | `src/telegram/bot-handlers.ts` |
| MODIFY | `src/auto-reply/reply/commands-models.ts` |

---

## Next Steps

Run `/validate` to verify session completeness.
