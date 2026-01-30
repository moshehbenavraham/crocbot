# Incident Response

## Severity Levels

| Level | Description | Response Time |
|-------|-------------|---------------|
| P0 | Gateway down, Telegram disconnected | Immediate |
| P1 | Bot not responding to messages | < 1 hour |
| P2 | Degraded performance, delayed responses | < 4 hours |
| P3 | Minor issues, cosmetic problems | Next business day |

## Quick Diagnostics

### Check Gateway Health

```bash
# Health endpoint
curl http://localhost:18789/health

# Expected response
# {"status":"ok","timestamp":"...","uptime":...,"heapUsedMb":...}
```

### Check Telegram Connection

```bash
crocbot channels status --probe
```

### View Logs

```bash
# Docker
docker logs -f crocbot

# Direct
tail -f /tmp/crocbot-gateway.log
```

## Common Incidents

### Gateway Not Responding

**Symptoms**: Health endpoint returns error or times out

**Resolution**:
1. Check if container is running: `docker ps | grep crocbot`
2. Check container logs: `docker logs crocbot --tail 100`
3. Restart container: `docker restart crocbot`
4. If persists, check system resources (memory, disk)

### Telegram Disconnected

**Symptoms**: `crocbot channels status` shows Telegram offline

**Resolution**:
1. Check bot token is valid: verify with @BotFather
2. Check network connectivity from container
3. Review gateway logs for connection errors
4. Restart gateway: `docker restart crocbot`
5. If 429 errors, wait for rate limit cooldown

### High Memory Usage

**Symptoms**: Health endpoint shows high heapUsedMb/rssMb

**Resolution**:
1. Check current memory: `curl localhost:18789/health | jq '.heapUsedMb, .rssMb'`
2. If over 512MB RSS, consider restart
3. Check for memory leaks in logs
4. Restart container: `docker restart crocbot`

### Bot Not Responding to Messages

**Symptoms**: Messages sent but no response

**Resolution**:
1. Check gateway is running and healthy
2. Check Telegram connection status
3. Check agent configuration: `crocbot config show`
4. Check API key validity (Anthropic, etc.)
5. Review logs for processing errors

## Restart Procedures

### Docker Container

```bash
# Graceful restart
docker restart crocbot

# Force restart if unresponsive
docker kill crocbot
docker start crocbot
```

### Full Redeploy

```bash
# Pull latest image
docker pull crocbot:latest

# Stop and remove
docker stop crocbot
docker rm crocbot

# Start fresh
docker run -d --name crocbot ... crocbot:latest
```

## Rollback

If a recent update caused issues:

```bash
# List available tags
docker images crocbot

# Run previous version
docker stop crocbot
docker rm crocbot
docker run -d --name crocbot ... crocbot:previous-tag
```

## Escalation

If standard procedures do not resolve:

1. Collect logs: `docker logs crocbot > incident-logs.txt`
2. Collect health: `curl localhost:18789/health > health.json`
3. Open GitHub issue with logs and reproduction steps
