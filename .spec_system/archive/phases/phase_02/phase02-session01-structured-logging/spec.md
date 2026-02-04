# Session Specification

**Session ID**: `phase02-session01-structured-logging`
**Phase**: 02 - Operational Maturity and Observability
**Status**: Not Started
**Created**: 2026-01-30

---

## 1. Session Overview

This session establishes structured JSON logging as the foundational observability layer for Phase 02. The crocbot gateway already uses tslog with basic file logging, but production deployments require consistent JSON output, correlation IDs for request tracing, and comprehensive sensitive data redaction.

Structured logging enables log aggregation services to parse, filter, and alert on gateway events. Correlation IDs allow tracing a single Telegram message through the entire processing pipeline. This work directly enables future sessions: Session 02 (Metrics/Monitoring) needs log correlation for tracing, Session 04 (Error Reporting) needs structured error categorization, and Session 05 (Runbooks) needs log analysis patterns.

The existing logging infrastructure (`src/logging/`) provides a solid foundation with tslog integration, subsystem loggers, and basic redaction. This session enhances that foundation with production-grade JSON output, request-scoped correlation IDs, Telegram-specific context fields, and expanded redaction patterns for phone numbers and Telegram tokens.

---

## 2. Objectives

1. Configure tslog for structured JSON output in production mode while retaining human-readable output for development
2. Implement correlation ID middleware that propagates a unique trace ID through the entire message processing pipeline
3. Standardize context fields across all log entries (timestamp, component, chat_id, user_id, correlation_id)
4. Expand sensitive data redaction to cover phone numbers, Telegram bot tokens, and session data

---

## 3. Prerequisites

### Required Sessions
- [x] `phase01-session01-clean-technical-debt` - Clean codebase foundation
- [x] `phase01-session02-docker-optimization` - Docker environment for testing
- [x] `phase01-session03-gateway-hardening` - Stable gateway for logging integration
- [x] `phase01-session04-cicd-finalization` - CI/CD pipeline for validation
- [x] `phase01-session05-internal-docs-cleanup` - Updated documentation base

### Required Tools/Knowledge
- tslog library (already integrated in `src/logging/`)
- Telegram Bot API context structure (grammyjs)
- JSON structured logging patterns

### Environment Requirements
- Node 22+ runtime
- Docker for production mode testing
- Telegram bot credentials for live testing

---

## 4. Scope

### In Scope (MVP)
- Production JSON logging mode via environment variable (`CROCBOT_LOG_FORMAT=json`)
- Correlation ID generation and propagation through message handlers
- Telegram-specific context injection (chat_id, user_id, message_id)
- Phone number redaction patterns (international formats)
- Telegram bot token redaction patterns
- Log format configuration documentation
- Unit tests for new functionality

### Out of Scope (Deferred)
- External log aggregation integration (Datadog, Loki) - *Reason: Requires infrastructure decisions outside session scope*
- Log-based alerting - *Reason: Deferred to Session 04 (Error Reporting/Alerting)*
- Performance profiling logs - *Reason: Separate observability concern*
- Log shipping/forwarding configuration - *Reason: Deployment-specific*

---

## 5. Technical Approach

### Architecture
The logging system follows a layered architecture:

1. **Core Logger** (`src/logging/logger.ts`): Base tslog configuration with format switching
2. **Subsystem Logger** (`src/logging/subsystem.ts`): Named loggers for components
3. **Context Middleware**: AsyncLocalStorage-based correlation ID propagation
4. **Redaction Layer** (`src/logging/redact.ts`): Sensitive data filtering

### Design Patterns
- **AsyncLocalStorage**: Request-scoped correlation ID propagation without parameter threading
- **Factory Pattern**: Logger creation with environment-based configuration
- **Decorator Pattern**: Context injection wrapping existing loggers
- **Strategy Pattern**: Format switching between JSON and pretty output

### Technology Stack
- tslog (existing dependency)
- AsyncLocalStorage (Node.js built-in)
- grammy context types for Telegram metadata

---

## 6. Deliverables

### Files to Create
| File | Purpose | Est. Lines |
|------|---------|------------|
| `src/logging/correlation.ts` | Correlation ID generation and AsyncLocalStorage context | ~80 |
| `src/logging/correlation.test.ts` | Unit tests for correlation ID module | ~60 |
| `src/logging/format.ts` | JSON/pretty format configuration | ~50 |
| `src/logging/format.test.ts` | Unit tests for format switching | ~40 |
| `docs/development/logging.md` | Log format documentation | ~100 |

