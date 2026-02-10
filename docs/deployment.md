# Deployment

## Deployment Paths

crocbot supports two deployment paths:

1. **Local** — native Node for dev/testing (`pnpm build` + `node dist/index.js gateway`)
2. **Docker** — runtime-only image built from pre-compiled `dist/`

## Local

```bash
pnpm install
pnpm build
node dist/index.js gateway --port 18789 --verbose
```

## Docker

```bash
# Build locally first
pnpm build

# Build the Docker image
docker build -t crocbot:local .

# Start the gateway
docker compose up -d crocbot-gateway
```

See [Docker installation](/install/docker) for full documentation.

## CI/CD Pipeline

```
Push to main --> CI (lint, build, test) --> Docker build --> Push to registry --> Coolify webhook deploy
```

### Pipeline Bundles

| Bundle | Workflow | Triggers |
|--------|----------|----------|
| Code Quality | `ci.yml` | Push, PR (lint, format, typecheck) |
| Build & Test | `ci.yml` | Push, PR (build, test with coverage) |
| Security | `ci.yml` + `security.yml` | Push, schedule (detect-secrets, CodeQL, npm-audit) |
| Integration | `integration.yml` | PR to main (E2E tests) |
| Docker Release | `docker-release.yml` | Push to main (build + push + Coolify webhook) |

## Build Process

```bash
# Full build (tsdown bundler, ~5s)
pnpm build

# Type-check + lint + format (no emit)
pnpm check

# Output
dist/           # Bundled JavaScript (code-split chunks)
```

## Release Process

1. Update version in `package.json`
2. Commit changes
3. Create tag: `git tag vYYYY.M.D`
4. Push: `git push && git push --tags`
5. CI builds and publishes

## Update Deployment

```bash
# Rebuild image with latest code
pnpm build
docker build -t crocbot:local .

# Recreate container
docker compose up -d crocbot-gateway
```

## Rollback

```bash
# List available versions
docker images crocbot

# Run previous version
docker stop crocbot-gateway
docker rm crocbot-gateway
docker run -d --name crocbot-gateway ... crocbot:previous-tag
```

## Health Monitoring

```bash
# Check health
curl http://localhost:18789/health

# Expected response
# {"status":"ok","timestamp":"...","uptime":...,"heapUsedMb":...}
```

Docker healthcheck: 30s interval, 3 retries, 10s timeout.

## Backup

- **Config backup**: `scripts/backup.sh` (7-day retention default)
- **Scheduled backup**: `.github/workflows/backup.yml` (daily 02:00 UTC, 30-day artifact retention)
- **Config export**: `GET /setup/export` (Bearer token auth, returns redacted config snapshot)

## Logs

```bash
# Docker logs
docker logs -f crocbot-gateway

# Systemd logs (if using daemon)
journalctl --user -u crocbot-gateway --since "1 hour ago"
```

## Runbooks

- [Startup/Shutdown](runbooks/startup-shutdown)
- [Incident Response](runbooks/incident-response)
- [Docker Operations](runbooks/docker-operations)
- [Health Checks](runbooks/health-checks)
- [Backup/Restore](runbooks/backup-restore)
- [Coolify Deploy](runbooks/coolify-deploy)
- [Log Analysis](runbooks/log-analysis)
- [Telegram Troubleshooting](runbooks/telegram-troubleshooting)
