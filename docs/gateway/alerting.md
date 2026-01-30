---
title: Alerting
description: Error reporting and alert notifications for proactive incident detection.
---

# Alerting

crocbot includes a lightweight alerting system for proactive error detection and notification. The system classifies errors by severity, deduplicates repeated errors, rate limits notifications to prevent alert storms, and delivers alerts through configurable channels.

## Overview

The alerting system operates in three stages:

1. **Classification** - Errors are automatically classified as `critical`, `warning`, or `info` based on content
2. **Aggregation** - Duplicate errors are deduplicated within a configurable window, and notifications are rate limited per severity
3. **Notification** - Alerts are dispatched to configured channels (webhook, Telegram)

## Configuration

Add alerting configuration to your `config.yaml` under the `gateway.alerting` key:

```yaml
gateway:
  alerting:
    enabled: true

    # Deduplication window (default: 5 minutes)
    dedupeWindowMs: 300000

    # Rate limiting
    rateLimitCritical: 5      # Max critical alerts per window
    rateLimitWarning: 10      # Max warning alerts per window
    rateLimitWindowMs: 300000 # Rate limit window (5 minutes)

    # Webhook notifications
    webhook:
      url: "https://your-webhook-endpoint.com/alerts"
      headers:
        Authorization: "Bearer your-token"
      timeoutMs: 5000

    # Telegram self-notification
    telegram:
      chatId: "123456789"      # Your Telegram chat ID
      accountId: "default"     # Optional: Telegram account
      minSeverity: "critical"  # Minimum severity to notify
```

## Severity Levels

Errors are classified into three severity levels:

| Severity | Description | Examples |
|----------|-------------|----------|
| `critical` | Requires immediate attention | Fatal errors, crashes, auth failures, database errors |
| `warning` | Degraded operation | Timeouts, rate limits, retries, network issues |
| `info` | Informational | General errors not matching other categories |

### Automatic Classification

The system automatically classifies errors based on keywords:

**Critical keywords**: fatal, crash, unhandled, uncaught, panic, oom, out of memory, connection refused, auth failed, authentication failed, token invalid, token expired, database connection, database error

**Warning keywords**: timeout, timed out, retry, retrying, rate limit, slow, degraded, failed to, could not, unable to, network error, connection reset

## Deduplication

To prevent alert fatigue, identical errors within the deduplication window are aggregated:

- First occurrence triggers an alert with `count: 1`
- Subsequent identical errors increment the count but do not trigger new alerts
- After the deduplication window expires, a new alert can be triggered

The deduplication key is generated from the error message and optional context (e.g., channel name).

## Rate Limiting

Even with deduplication, error bursts can occur. Rate limiting provides a secondary protection:

| Severity | Default Limit | Window |
|----------|---------------|--------|
| Critical | 5 alerts | 5 minutes |
| Warning | 10 alerts | 5 minutes |
| Info | Unlimited | N/A |

When the rate limit is exceeded, errors are still logged but notifications are suppressed.

## Notification Channels

### Webhook

The webhook notifier sends a POST request with a JSON payload:

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "message": "Connection refused to database",
  "severity": "critical",
  "timestamp": "2026-01-30T12:00:00.000Z",
  "context": "telegram",
  "count": 1,
  "stack": "Error: Connection refused\n    at ...",
  "metadata": {}
}
```

**Configuration options**:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `url` | string | (required) | Webhook endpoint URL |
| `headers` | object | `{}` | Custom headers (e.g., auth) |
| `timeoutMs` | number | `5000` | Request timeout |

### Telegram Self-Notification

Send alerts to yourself via Telegram using your existing bot:

```yaml
gateway:
  alerting:
    telegram:
      chatId: "123456789"
      accountId: "default"
      minSeverity: "critical"
```

**Configuration options**:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `chatId` | string | (required) | Telegram chat ID to send alerts |
| `accountId` | string | `"default"` | Telegram account ID |
| `minSeverity` | string | `"critical"` | Minimum severity to trigger notification |

To find your chat ID, start a conversation with your bot and check incoming messages in the logs, or use a bot like `@userinfobot`.

## Testing

### Webhook Test Endpoint

crocbot provides a test endpoint at `/alerts/webhook` that echoes received webhooks. Configure your local gateway as the webhook target for testing:

```yaml
gateway:
  alerting:
    webhook:
      url: "http://localhost:18789/alerts/webhook"
```

The endpoint returns:

```json
{
  "received": true,
  "timestamp": "2026-01-30T12:00:00.000Z",
  "payload": { ... }
}
```

### Triggering Test Alerts

You can trigger a test alert programmatically:

```typescript
import { reportError } from "./alerting/index.js";

await reportError(new Error("Test critical error: database connection failed"), {
  context: "test",
  severity: "critical",
});
```

## Metrics Integration

The alerting system integrates with the [metrics endpoint](/gateway/metrics):

- Errors increment `crocbot_errors_total` counter with a `severity` label
- Use Prometheus/Grafana to visualize error rates by severity

Example query:

```promql
rate(crocbot_errors_total{severity="critical"}[5m])
```

## Disabling Alerting

To disable alerting completely:

```yaml
gateway:
  alerting:
    enabled: false
```

When disabled, errors are still logged and metrics are updated, but no notifications are sent.

## Best Practices

1. **Start with critical only** - Begin with `minSeverity: critical` for Telegram to avoid notification fatigue
2. **Use webhooks for integration** - Connect to PagerDuty, OpsGenie, or Slack via webhooks
3. **Monitor rate limit hits** - If you frequently hit rate limits, investigate the root cause
4. **Review deduplication window** - Adjust based on your error patterns
5. **Test before production** - Use the `/alerts/webhook` endpoint to verify configuration
