# Environments

## Environment Overview

| Environment | URL | Purpose |
|-------------|-----|---------|
| Development | localhost:18789 | Local development |
| Production | Docker container | Live system |

## Configuration Differences

| Config | Development | Production |
|--------|-------------|------------|
| Gateway port | 18789 | 18789 (behind proxy) |
| TLS | None (HTTP) | Reverse proxy |
| Logging | Verbose | Structured JSON |
| State dir | Local | Docker volume |

## Environment Variables

### Required in All Environments

- `CROCBOT_STATE_DIR`: Runtime state directory
- `CROCBOT_CONFIG_PATH`: Main config file path
- `CROCBOT_WORKSPACE`: Agent working directory

### API Keys (at least one required)

- `ANTHROPIC_API_KEY`: Claude API access
- `OPENAI_API_KEY`: OpenAI API access

### Telegram

- `TELEGRAM_BOT_TOKEN`: Bot token from @BotFather

### Development-Only

- `NODE_ENV=development`: Enable development features
- `DEBUG=*`: Enable debug logging

### MCP (optional)

- `MCP_SERVER_TOKEN`: Authentication token for MCP server mode (if `mcp.server.enabled`)

### Production-Only

- `NODE_ENV=production`: Production mode
- `COOLIFY_WEBHOOK_URL`: Deployment trigger (GitHub Actions repo variable)
- Alerting webhook URLs (optional)

## Local Development

```bash
# Copy example env
cp .env.example .env

# Edit with your values
# Minimum: one API key + Telegram token

# Start gateway
pnpm gateway:watch
```

## Docker/Production

```bash
# Environment variables passed to container
docker run -d \
  -e ANTHROPIC_API_KEY=... \
  -e TELEGRAM_BOT_TOKEN=... \
  -e CROCBOT_STATE_DIR=/app/state \
  -v crocbot-state:/app/state \
  crocbot:latest
```

See [Docker installation](install/docker) and [Docker environment variables](install/docker-env-vars) for complete configuration.
