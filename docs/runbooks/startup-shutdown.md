# Startup and Shutdown

Procedures for starting, stopping, and restarting the crocbot gateway across different deployment models.

## Quick Reference

| Action | systemd | Docker |
|--------|---------|--------|
| Start | `systemctl --user start crocbot-gateway` | `docker start crocbot` |
| Stop | `systemctl --user stop crocbot-gateway` | `docker stop crocbot` |
| Restart | `systemctl --user restart crocbot-gateway` | `docker restart crocbot` |
| Status | `systemctl --user status crocbot-gateway` | `docker ps -f name=crocbot` |
| Logs | `journalctl --user -u crocbot-gateway -f` | `docker logs -f crocbot` |

---

## systemd (User Service)

### Service Location

The systemd user service file is typically at:

```bash
~/.config/systemd/user/crocbot-gateway.service
```

### Starting the Gateway

```bash
# Start the service
systemctl --user start crocbot-gateway

# Verify it's running
systemctl --user status crocbot-gateway

# Expected output (healthy):
# Active: active (running) since ...
```

### Stopping the Gateway

```bash
# Graceful stop (sends SIGTERM, waits for cleanup)
systemctl --user stop crocbot-gateway

# Verify stopped
systemctl --user status crocbot-gateway
# Expected: Active: inactive (dead)
```

### Restarting the Gateway

```bash
# Graceful restart
systemctl --user restart crocbot-gateway

# Check health after restart
curl http://localhost:18789/health
# Expected: {"status":"ok",...}
```

### Enable on Boot

```bash
# Enable auto-start
systemctl --user enable crocbot-gateway

# Also enable lingering (keeps user services running after logout)
loginctl enable-linger $USER
```

### Viewing Logs

```bash
# Recent logs
journalctl --user -u crocbot-gateway --since "1 hour ago"

# Follow live
journalctl --user -u crocbot-gateway -f

# Last 100 lines
journalctl --user -u crocbot-gateway -n 100
```

### Troubleshooting systemd

**Service won't start:**

```bash
# Check for configuration errors
systemctl --user status crocbot-gateway
journalctl --user -u crocbot-gateway --since "5 minutes ago"

# Verify the binary path in the service file
cat ~/.config/systemd/user/crocbot-gateway.service | grep ExecStart
```

**Service starts but exits immediately:**

```bash
# Check exit code
systemctl --user show crocbot-gateway -p ExecMainStatus

# Common causes:
# - Missing environment variables (check .env)
# - Port already in use
# - Invalid configuration
```

**After editing the service file:**

```bash
# Reload systemd daemon
systemctl --user daemon-reload

# Then restart
systemctl --user restart crocbot-gateway
```

---

## Docker

### Starting the Container

```bash
# Start existing container
docker start crocbot

# Verify running
docker ps -f name=crocbot

# Check health
curl http://localhost:18789/health
```

### First-Time Docker Run

```bash
# Run with required mounts and environment
docker run -d \
  --name crocbot \
  --restart unless-stopped \
  -p 18789:18789 \
  -v /path/to/state:/app/state \
  --env-file /path/to/.env \
  crocbot:latest
```

### Stopping the Container

```bash
# Graceful stop (10s timeout by default)
docker stop crocbot

# Force stop (immediate)
docker kill crocbot
```

### Restarting the Container

```bash
# Graceful restart
docker restart crocbot

# With extended timeout for cleanup
docker stop -t 30 crocbot && docker start crocbot
```

### Viewing Logs

```bash
# Last 100 lines
docker logs --tail 100 crocbot

# Follow live
docker logs -f crocbot

# With timestamps
docker logs -f -t crocbot
```

### Docker Compose

If using docker-compose:

```bash
# Start
docker-compose up -d

# Stop
docker-compose down

# Restart
docker-compose restart

# Logs
docker-compose logs -f crocbot
```

### Troubleshooting Docker

**Container won't start:**

```bash
# Check container status
docker ps -a -f name=crocbot

# View recent logs
docker logs --tail 50 crocbot

# Inspect configuration
docker inspect crocbot | jq '.[0].Config.Env'
```

**Container restarts repeatedly:**

```bash
# Check restart count
docker inspect crocbot | jq '.[0].RestartCount'

# View logs from last restart
docker logs --tail 100 crocbot

# Disable restart temporarily to debug
docker update --restart no crocbot
```

---

## Graceful Shutdown

The gateway handles shutdown signals gracefully:

1. **SIGTERM** - Initiates graceful shutdown
2. Stops accepting new connections
3. Completes in-flight requests (up to 30s timeout)
4. Closes Telegram connection cleanly
5. Flushes logs and metrics
6. Exits with code 0

### Manual Graceful Shutdown

```bash
# Find the process
pgrep -f "crocbot"

# Send SIGTERM for graceful shutdown
kill -SIGTERM <pid>

# Or use pkill
pkill -SIGTERM -f "crocbot"
```

### Forced Shutdown

Only use if graceful shutdown hangs:

```bash
# systemd
systemctl --user kill -s SIGKILL crocbot-gateway

# Docker
docker kill crocbot

# Direct process
kill -9 <pid>
```

---

## Health Verification After Startup

After starting the gateway, verify health:

```bash
# 1. Check process is running
pgrep -f "crocbot" || docker ps -f name=crocbot

# 2. Check health endpoint
curl -s http://localhost:18789/health | jq

# Expected response:
# {
#   "status": "ok",
#   "timestamp": "2026-...",
#   "uptime": 123.456,
#   "heapUsedMb": 45.2,
#   "rssMb": 98.7
# }

# 3. Check Telegram connection
crocbot channels status --probe
```

---

## Common Startup Issues

### Port Already in Use

```bash
# Find process using port
lsof -i :18789
# or
ss -tlnp | grep 18789

# Kill the process or use a different port
```

### Environment Variables Missing

```bash
# Verify .env is loaded (systemd)
systemctl --user show crocbot-gateway -p Environment

# Verify .env is passed (Docker)
docker inspect crocbot | jq '.[0].Config.Env'
```

### State Directory Permissions

```bash
# Check ownership
ls -la /path/to/crocbot/state

# Fix if needed
chown -R $USER:$USER /path/to/crocbot/state
```

---

## Related Documentation

- [Health Checks](/gateway/health) - Health endpoint details
- [Logging](/gateway/logging) - Log configuration and analysis
- [Deployment](/platforms/deployment) - Full deployment guides
- [Incident Response](/runbooks/incident-response) - Troubleshooting procedures
