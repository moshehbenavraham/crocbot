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
{"status":"ok","timestamp":"...","uptime":...}
```

## Logs

```bash
# Docker logs
docker logs -f crocbot-gateway
```

## Runbooks

- [Startup/Shutdown](runbooks/startup-shutdown)
- [Incident Response](runbooks/incident-response)
- [Docker Operations](runbooks/docker-operations)
- [Health Checks](runbooks/health-checks)
