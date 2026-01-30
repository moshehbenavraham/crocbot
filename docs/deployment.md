# Deployment

## Overview

crocbot is designed for VPS/container deployment. The primary deployment target is Docker with Coolify, Fly.io, Railway, or similar platforms.

## Docker Deployment

### Build Image

```bash
docker build -t crocbot:latest .
```

### Run Container

```bash
docker run -d \
  --name crocbot \
  -p 18789:18789 \
  -v crocbot-data:/data \
  -e ANTHROPIC_API_KEY=your-key \
  -e CLAWDBOT_GATEWAY_TOKEN=your-gateway-token \
  -e TELEGRAM_BOT_TOKEN=your-telegram-token \
  crocbot:latest
```

### Docker Compose

```yaml
services:
  crocbot:
    build: .
    ports:
      - "18789:18789"
    volumes:
      - crocbot-data:/data
    environment:
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - CLAWDBOT_GATEWAY_TOKEN=${CLAWDBOT_GATEWAY_TOKEN}
      - TELEGRAM_BOT_TOKEN=${TELEGRAM_BOT_TOKEN}
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:18789/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    restart: unless-stopped

volumes:
  crocbot-data:
```

Run with:
```bash
docker-compose up -d
```

## Environment Variables

See [Docker Environment Variables](docker-env-vars.md) for full list.

### Required

| Variable | Description |
|----------|-------------|
| `ANTHROPIC_API_KEY` | Anthropic API key for Claude models |
| `CLAWDBOT_GATEWAY_TOKEN` | Gateway authentication token |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token from @BotFather |

### Optional

| Variable | Description | Default |
|----------|-------------|---------|
| `CLAWDBOT_GATEWAY_PORT` | Gateway port | 18789 |
| `CLAWDBOT_GATEWAY_BIND` | Bind address | loopback |
| `NODE_ENV` | Node environment | production |

## CI/CD Pipeline

```
Push -> Build -> Test -> Docker Build -> Deploy
```

### GitHub Actions

The repository includes CI workflows:

- `ci.yml` - Runs lint, build, and tests on push/PR
- `docker-release.yml` - Builds and publishes Docker images on release
- `security.yml` - CodeQL security scanning

## Release Process

1. Update version in `package.json`
2. Update `CHANGELOG.md`
3. Create release commit
4. Tag with version: `git tag vYYYY.M.D`
5. Push with tags: `git push --tags`
6. CI builds and publishes Docker image

## Health Check

The gateway exposes a health endpoint:

```bash
curl http://localhost:18789/health
```

Response:
```json
{
  "status": "ok",
  "timestamp": "2026-01-30T12:00:00.000Z",
  "uptime": 3600,
  "heapUsedMb": 150,
  "heapTotalMb": 256,
  "rssMb": 300
}
```

## Monitoring

### Logs

Container logs:
```bash
docker logs -f crocbot
```

Gateway logs include:
- Startup/shutdown with memory metrics
- Telegram connection status
- Request processing
- Error details

### Metrics

The /health endpoint provides:
- Uptime
- Memory usage (heap and RSS)
- Status

## Rollback

```bash
# Pull previous version
docker pull crocbot:previous-tag

# Stop current container
docker stop crocbot
docker rm crocbot

# Run previous version
docker run -d --name crocbot ... crocbot:previous-tag
```

## Platform-Specific Guides

- [Railway](railway.mdx)
- [Render](render.mdx)
- [Northflank](northflank.mdx)
- [Docker](install/docker.md)
