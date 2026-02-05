# Session 02: Telegram Model Buttons Implementation

**Session ID**: `phase03-session02-telegram-model-buttons`
**Status**: Not Started
**Estimated Tasks**: ~18-22
**Estimated Duration**: 3-4 hours

---

## Objective

Implement Telegram inline button model selection, porting the upstream feature with adaptations for crocbot's architecture.

---

## Scope

### In Scope (MVP)
- Create `src/telegram/model-buttons.ts` - Button building utilities
- Add callback query handler for model selection
- Implement provider navigation with pagination
- Integrate with existing model provider system
- Update `/model` command to show button interface
- Handle model selection persistence per-chat
- Add error handling for invalid callbacks

### Out of Scope
- Custom button styling (Telegram doesn't support)
- Model favorites or history
- Admin-only model restrictions
- Multi-user model permissions

---

## Prerequisites

- [ ] Session 01 research completed
- [ ] Integration mapping document available
- [ ] Understanding of crocbot's model provider system

---

## Deliverables

1. `src/telegram/model-buttons.ts` - Button generation utilities
2. Updated callback handler in Telegram bot setup
3. Updated `/model` command with button interface
4. Unit tests for button generation
5. Integration tests for callback handling

---

## Success Criteria

- [ ] `/model` command shows inline buttons with available providers
- [ ] Selecting a provider shows available models with pagination
- [ ] Selecting a model updates the active model for the chat
- [ ] Button state handles edge cases (deleted messages, expired callbacks)
- [ ] All tests passing
- [ ] No regressions in existing Telegram functionality
