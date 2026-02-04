# Health Check Interpretation

Guide to understanding and troubleshooting health check responses from the crocbot gateway.

## Health Endpoints Overview

| Endpoint | Purpose | Use Case |
|----------|---------|----------|
| `/health` | Gateway liveness | Platform probes (Docker, Fly.io, k8s) |
| `/metrics` | Prometheus metrics | Monitoring dashboards |
| `crocbot health` | CLI health check | Manual diagnostics |
| `crocbot status` | Full status report | Comprehensive debugging |

---

## Health Endpoint Response

### Request

```bash
curl http://localhost:18789/health
```

### Response Fields

```json
{
  "status": "ok",
  "timestamp": "2026-02-04T12:00:00.000Z",
  "uptime": 3600.123,
  "heapUsedMb": 45.2,
  "rssMb": 98.7
}
```

| Field | Type | Description |
|-------|------|-------------|
| `status` | string | `"ok"` if healthy, `"degraded"` or `"error"` otherwise |
| `timestamp` | string | ISO 8601 timestamp of the response |
| `uptime` | number | Gateway uptime in seconds |
| `heapUsedMb` | number | V8 heap memory used (MB) |
| `rssMb` | number | Resident set size - total process memory (MB) |

---

## Interpreting Health Status

### Status: OK

```json
{"status": "ok", "uptime": 3600, "heapUsedMb": 45, "rssMb": 98}
```

**Meaning**: Gateway is running normally.

**Checks**:
- Process is alive
- Basic internal systems operational
- Memory within expected bounds

### Status: Degraded

```json
{"status": "degraded", "uptime": 3600, "heapUsedMb": 400, "rssMb": 512}
```

**Meaning**: Gateway running but with issues.

**Possible causes**:
- High memory usage
- Slow response times
- Non-critical component failures

**Actions**:
1. Check memory usage trends
2. Review recent logs for warnings
3. Consider restart if memory continues rising

### Status: Error / No Response

**Meaning**: Gateway is down or unresponsive.

**Actions**:
1. Check if process is running
2. Check for crash in logs
3. Restart gateway
4. See [Startup Shutdown](/runbooks/startup-shutdown)

---

## Memory Thresholds

| Metric | Normal | Warning | Critical |
|--------|--------|---------|----------|
| `heapUsedMb` | < 200 | 200-400 | > 400 |
| `rssMb` | < 300 | 300-512 | > 512 |

### Memory Trending

```bash
# Monitor memory over time
watch -n 5 'curl -s http://localhost:18789/health | jq ".heapUsedMb, .rssMb"'
```

### Memory Leak Detection

```bash
# Log memory every minute
while true; do
  echo "$(date): $(curl -s http://localhost:18789/health | jq -c '{heap: .heapUsedMb, rss: .rssMb}')"
  sleep 60
done >> memory.log
```

If `heapUsedMb` grows continuously without returning to baseline, a memory leak may be present.

---

## Uptime Interpretation

| Uptime | Interpretation |
|--------|----------------|
| < 60s | Recently started or restarted |
| < 300s | May still be warming up |
| > 86400s (1 day) | Stable |
| Decreasing frequently | Crash-restart loop |

### Check for Restart Loop

```bash
# Compare uptime to when you expect it started
curl -s http://localhost:18789/health | jq '.uptime'

# Docker restart count
docker inspect crocbot | jq '.[0].RestartCount'
```

---

## CLI Health Commands

### Basic Health Check

```bash
crocbot health
# Returns: OK or ERROR with details
```

### JSON Output

```bash
crocbot health --json
# Returns full health snapshot as JSON
```

### With Timeout

```bash
crocbot health --timeout 5000
# 5 second timeout (default is 10s)
```

### Status Command (More Detail)

```bash
# Quick summary
crocbot status

# Full diagnostics
crocbot status --all

# With gateway probe
crocbot status --deep
```

---

## Platform Health Probes

### Docker Healthcheck

In docker-compose.yml or Dockerfile:

```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:18789/health"]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 30s
```

Check health status:

```bash
docker inspect crocbot | jq '.[0].State.Health'
```

### Fly.io Health Checks

In fly.toml:

