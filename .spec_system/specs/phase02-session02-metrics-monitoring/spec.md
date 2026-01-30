# Session Specification

**Session ID**: `phase02-session02-metrics-monitoring`
**Phase**: 02 - Operational Maturity and Observability
**Status**: Not Started
**Created**: 2026-01-30

---

## 1. Session Overview

This session adds Prometheus-compatible metrics to crocbot, establishing the quantitative observability layer that complements the structured logging infrastructure from Session 01. Metrics provide visibility into gateway health, message throughput, and resource utilization - answering questions like "how many messages per minute?" and "what's the 95th percentile response time?" that logs alone cannot efficiently answer.

The `/metrics` endpoint exposes data in Prometheus exposition format, enabling integration with Prometheus/Grafana monitoring stacks commonly used in production VPS and Coolify deployments. This foundation enables Session 04's alerting capabilities and provides operators with real-time operational visibility.

With the Telegram-only architecture established in Phase 00, metrics can be focused and precise - no need for multi-channel cardinality concerns. We track gateway lifecycle (uptime, restarts), message flow (counts, latencies, errors), and Node.js runtime health (memory, event loop).

---

## 2. Objectives

1. Implement `/metrics` HTTP endpoint returning valid Prometheus exposition format
2. Add gateway operational metrics (uptime, message counts, error counts)
3. Add Telegram-specific metrics (bot latency histograms, reconnection counts)
4. Integrate standard Node.js runtime metrics (memory, GC, event loop lag)

---

## 3. Prerequisites

### Required Sessions
- [x] `phase02-session01-structured-logging` - Provides logging infrastructure and correlation context for metrics

### Required Tools/Knowledge
- Understanding of Prometheus metric types (Counter, Gauge, Histogram, Summary)
- Familiarity with prom-client npm package
- Basic knowledge of Prometheus exposition format

### Environment Requirements
- Node.js 22+ runtime
- Docker environment for testing metrics scraping
- Build passing (`pnpm lint && pnpm build && pnpm test`)

---

## 4. Scope

### In Scope (MVP)
- Add `prom-client` dependency for Prometheus metrics
- Implement `/metrics` endpoint in `src/gateway/server-http.ts`
- Create metrics registry module at `src/metrics/`
- Gateway metrics: `crocbot_uptime_seconds`, `crocbot_messages_total`, `crocbot_errors_total`
- Telegram metrics: `crocbot_telegram_latency_seconds`, `crocbot_telegram_reconnects_total`
- Enable default Node.js runtime metrics (`nodejs_*` prefix)
- Unit tests for metrics registration and increment logic
- Documentation for metrics endpoint and available metrics

### Out of Scope (Deferred)
- Grafana dashboard JSON templates - *Reason: Document how to set up, but templates are environment-specific*
- Custom alerting rules - *Reason: Deferred to Session 04 (Error Reporting & Alerting)*
- OpenTelemetry distributed tracing - *Reason: Adds complexity beyond MVP observability needs*
- Third-party APM integration (Datadog, New Relic) - *Reason: Prometheus is standard for self-hosted*
- Per-user or per-chat metrics - *Reason: High cardinality, privacy concerns*
- Metrics authentication - *Reason: Internal endpoint, typically behind firewall/VPN*

---

## 5. Technical Approach

### Architecture
The metrics system follows a centralized registry pattern. A single `MetricsRegistry` module manages all metric instances and exposes a `getMetrics()` function for the HTTP handler. Metrics are incremented at instrumentation points throughout the codebase (gateway startup, message handling, Telegram events).

```
src/metrics/
  index.ts          - Public API re-exports
  registry.ts       - Central registry, metric definitions
  gateway.ts        - Gateway-specific metrics (uptime, messages, errors)
  telegram.ts       - Telegram-specific metrics (latency, reconnects)
```

The `/metrics` endpoint joins the existing HTTP server in `server-http.ts`, placed before the 404 fallback. No authentication is added (standard for internal monitoring endpoints).

### Design Patterns
- **Singleton Registry**: Single prom-client Registry instance for all metrics
- **Metric Factories**: Helper functions to create typed Counter/Gauge/Histogram instances
- **Instrumentation Hooks**: Minimal code changes at existing event handlers to increment metrics

### Technology Stack
- `prom-client` ^16.x - Standard Prometheus client for Node.js
- Node.js built-in `process.memoryUsage()`, `process.uptime()` for runtime metrics
- Existing `src/gateway/server-http.ts` for endpoint integration

---

## 6. Deliverables

