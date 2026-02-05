# Session Specification

**Session ID**: `phase03-session01-research-upstream-features`
**Phase**: 03 - Upstream Features Port
**Status**: Not Started
**Created**: 2026-02-05

---

## 1. Session Overview

This research session marks the beginning of Phase 03, transitioning from operational maturity work to feature porting from upstream OpenClaw. The primary objective is to thoroughly analyze the upstream Telegram model button implementation and QMD vector memory architecture before committing to implementation.

Research-first approach is critical here. Phase 00 lessons learned emphasize "Reference tracing before deletion" and "Scope discipline" - these principles apply equally when porting code. Understanding upstream patterns, callback data formats, and pagination logic prevents costly refactoring during implementation. This session produces documentation artifacts that guide Session 02's implementation.

The session also documents QMD vector memory architecture for potential future adoption. While QMD implementation is out of scope for Phase 03, capturing this knowledge now preserves the option without requiring future upstream analysis.

---

## 2. Objectives

1. Analyze upstream model button implementation and document callback patterns, pagination logic, and provider interactions
2. Create integration mapping between upstream components and crocbot's existing model provider system
3. Document QMD vector memory architecture as a reference for future consideration
4. Identify conflicts, blockers, or integration challenges with mitigation strategies

---

## 3. Prerequisites

### Required Sessions
- [x] `phase02-session05-operational-runbooks` - Phase 02 complete with operational maturity

### Required Tools/Knowledge
- grammy callback query API understanding
- Telegram inline keyboard markup patterns
- crocbot model provider architecture familiarity

### Environment Requirements
- Upstream codebase available in `.001_ORIGINAL/`
- Read access to crocbot `src/` for comparison

---

## 4. Scope

### In Scope (MVP)
- Analyze `src/telegram/model-buttons.ts` from upstream
- Map upstream callback handlers in `src/telegram/bot-handlers.ts`
- Document model provider interface in `src/auto-reply/reply/commands-models.ts`
- Identify crocbot equivalents for upstream model APIs
- Document QMD vector memory architecture (reference documentation only)
- Create integration mapping document
- Document callback data format and encoding schemes
- Document pagination patterns for model lists

### Out of Scope (Deferred)
- Actual code implementation - *Reason: Session 02 scope*
- QMD binary installation or setup - *Reason: Not part of Phase 03*
- Changes to existing crocbot files - *Reason: Research only*
- Performance optimization research - *Reason: Implementation concern*

---

## 5. Technical Approach

### Architecture
This is a research session - no code changes. The approach involves systematic analysis of upstream source files, extracting patterns and documenting integration points. Research documents will be created in `.spec_system/PRD/phase_03/research/` to inform implementation.

Analysis will trace data flow from:
1. User taps model button in Telegram
2. grammy receives callback query
3. Handler parses callback data
4. Model provider lookup/switch occurs
5. Response sent with updated keyboard

### Design Patterns
- **Documentation-first**: Create reference docs before code
- **Comparative analysis**: Map upstream -> crocbot equivalents
- **Risk identification**: Surface blockers early

### Technology Stack
- grammy (Telegram bot framework)
- Telegram Bot API (inline keyboards, callback queries)
- TypeScript (for code analysis)

---

## 6. Deliverables

### Files to Create
| File | Purpose | Est. Lines |
|------|---------|------------|
| `.spec_system/PRD/phase_03/research/upstream-model-buttons.md` | Complete analysis of upstream model button implementation | ~150-200 |
| `.spec_system/PRD/phase_03/research/crocbot-integration-map.md` | Mapping between upstream and crocbot components | ~80-120 |
| `.spec_system/PRD/phase_03/research/qmd-architecture.md` | QMD vector memory architecture reference | ~100-150 |
| `.spec_system/PRD/phase_03/research/blockers-mitigations.md` | Identified conflicts with mitigation strategies | ~50-80 |

### Files to Modify
| File | Changes | Est. Lines |
|------|---------|------------|
| None | Research-only session | 0 |

---

## 7. Success Criteria

### Functional Requirements
- [ ] All upstream model button files analyzed and documented
- [ ] Callback data format fully documented with encoding scheme
- [ ] Pagination logic documented with edge cases
- [ ] crocbot integration points clearly identified
- [ ] QMD architecture documented for future reference

### Testing Requirements
- [ ] N/A - Documentation-only session

### Quality Gates
- [ ] All files ASCII-encoded
- [ ] Unix LF line endings
- [ ] Research documents follow markdown conventions
- [ ] No blocking conflicts identified (or all have mitigation plans)

---

## 8. Implementation Notes

### Key Considerations
- Focus on understanding before documenting - read code thoroughly
- Note any upstream dependencies that crocbot doesn't have
- Identify any grammy version differences between upstream and crocbot
- Pay attention to error handling patterns in upstream callbacks

### Potential Challenges
- **Callback data format differences**: Upstream may use different encoding scheme - document both and plan migration
- **Model provider interface mismatches**: Upstream API may differ from crocbot's providers - map differences explicitly
- **State management patterns**: Upstream may persist button state differently - document state lifecycle

### Relevant Considerations
- [P00] **Telegram-only channel registry**: Simplified channel architecture may make model button integration cleaner - single channel means no cross-channel state concerns
- [P00] **Incremental verification**: Apply research-first approach before implementation commits - this session IS that verification
- [P00] **TypeScript as refactoring guide**: Strict typing will reveal integration points during research - note type mismatches

### ASCII Reminder
All output files must use ASCII-only characters (0-127).

---

## 9. Testing Strategy

### Unit Tests
- N/A - Documentation-only session

### Integration Tests
- N/A - Documentation-only session

### Manual Testing
- Verify all upstream files referenced actually exist in `.001_ORIGINAL/`
- Cross-reference documented integration points with actual crocbot source

### Edge Cases
- Document upstream handling of: empty model lists, network errors during callback, concurrent button presses

---

## 10. Dependencies

### External Libraries
- None added - research only

### Other Sessions
- **Depends on**: `phase02-session05-operational-runbooks` (Phase 02 completion)
- **Depended by**: `phase03-session02-telegram-model-buttons` (implementation), `phase03-session03-feature-validation` (validation)

---

## Next Steps

Run `/tasks` to generate the implementation task checklist.
