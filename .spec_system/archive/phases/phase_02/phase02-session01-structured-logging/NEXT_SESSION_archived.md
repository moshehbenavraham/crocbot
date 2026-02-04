# NEXT_SESSION.md

## Session Recommendation

**Generated**: 2026-01-30
**Project State**: Phase 02 - Operational Maturity and Observability
**Completed Sessions**: 13

---

## Recommended Next Session

**Session ID**: `phase02-session01-structured-logging`
**Session Name**: Structured Logging
**Estimated Duration**: 2-4 hours
**Estimated Tasks**: 15-20

---

## Why This Session Next?

### Prerequisites Met
- [x] Phase 01 completed (all 5 sessions)
- [x] tslog already integrated in codebase
- [x] Docker environment available

### Dependencies
- **Builds on**: Phase 01 production hardening work
- **Enables**: Session 02 (Metrics/Monitoring), Session 04 (Error Reporting/Alerting)

### Project Progression
Structured logging is the foundational observability layer for Phase 02. All subsequent sessions in this phase depend on having consistent, structured log output:

1. **Session 02 (Metrics)** needs log correlation IDs for tracing
2. **Session 04 (Error Reporting)** needs structured error categorization from logs
3. **Session 05 (Runbooks)** needs log analysis patterns to document

Starting with logging establishes the observability baseline before adding metrics, alerting, and documentation.

---

## Session Overview

### Objective
Implement structured JSON logging throughout the crocbot gateway for production debugging and log aggregation compatibility.

### Key Deliverables
1. tslog configuration for production JSON output
2. Correlation ID middleware for request/message tracing
3. Standardized log levels (debug, info, warn, error)
4. Sensitive data redaction (API keys, tokens, phone numbers)
5. Log format documentation

### Scope Summary
- **In Scope (MVP)**: JSON logging, correlation IDs, log levels, redaction, log rotation
- **Out of Scope**: External log aggregation (Datadog, Loki), log-based alerting (Session 04), performance profiling

---

## Technical Considerations

### Technologies/Patterns
- tslog (already in codebase)
- JSON structured output format
- Request correlation middleware pattern
- Sensitive data regex redaction

### Potential Challenges
- Ensuring all gateway components use centralized logger
- Balancing verbosity between dev and production modes
- Identifying all sensitive data patterns for redaction

### Relevant Considerations
- [P00] **Stub files for disabled features**: Some stub code may contain logging; ensure stubs use the new structured logger if touched
- [P00] **Telegram-only channel registry**: Logging context should include Telegram-specific fields (chat_id, user_id)

---

## Alternative Sessions

If this session is blocked:
1. **phase02-session03-remaining-technical-debt** - Can be done independently; cleans stub files
2. **phase02-session05-operational-runbooks** - Documentation-only; can start with current logging state

---

## Next Steps

Run `/sessionspec` to generate the formal specification.
