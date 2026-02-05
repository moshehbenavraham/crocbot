# Session 01: Grammy Timeout Recovery

**Session ID**: `phase04-session01-grammy-timeout-recovery`
**Status**: Not Started
**Estimated Tasks**: ~15-20
**Estimated Duration**: 2-4 hours

---

## Objective

Port Grammy timeout recovery fixes from upstream to prevent Telegram bot crashes during network interruptions.

---

## Scope

### In Scope (MVP)
- Add `.error` property traversal in `collectErrorCandidates()` for Grammy HttpError
- Add "timed out" message pattern to `RECOVERABLE_MESSAGE_SNIPPETS`
- Register scoped unhandled rejection handler in `monitor.ts` for Grammy HttpError
- Add tests for new error handling patterns
- Verify integration with existing error handling infrastructure

### Out of Scope
- Changes to Grammy library itself
- Cron delivery fixes (architectural incompatibility)
- Retry logic changes (existing infrastructure adequate)
- Custom timeout values (use Grammy defaults)

---

## Prerequisites

- [ ] Phase 03 completed
- [ ] Upstream reference in `.001_ORIGINAL/` accessible
- [ ] Understanding of current `src/telegram/network-errors.ts` implementation
- [ ] Understanding of `src/infra/unhandled-rejections.ts` patterns

---

## Key Files

### Upstream Reference (`.001_ORIGINAL/`)
- `src/telegram/network-errors.ts` - Network error handling with `.error` traversal
- `src/telegram/monitor.ts` - Telegram monitoring with scoped rejection handler

### crocbot Files to Modify
- `src/telegram/network-errors.ts` - Add `.error` property traversal, "timed out" pattern
- `src/telegram/monitor.ts` - Add scoped unhandled rejection handler

---

## Deliverables

1. Updated `collectErrorCandidates()` with Grammy HttpError support
2. Extended `RECOVERABLE_MESSAGE_SNIPPETS` with timeout pattern
3. Scoped unhandled rejection handler for Grammy errors in monitor
4. Test cases for Grammy timeout scenarios
5. Documentation of error handling changes

---

## Success Criteria

- [ ] Grammy HttpError with `.error` property is traversed correctly
- [ ] "timed out after X seconds" messages recognized as recoverable
- [ ] Unhandled Grammy rejections caught by scoped handler
- [ ] Existing error handling continues to work
- [ ] All tests passing
- [ ] Build and lint pass
