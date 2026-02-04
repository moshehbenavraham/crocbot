# Telegram Troubleshooting

Diagnostic procedures for Telegram connection issues, including reconnection handling and rate limit recovery.

## Quick Diagnostics

```bash
# 1. Check channel status
crocbot channels status --probe

# 2. Check gateway health
curl -s http://localhost:18789/health | jq

# 3. View recent Telegram logs
journalctl --user -u crocbot-gateway --since "10 minutes ago" | grep -i telegram
# or for Docker:
docker logs --tail 100 crocbot | grep -i telegram
```

---

## Symptom: Bot Not Responding

### Diagnostic Steps

```bash
# Step 1: Verify gateway is running
curl -s http://localhost:18789/health
# If this fails, see /runbooks/startup-shutdown

# Step 2: Check Telegram connection
crocbot channels status --probe

# Step 3: Check for errors in logs
crocbot logs --follow | grep -E "(error|telegram|disconnect)"
```

### Common Causes

| Symptom | Cause | Resolution |
|---------|-------|------------|
| Health OK but no responses | Bot blocked or chat not allowed | Check `allowFrom` config |
| Connection shows offline | Network issue or token invalid | Verify token, check network |
| Intermittent failures | Rate limiting | Wait and retry |
| "Conflict" errors | Multiple instances | Stop duplicate gateways |

---

## Symptom: Connection Offline

### Check Token Validity

```bash
# Test token manually
curl "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getMe"

# Expected response:
# {"ok":true,"result":{"id":123456789,"is_bot":true,"first_name":"..."}}

# If "ok":false, token is invalid - get new token from @BotFather
```

### Verify Network Connectivity

```bash
# Test Telegram API reachability
curl -s -o /dev/null -w "%{http_code}" https://api.telegram.org
# Expected: 200

# If fails, check DNS and firewall
nslookup api.telegram.org
```

### Re-link Telegram

```bash
# Logout and re-authenticate
crocbot channels logout
crocbot channels login --verbose

# Follow the prompts to re-link your bot
```

---

## Symptom: Rate Limit Errors (HTTP 429)

Rate limiting occurs when too many requests are sent to Telegram API.

### Identify Rate Limiting

```bash
# Search logs for rate limit errors
grep -E "429|rate.?limit|too many requests" /tmp/crocbot/crocbot-*.log

# or via journalctl
journalctl --user -u crocbot-gateway --since "1 hour ago" | grep -i "429\|rate"
```

### Immediate Recovery

1. **Wait for cooldown** - Telegram rate limits typically last 1-60 seconds
2. **Do not restart repeatedly** - Restarts trigger reconnection floods

```bash
# Check current backoff in metrics
curl -s http://localhost:18789/metrics | grep reconnect

# Wait at least 60 seconds before manual intervention
sleep 60

# Then check status
crocbot channels status --probe
```

### Prevent Future Rate Limits

- Avoid sending messages in tight loops
- Use built-in throttling (enabled by default via `@grammyjs/transformer-throttler`)
- For group messages, ensure proper spacing between sends

---

## Symptom: Conflict Errors

Conflict errors occur when multiple bot instances use the same token.

### Identify Conflict

```bash
# Search for conflict errors
grep -i "conflict\|terminated by other\|409" /tmp/crocbot/crocbot-*.log
```

### Resolution

```bash
# 1. Find all running instances
pgrep -fa crocbot
docker ps -a | grep crocbot

# 2. Stop all instances
systemctl --user stop crocbot-gateway
docker stop crocbot

# 3. Start only ONE instance
systemctl --user start crocbot-gateway
```

---

## Symptom: Messages Not Delivered

Bot is connected but messages are not being received or sent.

### Check Allowlist Configuration

```bash
# View current configuration
crocbot config show | grep -A 20 telegram

# Verify sender is in allowFrom list
# config.yaml should have:
# channels:
#   telegram:
#     allowFrom:
#       - "123456789"  # Your chat ID
```

### Find Your Chat ID

```bash
# Method 1: Send /status to the bot and check logs
docker logs crocbot 2>&1 | grep "chat" | tail -5

# Method 2: Use @userinfobot on Telegram
# - Start a chat with @userinfobot
# - It will reply with your user ID
```

### Check Group Chat Settings

For group chats, verify:

```yaml
channels:
  telegram:
    groups:
      allowFrom:
        - "-100123456789"  # Group chat ID (negative)
```

---

## Reconnection Procedures

### Automatic Reconnection

The gateway automatically reconnects with exponential backoff:

1. Disconnect detected
2. Wait 1 second
3. Attempt reconnection
4. If fails, wait 2s, 4s, 8s... (max 60s)
5. Continue until successful

### Manual Reconnection

```bash
# Force reconnection via restart
systemctl --user restart crocbot-gateway
# or
docker restart crocbot

# Then verify
sleep 5
crocbot channels status --probe
```

### Full Re-authentication

If automatic reconnection fails repeatedly:

```bash
# 1. Stop the gateway
systemctl --user stop crocbot-gateway

# 2. Clear cached credentials (optional)
rm ~/.crocbot/credentials/telegram.json

# 3. Re-login
crocbot channels login --verbose

# 4. Start gateway
systemctl --user start crocbot-gateway
```

---

## Monitoring Telegram Health

### Key Metrics

```bash
# Check reconnection count
curl -s http://localhost:18789/metrics | grep telegram_reconnect

# Check message processing latency
curl -s http://localhost:18789/metrics | grep telegram_latency
```

### Health Check Script

```bash
#!/bin/bash
# telegram-health.sh

HEALTH=$(curl -s http://localhost:18789/health)
STATUS=$(crocbot channels status --json 2>/dev/null)

echo "Gateway Health:"
echo "$HEALTH" | jq -r '.status'

echo "Telegram Status:"
echo "$STATUS" | jq -r '.telegram.status // "unknown"'

# Alert if unhealthy
if ! echo "$HEALTH" | jq -e '.status == "ok"' > /dev/null; then
    echo "WARNING: Gateway unhealthy"
    exit 1
fi
```

---

## Alert Integration

Critical Telegram issues trigger alerts via the [alerting system](/gateway/alerting):

| Error | Severity | Example |
|-------|----------|---------|
| Connection failed | Critical | "Telegram auth failed" |
| Rate limited | Warning | "429 Too Many Requests" |
| Reconnection | Info | "Telegram reconnecting" |

Configure alert destinations:

```yaml
gateway:
  alerting:
    telegram:
      chatId: "YOUR_ADMIN_CHAT_ID"
      minSeverity: "critical"
```

---

## Common Error Messages

| Error | Meaning | Resolution |
|-------|---------|------------|
| `Unauthorized` | Invalid bot token | Get new token from @BotFather |
| `Conflict: terminated by other getUpdates request` | Multiple instances | Stop duplicate instances |
| `Too Many Requests: retry after N` | Rate limited | Wait N seconds |
| `Bad Request: chat not found` | Invalid chat ID | Verify chat ID exists |
| `Forbidden: bot was blocked by the user` | User blocked bot | User must unblock |
| `ETIMEOUT` | Network timeout | Check network connectivity |

---

## Related Documentation

- [Telegram Channel](/channels/telegram) - Configuration reference
- [Alerting](/gateway/alerting) - Alert configuration
- [Incident Response](/runbooks/incident-response) - General troubleshooting
- [Health Checks](/runbooks/health-checks) - Health endpoint interpretation
