# Session Specification

**Session ID**: `phase03-session02-telegram-model-buttons`
**Phase**: 03 - Upstream Features Port
**Status**: Not Started
**Created**: 2026-02-05

---

## 1. Session Overview

This session implements Telegram inline button model selection by porting the upstream OpenClaw feature with adaptations for crocbot's Telegram-first architecture. Users will be able to browse AI providers and select models through an interactive button interface instead of typing commands, improving the user experience significantly.

The feature adds a keyboard-based navigation system where the `/model` and `/models` commands display inline buttons. Users can tap through provider lists, paginate through available models, and select their preferred model with a single tap. The implementation leverages Telegram's callback query system while respecting the 64-byte callback data limit through compact encoding.

This session is the natural progression from the completed Session 01 research phase, which documented the upstream implementation details, identified integration points, and confirmed no blocking conflicts exist. All required dependencies and helper functions are already available in crocbot.

---

## 2. Objectives

1. Create `src/telegram/model-buttons.ts` with button building utilities and callback parsing logic
2. Add model selection callback handler to `bot-handlers.ts` for processing button taps
3. Update `/model` and `/models` commands to render inline button keyboards on Telegram
4. Implement session-aware model resolution showing the current model with a checkmark indicator

---

## 3. Prerequisites

### Required Sessions
- [x] `phase03-session01-research-upstream-features` - Provides integration mapping, upstream analysis, and verified dependency compatibility

### Required Tools/Knowledge
- Grammy bot framework (callback queries, inline keyboards)
- Telegram InlineKeyboardButton API and 64-byte callback data limit
- crocbot model provider system (`src/auto-reply/reply/commands-models.ts`)

### Environment Requirements
- Node 22+
- Grammy ^1.39.3 (already installed)
- Telegram bot token configured

---

## 4. Scope

### In Scope (MVP)
- Button building utilities module (`model-buttons.ts`)
- Callback data parsing with `mdl_` prefix patterns
- Provider keyboard (2 providers per row)
- Paginated model keyboard (8 models per page)
- Current model checkmark indicator
- Back navigation between views
- Model selection callback handler
- Session model resolution helper
- Update to `/model` command with "Browse providers" button
- Update to `/models` command with provider/model buttons
- Error handling for invalid callbacks, expired messages
- Unit tests for button generation and parsing

### Out of Scope (Deferred)
- Custom button styling - *Reason: Telegram API limitation*
- Model favorites or history - *Reason: Not in upstream, would require config schema changes*
- Admin-only model restrictions - *Reason: Multi-user feature beyond MVP*
- Multi-user model permissions - *Reason: Complex permission system beyond MVP*

---

## 5. Technical Approach

### Architecture
The implementation follows a clean separation: pure utility functions in `model-buttons.ts` for keyboard building and callback parsing, with the callback handler in `bot-handlers.ts` coordinating between button events and the existing model selection system.

```
User taps button
       |
       v
bot.on("callback_query") in bot-handlers.ts
       |
       v
parseModelCallbackData() from model-buttons.ts
       |
       +-- type: "providers" / "back" --> buildProviderKeyboard() --> editMessageText()
       |
       +-- type: "list" --> buildModelsKeyboard() with pagination --> editMessageText()
       |
       +-- type: "select" --> processMessage() with synthetic "/model" command
```

### Design Patterns
- **Pure Functions**: `model-buttons.ts` contains stateless utilities with no side effects
- **Callback Routing**: Prefix-based callback data (`mdl_*`) allows coexistence with other handlers
- **Synthetic Command**: Model selection reuses existing `/model` command handler via synthetic message

### Technology Stack
- Grammy ^1.39.3 (Telegram bot framework)
- TypeScript with strict mode
- Vitest for testing

---

## 6. Deliverables

### Files to Create
| File | Purpose | Est. Lines |
|------|---------|------------|
| `src/telegram/model-buttons.ts` | Button building utilities, callback parsing, pagination | ~200 |
| `src/telegram/model-buttons.test.ts` | Unit tests for button utilities | ~250 |

### Files to Modify
| File | Changes | Est. Lines |
|------|---------|------------|
| `src/telegram/bot-handlers.ts` | Add model callback handler, `resolveTelegramSessionModel` helper, imports | ~120 |
| `src/auto-reply/reply/commands-models.ts` | Export `buildModelsProviderData`, add `surface` param, Telegram button rendering | ~80 |

---

## 7. Success Criteria

