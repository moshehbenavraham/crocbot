---
summary: "Security reporting and operational hardening guidance"
read_when:
  - Reporting a security issue
  - Reviewing security requirements and hardening guidance
---
# Security Policy

If you believe you've found a security issue in crocbot, please report it privately.

## Reporting

- Use [GitHub Security Advisories](https://github.com/moshehbenavraham/crocbot/security/advisories/new) to report privately.
- What to include: reproduction steps, impact assessment, and (if possible) a minimal PoC.

## Operational Guidance

For threat model + hardening guidance (including `crocbot security audit --deep` and `--fix`), see:

- `https://aiwithapex.mintlify.app/gateway/security`

### Web Interface Safety

crocbot's web interface is intended for local use only. Do **not** bind it to the public internet; it is not hardened for public exposure.

## Runtime Requirements

### Node.js Version

crocbot requires **Node.js 22.12.0 or later** (LTS). This version includes important security patches:

- CVE-2025-59466: async_hooks DoS vulnerability
- CVE-2026-21636: Permission model bypass vulnerability

Verify your Node.js version:

```bash
node --version  # Should be v22.12.0 or later
```

### Docker Security

When running crocbot in Docker:

1. The official image runs as a non-root user (`node`) for reduced attack surface
2. Use `--read-only` flag when possible for additional filesystem protection
3. Limit container capabilities with `--cap-drop=ALL`

Example secure Docker run:

```bash
docker run --read-only --cap-drop=ALL \
  -v crocbot-data:/app/data \
  crocbot/crocbot:latest
```

## Security Scanning

This project uses `detect-secrets` for automated secret detection in CI/CD.
See `.detect-secrets.cfg` for configuration and `.secrets.baseline` for the baseline.

Run locally:

```bash
pip install detect-secrets==1.5.0
detect-secrets scan --baseline .secrets.baseline
```
