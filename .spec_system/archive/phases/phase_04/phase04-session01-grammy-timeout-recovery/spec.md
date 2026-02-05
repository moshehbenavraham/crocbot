# Session Specification

**Session ID**: `phase04-session01-grammy-timeout-recovery`
**Phase**: 04 - Upstream Bug Fixes Port
**Status**: Not Started
**Created**: 2026-02-05

---

## 1. Session Overview

This session ports Grammy timeout recovery fixes from upstream OpenClaw to prevent Telegram bot crashes during network interruptions. Grammy's HttpError wraps underlying network errors in its `.error` property rather than the standard `.cause`, and its timeout messages use "timed out" phrasing that isn't matched by existing patterns.

The fixes are purely additive and surgical: extend the error candidate traversal to follow Grammy's `.error` property, add "timed out" to the recoverable message snippets, and register a scoped unhandled rejection handler in the monitor to catch Grammy HttpErrors that escape the polling loop's try-catch (e.g., from `setMyCommands` during bot setup).

These changes directly improve production stability by ensuring transient network failures during Telegram polling are properly recognized and handled rather than crashing the gateway.

---

## 2. Objectives

1. Port Grammy HttpError `.error` property traversal to `collectErrorCandidates()` in `network-errors.ts`
2. Extend `RECOVERABLE_MESSAGE_SNIPPETS` with "timed out" and related patterns from upstream
3. Add scoped unhandled rejection handler for Grammy HttpErrors in `monitor.ts`
4. Verify integration with existing error handling and add tests for new patterns

---

## 3. Prerequisites

### Required Sessions
- [x] `phase03-session03-feature-validation` - Phase 03 completed, codebase stable

### Required Tools/Knowledge
- Understanding of Grammy's HttpError structure (`.error` vs `.cause`)
- Node.js unhandled rejection handler patterns
- Existing error handling in `src/telegram/network-errors.ts`

### Environment Requirements
- Node 22+ runtime
- Access to upstream reference in `.001_ORIGINAL/`

---

## 4. Scope

### In Scope (MVP)
- Add `.error` property traversal in `collectErrorCandidates()` for Grammy HttpError
- Add "timed out" message pattern to `RECOVERABLE_MESSAGE_SNIPPETS`
- Add "timeout" general pattern to catch timeout messages not covered by error codes/names
- Add missing error codes ("ECONNABORTED", "ERR_NETWORK") to `RECOVERABLE_ERROR_CODES`
- Import `registerUnhandledRejectionHandler` in `monitor.ts`
- Add `isGrammyHttpError()` helper function in `monitor.ts`
- Register scoped unhandled rejection handler in `monitorTelegramProvider()`
- Add tests for Grammy HttpError traversal and timeout message matching
- Verify existing error handling continues to work

### Out of Scope (Deferred)
- Changes to Grammy library itself - *Reason: external dependency*
- Cron delivery fixes - *Reason: architectural incompatibility with crocbot*
- Retry logic changes - *Reason: existing infrastructure adequate*
- Custom timeout values - *Reason: Grammy defaults sufficient*
- Removing HTTP status code handling - *Reason: crocbot has it, upstream doesn't; keep for safety*

---

## 5. Technical Approach

### Architecture
The changes follow the existing error handling architecture:
1. `collectErrorCandidates()` builds a list of error objects to check by traversing `.cause`, `.reason`, `.errors`, and now `.error` for Grammy HttpError
2. `isRecoverableTelegramNetworkError()` checks each candidate against known patterns
3. The scoped rejection handler in `monitor.ts` catches Grammy HttpErrors that escape normal try-catch

### Design Patterns
- **Visitor pattern**: Error candidate traversal visits all nested error objects
- **Guard clause pattern**: `isGrammyHttpError()` gates the `.error` traversal to avoid widening search graph
- **Registration pattern**: Scoped handler registers on entry, unregisters on exit via try-finally

