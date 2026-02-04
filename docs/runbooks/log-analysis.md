# Log Analysis

Guide to structured log querying, correlation ID tracing, and error pattern analysis for crocbot debugging.

## Log Locations

| Deployment | Location |
|------------|----------|
| File logs | `/tmp/crocbot/crocbot-YYYY-MM-DD.log` |
| systemd | `journalctl --user -u crocbot-gateway` |
| Docker | `docker logs crocbot` |
| CLI | `crocbot logs --follow` |

---

## Log Format

Crocbot uses structured JSON logging. Each line is a JSON object:

```json
{
  "level": "info",
  "time": "2026-02-04T12:00:00.000Z",
  "msg": "Message processed",
  "subsystem": "telegram/inbound",
  "correlationId": "abc123-def456",
  "channel": "telegram",
  "chatId": "123456789",
  "latencyMs": 45
}
```

### Log Levels

| Level | Use |
|-------|-----|
| `trace` | Extremely verbose, internal state |
| `debug` | Debugging details, message bodies |
| `info` | Normal operations |
| `warn` | Potential issues, recoverable errors |
| `error` | Failures requiring attention |
| `fatal` | Critical failures, process exit |

---

## Basic Querying

### View Recent Logs

```bash
# Last 100 lines
tail -100 /tmp/crocbot/crocbot-*.log

# Follow live
tail -f /tmp/crocbot/crocbot-*.log

# Using CLI
crocbot logs --follow
```

### Filter by Level

```bash
# Errors only
cat /tmp/crocbot/crocbot-*.log | jq -c 'select(.level == "error")'

# Warnings and above
cat /tmp/crocbot/crocbot-*.log | jq -c 'select(.level == "error" or .level == "warn")'
```

### Filter by Time

```bash
# Last hour (requires jq)
cat /tmp/crocbot/crocbot-*.log | jq -c --arg since "$(date -d '1 hour ago' -Iseconds)" \
  'select(.time >= $since)'

# Specific time range
cat /tmp/crocbot/crocbot-*.log | jq -c \
  'select(.time >= "2026-02-04T10:00:00" and .time <= "2026-02-04T11:00:00")'
```

### Filter by Subsystem

```bash
# Telegram-related logs
cat /tmp/crocbot/crocbot-*.log | jq -c 'select(.subsystem | startswith("telegram"))'

# Gateway logs
cat /tmp/crocbot/crocbot-*.log | jq -c 'select(.subsystem == "gateway")'
```

---

## Correlation ID Tracing

Correlation IDs link related log entries across a request lifecycle. Use them to trace the full journey of a message or request.

### Find Correlation ID

```bash
# From an error
cat /tmp/crocbot/crocbot-*.log | jq -c 'select(.level == "error")' | head -1 | jq '.correlationId'
```

### Trace Full Request

```bash
# Trace all logs for a correlation ID
CORR_ID="abc123-def456"
cat /tmp/crocbot/crocbot-*.log | jq -c "select(.correlationId == \"$CORR_ID\")"
```

### Trace Script

```bash
#!/bin/bash
# trace-request.sh <correlation-id>

CORR_ID=$1
LOG_DIR="/tmp/crocbot"

if [ -z "$CORR_ID" ]; then
  echo "Usage: trace-request.sh <correlation-id>"
  exit 1
fi

echo "Tracing correlation ID: $CORR_ID"
echo "---"

cat $LOG_DIR/crocbot-*.log | \
  jq -c "select(.correlationId == \"$CORR_ID\")" | \
  jq -r '[.time, .level, .subsystem, .msg] | @tsv' | \
  column -t -s $'\t'
```

### Common Correlation Patterns

```bash
# Find all unique correlation IDs from last hour
cat /tmp/crocbot/crocbot-*.log | \
  jq -r --arg since "$(date -d '1 hour ago' -Iseconds)" \
  'select(.time >= $since and .correlationId != null) | .correlationId' | \
  sort -u

# Count logs per correlation ID (find noisy requests)
cat /tmp/crocbot/crocbot-*.log | \
  jq -r 'select(.correlationId != null) | .correlationId' | \
  sort | uniq -c | sort -rn | head -10
```

---

## Error Pattern Analysis

### Find Common Errors

```bash
# Group errors by message
cat /tmp/crocbot/crocbot-*.log | \
  jq -r 'select(.level == "error") | .msg' | \
  sort | uniq -c | sort -rn | head -10
```

### Error Timeline

```bash
# Errors per minute
cat /tmp/crocbot/crocbot-*.log | \
  jq -r 'select(.level == "error") | .time[:16]' | \
  sort | uniq -c
```

### Find Related Errors

```bash
# Errors with stack traces
cat /tmp/crocbot/crocbot-*.log | \
  jq -c 'select(.level == "error" and .stack != null)'
```

### Error Context

```bash
# Get full context around an error
ERROR_TIME="2026-02-04T12:00:00"
cat /tmp/crocbot/crocbot-*.log | \
  jq -c "select(.time >= \"${ERROR_TIME}\" and .time <= \"${ERROR_TIME}Z\")"
```

