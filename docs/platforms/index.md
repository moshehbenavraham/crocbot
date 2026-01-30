---
summary: "Platform support overview (Gateway)"
read_when:
  - Looking for OS support or install paths
  - Deciding where to run the Gateway
---
# Platforms

crocbot core is written in TypeScript. **Node is the recommended runtime**.
Bun is not recommended for the Gateway.

## Choose your OS

- Windows: [Windows (WSL2)](/platforms/windows)
- Linux: [Linux](/platforms/linux)

## VPS & hosting

- VPS hub: [VPS hosting](/vps)
- Fly.io: [Fly.io](/platforms/fly)
- Hetzner (Docker): [Hetzner](/platforms/hetzner)
- GCP (Compute Engine): [GCP](/platforms/gcp)
- exe.dev (VM + HTTPS proxy): [exe.dev](/platforms/exe-dev)

## Common links

- Install guide: [Getting Started](/start/getting-started)
- Gateway runbook: [Gateway](/gateway)
- Gateway configuration: [Configuration](/gateway/configuration)
- Service status: `crocbot gateway status`

## Gateway service install (CLI)

Use one of these (all supported):

- Wizard (recommended): `crocbot onboard --install-daemon`
- Direct: `crocbot gateway install`
- Configure flow: `crocbot configure` -> select **Gateway service**
- Repair/migrate: `crocbot doctor` (offers to install or fix the service)

The service target depends on OS:
- Linux/WSL2: systemd user service (`crocbot-gateway[-<profile>].service`)
