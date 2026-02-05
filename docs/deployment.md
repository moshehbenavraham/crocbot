# Deployment

## CI/CD Pipeline

```
Push --> Build --> Test --> Deploy
```

GitHub Actions workflow runs on push to `main`:
1. Install dependencies
2. Run build (`pnpm build`)
3. Run lint (`pnpm lint`)
4. Run tests (`pnpm test`)
5. Build Docker image (on success)

## Build Process

```bash
# Full build
pnpm build

# Output
dist/           # Compiled JavaScript
```

## Release Process

1. Update version in `package.json`
2. Commit changes
3. Create tag: `git tag vYYYY.M.D`
4. Push: `git push && git push --tags`
5. CI builds and publishes

## Docker Deployment

### Build Image

```bash
# Multi-stage build
docker build -t crocbot:latest .
```

### Run Container

```bash
docker run -d \
  --name crocbot \
  --restart unless-stopped \
  -p 18789:18789 \
  -e ANTHROPIC_API_KEY=... \
  -e TELEGRAM_BOT_TOKEN=... \
  -v crocbot-state:/app/state \
  crocbot:latest
```

### Update Deployment

```bash
# Pull new image
docker pull crocbot:latest

# Recreate container
docker stop crocbot
docker rm crocbot
docker run -d ... crocbot:latest
```

## Coolify Deployment

1. Connect GitHub repository
2. Configure environment variables
3. Set build command: `pnpm build`
4. Deploy

Coolify handles:
- Automatic TLS certificates
- Container orchestration
- Zero-downtime deployments

## Rollback

```bash
# List available versions
docker images crocbot

# Run previous version
docker stop crocbot
docker rm crocbot
docker run -d --name crocbot ... crocbot:previous-tag
```

## Health Monitoring

```bash
# Check health
curl http://localhost:18789/health

# Expected response
{"status":"ok","timestamp":"...","uptime":...}
```

## Logs

```bash
# Docker logs
docker logs -f crocbot

# systemd logs
journalctl --user -u crocbot-gateway -f
```

## Runbooks

- [Startup/Shutdown](runbooks/startup-shutdown)
- [Incident Response](runbooks/incident-response)
- [Docker Operations](runbooks/docker-operations)
- [Health Checks](runbooks/health-checks)
