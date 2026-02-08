---
summary: "Running crocbot on a VPS with Docker"
read_when:
  - You want to run the Gateway in the cloud
  - You need guidance on VPS deployment
---
# VPS Hosting (Docker)

This guide covers running crocbot on a VPS using Docker.

## How it works

- The **Gateway runs on the VPS** inside a Docker container and owns state + workspace.
- You connect from your laptop/phone via the **Control UI** or **Tailscale/SSH**.
- Treat the VPS as the source of truth and **back up** the state + workspace.
- Secure default: keep the Gateway on loopback and access it via SSH tunnel or Tailscale Serve.
  If you bind to `lan`/`tailnet`, require `gateway.auth.token` or `gateway.auth.password`.

## Setup

1. **Provision a VPS** with any cloud provider (Hetzner, DigitalOcean, AWS, GCP, etc.)
2. **Install Docker** on the VPS
3. **Clone the repo** and build:

```bash
git clone https://github.com/moshehbenavraham/crocbot.git
cd crocbot
pnpm install
pnpm build
docker build -t crocbot:local .
```

4. **Configure environment** — create a `.env` file with your API keys and tokens
5. **Start the gateway**:

```bash
docker compose up -d crocbot-gateway
```

## Remote access

The Gateway runs on the VPS and handles all Telegram traffic. Access the Gateway
remotely via Tailscale Serve/Funnel or SSH tunnel.

Docs: [Remote access](/gateway/remote), [Tailscale](/gateway/tailscale)

## Resource requirements

| Resource | Minimum | Recommended |
|----------|---------|-------------|
| Memory | 512MB | 2GB |
| Storage | 1GB | 5GB+ |
| CPU | 1 vCPU | 2 vCPU |

## Backups

See [Backup & Restore](/runbooks/backup-restore) for backup procedures.

Remote access: [Gateway remote](/gateway/remote)
Platforms hub: [Platforms](/platforms)
