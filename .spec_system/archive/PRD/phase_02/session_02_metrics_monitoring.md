# Session 02: Metrics and Monitoring

**Session ID**: `phase02-session02-metrics-monitoring`
**Status**: Not Started
**Estimated Tasks**: ~15-20
**Estimated Duration**: 2-4 hours

---

## Objective

Add Prometheus-compatible metrics endpoint for production monitoring, enabling visibility into gateway health, message throughput, and resource usage.

---

## Scope

### In Scope (MVP)
- Add prom-client dependency for Prometheus metrics
- Implement `/metrics` endpoint with standard format
- Add gateway metrics (uptime, message count, error rate)
- Add Telegram-specific metrics (bot latency, reconnects)
- Add Node.js runtime metrics (memory, event loop lag)
- Document metrics and Grafana dashboard basics

### Out of Scope
- Grafana dashboard templates (document only)
- Custom alerting rules (deferred to Session 04)
- Distributed tracing (OpenTelemetry)
- Third-party monitoring service integration

---

## Prerequisites

- [ ] Session 01 completed (structured logging)
- [ ] Prometheus concepts understood
- [ ] Docker environment for testing

---

## Deliverables

1. `/metrics` endpoint returning Prometheus format
2. Gateway metrics: `crocbot_uptime_seconds`, `crocbot_messages_total`, `crocbot_errors_total`
3. Telegram metrics: `crocbot_telegram_latency_seconds`, `crocbot_telegram_reconnects_total`
4. Runtime metrics: `nodejs_*` standard metrics
5. Metrics documentation in docs/

---

## Success Criteria

- [ ] `/metrics` endpoint accessible and returns valid Prometheus format
- [ ] Message counter increments on Telegram messages
- [ ] Error counter increments on failures
- [ ] Latency histogram tracks response times
- [ ] Memory metrics reflect actual usage
- [ ] All tests passing
