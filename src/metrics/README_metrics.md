# src/metrics/

Observability metrics collection using Prometheus-compatible counters and gauges.

## Key Files

| File          | Purpose                                               |
| ------------- | ----------------------------------------------------- |
| `gateway.ts`  | Gateway-level metrics (connections, requests, uptime) |
| `telegram.ts` | Telegram channel metrics (messages sent/received)     |
| `registry.ts` | Metric registration and export                        |

## Stack

Uses `prom-client` for Prometheus-compatible metric collection. Metrics can be scraped by monitoring systems for dashboards and alerting.

## Related

- Logging: `src/logging/`
- Alerting: `src/alerting/`