### Technology Stack
- TypeScript with strict mode
- Grammy 1.x (HttpError class)
- Node.js process unhandled rejection API

---

## 6. Deliverables

### Files to Create
| File | Purpose | Est. Lines |
|------|---------|------------|
| `src/telegram/network-errors.test.ts` | Tests for Grammy HttpError and timeout patterns | ~80 |

### Files to Modify
| File | Changes | Est. Lines |
|------|---------|------------|
| `src/telegram/network-errors.ts` | Add `.error` traversal, "timed out"/"timeout" patterns, error codes | ~25 |
| `src/telegram/monitor.ts` | Add import, isGrammyHttpError helper, scoped rejection handler | ~30 |

---

## 7. Success Criteria

### Functional Requirements
- [ ] Grammy HttpError with `.error` property is traversed by `collectErrorCandidates()`
- [ ] "timed out after X seconds" messages recognized as recoverable network errors
- [ ] "timeout" messages recognized as recoverable network errors
- [ ] Unhandled Grammy rejections caught by scoped handler in monitor
- [ ] Existing error handling (error codes, names, HTTP status codes) continues to work

### Testing Requirements
- [ ] Unit tests for Grammy HttpError `.error` traversal
- [ ] Unit tests for "timed out" and "timeout" message matching
- [ ] Integration test verifying scoped handler registration/unregistration

### Quality Gates
- [ ] All files ASCII-encoded
- [ ] Unix LF line endings
- [ ] Code follows project conventions (camelCase, explicit types)
- [ ] `pnpm build` passes with no errors
- [ ] `pnpm lint` passes with no warnings
- [ ] `pnpm test` passes with no failures

---

## 8. Implementation Notes

### Key Considerations
- Grammy's HttpError uses `.error` property, not `.cause`, to wrap underlying errors
- Only follow `.error` for HttpError to avoid widening the traversal graph for other error types
- The scoped handler must be unregistered in a finally block to prevent leaks
- Existing crocbot code has HTTP status code handling that upstream removed; keep it for safety

### Potential Challenges
- **Grammy HttpError structure verification**: Need to confirm Grammy version matches expected structure
- **Handler registration timing**: Must register before bot creation, unregister after polling stops
- **Test isolation**: Mock Grammy HttpError structure in tests to avoid Grammy dependency

### Relevant Considerations
- [P00] **Telegram-only channel registry**: All error handling is Telegram-focused, simplifying implementation
- [P00] **Incremental verification**: Run build/lint/test after each fix to catch issues early

### ASCII Reminder
All output files must use ASCII-only characters (0-127).

---

## 9. Testing Strategy

### Unit Tests
- Test `collectErrorCandidates()` traverses Grammy HttpError `.error` property
- Test `collectErrorCandidates()` does NOT traverse `.error` for non-HttpError objects
- Test `isRecoverableTelegramNetworkError()` matches "timed out after 30 seconds"
- Test `isRecoverableTelegramNetworkError()` matches "timeout" in various error messages
- Test existing error code/name/message patterns still work

### Integration Tests
- Test scoped handler registration returns unregister function
- Test handler is called for Grammy HttpError rejections
- Test handler returns false for non-Grammy errors (doesn't interfere)

### Manual Testing
- Deploy to staging and observe Telegram bot behavior during network interruptions
- Verify no crashes from Grammy timeout errors in logs
- Confirm reconnection behavior works as expected

### Edge Cases
- Grammy HttpError with no `.error` property (should not crash)
- Deeply nested error chains (should not infinite loop)
- Concurrent handler registration/unregistration

---

## 10. Dependencies

### External Libraries
- Grammy: ^1.x (HttpError class structure)
- @grammyjs/runner: existing (no version change)

### Other Sessions
- **Depends on**: `phase03-session03-feature-validation` (stable codebase)
- **Depended by**: `phase04-session02-session-transcript-repair` (establishes error handling patterns)

---

## Next Steps

Run `/tasks` to generate the implementation task checklist.
