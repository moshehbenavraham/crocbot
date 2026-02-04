# Session 01: Structured Logging

**Session ID**: `phase02-session01-structured-logging`
**Status**: Not Started
**Estimated Tasks**: ~15-20
**Estimated Duration**: 2-4 hours

---

## Objective

Implement structured JSON logging throughout the crocbot gateway for production debugging and log aggregation compatibility.

---

## Scope

### In Scope (MVP)
- Configure tslog for JSON output in production mode
- Add request/message correlation IDs for tracing
- Standardize log levels across gateway components
- Add context fields (timestamp, component, user_id, chat_id)
- Ensure sensitive data is redacted from logs
- Add log rotation configuration for Docker deployments

### Out of Scope
- External log aggregation service integration (Datadog, Loki, etc.)
- Log-based alerting (deferred to Session 04)
- Performance profiling logs

---

## Prerequisites

- [ ] Phase 01 completed
- [ ] tslog already integrated (verify current usage)
- [ ] Docker environment available for testing

---

## Deliverables

1. tslog configuration for production JSON output
2. Correlation ID middleware for request tracing
3. Standardized log levels (debug, info, warn, error)
4. Sensitive data redaction (API keys, tokens, phone numbers)
5. Log format documentation

---

## Success Criteria

- [ ] Gateway logs in JSON format in production mode
- [ ] Each request/message has unique correlation ID
- [ ] Logs include component, timestamp, and context
- [ ] No sensitive data appears in logs
- [ ] Human-readable format retained for development
- [ ] All tests passing