### Files to Modify
| File | Changes | Est. Lines |
|------|---------|------------|
| `src/logging/logger.ts` | Add JSON format mode, correlation ID injection | ~30 |
| `src/logging/subsystem.ts` | Inject correlation ID into log entries | ~20 |
| `src/logging/redact.ts` | Add phone number and Telegram token patterns | ~25 |
| `src/logging/redact.test.ts` | Tests for new redaction patterns | ~40 |
| `src/telegram/bot.ts` | Inject correlation ID middleware | ~15 |
| `src/telegram/bot-message-context.ts` | Extract Telegram context for logging | ~20 |
| `src/config/types.ts` | Add logging format configuration type | ~10 |

---

## 7. Success Criteria

### Functional Requirements
- [ ] Gateway logs in JSON format when `CROCBOT_LOG_FORMAT=json` is set
- [ ] Each Telegram message has a unique correlation ID visible in all related logs
- [ ] Logs include `chat_id`, `user_id`, `message_id` when processing Telegram messages
- [ ] Phone numbers in international formats are redacted from logs
- [ ] Telegram bot tokens are redacted from logs
- [ ] Human-readable pretty format retained for development (default)

### Testing Requirements
- [ ] Unit tests for correlation ID generation (uniqueness, format)
- [ ] Unit tests for format switching (JSON vs pretty)
- [ ] Unit tests for phone number redaction patterns
- [ ] Unit tests for Telegram token redaction
- [ ] Manual testing with Docker in production mode

### Quality Gates
- [ ] All files ASCII-encoded
- [ ] Unix LF line endings
- [ ] Code follows project conventions (camelCase, explicit return types)
- [ ] `pnpm lint` passes
- [ ] `pnpm build` succeeds
- [ ] `pnpm test` passes with 70%+ coverage maintained

---

## 8. Implementation Notes

### Key Considerations
- Correlation IDs should be short enough to be readable in logs (e.g., 8-character nanoid)
- JSON format must include all fields for log aggregation compatibility
- Pretty format should remain the default for local development experience
- Redaction must not significantly impact logging performance

### Potential Challenges
- **AsyncLocalStorage propagation**: Ensure correlation ID survives async boundaries in grammy middleware
- **Existing logger usage**: Verify all gateway components use centralized SubsystemLogger
- **Phone number formats**: International formats vary widely; start with common patterns

### Relevant Considerations
- [P00] **Telegram-only channel registry**: Logging context should include Telegram-specific fields (chat_id, user_id) as primary identifiers
- [P00] **Stub files for disabled features**: If stub code logs, ensure it uses SubsystemLogger (unlikely to need changes)

### ASCII Reminder
All output files must use ASCII-only characters (0-127).

---

## 9. Testing Strategy

### Unit Tests
- Correlation ID generation produces unique, valid IDs
- Format module correctly switches between JSON and pretty output
- Redaction patterns match phone numbers in various international formats
- Redaction patterns match Telegram bot token format (digits:alphanumeric)
- Context injection adds expected fields to log entries

### Integration Tests
- Correlation ID propagates through simulated message handling flow
- JSON output is valid JSON and includes all required fields
- Redaction works within full logging pipeline

### Manual Testing
- Start gateway with `CROCBOT_LOG_FORMAT=json` and verify JSON output
- Send Telegram message and verify correlation ID appears in all related logs
- Verify phone numbers and tokens are redacted in production logs
- Verify pretty format works correctly in development mode

### Edge Cases
- Empty or malformed Telegram context (graceful degradation)
- Very long messages that might contain multiple sensitive patterns
- Concurrent requests maintaining separate correlation IDs
- Logger initialization before configuration is loaded

---

## 10. Dependencies

### External Libraries
- tslog: ^4.x (existing)
- nanoid: ^5.x (existing, for correlation ID generation)

### Other Sessions
- **Depends on**: Phase 01 sessions (all completed)
- **Depended by**:
  - `phase02-session02-metrics-monitoring` (correlation IDs for tracing)
  - `phase02-session04-error-reporting-alerting` (structured error fields)
  - `phase02-session05-operational-runbooks` (log analysis documentation)

---

## Next Steps

Run `/tasks` to generate the implementation task checklist.
