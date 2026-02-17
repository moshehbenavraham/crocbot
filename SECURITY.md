# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 0.1.x (latest) | Yes |
| < 0.1.x | No |

Only the latest release on the `main` branch receives security fixes. There are no LTS branches.

## Reporting a Vulnerability

**Do not open a public issue for security vulnerabilities.**

To report a vulnerability, use one of the following channels:

1. **GitHub Security Advisories** (preferred): [Report a vulnerability](https://github.com/moshehbenavraham/crocbot/security/advisories/new)
2. **Email**: moshehwebservices@live.com

Please include:

- Description of the vulnerability
- Steps to reproduce
- Affected version(s)
- Impact assessment (what an attacker could achieve)
- Any suggested fix (optional)

### Response Timeline

| Stage | Target |
|-------|--------|
| Acknowledgment | 48 hours |
| Initial triage | 5 business days |
| Fix for critical/high | 14 days |
| Fix for medium/low | 30 days |

You will receive updates as the issue is investigated. If accepted, you will be credited in the release notes (unless you prefer to remain anonymous).

## Upstream Lineage

crocbot is a fork of [openclaw/openclaw](https://github.com/openclaw/openclaw). Upstream CVEs and advisories are tracked and remediated independently. See the [Upstream Audit Trail](docs/security/security-reference.md#upstream-audit-trail) for the full audit.

### Resolved Upstream CVEs

- **CVE-2026-25253** (1-Click RCE in OpenClaw): `gatewayUrl` not accepted from query params; Control UI removed entirely; loopback binding enforced with auth requirement for non-loopback.
- **CVE-2025-59466 / CVE-2026-21636** (Node.js vulnerabilities): Running Node v24.13.0, well past the required v22.12.0.

## Security Model

### Architecture

```
Internet
   |
   +-- Telegram API --> webhook (grammy secret token validation)
   |
   +-- (no other inbound paths)

Host
   +-- Reverse proxy (Traefik/Caddy) --> ports 80/443
   |
   +-- Docker (or local Node)
         +-- crocbot
               +-- Gateway bound to 127.0.0.1 (loopback only)
               +-- Non-root user (configurable UID/GID)
               +-- no-new-privileges
               +-- Volumes: state/, workspace/ (host-mounted)
```

The only external attack surface is the Telegram webhook. The gateway is never exposed to the internet.

### Gateway Security

- **Loopback binding enforced** — refuses to start on `0.0.0.0` without an auth token
- **Timing-safe auth comparison** — prevents token extraction via timing attacks
- **Proxy header rejection** — untrusted addresses cannot spoof `X-Forwarded-For`
- **WebSocket origin validation** — `gateway.allowedWsOrigins` config rejects unlisted origins on non-loopback (code 1008)
- **Auth tokens via headers only** — `Authorization: Bearer` and `X-crocbot-Token`; query parameter tokens removed
- **Rate limiting** on HTTP endpoints
- **CORS** — no headers set (secure default deny)
- **Health endpoint** — returns only `{"status":"healthy"}`, no system info leaked

### Telegram Security

- **Webhook secret token validation** via grammy
- **Bot token redaction** — `redactBotToken()` scrubs tokens from all error output
- **Allowlist enforcement** — only authorized users/groups can interact

### Exec and Process Safety

- **Default policy**: `security: "deny"`, `ask: "on-miss"`, `askFallback: "deny"`
- **Process spawning**: `spawn()` with argument arrays (no shell injection)
- **SIGKILL timeout** on runaway processes

### SSRF Protections

- Private IP blocking (RFC 1918, link-local, loopback)
- DNS pinning
- Redirect limiting (3 max)
- All outbound fetches routed through `fetchWithSsrfGuard`

### Secrets Management

- `.env` file with `0600` permissions — never committed to git
- Session transcripts: `0600` per file
- Device credentials: `0600`
- SSH keys: `0700`, mounted read-only in Docker
- Config redaction: 40+ secret format patterns active in logging

## Known Security Considerations

### Plugin Execution (No OS-Level Sandbox)

Plugins execute in the main Node.js process. The `PluginRuntime` API restricts the exposed surface, and exec approval gates are enforced, but a malicious plugin has full process access.

**Controls in place:**
- API whitelisting via `PluginRuntime` (no direct `process.env`, `fs`, or `child_process`)
- Exec approval gates on shell commands
- `--ignore-scripts` on plugin npm install (blocks malicious postinstall hooks)
- ClawHub marketplace removed entirely (supply chain vector eliminated)
- Path traversal protection via `resolveUserPath()` and `safeDirName()`

**Not in place:**
- No V8 isolates or seccomp sandboxing
- No plugin signing or cryptographic verification
- No per-plugin capability restrictions

**Recommendation:** Only install plugins you have audited.

### Session Transcripts (Unencrypted at Rest)

Session transcripts are stored as plaintext JSONL. File permissions (`0o600`) restrict access, but disk-level access would expose contents. Directory-level encryption with [gocryptfs](https://nuetzlich.net/gocryptfs/) over the `state/` directory is recommended for production deployments.

### Memory Poisoning (Architectural)

Persistent memory enables time-shifted prompt injection. A cron-based AI audit periodically scans memory files for injection attempts and reports flagged entries to the admin.

## Dependency Security

Dependencies are monitored via:
- **GitHub Dependabot** — automated alerts for known vulnerabilities
- **GitHub CodeQL** — static analysis for code-level security issues
- **pnpm audit** — run as part of the development workflow

Pinned overrides for known-vulnerable transitive dependencies are maintained in `package.json` under `pnpm.overrides`.

## Formal Verification

Machine-checked security models (TLA+/TLC) cover the highest-risk paths:

- **Gateway exposure** — binding beyond loopback without auth increases exposure; token/password blocks unauth attackers
- **Nodes.run pipeline** — requires node command allowlist plus live approval; approvals are tokenized to prevent replay
- **Ingress gating** — unauthorized control commands cannot bypass mention gating in group contexts
- **Routing/session-key isolation** — DMs from distinct peers do not collapse into the same session

Models are maintained at [vignesh07/crocbot-formal-models](https://github.com/vignesh07/crocbot-formal-models). See the [Formal Verification](docs/security/security-reference.md#formal-verification) section for reproduction instructions.

## Container Hardening (Docker Deployments)

The recommended `docker-compose.yml` configuration enforces:

- Non-root user (`user: "<UID>:<GID>"`)
- `no-new-privileges:true`
- Loopback-only port binding (`127.0.0.1:<PORT>:8080`)
- `init: true` for zombie process reaping
- Memory limits (2G cap, 512M reservation)
- Read-only mounts for SSH keys
- Health checks every 30s

See the [Security Reference](docs/security/security-reference.md) for the full deployment hardening guide including firewall rules, Docker iptables protection, and SSH hardening.

## References

- [Security Reference](docs/security/security-reference.md) — deployment hardening, formal verification details, upstream audit trail
- [CVE-2026-25253 — 1-Click RCE in OpenClaw](https://socradar.io/blog/cve-2026-25253-rce-openclaw-auth-token/)
- [OWASP — LLM Top 10](https://owasp.org/www-project-top-10-for-large-language-model-applications/)
- [OCSAS — OpenClaw Security Profile](https://gensecaihq.github.io/ocsas/docs/profiles/openclaw.html)
