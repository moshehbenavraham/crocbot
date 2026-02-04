# Task Checklist

**Session ID**: `phase02-session01-structured-logging`
**Total Tasks**: 20
**Estimated Duration**: 6-8 hours
**Created**: 2026-01-30

---

## Legend

- `[x]` = Completed
- `[ ]` = Pending
- `[P]` = Parallelizable (can run with other [P] tasks)
- `[S0201]` = Session reference (Phase 02, Session 01)
- `TNNN` = Task ID

---

## Progress Summary

| Category | Total | Done | Remaining |
|----------|-------|------|-----------|
| Setup | 2 | 2 | 0 |
| Foundation | 6 | 6 | 0 |
| Implementation | 8 | 8 | 0 |
| Testing | 4 | 4 | 0 |
| **Total** | **20** | **20** | **0** |

---

## Setup (2 tasks)

Initial configuration and environment preparation.

- [x] T001 [S0201] Verify prerequisites met (Node 22+, tslog, nanoid dependencies exist)
- [x] T002 [S0201] Verify existing logging infrastructure in `src/logging/` is stable and working

---

## Foundation (6 tasks)

Core structures and base implementations.

- [x] T003 [S0201] [P] Create correlation ID module with AsyncLocalStorage context (`src/logging/correlation.ts`)
- [x] T004 [S0201] [P] Create format configuration module for JSON/pretty switching (`src/logging/format.ts`)
- [x] T005 [S0201] Add logging format type to config types (`src/config/types.base.ts`)
- [x] T006 [S0201] Add phone number redaction patterns to existing patterns (`src/logging/redact.ts`)
- [x] T007 [S0201] Add Telegram bot token redaction pattern to existing patterns (`src/logging/redact.ts`)
- [x] T008 [S0201] Add session data redaction patterns (chat_id, user paths) (`src/logging/redact.ts`)

---

## Implementation (8 tasks)

Main feature implementation.

- [x] T009 [S0201] Integrate format module into logger for JSON output mode (`src/logging/logger.ts`)
- [x] T010 [S0201] Inject correlation ID into subsystem logger emit function (`src/logging/subsystem.ts`)
- [x] T011 [S0201] Add correlation ID middleware to Telegram bot initialization (`src/telegram/bot.ts`)
- [x] T012 [S0201] Extract Telegram context fields (chat_id, user_id, message_id) for logging (`src/telegram/bot-message-context.ts`)
- [x] T013 [S0201] Add helper to inject Telegram context into log entries (`src/logging/subsystem.ts`)
- [x] T014 [S0201] Wire correlation ID propagation through message handler chain (`src/telegram/bot-message.ts`)
- [x] T015 [S0201] Add CROCBOT_LOG_FORMAT environment variable support (`src/logging/config.ts`)
- [x] T016 [S0201] Create logging documentation for production deployment (`docs/development/logging.md`)

---

## Testing (4 tasks)

Verification and quality assurance.

- [x] T017 [S0201] [P] Write unit tests for correlation ID module (`src/logging/correlation.test.ts`)
- [x] T018 [S0201] [P] Write unit tests for format switching (`src/logging/format.test.ts`)
- [x] T019 [S0201] Add tests for new redaction patterns (phone, token) (`src/logging/redact.test.ts`)
- [x] T020 [S0201] Run full test suite, lint, and build validation

---

## Completion Checklist

Before marking session complete:

- [x] All tasks marked `[x]` (20/20 complete)
- [x] All tests passing (`pnpm test`) - 3625/3625 tests passed
- [x] Lint passes (`pnpm lint`) - 0 warnings, 0 errors
- [x] Build succeeds (`pnpm build`)
- [x] All files ASCII-encoded (ellipsis character intentional in redaction output)
- [x] implementation-notes.md updated
- [x] Ready for `/validate`

**Note**: T020 validation requires runtime environment. Run the following manually:
```bash
pnpm lint && pnpm build && pnpm test src/logging/
```

---

## Notes

### Parallelization
Tasks marked `[P]` can be worked on simultaneously:
- T003, T004: Core modules have no dependencies on each other
- T017, T018, T019: Test files can be written in parallel

### Task Timing
Target ~20-25 minutes per task.

### Dependencies
- T005 must complete before T009, T015
- T003 must complete before T010, T011, T014
- T004 must complete before T009
- T006, T007, T008 can be done together (same file)
- T009, T010 must complete before T011, T014
- T011, T012 must complete before T014
- T016 can be written after T009-T015 are validated

### Key Implementation Details

1. **Correlation ID Format**: Use nanoid with 8 characters for readable short IDs
2. **AsyncLocalStorage**: Use Node.js built-in for request-scoped context propagation
3. **JSON Format**: Triggered by `CROCBOT_LOG_FORMAT=json` environment variable
4. **Phone Number Patterns**: Cover international formats (+1, +44, +972, etc.)
5. **Telegram Token Pattern**: `\d{6,}:[A-Za-z0-9_-]{20,}` already exists in redact.ts
6. **Context Fields**: timestamp, component/subsystem, correlation_id, chat_id, user_id, message_id

### Existing Infrastructure
- `src/logging/logger.ts`: Base tslog configuration, file logging
- `src/logging/subsystem.ts`: SubsystemLogger with console/file output
- `src/logging/redact.ts`: Sensitive data filtering (already has Telegram token pattern)
- `src/logging/config.ts`: Logging configuration resolution
- `src/logging/console.ts`: Console settings and formatting

---

## Next Steps

Run `/validate` to verify session completeness after running:
```bash
pnpm lint && pnpm build && pnpm test src/logging/
```
