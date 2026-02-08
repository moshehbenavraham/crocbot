# Security Guide: crocbot VPS Deployment

> **Scope**: Docker-based single-user deployment on a VPS behind a reverse proxy.
> **Last updated**: 2026-02-08

---

## Architecture Overview

```
Internet
   │
   ├── Telegram API ──► webhook (grammy secret token validation)
   │
   └── (no other inbound paths)

VPS
   ├── Reverse proxy (Traefik/Caddy) ─► ports 80/443
   │
   └── Docker
         └── crocbot container
               ├── Gateway bound to 127.0.0.1 (loopback only)
               ├── Non-root user (configurable UID/GID)
               ├── no-new-privileges
               └── Volumes: state/, workspace/ (host-mounted)
```

The only external attack surface is the Telegram webhook. The gateway is never exposed to the internet.

---

## Container Hardening

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
# Protect Docker-published ports from direct external access

# List ALL Docker-published ports on this host (example: 8080 5432 ...)
PROTECTED_PORTS=(  )  # <── fill in your actual ports

iptables -F DOCKER-USER

for port in "${PROTECTED_PORTS[@]}"; do
  # Allow loopback
  iptables -A DOCKER-USER -i lo -p tcp --dport "$port" -j ACCEPT
  # Allow Docker bridge networks (172.16.0.0/12)
  iptables -A DOCKER-USER -s 172.16.0.0/12 -p tcp --dport "$port" -j ACCEPT
  # Drop everything else
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

## Application Security

### Gateway

- **Loopback binding enforced** — refuses to start on `0.0.0.0` without auth token
- **Timing-safe auth comparison** — prevents token extraction via timing attacks
- **Proxy header rejection** — untrusted addresses cannot spoof `X-Forwarded-For`
- **WebSocket origin validation** — `gateway.allowedWsOrigins` config rejects unlisted origins on non-loopback (code 1008)
- **Auth tokens via headers only** — `Authorization: Bearer` and `X-crocbot-Token`; query parameter tokens removed
- **Rate limiting** on HTTP endpoints
- **CORS** — no headers set (secure default deny)
- **Health endpoint** — returns only `{"status":"healthy"}`, no system info leaked

### Telegram

- **Webhook secret token validation** via grammy
- **Bot token redaction** — `redactBotToken()` scrubs tokens from all error output; pattern `/bot[^/]+/` replaced with `/bot<REDACTED>/`
- **Allowlist enforcement** — only authorized users/groups can interact

### Exec & Process Safety

- **Default policy**: `security: "deny"`, `ask: "on-miss"`, `askFallback: "deny"`
- **Process spawning**: `spawn()` with argument arrays (no shell injection possible)
- **SIGKILL timeout** on runaway processes

### SSRF Protections

- Private IP blocking (RFC 1918, link-local, loopback)
- DNS pinning
- Redirect limiting (3 max)
- All outbound fetches routed through `fetchWithSsrfGuard`

### External Content

- 28 suspicious pattern detections active
- `allowUnsafeExternalContent` is never `true` in production

---

## Secrets Management

### `.env` file

- Permissions: `0600` (owner-only read/write)
- Contains: API keys, bot tokens, database credentials
- **Never committed to git** — listed in `.gitignore`

### File permissions

| Path | Permissions | Contents |
|------|-------------|----------|
| `.env` | `0600` | API keys, tokens |
| `state/sessions/` | `0600` per file | Session transcripts (JSONL) |
| `state/credentials/` | `0600` | Device auth, exec approvals |
| `container-ssh/` | `0700` | SSH keys (mounted read-only) |

### Config redaction

Comprehensive pattern matching (40+ secret formats) active in logging. Tokens, API keys, and credentials are redacted from log output.

---

## Data at Rest

### Session transcripts

Session transcripts are stored as plaintext JSONL in `state/sessions/`. File permissions (`0o600`) restrict access to the owner, but disk-level access would expose contents.

**Recommended: Encrypt the state directory with gocryptfs.**

```bash
apt install gocryptfs
gocryptfs -init /encrypted-state              # set passphrase
gocryptfs /encrypted-state /path/to/state     # mount decrypted view
```

Add a systemd unit to auto-mount on boot using a keyfile. The app requires no code changes — it writes plaintext and gocryptfs handles encryption transparently.

Full-disk LUKS is an alternative but requires passphrase entry on every reboot (via Dropbear SSH in initrd), which is impractical for unattended VPS operation.

### Memory

Persistent memory is stored as markdown in `workspace/MEMORY.md` and `workspace/memory/`. A cron-based AI audit periodically scans for prompt injection, role hijacking, encoded payloads, and manipulation attempts. Flagged entries are logged and reported to the admin Telegram chat.

---

## Plugin Security

Plugins execute in the main Node.js process (no OS-level sandbox). The `PluginRuntime` API restricts the exposed surface, and exec approval gates are enforced, but a malicious plugin has full process access.

**Controls in place:**
- API whitelisting via `PluginRuntime` (no direct `process.env`, `fs`, or `child_process`)
- Exec approval gates on shell commands
- `--ignore-scripts` on plugin npm install (blocks malicious postinstall hooks)
- `--no-audit --no-fund` flags
- ClawHub marketplace removed entirely (supply chain vector eliminated)
- `tar` pinned to patched version (7.5.7) via pnpm overrides
- Path traversal protection via `resolveUserPath()` and `safeDirName()`

**Not in place:**
- No V8 isolates or seccomp sandboxing
- No plugin signing or cryptographic verification
- No per-plugin capability restrictions
- No lockfile pinning for plugin dependencies (requires plugin authors to ship lockfiles)

**Recommendation:** Only install plugins you have audited. Document which plugins are in use and their provenance.

---

## Monitoring

- **Health check**: `curl -sf http://localhost:<HOST_PORT>/health`
- **Prometheus metrics**: Available at `/metrics` (loopback only, no auth)
- **Fail2ban**: Monitor SSH brute-force attempts
- **Memory audit cron**: Periodic AI scan of persistent memory for injection attempts
- **Docker logs**: `docker compose logs -f`

---

## Checklist: New Deployment

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

## References

- [Upstream security audit](upstream-security-audit.md)
- [CVE-2026-25253 — 1-Click RCE in OpenClaw](https://socradar.io/blog/cve-2026-25253-rce-openclaw-auth-token/)
- [OWASP — LLM Top 10](https://owasp.org/www-project-top-10-for-large-language-model-applications/)
- [Docker security best practices](https://docs.docker.com/build/building/best-practices/)