### Functional Requirements
- [ ] `/model` command shows current model with "Browse providers" button
- [ ] `/models` command shows provider buttons (2 per row)
- [ ] Tapping provider shows paginated model list (8 per page)
- [ ] Current model displays checkmark suffix
- [ ] Pagination buttons (Prev/Next) work correctly
- [ ] Back button returns to provider list
- [ ] Model selection updates the active model for the chat
- [ ] Selection confirmation message displays

### Testing Requirements
- [ ] Unit tests for `parseModelCallbackData` all patterns
- [ ] Unit tests for `buildProviderKeyboard` layout
- [ ] Unit tests for `buildModelsKeyboard` pagination
- [ ] Unit tests for model ID truncation
- [ ] Unit tests for 64-byte limit enforcement
- [ ] Manual testing in DM context
- [ ] Manual testing in group context

### Quality Gates
- [ ] All files ASCII-encoded
- [ ] Unix LF line endings
- [ ] Code follows project conventions (CONVENTIONS.md)
- [ ] `pnpm build` passes with no errors
- [ ] `pnpm lint` passes with no warnings
- [ ] `pnpm test` passes with no failures
- [ ] No TypeScript `any` types

---

## 8. Implementation Notes

### Key Considerations
- Callback data limited to 64 bytes; models with long IDs that exceed limit are silently skipped
- Model display names truncated to 38 chars with ellipsis prefix for readability
- Always answer callback query immediately before processing to prevent Telegram retries
- Catch "message is not modified" errors silently (user re-tapped same button)

### Potential Challenges
- **Callback Data Size**: Long model IDs like `anthropic/claude-3.5-sonnet-20241022` may approach limit
  - *Mitigation*: Skip models exceeding 64 bytes as upstream does
- **Expired Callbacks**: User taps button on old message after bot restart
  - *Mitigation*: Graceful error handling, rebuild keyboard if possible
- **Concurrent Button Presses**: Multiple rapid taps
  - *Mitigation*: Answer query immediately, process asynchronously

### Relevant Considerations
- [P00] **Telegram-only channel registry**: All button implementation can assume single-channel (Telegram) without needing channel abstraction - simplifies `surface` parameter handling
- [P00] **TypeScript as refactoring guide**: Strict typing will identify necessary integration points when porting upstream code - rely on compiler errors to find missing pieces

### ASCII Reminder
All output files must use ASCII-only characters (0-127). Unicode characters for UI display (checkmark, arrows) use escape sequences: `\u2713`, `\u25C0`, `\u25B6`, `\u2026`.

---

## 9. Testing Strategy

### Unit Tests
- `parseModelCallbackData` - all callback patterns (`mdl_prov`, `mdl_back`, `mdl_list_*`, `mdl_sel_*`)
- `buildProviderKeyboard` - layout with varying provider counts
- `buildModelsKeyboard` - pagination boundaries, current model marking
- `calculateTotalPages` - edge cases (0 models, exact multiple)
- Model ID truncation - short/long/exact boundary
- 64-byte callback data enforcement

### Integration Tests
- Provider data building with actual config structure
- Button rendering in reply payload

### Manual Testing
- DM context: `/model`, `/models`, full navigation flow
- Group context: Same flow, verify per-chat model storage
- Forum topic context: Verify thread-aware session
- Multiple providers: Test pagination across providers
- Pagination boundaries: First page, last page, single page

### Edge Cases
- Empty provider list (no configured models)
- Unknown provider in callback (stale button)
- Page number out of bounds
- Model ID exactly 64 bytes
- Re-tapping same button (no-op)

---

## 10. Dependencies

### External Libraries
- Grammy: ^1.39.3 (existing)
- @grammyjs/runner: ^2.0.3 (existing)

### Internal Dependencies
| Module | Function | Purpose |
|--------|----------|---------|
| `src/auto-reply/reply/model-selection.ts` | `resolveStoredModelOverride` | Get stored model override |
| `src/config/sessions.ts` | `loadSessionStore`, `resolveStorePath` | Session store access |
| `src/routing/resolve-route.ts` | `resolveAgentRoute` | Agent route resolution |
| `src/routing/session-key.ts` | `resolveThreadSessionKeys` | Thread session keys |
| `src/telegram/bot/helpers.ts` | `buildTelegramGroupPeerId` | Peer ID construction |

### Other Sessions
- **Depends on**: `phase03-session01-research-upstream-features` (completed)
- **Depended by**: `phase03-session03-feature-validation`

---

## Next Steps

Run `/tasks` to generate the implementation task checklist.
