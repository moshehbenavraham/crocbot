---
summary: "Platform support overview (Gateway)"
read_when:
  - Looking for OS support or install paths
  - Deciding where to run the Gateway
---
# Platforms

crocbot core is written in TypeScript. **Node is the recommended runtime**.
Bun is not recommended for the Gateway.

## Deployment Paths

crocbot supports two deployment paths:

1. **Local (Docker Compose)** - For development and testing
2. **Coolify (VPS)** - For production deployment

See [Deployment](/deployment) for full setup instructions.

## Operating Systems

- Windows: [Windows (WSL2)](/platforms/windows)
- Linux: [Linux](/platforms/linux)
- Raspberry Pi: [Raspberry Pi](/platforms/raspberry-pi)

## Common Links

- Install guide: [Getting Started](/start/getting-started)
- Gateway runbook: [Gateway](/gateway)
- Gateway configuration: [Configuration](/gateway/configuration)
- Service status: `crocbot gateway status`

## Gateway Service Install (CLI)

Use one of these (all supported):

- Wizard (recommended): `crocbot onboard --install-daemon`
- Direct: `crocbot gateway install`
- Configure flow: `crocbot configure` -> select **Gateway service**
- Repair/migrate: `crocbot doctor` (offers to install or fix the service)

The service target depends on OS:
- Linux/WSL2: systemd user service (`crocbot-gateway[-<profile>].service`)
