# Docker Environment Variables

This document describes the environment variables used when running crocbot in Docker.

## Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `CLAWDBOT_GATEWAY_TOKEN` | Authentication token for the gateway API | `your-secure-token` |

## Optional Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `CLAWDBOT_GATEWAY_PORT` | `18789` | Port for the gateway HTTP/WebSocket server |
| `CLAWDBOT_GATEWAY_BIND` | `lan` | Network binding: `loopback`, `lan`, or `all` |
| `CLAWDBOT_BRIDGE_PORT` | `18790` | Port for the bridge service |
| `CLAWDBOT_CONFIG_DIR` | - | Host path to mount at `/home/node/.clawdbot` |
| `CLAWDBOT_WORKSPACE_DIR` | - | Host path to mount at `/home/node/clawd` |
| `CLAWDBOT_IMAGE` | `crocbot:local` | Docker image to use |
| `NODE_ENV` | `production` | Node.js environment (set in Dockerfile) |
| `HOME` | `/home/node` | Home directory (set in compose) |
| `TERM` | `xterm-256color` | Terminal type (set in compose) |

## Claude Provider Variables

These variables configure the Claude AI provider connection:

| Variable | Description |
|----------|-------------|
| `CLAUDE_AI_SESSION_KEY` | Session key for Claude AI API |
| `CLAUDE_WEB_SESSION_KEY` | Session key for Claude web interface |
| `CLAUDE_WEB_COOKIE` | Cookie for Claude web authentication |

## Usage with docker-compose

Create a `.env` file in the same directory as `docker-compose.yml`:

```bash
# Required
CLAWDBOT_GATEWAY_TOKEN=your-secure-token-here

# Paths (adjust for your system)
CLAWDBOT_CONFIG_DIR=/path/to/.clawdbot
CLAWDBOT_WORKSPACE_DIR=/path/to/workspace

# Optional overrides
CLAWDBOT_GATEWAY_PORT=18789
CLAWDBOT_GATEWAY_BIND=lan
```

Then run:

```bash
docker-compose up -d
```

## Usage with docker run

```bash
docker run -d \
  --name crocbot-gateway \
  -p 18789:18789 \
  -e CLAWDBOT_GATEWAY_TOKEN=your-token \
  -v /path/to/.clawdbot:/home/node/.clawdbot \
  -v /path/to/workspace:/home/node/clawd \
  crocbot:local \
  node dist/index.js gateway --bind lan --port 18789
```

## Build-time Variables

These ARG variables can be passed during `docker build`:

| Variable | Default | Description |
|----------|---------|-------------|
| `CLAWDBOT_DOCKER_APT_PACKAGES` | (empty) | Additional apt packages to install |

Example:

```bash
docker build --build-arg CLAWDBOT_DOCKER_APT_PACKAGES="vim" -t crocbot:custom .
```

## First-Time Setup

Before running the gateway for the first time, you need to configure it:

1. Run the setup wizard (interactive):
   ```bash
   docker run -it --rm \
     -v /path/to/.clawdbot:/home/node/.clawdbot \
     crocbot:local node dist/index.js setup
   ```

2. Or set `gateway.mode=local` in configuration to skip setup validation:
   ```bash
   docker run --rm \
     -v /path/to/.clawdbot:/home/node/.clawdbot \
     crocbot:local node dist/index.js config set gateway.mode local
   ```

For testing without configuration, add `--allow-unconfigured` to the command.

## Security Notes

- Never commit `.env` files containing real tokens to version control
- Use Docker secrets or a secrets manager in production
- The `CLAWDBOT_GATEWAY_TOKEN` should be a strong, unique value
- Container runs as non-root `node` user for security
