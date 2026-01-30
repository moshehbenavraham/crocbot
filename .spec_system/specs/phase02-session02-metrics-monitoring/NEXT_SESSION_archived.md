# NEXT_SESSION.md

## Session Recommendation

**Generated**: 2026-01-30
**Project State**: Phase 02 - Operational Maturity and Observability
**Completed Sessions**: 14

---

## Recommended Next Session

**Session ID**: `phase02-session02-metrics-monitoring`
**Session Name**: Metrics and Monitoring
**Estimated Duration**: 2-4 hours
**Estimated Tasks**: 15-20

---

## Why This Session Next?

### Prerequisites Met
- [x] Phase 00 complete (codebase stripped to Telegram-only)
- [x] Phase 01 complete (production hardening)
- [x] Session 01 complete (structured logging)
- [x] Docker environment available for testing

### Dependencies
- **Builds on**: Session 01 (Structured Logging) - logging infrastructure provides context for metrics
- **Enables**: Session 04 (Error Reporting & Alerting) - metrics are foundation for alerts

### Project Progression
This is the natural next step in the observability stack. With structured logging now in place from Session 01, adding Prometheus metrics provides the quantitative visibility layer. Metrics complement logs: logs tell you *what* happened, metrics tell you *how often* and *how much*. This session establishes the foundation for Session 04's alerting capabilities.

---

## Session Overview

### Objective
Add Prometheus-compatible metrics endpoint for production monitoring, enabling visibility into gateway health, message throughput, and resource usage.

### Key Deliverables
1. `/metrics` endpoint returning Prometheus format
2. Gateway metrics: `crocbot_uptime_seconds`, `crocbot_messages_total`, `crocbot_errors_total`
3. Telegram metrics: `crocbot_telegram_latency_seconds`, `crocbot_telegram_reconnects_total`
4. Runtime metrics: `nodejs_*` standard metrics (memory, event loop lag)
5. Metrics documentation in docs/

### Scope Summary
- **In Scope (MVP)**: prom-client integration, `/metrics` endpoint, gateway/Telegram/runtime metrics, basic docs
- **Out of Scope**: Grafana dashboard templates (document only), alerting rules (Session 04), distributed tracing, third-party integrations

---

## Technical Considerations

### Technologies/Patterns
- `prom-client` - standard Prometheus client for Node.js
- Counter, Gauge, Histogram metric types
- Express/Fastify middleware for `/metrics` endpoint
- Default Node.js runtime metrics (GC, event loop, memory)

### Potential Challenges
- Metrics cardinality - avoid high-cardinality labels (e.g., per-user metrics)
- Memory overhead - keep metric count reasonable
- Endpoint security - decide if `/metrics` needs auth (likely not for internal monitoring)

### Relevant Considerations
- [P00] **Telegram-only channel registry**: Metrics should only track Telegram channel - no need for multi-channel metric labels
- [P00] **Incremental verification**: Add metrics incrementally, verify each works before moving to next

---

## Alternative Sessions

If this session is blocked:
1. **phase02-session03-remaining-technical-debt** - Clean up stub files and unused code
2. **phase02-session05-operational-runbooks** - Document operational procedures (less technical)

---

## Next Steps

Run `/sessionspec` to generate the formal specification.
