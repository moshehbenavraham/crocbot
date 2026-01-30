# Session Specification

**Session ID**: `phase02-session04-error-reporting-alerting`
**Phase**: 02 - Operational Maturity and Observability
**Status**: Not Started
**Created**: 2026-01-30

---

## 1. Session Overview

This session implements error aggregation and alerting infrastructure for proactive incident detection and response. Building on the structured logging (Session 01) and Prometheus metrics (Session 02) foundations, this session adds the final piece of the observability triad: alerting.

The implementation creates a lightweight, self-contained alerting system that categorizes errors by severity, aggregates them with deduplication to prevent alert storms, and provides multiple notification channels including a webhook interface for external systems and self-notification via the existing Telegram bot.

This approach keeps crocbot operationally independent while providing extensibility through webhooks for users who want to integrate with external alerting platforms like PagerDuty or OpsGenie in the future.

---

## 2. Objectives

1. Implement error severity classification (critical, warning, info) integrated with structured logging
2. Create error aggregation with deduplication and rate limiting to prevent alert storms
3. Build a configurable webhook interface for external alerting system integration
4. Enable Telegram self-notification for critical errors using existing bot infrastructure
5. Document alerting configuration and thresholds

---

## 3. Prerequisites

### Required Sessions
- [x] `phase02-session01-structured-logging` - Provides tslog-based JSON logging with correlation IDs
- [x] `phase02-session02-metrics-monitoring` - Provides Prometheus metrics and error counters

### Required Tools/Knowledge
- TypeScript with strict typing
- grammy Telegram bot library (existing integration)
- prom-client for metrics integration

### Environment Requirements
- Node.js 22+
- Existing Telegram bot token configured

---

## 4. Scope

### In Scope (MVP)
- Error severity enum and classification logic
- Error aggregation service with configurable deduplication window
- Rate limiting for alert notifications (configurable threshold per window)
- Webhook interface (`POST /alerts/webhook`) for external notification dispatch
- Telegram self-notification using existing `sendMessageTelegram()` function
- Configuration schema additions for alerting thresholds
- Integration with existing metrics (increment `crocbot_errors_total` with severity label)
- Unit tests for all new modules

### Out of Scope (Deferred)
- Sentry/Bugsnag integration - *Reason: Adds external dependency; webhook provides extensibility*
- PagerDuty/OpsGenie direct integration - *Reason: Webhook interface enables this without coupling*
- Complex alerting rules engine - *Reason: Simple thresholds sufficient for MVP*
- Historical error analytics - *Reason: Log aggregation (e.g., Loki) handles this*
- Email notifications - *Reason: Telegram self-notification sufficient for MVP*

---

## 5. Technical Approach

### Architecture

```
                          +-------------------+
                          |  Error Source     |
                          | (catch, logger)   |
                          +---------+---------+
                                    |
                                    v
                          +-------------------+
                          |  Error Reporter   |
                          |  - classify()     |
                          |  - report()       |
                          +---------+---------+
                                    |
                                    v
                          +-------------------+
                          |  Error Aggregator |
                          |  - dedupe key     |
                          |  - rate limit     |
                          +---------+---------+
                                    |
                    +---------------+---------------+
                    v                               v
          +-------------------+           +-------------------+
          |  Webhook Notifier |           | Telegram Notifier |
          |  POST to URL      |           | sendMessage()     |
          +-------------------+           +-------------------+
```

### Design Patterns
- **Singleton Pattern**: Single ErrorAggregator instance for consistent deduplication state
- **Observer Pattern**: Log transport integration to capture errors automatically
- **Strategy Pattern**: Pluggable notifiers (webhook, Telegram) implement common interface

### Technology Stack
- TypeScript (strict mode)
- tslog (existing logging infrastructure)
- grammy (existing Telegram integration)
- prom-client (existing metrics)

---

## 6. Deliverables

### Files to Create
| File | Purpose | Est. Lines |
|------|---------|------------|
| `src/alerting/severity.ts` | Error severity enum and classification | ~40 |
| `src/alerting/aggregator.ts` | Deduplication and rate limiting logic | ~120 |
| `src/alerting/notifier-webhook.ts` | HTTP webhook notification dispatch | ~80 |
| `src/alerting/notifier-telegram.ts` | Telegram self-notification wrapper | ~60 |
| `src/alerting/reporter.ts` | Main API for reporting errors | ~100 |
| `src/alerting/index.ts` | Public module exports | ~20 |
| `src/alerting/severity.test.ts` | Unit tests for severity classification | ~60 |
| `src/alerting/aggregator.test.ts` | Unit tests for deduplication/rate limiting | ~120 |
| `src/alerting/notifier-webhook.test.ts` | Unit tests for webhook notifier | ~80 |
| `src/alerting/notifier-telegram.test.ts` | Unit tests for Telegram notifier | ~60 |
| `src/alerting/reporter.test.ts` | Unit tests for reporter API | ~80 |
| `docs/configuration/alerting.md` | Alerting configuration documentation | ~150 |

