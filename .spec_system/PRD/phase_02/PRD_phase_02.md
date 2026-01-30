# PRD Phase 02: Operational Maturity and Observability

**Status**: In Progress
**Sessions**: 5
**Estimated Duration**: 3-4 days

**Progress**: 1/5 sessions (20%)

---

## Overview

With crocbot production-hardened and deployed (Phase 01 complete), Phase 02 focuses on operational maturity: enhanced observability, monitoring, structured logging, and cleanup of remaining technical debt. This phase ensures the system is maintainable, debuggable, and ready for sustained production operation.

---

## Progress Tracker

| Session | Name | Status | Est. Tasks | Validated |
|---------|------|--------|------------|-----------|
| 01 | Structured Logging | Complete | 20 | 2026-01-30 |
| 02 | Metrics and Monitoring | Not Started | ~15-20 | - |
| 03 | Remaining Technical Debt | Not Started | ~12-18 | - |
| 04 | Error Reporting and Alerting | Not Started | ~15-20 | - |
| 05 | Operational Runbooks | Not Started | ~12-15 | - |

---

## Completed Sessions

- **Session 01: Structured Logging** (2026-01-30) - JSON logging, correlation IDs, phone/token redaction

---

## Upcoming Sessions

- Session 02: Metrics and Monitoring

---

## Objectives

1. Implement structured JSON logging for production debugging
2. Add Prometheus-compatible metrics endpoint for monitoring
3. Clean up remaining stub files and technical debt (TTS, pairing, BlueBubbles)
4. Add error reporting and alerting infrastructure
5. Create operational runbooks for common scenarios

---

## Prerequisites

- Phase 01 completed (production hardening, Docker optimization, CI/CD finalization)
- All Phase 01 tests passing
- Production deployment infrastructure available (Fly.io/Coolify)

---

## Technical Considerations

### Architecture
- Logging via tslog with structured JSON output for production
- Metrics endpoint at `/metrics` for Prometheus scraping
- Health endpoint enhanced with readiness/liveness probes
- Error aggregation for alerting (optional external service)

### Technologies
- tslog - Structured logging (already in codebase)
- prom-client - Prometheus metrics (to be added)
- Node.js built-in diagnostics - Memory/CPU metrics
- Fly.io metrics - Platform-level monitoring

### Risks
- **Logging overhead**: Structured logging may impact performance. Mitigation: Benchmark before/after, use log levels appropriately.
- **Metrics cardinality**: High-cardinality labels can cause memory issues. Mitigation: Follow Prometheus best practices, limit label values.
- **Breaking existing logging**: Changing log format may break log parsing. Mitigation: Ensure backwards-compatible log format options.

### Relevant Considerations
<!-- From CONSIDERATIONS.md -->
- [P00] **Stub files for disabled features**: TTS, pairing, Bonjour stubs remain. Session 03 will assess full removal.
- [P00] **WhatsApp types retained**: Session 03 will verify if web provider still needs these types.
- [P00] **BlueBubbles provider status**: Session 03 will verify and remove if unused.
- [P01] **Internal docs cleanup complete**: No further docs work needed for existing features.

---

## Success Criteria

Phase complete when:
- [ ] All 5 sessions completed
- [ ] Structured JSON logging implemented for production
- [ ] `/metrics` endpoint returns Prometheus-compatible metrics
- [ ] All stub files removed or documented as intentionally retained
- [ ] Error reporting infrastructure in place
- [ ] Operational runbooks created for common scenarios
- [ ] All tests passing with coverage thresholds met
- [ ] Memory usage stable under sustained load

---

## Dependencies

### Depends On
- Phase 01: Production Hardening and Deployment (Complete)

### Enables
- Feature development phases (new capabilities)
- SRE/ops handoff (runbooks, monitoring)
- Incident response (alerting, debugging)
