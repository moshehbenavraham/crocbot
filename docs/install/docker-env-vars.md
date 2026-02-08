# Docker Environment Variables

This document describes the environment variables used when running crocbot in Docker.

## Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `CROCBOT_GATEWAY_TOKEN` | Authentication token for the gateway API | `your-secure-token` |

## Optional Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `CROCBOT_GATEWAY_PORT` | `18789` | Port for the gateway HTTP/WebSocket server |
| `CROCBOT_GATEWAY_BIND` | `lan` | Network binding: `loopback`, `lan`, or `all` |
| `CROCBOT_BRIDGE_PORT` | `18790` | Port for the bridge service |
| `CROCBOT_CONFIG_DIR` | - | Host path to mount at `/home/node/.crocbot` |
| `CROCBOT_WORKSPACE_DIR` | - | Host path to mount at `/home/node/croc` |
| `CROCBOT_IMAGE` | `crocbot:local` | Docker image to use |
| `NODE_ENV` | `production` | Node.js environment (set in Dockerfile) |
| `HOME` | `/home/node` | Home directory (set in compose) |
| `TERM` | `xterm-256color` | Terminal type (set in compose) |

## Usage with docker-compose

Create a `.env` file in the same directory as `docker-compose.yml`:

```bash
# Required
CROCBOT_GATEWAY_TOKEN=your-secure-token-here

# Paths (adjust for your system)
CROCBOT_CONFIG_DIR=/path/to/.crocbot
CROCBOT_WORKSPACE_DIR=/path/to/workspace

# Optional overrides
CROCBOT_GATEWAY_PORT=18789
CROCBOT_GATEWAY_BIND=lan
```

Then run:

```bash
docker compose up -d
```

## Usage with docker run

```bash
docker run -d \
  --name crocbot-gateway \
  -p 18789:18789 \
  -e CROCBOT_GATEWAY_TOKEN=your-token \
  -v /path/to/.crocbot:/home/node/.crocbot \
  -v /path/to/workspace:/home/node/croc \
  crocbot:local \
  node dist/index.js gateway --bind lan --port 18789
```

## First-Time Setup

Before running the gateway for the first time, you need to configure it:

1. Run the setup wizard (interactive):
   ```bash
   docker run -it --rm \
     -v /path/to/.crocbot:/home/node/.crocbot \
     crocbot:local node dist/index.js setup
   ```

2. Or set `gateway.mode=local` in configuration to skip setup validation:
   ```bash
   docker run --rm \
     -v /path/to/.crocbot:/home/node/.crocbot \
     crocbot:local node dist/index.js config set gateway.mode local
   ```

For testing without configuration, add `--allow-unconfigured` to the command.

## Security Notes

- Never commit `.env` files containing real tokens to version control
- Use Docker secrets or a secrets manager in production
- The `CROCBOT_GATEWAY_TOKEN` should be a strong, unique value
- Container runs as non-root `node` user for security
