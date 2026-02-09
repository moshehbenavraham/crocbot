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

### Response

The `/health` endpoint is a lightweight liveness probe that returns a minimal response:

```json
{"status": "healthy"}
```

| Field | Type | Description |
|-------|------|-------------|
| `status` | string | `"healthy"` if the gateway is running |

A 200 response with `"healthy"` status confirms the gateway process is alive and accepting HTTP connections. If the endpoint does not respond, the gateway is down.

For detailed diagnostics (memory, uptime, component health), use the CLI:

```bash
crocbot health --json
crocbot status --all
```

---

## Interpreting Health Status

### Status: Healthy (200 response)

```json
{"status": "healthy"}
```

**Meaning**: Gateway is running and accepting connections.

### No Response / Connection Refused

**Meaning**: Gateway is down or unresponsive.

**Actions**:
1. Check if process is running
2. Check for crash in logs
3. Restart gateway
4. See [Startup Shutdown](/runbooks/startup-shutdown)

---

## Memory Monitoring

The `/health` endpoint does not return memory metrics. Use the CLI or `/metrics` endpoint for memory monitoring:

```bash
# CLI health with diagnostics
crocbot health --json

# Prometheus metrics
curl -s http://localhost:18789/metrics | grep -E 'heap|rss'
```

### Check for Restart Loop

```bash
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

### High Memory Suspected

```bash
# Check process memory via CLI diagnostics
crocbot health --json

# Or check via system tools
ps -o rss,vsz -p $(pgrep -f crocbot)

# Restart if needed
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

echo "Status: $STATUS"

if [ "$STATUS" != "healthy" ]; then
  echo "WARNING: Gateway status is $STATUS"
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
