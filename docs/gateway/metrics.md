---
summary: "Prometheus metrics endpoint for gateway observability"
read_when:
  - Setting up monitoring for the gateway
  - Configuring Prometheus scraping
  - Understanding available metrics
---

# Metrics (Prometheus)

The gateway exposes a `/metrics` endpoint that returns metrics in Prometheus exposition format. This enables integration with monitoring systems like Prometheus, Grafana, and other observability tools.

## Endpoint

```
GET http://localhost:18789/metrics
```

No authentication is required. The endpoint is intended for internal/local monitoring use.

## Available Metrics

### Gateway Metrics

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `crocbot_uptime_seconds` | Gauge | - | Gateway uptime in seconds since startup |
| `crocbot_messages_total` | Counter | `channel`, `type` | Total messages processed |
| `crocbot_errors_total` | Counter | `channel`, `type` | Total errors encountered |

**Labels:**
- `channel`: The messaging channel (e.g., `telegram`)
- `type`: Message type (`text`, `media`, `command`) or error type (`processing`, `network`, `timeout`)

### Telegram Metrics

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `crocbot_telegram_latency_seconds` | Histogram | `type` | Message handling latency in seconds |
| `crocbot_telegram_reconnects_total` | Counter | `reason` | Total reconnection attempts |

**Labels:**
- `type`: Message type (`text`, `media`, `command`)
- `reason`: Reconnection reason (`network`, `conflict`, `timeout`)

**Histogram Buckets:** 10ms, 50ms, 100ms, 250ms, 500ms, 1s, 2.5s, 5s, 10s

### Node.js Runtime Metrics

Standard Node.js runtime metrics are also exposed with `nodejs_` and `process_` prefixes:

- `process_cpu_user_seconds_total` - CPU time in user mode
- `process_cpu_system_seconds_total` - CPU time in system mode
- `process_resident_memory_bytes` - Resident memory size
- `process_heap_bytes` - Heap memory size
- `nodejs_active_handles_total` - Active libuv handles
- `nodejs_eventloop_lag_seconds` - Event loop lag
- And more...

## Example Output

```prometheus
# HELP crocbot_uptime_seconds Gateway uptime in seconds
# TYPE crocbot_uptime_seconds gauge
crocbot_uptime_seconds 3600.123

# HELP crocbot_messages_total Total messages processed
# TYPE crocbot_messages_total counter
crocbot_messages_total{channel="telegram",type="text"} 42

# HELP crocbot_telegram_latency_seconds Telegram message handling latency in seconds
# TYPE crocbot_telegram_latency_seconds histogram
crocbot_telegram_latency_seconds_bucket{type="text",le="0.1"} 30
crocbot_telegram_latency_seconds_bucket{type="text",le="0.5"} 40
crocbot_telegram_latency_seconds_bucket{type="text",le="+Inf"} 42
crocbot_telegram_latency_seconds_sum{type="text"} 8.456
crocbot_telegram_latency_seconds_count{type="text"} 42
```

## Prometheus Configuration

Add the gateway to your Prometheus scrape config:

```yaml
scrape_configs:
  - job_name: 'crocbot'
    static_configs:
      - targets: ['localhost:18789']
    scrape_interval: 15s
    metrics_path: /metrics
```

## Grafana Dashboard

Example queries for a Grafana dashboard:

```promql
# Messages per minute
rate(crocbot_messages_total[1m]) * 60

# Error rate
rate(crocbot_errors_total[5m])

# 95th percentile latency
histogram_quantile(0.95, rate(crocbot_telegram_latency_seconds_bucket[5m]))

# Uptime
crocbot_uptime_seconds

# Memory usage
process_resident_memory_bytes / 1024 / 1024
```

## Health vs Metrics

- **`/health`** - Simple JSON health check for platform probes (Fly.io, Docker, k8s)
- **`/metrics`** - Full Prometheus metrics for detailed observability

Use `/health` for liveness/readiness probes and `/metrics` for monitoring dashboards.
