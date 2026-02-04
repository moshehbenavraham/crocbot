# PRD Phase 03: Upstream Features Port

**Status**: Not Started
**Sessions**: 3
**Estimated Duration**: 2-3 days

**Progress**: 0/3 sessions (0%)

---

## Overview

Phase 03 selectively ports valuable feature additions from the upstream OpenClaw repository. The focus is on Telegram inline button model selection, which enhances the user experience by allowing model switching via interactive buttons in Telegram. QMD vector memory is documented for reference but not implemented (requires external binary, overkill for single-user deployment).

---

## Progress Tracker

| Session | Name | Status | Est. Tasks | Validated |
|---------|------|--------|------------|-----------|
| 01 | Research Upstream Features | Not Started | ~12-15 | - |
| 02 | Telegram Model Buttons Implementation | Not Started | ~18-22 | - |
| 03 | Feature Validation and Documentation | Not Started | ~12-15 | - |

---

## Completed Sessions

[None yet]

---

## Upcoming Sessions

- Session 01: Research Upstream Features

---

## Objectives

1. Port Telegram inline button model selection for interactive model switching
2. Document QMD vector memory architecture for potential future adoption
3. Ensure ported features integrate cleanly with crocbot's Telegram-first architecture

---

## Prerequisites

- Phase 02 completed (Operational Maturity and Observability)
- Upstream reference codebase available in `.001_ORIGINAL/`
- Understanding of crocbot's model provider system

---

## Technical Considerations

### Architecture
- Telegram model buttons use callback queries with pagination
- Model selection integrates with existing `/model` command pattern
- Button state persisted per-chat for session continuity

### Technologies
- grammy - Telegram Bot API (already in codebase)
- @grammyjs/conversations - Conversation flow management
- Existing model provider infrastructure in `src/auto-reply/reply/`

### Risks
- **Callback data size limits**: Telegram limits callback data to 64 bytes. Mitigation: Use compressed identifiers, not full model names.
- **Provider API differences**: Upstream may have different model provider structure. Mitigation: Research phase maps upstream to crocbot patterns.
- **User confusion**: Multiple model selection methods (command vs buttons). Mitigation: Clear documentation and consistent UX.

### Relevant Considerations
<!-- From CONSIDERATIONS.md -->
- [P00] **Plugin system intact**: Core plugin system preserved. Model buttons may interact with plugin-provided models.
- [P00] **Telegram-only channel registry**: Buttons are Telegram-specific, aligns with single-channel focus.

---

## Success Criteria

Phase complete when:
- [ ] All 3 sessions completed
- [ ] Telegram inline buttons allow browsing available models
- [ ] Model selection via buttons updates active model for chat
- [ ] Buttons paginate for providers with many models
- [ ] QMD vector memory documented in architecture docs
- [ ] All tests passing
- [ ] No regressions in existing Telegram functionality

---

## Dependencies

### Depends On
- Phase 02: Operational Maturity and Observability

### Enables
- Phase 04: Upstream Bug Fixes Port
- Enhanced Telegram user experience
