# Deployment

## Overview

crocbot supports two deployment paths:

1. **Local** - Docker Compose for local development and testing
2. **Coolify** - VPS production deployment with Coolify

## Local Deployment (Docker Compose)

Use Docker Compose for local development, testing, and evaluation.

### Prerequisites

- Docker Desktop (or Docker Engine) + Docker Compose v2
- Enough disk for images + logs

### Quick Start

From the repo root:

```bash
./scripts/docker-setup.sh
```

This script:
- Builds the gateway image
- Runs the onboarding wizard
- Prints optional provider setup hints
- Starts the gateway via Docker Compose
- Generates a gateway token and writes it to `.env`

After it finishes:
- Open `http://127.0.0.1:18789/` in your browser
- Paste the token into the Control UI (Settings)

### Manual Flow

```bash
# Build the image
docker build -t crocbot:local -f Dockerfile .

# Run onboarding
docker compose run --rm crocbot-cli onboard

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

## Coolify Deployment (VPS Production)

Use Coolify for production VPS deployment with automatic SSL, persistent storage, and easy management.

### Prerequisites

- A VPS with [Coolify](https://coolify.io/) installed
- An API key from your preferred model provider
- Domain name (optional, for custom domain)

### Setup Steps

1. **Create a new service in Coolify**
   - Go to your Coolify dashboard
   - Create a new Project (or use existing)
   - Add a new Resource > Docker Compose

2. **Configure the repository**
   - Repository: `https://github.com/moshehbenavraham/crocbot`
   - Branch: `main`
   - Docker Compose file: `docker-compose.coolify.yml`

3. **Set environment variables**

   Required:
   - `CROCBOT_GATEWAY_TOKEN` - Generate with: `openssl rand -hex 32`
   - `ANTHROPIC_API_KEY` - Your Anthropic API key

   Optional:
   - `SETUP_PASSWORD` - Password for `/setup` wizard
   - `TELEGRAM_BOT_TOKEN` - Telegram bot token
   - `OPENAI_API_KEY` - OpenAI API key (fallback)

4. **Configure domain (optional)**
   - Add your domain in Coolify's settings
   - Coolify handles SSL automatically via Let's Encrypt

5. **Deploy**
   - Click Deploy
   - Wait for the build to complete

### After Deployment

1. **Complete setup wizard**
   - Visit `https://your-domain.com/setup`
   - Enter your `SETUP_PASSWORD`
   - Configure model provider and channels

2. **Access Control UI**
   - Visit `https://your-domain.com/crocbot`
   - Use your gateway token to authenticate

### Health Check

The gateway exposes a health endpoint:

```bash
curl https://your-domain.com/health
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

### Monitoring

View logs in Coolify dashboard:
- Build logs (Docker image creation)
- Runtime logs (application output)

### Updates

To update crocbot:
1. Go to your service in Coolify
2. Click "Redeploy" to pull latest changes
3. Coolify rebuilds and restarts automatically

### Backups

Export configuration at any time:
```
https://your-domain.com/setup/export
```

This downloads a portable backup you can restore on any crocbot host.

### Resource Requirements

| Resource | Minimum | Recommended |
|----------|---------|-------------|
| Memory | 512MB | 2GB |
| Storage | 1GB | 5GB+ |
| CPU | 1 vCPU | 2 vCPU |

---

## CI/CD Pipeline

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

## Docker Environment Variables

See [Docker Environment Variables](/install/docker-env-vars) for the full list of supported environment variables.
