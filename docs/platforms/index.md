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

1. **Local (Node)** — native Node for development and testing
2. **Docker** — runtime-only container for production or isolated environments

See [Deployment](/platforms/deployment) for full setup instructions.

## Operating Systems

- Windows: [Windows (WSL2)](/platforms/windows)
- Linux: [Linux](/platforms/linux)

## Common Links

- Install guide: [Getting Started](/start/getting-started)
- Gateway runbook: [Gateway](/gateway)
- Gateway configuration: [Configuration](/gateway/configuration)
- Service status: `crocbot gateway status`
