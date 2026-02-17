---
title: Security Reference
summary: Deployment hardening, formal verification, and upstream audit details.
permalink: /security/reference/
---

# Security Reference

> For the security policy, vulnerability reporting, and security model overview, see [SECURITY.md](/SECURITY.md) in the project root.

This document contains operational details that supplement the root security policy: deployment hardening procedures, formal verification reproduction instructions, and the upstream audit trail.

---

## Deployment Hardening (Docker)

### docker-compose.yml

```yaml
services:
  crocbot:
    image: crocbot:vps-prod
    user: "<UID>:<GID>"                   # non-root, match host UID/GID
    security_opt:
      - no-new-privileges:true           # prevent privilege escalation
    ports:
      - "127.0.0.1:<HOST_PORT>:8080"   # loopback only — never 0.0.0.0
    init: true                           # zombie process reaping
    deploy:
      resources:
        limits:
          memory: 2G                     # prevent OOM from taking down the host
        reservations:
          memory: 512M
    volumes:
      - ./state:/data
      - ./workspace:/data/workspace
      - ./container-ssh:/home/node/.ssh:ro  # read-only SSH keys
    env_file:
      - .env
    environment:
      NODE_ENV: production
      NODE_OPTIONS: "--max-old-space-size=1536"
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-sf", "http://localhost:8080/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 30s
```

Key points:
- **Never bind to `0.0.0.0`** — the gateway enforces loopback-only and refuses to start without auth on non-loopback
- **Non-root user** — the container runs as a dedicated UID, not root
- **Read-only mounts** where possible (SSH keys use `:ro`)
- **Memory limits** prevent a runaway process from killing the host

### Dockerfile

The multi-stage build enforces:
- `--frozen-lockfile` on dependency install (no drift from lockfile)
- Dev dependencies pruned in a separate stage
- Pinned binary versions (Bun, gog CLI) — no `latest` tags
- `USER node` in the runtime stage
- Build failures are not silenced (`pnpm build`, not `pnpm build || true`)

---

## Network Security

### Firewall (UFW + iptables)

Required rules:
- **SSH (22)**: Open, but password auth disabled (pubkey only)
- **HTTP/HTTPS (80/443)**: Restrict to your reverse proxy or CDN IP ranges (e.g., Cloudflare)
- **All other ports**: Deny by default

### Docker port protection

Docker bypasses UFW by default via the `DOCKER-USER` iptables chain. Any service bound to `0.0.0.0` inside Docker is reachable from the internet regardless of UFW rules.

**Protect Docker-published ports** by adding `DOCKER-USER` rules:

```bash
#!/bin/bash
# /usr/local/bin/docker-user-rules.sh

PROTECTED_PORTS=(  )  # <── fill in your actual ports

iptables -F DOCKER-USER

for port in "${PROTECTED_PORTS[@]}"; do
  iptables -A DOCKER-USER -i lo -p tcp --dport "$port" -j ACCEPT
  iptables -A DOCKER-USER -s 172.16.0.0/12 -p tcp --dport "$port" -j ACCEPT
  iptables -A DOCKER-USER -p tcp --dport "$port" -j DROP
done

iptables -A DOCKER-USER -j RETURN
```

Persist with a systemd service:

```ini
# /etc/systemd/system/docker-user-rules.service
[Unit]
Description=Apply DOCKER-USER iptables rules
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
ExecStart=/usr/local/bin/docker-user-rules.sh
RemainAfterExit=yes

[Install]
WantedBy=multi-user.target
```

```bash
sudo chmod +x /usr/local/bin/docker-user-rules.sh
sudo systemctl enable --now docker-user-rules.service
```

### SSH hardening

In `/etc/ssh/sshd_config`:
```
PasswordAuthentication no
PermitRootLogin no
PubkeyAuthentication yes
```

Install fail2ban for brute-force protection:
```bash
apt install fail2ban
systemctl enable fail2ban
```

---

## Data at Rest Encryption

Session transcripts are stored as plaintext JSONL in `state/sessions/`. File permissions (`0o600`) restrict access, but disk-level access would expose contents.

