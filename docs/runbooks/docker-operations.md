# Docker Operations

Container management procedures for crocbot deployments, including image updates, rollback, and troubleshooting.

## Quick Reference

| Operation | Command |
|-----------|---------|
| Start | `docker start crocbot` |
| Stop | `docker stop crocbot` |
| Restart | `docker restart crocbot` |
| Logs | `docker logs -f crocbot` |
| Shell | `docker exec -it crocbot sh` |
| Status | `docker ps -f name=crocbot` |

---

## Container Management

### Viewing Container Status

```bash
# Check if container is running
docker ps -f name=crocbot

# Include stopped containers
docker ps -a -f name=crocbot

# Detailed status
docker inspect crocbot | jq '.[0].State'

# Expected output for healthy container:
# {
#   "Status": "running",
#   "Running": true,
#   "Paused": false,
#   ...
# }
```

### Resource Usage

```bash
# Real-time stats
docker stats crocbot --no-stream

# Memory and CPU details
docker stats crocbot --format "{{.Name}}: {{.MemUsage}} / {{.CPUPerc}}"
```

### Container Inspection

```bash
# View all configuration
docker inspect crocbot

# Specific fields
docker inspect crocbot | jq '.[0].Config.Env'       # Environment
docker inspect crocbot | jq '.[0].Mounts'           # Volumes
docker inspect crocbot | jq '.[0].NetworkSettings'  # Network
docker inspect crocbot | jq '.[0].RestartCount'     # Restart count
```

---

## Image Updates

### Pull Latest Image

```bash
# Pull from registry
docker pull ghcr.io/your-org/crocbot:latest

# Verify new image
docker images | grep crocbot
```

### Update Running Container

```bash
# 1. Pull new image
docker pull ghcr.io/your-org/crocbot:latest

# 2. Stop current container
docker stop crocbot

# 3. Remove old container
docker rm crocbot

# 4. Start with new image (preserves volumes)
docker run -d \
  --name crocbot \
  --restart unless-stopped \
  -p 18789:18789 \
  -v crocbot-state:/app/state \
  --env-file /path/to/.env \
  ghcr.io/your-org/crocbot:latest

# 5. Verify health
curl http://localhost:18789/health
```

### Update with Docker Compose

```bash
# Pull and recreate
docker-compose pull
docker-compose up -d

# Verify
docker-compose ps
```

### Tag-Based Updates

```bash
# List available tags
docker images ghcr.io/your-org/crocbot --format "{{.Tag}}"

# Update to specific version
docker pull ghcr.io/your-org/crocbot:2026.1.55
docker stop crocbot && docker rm crocbot
docker run -d --name crocbot ... ghcr.io/your-org/crocbot:2026.1.55
```

---

## Rollback Procedures

### Identify Previous Version

```bash
# List local images with timestamps
docker images ghcr.io/your-org/crocbot --format "{{.Tag}}\t{{.CreatedAt}}"

# Check what version is currently running
docker inspect crocbot | jq -r '.[0].Config.Image'
```

### Rollback to Previous Version

```bash
# 1. Stop current container
docker stop crocbot

# 2. Remove container (preserves volumes)
docker rm crocbot

# 3. Run previous version
docker run -d \
  --name crocbot \
  --restart unless-stopped \
  -p 18789:18789 \
  -v crocbot-state:/app/state \
  --env-file /path/to/.env \
  ghcr.io/your-org/crocbot:2026.1.54

# 4. Verify rollback successful
curl http://localhost:18789/health
docker logs --tail 20 crocbot
```

### Emergency Rollback Script

```bash
#!/bin/bash
# rollback.sh <previous-tag>

TAG=${1:-"previous"}
IMAGE="ghcr.io/your-org/crocbot:$TAG"

echo "Rolling back to $IMAGE..."

docker stop crocbot
docker rm crocbot
docker run -d \
  --name crocbot \
  --restart unless-stopped \
  -p 18789:18789 \
  -v crocbot-state:/app/state \
  --env-file /path/to/.env \
  "$IMAGE"

sleep 5
if curl -sf http://localhost:18789/health > /dev/null; then
  echo "Rollback successful"
else
  echo "Rollback failed - check logs"
  docker logs --tail 50 crocbot
  exit 1
fi
```

