# NEXT_SESSION.md

## Session Recommendation

**Generated**: 2026-02-05
**Project State**: Phase 03 - Upstream Features Port
**Completed Sessions**: 19

---

## Recommended Next Session

**Session ID**: `phase03-session02-telegram-model-buttons`
**Session Name**: Telegram Model Buttons Implementation
**Estimated Duration**: 3-4 hours
**Estimated Tasks**: 18-22

---

## Why This Session Next?

### Prerequisites Met
- [x] Session 01 research completed (phase03-session01-research-upstream-features)
- [x] Integration mapping document available from research
- [x] Understanding of crocbot's model provider system documented

### Dependencies
- **Builds on**: phase03-session01-research-upstream-features (completed 2026-02-05)
- **Enables**: phase03-session03-feature-validation

### Project Progression
This is the natural next step in Phase 03's Upstream Features Port. The research session has been completed, providing the integration mapping and architectural understanding needed to implement the Telegram model buttons feature. This session moves from research to actual implementation, porting the upstream inline button functionality adapted for crocbot's Telegram-first architecture.

---

## Session Overview

### Objective
Implement Telegram inline button model selection, porting the upstream feature with adaptations for crocbot's architecture.

### Key Deliverables
1. `src/telegram/model-buttons.ts` - Button building utilities
2. Updated callback handler in Telegram bot setup
3. Updated `/model` command with button interface
4. Unit tests for button generation
5. Integration tests for callback handling

### Scope Summary
- **In Scope (MVP)**: Button building utilities, callback query handler, provider navigation with pagination, model provider integration, `/model` command update, model selection persistence, error handling
- **Out of Scope**: Custom button styling, model favorites/history, admin-only restrictions, multi-user permissions

---

## Technical Considerations

### Technologies/Patterns
- Grammy bot framework
- Telegram InlineKeyboardButton API
- Callback query handling
- Existing model provider system in `src/auto-reply/reply/commands-models.ts`

### Potential Challenges
- Callback data size limitations (64 bytes in Telegram)
- Pagination state management across button interactions
- Error handling for expired callbacks and deleted messages
- Integration with existing model provider system

### Relevant Considerations
- [P00] **Telegram-only channel registry**: All button implementation can assume single-channel (Telegram) without needing channel abstraction
- [P00] **TypeScript as refactoring guide**: Strict typing will help identify necessary integration points when porting upstream code

---

## Alternative Sessions

If this session is blocked:
1. **phase04-session01-grammy-timeout-recovery** - Could start bug fixes if model buttons implementation is blocked by upstream research gaps
2. **phase03-session03-feature-validation** - Not viable as it requires Session 02 completion

---

## Next Steps

Run `/sessionspec` to generate the formal specification.