**Recommended: Encrypt the state directory with gocryptfs.**

```bash
apt install gocryptfs
gocryptfs -init /encrypted-state              # set passphrase
gocryptfs /encrypted-state /path/to/state     # mount decrypted view
```

Add a systemd unit to auto-mount on boot using a keyfile. The app requires no code changes — it writes plaintext and gocryptfs handles encryption transparently.

Full-disk LUKS is an alternative but requires passphrase entry on every reboot (via Dropbear SSH in initrd), which is impractical for unattended VPS operation.

---

## Monitoring

- **Health check**: `curl -sf http://localhost:<HOST_PORT>/health`
- **Prometheus metrics**: Available at `/metrics` (loopback only, no auth)
- **Fail2ban**: Monitor SSH brute-force attempts
- **Memory audit cron**: Periodic AI scan of persistent memory for injection attempts
- **Docker logs**: `docker compose logs -f`

---

## Deployment Checklist

1. [ ] SSH: Disable password auth, disable root login, enable pubkey only
2. [ ] Install and enable fail2ban
3. [ ] Configure UFW: allow 22, restrict 80/443 to CDN IPs, deny all else
4. [ ] Add `DOCKER-USER` iptables rules for any Docker-published ports
5. [ ] Persist iptables rules via systemd service
6. [ ] Set `.env` permissions to `0600`
7. [ ] Set `state/` and `workspace/` ownership to match container UID/GID
8. [ ] Set `container-ssh/` permissions to `0700`
9. [ ] Build image: `docker build -t crocbot:vps-prod source/`
10. [ ] Verify `docker-compose.yml` binds to `127.0.0.1`, not `0.0.0.0`
11. [ ] Start: `docker compose up -d`
12. [ ] Verify health: `curl -sf http://localhost:<HOST_PORT>/health`
13. [ ] Verify Telegram webhook is receiving messages
14. [ ] (Optional) Set up gocryptfs for state directory encryption
15. [ ] (Optional) Set up reverse proxy (Caddy/Traefik) for HTTPS termination

---

## Formal Verification

Machine-checked TLA+/TLC security models provide an executable, attacker-driven regression suite for the highest-risk paths.

**Important caveats:**
- These are **models**, not the full TypeScript implementation. Drift between model and code is possible.
- Results are bounded by the state space explored by TLC; "green" does not imply security beyond the modeled assumptions and bounds.
- Some claims rely on explicit environmental assumptions (e.g., correct deployment, correct configuration inputs).

### Reproducing Results

```bash
git clone https://github.com/vignesh07/crocbot-formal-models
cd crocbot-formal-models

# Java 11+ required (TLC runs on the JVM).
# The repo vendors a pinned tla2tools.jar and provides bin/tlc + Make targets.

make <target>
```

### Gateway Exposure and Open Gateway Misconfiguration

**Claim:** Binding beyond loopback without auth can make remote compromise possible; token/password blocks unauth attackers (per the model assumptions).

- Green runs: `make gateway-exposure-v2`, `make gateway-exposure-v2-protected`
- Red (expected): `make gateway-exposure-v2-negative`

### Nodes.run Pipeline (Highest-Risk Capability)

**Claim:** `nodes.run` requires (a) node command allowlist plus declared commands and (b) live approval when configured; approvals are tokenized to prevent replay (in the model).

- Green runs: `make nodes-pipeline`, `make approvals-token`
- Red (expected): `make nodes-pipeline-negative`, `make approvals-token-negative`

### Ingress Gating (Mentions + Control-Command Bypass)

**Claim:** In group contexts requiring mention, an unauthorized "control command" cannot bypass mention gating.

- Green: `make ingress-gating`
- Red (expected): `make ingress-gating-negative`

### Routing/Session-Key Isolation

**Claim:** DMs from distinct peers do not collapse into the same session unless explicitly linked/configured.

- Green: `make routing-isolation`
- Red (expected): `make routing-isolation-negative`

### Roadmap