```toml
[[services.http_checks]]
  interval = "30s"
  timeout = "10s"
  grace_period = "30s"
  method = "GET"
  path = "/health"
```

### Kubernetes Probes

```yaml
livenessProbe:
  httpGet:
    path: /health
    port: 18789
  initialDelaySeconds: 30
  periodSeconds: 30

readinessProbe:
  httpGet:
    path: /health
    port: 18789
  initialDelaySeconds: 5
  periodSeconds: 10
```

---

## Troubleshooting Health Issues

### Health Endpoint Not Responding

```bash
# 1. Check if process is running
pgrep -f crocbot || docker ps -f name=crocbot

# 2. Check if port is listening
ss -tlnp | grep 18789
# or
lsof -i :18789

# 3. Check network binding
curl -v http://localhost:18789/health 2>&1 | head -20
```

### Connection Refused

**Cause**: Gateway not running or not bound to expected port/interface.

```bash
# Check gateway is running
systemctl --user status crocbot-gateway
# or
docker ps -f name=crocbot

# Check environment for port override
grep -i port /path/to/.env
```

### Timeout

**Cause**: Gateway overloaded or hung.

```bash
# Check CPU usage
top -p $(pgrep -f crocbot) -n 1

# Check if process is responsive
strace -p $(pgrep -f crocbot) -c

# Force restart if hung
systemctl --user restart crocbot-gateway
```

### High Memory Response

```bash
# Check what's consuming memory
curl -s http://localhost:18789/health | jq

# If heapUsedMb > 400, consider restart
docker restart crocbot
```

---

## Metrics Endpoint

For detailed operational metrics, use `/metrics`:

```bash
curl http://localhost:18789/metrics
```

### Key Metrics to Monitor

```bash
# Uptime
curl -s http://localhost:18789/metrics | grep crocbot_uptime

# Message counts
curl -s http://localhost:18789/metrics | grep crocbot_messages_total

# Errors
curl -s http://localhost:18789/metrics | grep crocbot_errors_total

# Telegram latency
curl -s http://localhost:18789/metrics | grep telegram_latency
```

See [Metrics Documentation](/gateway/metrics) for full metric list.

---

## Health Check Script

```bash
#!/bin/bash
# health-check.sh

set -e

HEALTH_URL="http://localhost:18789/health"
TIMEOUT=5

# Fetch health
RESPONSE=$(curl -sf --max-time $TIMEOUT "$HEALTH_URL" 2>/dev/null)

if [ $? -ne 0 ]; then
  echo "CRITICAL: Health endpoint unreachable"
  exit 2
fi

STATUS=$(echo "$RESPONSE" | jq -r '.status')
HEAP=$(echo "$RESPONSE" | jq -r '.heapUsedMb')
RSS=$(echo "$RESPONSE" | jq -r '.rssMb')
UPTIME=$(echo "$RESPONSE" | jq -r '.uptime')

echo "Status: $STATUS | Heap: ${HEAP}MB | RSS: ${RSS}MB | Uptime: ${UPTIME}s"

if [ "$STATUS" != "ok" ]; then
  echo "WARNING: Gateway status is $STATUS"
  exit 1
fi

if [ "$(echo "$RSS > 512" | bc)" -eq 1 ]; then
  echo "WARNING: High memory usage (RSS: ${RSS}MB)"
  exit 1
fi

echo "OK: Gateway healthy"
exit 0
```

---

## Alerting on Health Issues

Configure alerting to notify on health degradation:

```yaml
gateway:
  alerting:
    enabled: true
    telegram:
      chatId: "YOUR_ADMIN_CHAT_ID"
      minSeverity: "critical"
```

Critical alerts trigger for:
- Gateway crashes
- Authentication failures
- Persistent connection failures

See [Alerting Documentation](/gateway/alerting) for full configuration.

---

## Related Documentation

- [Health Checks (CLI)](/gateway/health) - CLI health commands
- [Metrics](/gateway/metrics) - Prometheus metrics endpoint
- [Alerting](/gateway/alerting) - Alert configuration
- [Startup Shutdown](/runbooks/startup-shutdown) - Start/stop procedures
- [Incident Response](/runbooks/incident-response) - General troubleshooting
