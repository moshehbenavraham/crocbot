# Deployment

## Overview

crocbot supports two deployment paths:

1. **Local** — native Node for development and testing
2. **Docker** — runtime-only container for production or isolated environments

## Local Deployment (Node)

Run crocbot directly on your machine with Node.js.

### Prerequisites

- Node.js 22+
- pnpm

### Quick Start

```bash
pnpm install
pnpm build
node dist/index.js gateway --port 18789 --verbose
```

### Environment Variables

Set these in `.env` or export them:

| Variable | Description | Default |
|----------|-------------|---------|
| `ANTHROPIC_API_KEY` | Anthropic API key | - |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token | - |
| `CROCBOT_STATE_DIR` | Runtime state directory | `~/.crocbot` |
| `CROCBOT_WORKSPACE` | Agent working directory | `~/croc` |

### Commands

```bash
# Dev loop (auto-reload on TS changes)
pnpm gateway:watch

# Health check
curl http://localhost:18789/health
```

---

## Docker Deployment

Use Docker for production or isolated environments. The Dockerfile packages a pre-built `dist/` into a lean `node:22-slim` runtime image.

### Prerequisites

- Docker Engine + Docker Compose v2
- Pre-built `dist/` directory (`pnpm build`)

### Quick Start

```bash
# Build application
pnpm build

# Build Docker image
docker build -t crocbot:local .

# Start the gateway
docker compose up -d crocbot-gateway
```

### Environment Variables

Set these in `.env` or export them:

| Variable | Description | Default |
|----------|-------------|---------|
| `CROCBOT_CONFIG_DIR` | Host path for config | `~/.crocbot` |
| `CROCBOT_WORKSPACE_DIR` | Host path for workspace | `~/croc` |
| `CROCBOT_GATEWAY_PORT` | Gateway HTTP port | `18789` |
| `CROCBOT_GATEWAY_TOKEN` | Gateway auth token | Auto-generated |
| `ANTHROPIC_API_KEY` | Anthropic API key | - |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token | - |

### Commands

```bash
# View logs
docker compose logs -f crocbot-gateway

# Health check
docker compose exec crocbot-gateway node dist/index.js health --token "$CROCBOT_GATEWAY_TOKEN"

# Run CLI commands
docker compose run --rm crocbot-cli <command>

# Stop gateway
docker compose down
```

See [Docker Installation](/install/docker) for full documentation.

---

## CI/CD Pipeline

The repository includes CI workflows:

- `ci.yml` — runs lint, build, and tests on push/PR
- `docker-release.yml` — builds and publishes Docker images on release
- `security.yml` — CodeQL security scanning

## Release Process

1. Update version in `package.json`
2. Update `CHANGELOG.md`
3. Create release commit
4. Tag with version: `git tag vYYYY.M.D`
5. Push with tags: `git push --tags`
6. CI builds and publishes Docker image

## Docker Environment Variables

See [Docker Environment Variables](/install/docker-env-vars) for the full list of supported environment variables.
