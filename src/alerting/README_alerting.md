# src/alerting/

Error reporting and notification system with aggregation and multi-channel dispatch.

## Purpose

Monitors runtime errors, deduplicates them, and sends alerts to configured notification channels (Telegram, webhooks).

## Key Files

| File | Purpose |
|------|---------|
| `aggregator.ts` | Error deduplication and rate-limiting |
| `reporter.ts` | Central error reporting entry point |
| `severity.ts` | Severity classification (info, warn, error, critical) |
| `notifier-telegram.ts` | Sends alerts to Telegram |
| `notifier-webhook.ts` | Sends alerts to webhook endpoints |

## Related

- Logging: `src/logging/`
- Metrics: `src/metrics/`