Next models to deepen fidelity:
- Provider-specific ingress preflight modeling
- Routing identity-links + dmScope variants + binding precedence
- Gateway auth conformance (proxy/tailscale specifics)

---

## Upstream Audit Trail

> **Scope**: Issues inherited from [openclaw/openclaw](https://github.com/openclaw/openclaw) that were tracked and remediated in the crocbot fork.
> **Last updated**: 2026-02-08

### Resolved Issues

| Issue | Priority | Resolution |
|-------|----------|------------|
| CVE-2026-25253 (1-Click RCE) | Critical | `gatewayUrl` not accepted from query params; Control UI removed; loopback enforced |
| CVE-2025-59466 / CVE-2026-21636 (Node.js) | Critical | Running v24.13.0, past required v22.12.0 |
| Bot token in Telegram API URLs | High | Added `redactBotToken()` in `src/telegram/download.ts`; wrapped all 3 fetch sites |
| Dockerfile: unverified binary downloads | High | Bun pinned to `BUN_VERSION=1.2.2`; gog CLI pinned to `v1.5.0` |
| Dockerfile: build failure silenced | Medium | Changed `pnpm build \|\| true` to `pnpm build` |
| WebSocket origin not validated | Medium | Added `gateway.allowedWsOrigins` config; non-loopback rejects unlisted origins (code 1008) |
| Hook token via query parameter | Medium | Removed query param extraction; only `Authorization: Bearer` and `X-crocbot-Token` accepted |
| Plugin npm install: no safety flags | Medium | Added `--no-audit --no-fund --ignore-scripts` flags |
| Health endpoint info leakage | Low | Returns only `{"status":"healthy"}`; no memory or uptime info |
| `tar` dependency vulnerability | Low | Pinned to 7.5.7 via pnpm overrides |
| `node-tar` arbitrary file write | Low | Resolved via 7.5.7 override |

### Remaining Open Items

| Issue | Priority | Status |
|-------|----------|--------|
| In-process plugin execution (no OS sandbox) | High | Mitigated by API whitelisting + exec gates; no V8 isolates planned |
| Session transcripts unencrypted at rest | Medium | gocryptfs recommended; see [Data at Rest Encryption](#data-at-rest-encryption) |
| Plugin dependency lockfile pinning | Medium | Deferred; requires plugin authors to ship lockfiles |
| AJV schema validation permissive (`strict: false`) | Low | Allows unknown properties in plugin configs |
| Unauthenticated `/metrics` endpoint | Low | Required for Prometheus scraping; mitigated by loopback binding |

---

## External References

### CVE and Advisory

- [GHSA-g8p2-7wf7-98mq — GitHub Advisory](https://github.com/openclaw/openclaw/security/advisories/GHSA-g8p2-7wf7-98mq)
- [CVE-2026-25253: 1-Click RCE in OpenClaw — SOCRadar](https://socradar.io/blog/cve-2026-25253-rce-openclaw-auth-token/)

### Industry Analysis

- [Cisco — Personal AI Agents Are a Security Nightmare](https://blogs.cisco.com/ai/personal-ai-agents-like-openclaw-are-a-security-nightmare)
- [CrowdStrike — What Security Teams Need to Know](https://www.crowdstrike.com/en-us/blog/what-security-teams-need-to-know-about-openclaw-ai-super-agent/)

### Audits and Research

- [Codeslick — OpenClaw Security Audit](https://codeslick.dev/blog/openclaw-security-audit)
- [OCSAS — OpenClaw Security Profile](https://gensecaihq.github.io/ocsas/docs/profiles/openclaw.html)
- [Adversa AI — OpenClaw Security Guide 2026](https://adversa.ai/blog/openclaw-security-101-vulnerabilities-hardening-2026/)

### Prompt Injection and LLM Security

- [OWASP — LLM Top 10 Prompt Injection](https://genai.owasp.org/llmrisk/llm01-prompt-injection/)
- [OWASP — Top 10 for LLM Applications](https://owasp.org/www-project-top-10-for-large-language-model-applications/)