### Files to Modify
| File | Changes | Est. Lines |
|------|---------|------------|
| `src/config/types.ts` | Add AlertingConfig schema | ~30 |
| `src/config/types.gateway.ts` | Add alerting to GatewayConfig | ~10 |
| `src/gateway/server-http.ts` | Add `/alerts/webhook` test endpoint | ~20 |
| `src/gateway/boot.ts` | Initialize alerting on gateway startup | ~15 |
| `src/metrics/gateway.ts` | Add severity label to errors counter | ~10 |
| `docs/docs.json` | Add alerting page to navigation | ~5 |

---

## 7. Success Criteria

### Functional Requirements
- [ ] Errors are categorized into critical, warning, info severities
- [ ] Duplicate errors within deduplication window are aggregated (not re-alerted)
- [ ] Rate limiting prevents more than N alerts per window
- [ ] Webhook fires HTTP POST to configured URL with error payload
- [ ] Telegram notification sends to configured chat ID for critical errors
- [ ] Alert thresholds are configurable via config file

### Testing Requirements
- [ ] Unit tests written for all new modules (70% coverage minimum)
- [ ] Integration test for error-to-alert flow
- [ ] Manual testing: trigger error, verify Telegram notification received

### Quality Gates
- [ ] All files ASCII-encoded (no Unicode characters outside strings)
- [ ] Unix LF line endings
- [ ] Code follows project conventions (camelCase, explicit return types)
- [ ] `pnpm lint` passes
- [ ] `pnpm build` succeeds
- [ ] `pnpm test` passes with coverage thresholds

---

## 8. Implementation Notes

### Key Considerations
- Use `registerLogTransport()` from existing logging to capture errors automatically
- Leverage `sendMessageTelegram()` directly - no need for new Telegram code
- Deduplication key should include: error message hash + context (e.g., channel)
- Rate limiting window defaults: 5 alerts per 5 minutes for critical, 10 per hour for warning
- Silent mode config option to disable notifications during development/testing

### Potential Challenges
- **Rate limiting state persistence**: Use in-memory Map; state loss on restart is acceptable for MVP
- **Circular dependency**: Reporter depends on logger, logger can trigger reporter. Use flag to prevent re-entry.
- **Test isolation**: Singleton aggregator needs reset function for test cleanup

### Relevant Considerations
- [P00] **Telegram-only channel registry**: Self-notification uses existing Telegram integration; no new channel code needed
- [P00] **TypeScript as refactoring guide**: Strict typing ensures error classification types are properly handled
- [P00] **Stub approach for feature removal**: If alerting needs to be disabled, config flag provides clean off-switch

### ASCII Reminder
All output files must use ASCII-only characters (0-127). No smart quotes, em dashes, or Unicode symbols outside of string literals.

---

## 9. Testing Strategy

### Unit Tests
- `severity.test.ts`: Verify classification logic for various error types
- `aggregator.test.ts`: Test deduplication window, rate limiting, key generation
- `notifier-webhook.test.ts`: Mock HTTP calls, verify payload format
- `notifier-telegram.test.ts`: Mock sendMessageTelegram, verify message format
- `reporter.test.ts`: End-to-end reporter API, verify metrics increment

### Integration Tests
- Error thrown in gateway handler triggers alert flow
- Multiple identical errors within window produce single alert
- Rate limit exceeded produces "rate limited" log entry

### Manual Testing
- Configure Telegram self-notification chat ID
- Trigger critical error (e.g., invalid config)
- Verify Telegram message received with error details
- Verify `/metrics` shows incremented error counter with severity label

### Edge Cases
- Empty error message
- Very long error message (truncation)
- Invalid webhook URL (graceful failure)
- Telegram send failure (log and continue)
- Rapid error burst (rate limiting kicks in)

---

## 10. Dependencies

### External Libraries
- `prom-client`: ^15.x (existing)
- `grammy`: ^1.x (existing)
- `tslog`: ^4.x (existing)

### Other Sessions
- **Depends on**: `phase02-session01-structured-logging`, `phase02-session02-metrics-monitoring`
- **Depended by**: `phase02-session05-operational-runbooks` (runbooks will reference alerting configuration)

---

## Configuration Schema

```typescript
interface AlertingConfig {
  enabled: boolean;                    // Master switch (default: true)

  // Deduplication
  dedupeWindowMs: number;              // Window for deduplication (default: 300000 = 5min)

  // Rate limiting
  rateLimitCritical: number;           // Max critical alerts per window (default: 5)
  rateLimitWarning: number;            // Max warning alerts per window (default: 10)
  rateLimitWindowMs: number;           // Rate limit window (default: 300000 = 5min)

  // Webhook
  webhook?: {
    url: string;                       // Webhook URL
    headers?: Record<string, string>;  // Optional headers (e.g., auth)
    timeoutMs?: number;                // Request timeout (default: 5000)
  };

  // Telegram self-notification
  telegram?: {
    chatId: string;                    // Chat ID to send alerts to
    accountId?: string;                // Telegram account (default: "default")
    minSeverity?: "critical" | "warning" | "info";  // Minimum severity (default: "critical")
  };
}
```

---

## Next Steps

Run `/tasks` to generate the implementation task checklist.