### Files to Create
| File | Purpose | Est. Lines |
|------|---------|------------|
| `src/metrics/index.ts` | Public API re-exports | ~15 |
| `src/metrics/registry.ts` | Central registry and metric definitions | ~80 |
| `src/metrics/gateway.ts` | Gateway metrics (uptime, messages, errors) | ~50 |
| `src/metrics/telegram.ts` | Telegram metrics (latency, reconnects) | ~40 |
| `src/metrics/registry.test.ts` | Unit tests for registry | ~60 |
| `src/metrics/gateway.test.ts` | Unit tests for gateway metrics | ~50 |
| `docs/observability/metrics.md` | Metrics endpoint documentation | ~120 |

### Files to Modify
| File | Changes | Est. Lines Changed |
|------|---------|-------------------|
| `src/gateway/server-http.ts` | Add `/metrics` endpoint handler | ~15 |
| `src/gateway/gateway.ts` | Instrument message/error counters | ~10 |
| `src/telegram/telegram.ts` | Instrument latency/reconnect metrics | ~15 |
| `package.json` | Add prom-client dependency | ~1 |
| `docs/docs.json` | Add metrics doc to navigation | ~3 |

---

## 7. Success Criteria

### Functional Requirements
- [ ] GET `/metrics` returns HTTP 200 with `text/plain; version=0.0.4` content type
- [ ] Response contains valid Prometheus exposition format (parseable by Prometheus)
- [ ] `crocbot_uptime_seconds` gauge reflects actual gateway uptime
- [ ] `crocbot_messages_total` counter increments on each processed message
- [ ] `crocbot_errors_total` counter increments on processing errors
- [ ] `crocbot_telegram_latency_seconds` histogram records message handling duration
- [ ] `crocbot_telegram_reconnects_total` counter increments on bot reconnection
- [ ] `nodejs_*` runtime metrics present (heap, GC, event loop)

### Testing Requirements
- [ ] Unit tests for metric registration
- [ ] Unit tests for counter increment functions
- [ ] Unit tests for histogram observation functions
- [ ] Manual testing: curl `/metrics` and verify output format

### Quality Gates
- [ ] All files ASCII-encoded (0-127)
- [ ] Unix LF line endings
- [ ] Code follows project conventions (camelCase, explicit return types)
- [ ] `pnpm lint` passes
- [ ] `pnpm build` succeeds
- [ ] `pnpm test` passes (70% coverage threshold)
- [ ] No new TypeScript `any` types introduced

---

## 8. Implementation Notes

### Key Considerations
- Use metric name prefix `crocbot_` for all custom metrics (avoids collision with `nodejs_*`)
- Histogram buckets for latency: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10] seconds
- Avoid high-cardinality labels (no per-user, per-chat, per-message-id labels)
- Metrics endpoint should be fast (<10ms response time)

### Potential Challenges
- **Circular imports**: Metrics module must be importable from multiple places without cycles. Mitigation: Keep registry as standalone module with no internal dependencies.
- **Memory overhead**: prom-client is lightweight but histograms grow with bucket count. Mitigation: Use reasonable bucket count (9 buckets for latency).
- **Instrumentation placement**: Need to identify correct hooks for message counting. Mitigation: Review gateway event flow before implementing.

### Relevant Considerations
- [P00] **Telegram-only channel registry**: Metrics use single `telegram` label value, no multi-channel cardinality concerns. Simplifies metric design.
- [P00] **Incremental verification**: Add one metric category at a time (gateway first, then Telegram, then runtime). Verify each via curl before proceeding.

### ASCII Reminder
All output files must use ASCII-only characters (0-127). Avoid em-dashes, smart quotes, and non-ASCII symbols.

---

## 9. Testing Strategy

### Unit Tests
- `registry.test.ts`: Verify registry initializes, metrics register correctly, `getMetrics()` returns valid string
- `gateway.test.ts`: Verify counters increment, gauge updates, error scenarios

### Integration Tests
- None required for MVP (unit tests sufficient for metrics logic)

### Manual Testing
1. Start gateway: `pnpm gateway:dev`
2. Fetch metrics: `curl http://localhost:18789/metrics`
3. Verify output contains expected metric names
4. Send test message, re-fetch, verify counter increment
5. Use `promtool check metrics` if available to validate format

### Edge Cases
- Gateway restart: uptime gauge should reset to 0
- Rapid message burst: counters should handle concurrent increments
- No messages: metrics should still be present with 0 values

---

## 10. Dependencies

### External Libraries
- `prom-client`: ^16.0.0 (latest stable)

### Other Sessions
- **Depends on**: `phase02-session01-structured-logging` (logging infrastructure)
- **Depended by**: `phase02-session04-error-reporting-alerting` (alerting builds on metrics)

---

## Next Steps

Run `/tasks` to generate the implementation task checklist.