---

## Performance Analysis

### Latency Distribution

```bash
# Average latency by message type
cat /tmp/crocbot/crocbot-*.log | \
  jq -r 'select(.latencyMs != null) | [.subsystem, .latencyMs] | @csv' | \
  awk -F, '{sum[$1]+=$2; count[$1]++} END {for(s in sum) print s, sum[s]/count[s]}' | \
  sort -k2 -rn
```

### Slow Requests

```bash
# Requests over 1 second
cat /tmp/crocbot/crocbot-*.log | \
  jq -c 'select(.latencyMs > 1000)'

# Top 10 slowest requests
cat /tmp/crocbot/crocbot-*.log | \
  jq -r 'select(.latencyMs != null) | [.time, .latencyMs, .msg] | @tsv' | \
  sort -t$'\t' -k2 -rn | head -10
```

### Message Volume

```bash
# Messages per hour
cat /tmp/crocbot/crocbot-*.log | \
  jq -r 'select(.subsystem | startswith("telegram")) | .time[:13]' | \
  sort | uniq -c
```

---

## systemd / journalctl

### Basic Queries

```bash
# Recent logs
journalctl --user -u crocbot-gateway --since "1 hour ago"

# Follow live
journalctl --user -u crocbot-gateway -f

# Output as JSON
journalctl --user -u crocbot-gateway -o json --since "1 hour ago"
```

### Filter by Priority

```bash
# Errors only (priority 3 = err)
journalctl --user -u crocbot-gateway -p err

# Warnings and above
journalctl --user -u crocbot-gateway -p warning
```

### Search in Logs

```bash
# Search for pattern
journalctl --user -u crocbot-gateway --since "1 hour ago" | grep -i "telegram"

# Case-insensitive search
journalctl --user -u crocbot-gateway -g "error|timeout"
```

---

## Docker Log Analysis

### Basic Queries

```bash
# Recent logs
docker logs --tail 100 crocbot

# Follow live
docker logs -f crocbot

# With timestamps
docker logs -f -t crocbot

# Since specific time
docker logs --since "1h" crocbot
```

### Parse JSON Logs

```bash
# Filter errors
docker logs crocbot 2>&1 | jq -c 'select(.level == "error")'

# Filter by subsystem
docker logs crocbot 2>&1 | jq -c 'select(.subsystem | startswith("telegram"))'
```

---

## Common Debug Scenarios

### Debug Message Flow

```bash
# Track a message from receipt to response
docker logs crocbot 2>&1 | jq -c 'select(
  .subsystem | test("telegram|agent|queue")
)'
```

### Debug Connection Issues

```bash
# Network and connection logs
cat /tmp/crocbot/crocbot-*.log | jq -c 'select(
  .msg | test("connect|disconnect|timeout|retry"; "i")
)'
```

### Debug Auth Issues

```bash
# Authentication-related logs
cat /tmp/crocbot/crocbot-*.log | jq -c 'select(
  .msg | test("auth|token|unauthorized|forbidden"; "i")
)'
```

### Find Memory Issues

```bash
# Memory-related entries
cat /tmp/crocbot/crocbot-*.log | jq -c 'select(
  .msg | test("memory|heap|oom|gc"; "i") or .heapUsedMb != null
)'
```

---

## Log Aggregation

### Export for Analysis

```bash
# Export last 24 hours to CSV
cat /tmp/crocbot/crocbot-*.log | \
  jq -r '[.time, .level, .subsystem, .msg] | @csv' > logs.csv
```

### Aggregate Metrics

```bash
# Count by level
cat /tmp/crocbot/crocbot-*.log | jq -r '.level' | sort | uniq -c

# Count by subsystem
cat /tmp/crocbot/crocbot-*.log | jq -r '.subsystem' | sort | uniq -c | sort -rn
```

---

## Useful jq Recipes

```bash
# Pretty print single log entry
cat /tmp/crocbot/crocbot-*.log | jq -s '.[-1]'

# Extract specific fields
cat /tmp/crocbot/crocbot-*.log | jq -r '[.time, .level, .msg] | @tsv'

# Filter and format
cat /tmp/crocbot/crocbot-*.log | \
  jq -r 'select(.level == "error") | "\(.time) [\(.subsystem)] \(.msg)"'

# Count entries
cat /tmp/crocbot/crocbot-*.log | jq -s 'length'

# Group and count
cat /tmp/crocbot/crocbot-*.log | jq -s 'group_by(.level) | map({level: .[0].level, count: length})'
```

---

## Related Documentation

- [Logging Configuration](/gateway/logging) - Log levels and formats
- [User Logging Guide](/help/logging) - Overview for users
- [Metrics](/gateway/metrics) - Prometheus metrics
- [Alerting](/gateway/alerting) - Error alerting
- [Incident Response](/runbooks/incident-response) - Troubleshooting procedures