---

## Volume Management

### List Volumes

```bash
# All crocbot volumes
docker volume ls -f name=crocbot

# Volume details
docker volume inspect crocbot-state
```

### Backup Volume

```bash
# Backup state directory
docker run --rm \
  -v crocbot-state:/data:ro \
  -v $(pwd):/backup \
  alpine tar czf /backup/crocbot-state-backup.tar.gz -C /data .
```

### Restore Volume

```bash
# Stop container first
docker stop crocbot

# Restore from backup
docker run --rm \
  -v crocbot-state:/data \
  -v $(pwd):/backup \
  alpine tar xzf /backup/crocbot-state-backup.tar.gz -C /data

# Start container
docker start crocbot
```

---

## Log Management

### View Logs

```bash
# Follow logs
docker logs -f crocbot

# Last N lines
docker logs --tail 100 crocbot

# With timestamps
docker logs -f -t crocbot

# Since specific time
docker logs --since "1h" crocbot
docker logs --since "2026-02-04T10:00:00" crocbot
```

### Export Logs

```bash
# Export to file
docker logs crocbot > crocbot-logs.txt 2>&1

# Export last 1000 lines
docker logs --tail 1000 crocbot > recent-logs.txt 2>&1
```

### Log Rotation (Docker daemon)

Configure in `/etc/docker/daemon.json`:

```json
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
```

Then restart Docker daemon:

```bash
sudo systemctl restart docker
```

---

## Troubleshooting

### Container Won't Start

```bash
# Check container exit code
docker inspect crocbot | jq '.[0].State.ExitCode'

# View logs from failed start
docker logs crocbot

# Common exit codes:
# 0 - Normal exit
# 1 - Application error
# 137 - OOM killed (SIGKILL)
# 139 - Segfault
```

### Container Restarts Repeatedly

```bash
# Check restart count
docker inspect crocbot | jq '.[0].RestartCount'

# Disable restart temporarily
docker update --restart no crocbot

# Debug manually
docker logs --tail 100 crocbot
```

### Out of Memory (OOM)

```bash
# Check if OOM killed
docker inspect crocbot | jq '.[0].State.OOMKilled'

# View system logs for OOM events
dmesg | grep -i "killed process"

# Increase memory limit
docker update --memory 1g crocbot
# or recreate with:
docker run ... --memory 1g ...
```

### Network Issues

```bash
# Check network configuration
docker network ls
docker inspect crocbot | jq '.[0].NetworkSettings.Networks'

# Test internal DNS
docker exec crocbot nslookup api.telegram.org

# Check port bindings
docker port crocbot
```

### Disk Space

```bash
# Check Docker disk usage
docker system df

# Clean up unused resources
docker system prune -f

# Remove old images
docker image prune -a -f --filter "until=168h"  # older than 7 days
```

---

## Health Checks

### Docker Health Check

Configure in Dockerfile or compose:

```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:18789/health"]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 30s
```

### Check Health Status

```bash
# View health status
docker inspect crocbot | jq '.[0].State.Health'

# Health history
docker inspect crocbot | jq '.[0].State.Health.Log'
```

---

## Docker Compose Operations

### Basic Commands

```bash
# Start services
docker-compose up -d

# Stop services
docker-compose down

# Restart specific service
docker-compose restart crocbot

# View logs
docker-compose logs -f crocbot

# Pull and update
docker-compose pull && docker-compose up -d
```

### Example docker-compose.yml

```yaml
version: "3.8"
services:
  crocbot:
    image: ghcr.io/your-org/crocbot:latest
    container_name: crocbot
    restart: unless-stopped
    ports:
      - "18789:18789"
    volumes:
      - crocbot-state:/app/state
    env_file:
      - .env
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:18789/health"]
      interval: 30s
      timeout: 10s
      retries: 3

volumes:
  crocbot-state:
```

---

## Related Documentation

- [Docker Installation](/install/docker) - Initial Docker setup
- [Docker Environment Variables](/install/docker-env-vars) - Configuration
- [Startup and Shutdown](/runbooks/startup-shutdown) - Start/stop procedures
- [Health Checks](/runbooks/health-checks) - Health monitoring
