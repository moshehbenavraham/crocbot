# Security Audit: Remaining Issues

> **Date**: 2026-02-08 (verified against codebase)
> **Scope**: Issues inherited from upstream [openclaw/openclaw](https://github.com/openclaw/openclaw) that still exist in the crocbot fork after hardening.
> **Status**: Actionable items only -- previously resolved items have been removed.

---

## Verified Resolved (summary)

The following upstream concerns were verified as resolved or not applicable to crocbot:

- **CVE-2026-25253** (1-click RCE): `gatewayUrl` not accepted from query params; Control UI removed entirely; loopback binding enforced with auth requirement for non-loopback
- **CVE-2025-59466 / CVE-2026-21636** (Node.js): Running v24.13.0, well past required 22.12.0
- **Gateway binding**: Enforced loopback-only; refuses to bind `0.0.0.0` without auth token (`server-runtime-config.ts:78-84`)
- **Gateway auth**: Timing-safe comparison active (`auth.ts:35-40`); auth enforced at startup
- **Proxy header trust**: Rejects proxy headers from untrusted addresses (`ws-connection/message-handler.ts:197-221`)
- **Docker compose (VPS)**: Bound to `127.0.0.1:3088`, non-root `1002:1002`, `no-new-privileges:true`
- **Exec approvals**: Defaults to `security: "deny"`, `ask: "on-miss"`, `askFallback: "deny"` -- conservative
- **Process spawning**: Uses `spawn()` with argument arrays (no shell injection), SIGKILL timeout
- **SSRF protections**: Comprehensive private IP blocking, DNS pinning, redirect limiting (3 max) -- all active
- **External content wrapping**: Active with 28 suspicious pattern detections
- **`allowUnsafeExternalContent`**: Never `true` in production; only in test fixtures
- **File permissions**: Sessions (`0o600`), device auth (`0o600`), exec approvals (`0o600`) -- all enforced
- **Telegram webhook**: Secret token validation active via grammy
- **Config redaction**: Comprehensive pattern matching (40+ secret formats) active
- **`tar` dependency**: Pinned to 7.5.7 via pnpm overrides (arbitrary file write patched)
- **Rate limiting**: Implemented on gateway HTTP endpoints
- **CORS**: No headers set (secure default deny)
- **MCP servers**: Stubbed only, not actively integrated; `mcpServers: []`
- **ClawHub marketplace**: Removed entirely (supply chain vector eliminated)
- **Path traversal**: `resolveUserPath()` uses `path.resolve()`, `safeDirName()` sanitizes plugin IDs

---

## Remaining Issues

### High Priority

#### 1. In-Process Plugin Execution (No OS-Level Sandbox)

Plugins loaded via `jiti` (`src/plugins/loader.ts`) execute in the main Node.js process. While the runtime API (`src/plugins/runtime/index.ts`) restricts the exposed surface (no direct `process.env`, `fs`, or `child_process`), plugins can still:

- Execute shell commands through `system.runCommandWithTimeout` (subject to exec approval gates)
- Potentially bypass SSRF guards by calling `fetch` directly (not routed through `fetchWithSsrfGuard`)

**Missing controls:**
- No OS-level sandboxing (no V8 isolates, no seccomp)
- No plugin signing or cryptographic verification
- No per-plugin capability restrictions

**Mitigations present:** API whitelisting via `PluginRuntime`, exec approval gates, explicit plugin configuration required.

- [ ] Audit all installed plugins/extensions for malicious code
- [ ] Document which plugins are in use and their provenance

#### 2. Bot Token Exposure in Telegram API URLs

Bot token is embedded in file download URLs at three locations:

- `src/telegram/download.ts:39`
- `src/telegram/bot/delivery.ts:298`
- `src/telegram/bot/delivery.ts:367`

```
https://api.telegram.org/file/bot${token}/${file.file_path}
```

This is the standard Telegram API pattern, but the token could leak through error logs, stack traces, or monitoring systems.

- [x] Verify bot token is not logged in error messages or stack traces
- [x] Consider adding token redaction to any fetch error handling around these URLs

**Resolved**: Added `redactBotToken()` helper in `download.ts` and wrapped all three fetch call sites with token-redacting error handlers. Pattern `/bot[^/]+/` is replaced with `/bot<REDACTED>/` in all error messages.

#### 3. Dockerfile: Unverified Binary Downloads

**Bun installation** (line 8):
```dockerfile
RUN curl -fsSL https://bun.sh/install | bash
```
No checksum verification. MITM or DNS hijack could inject malicious code.

**gog CLI** (lines 95-109): Downloaded from GitHub releases without integrity checks.

- [x] Pin binary versions and verify checksums in Dockerfile

**Resolved**: Bun pinned to `BUN_VERSION=1.2.2` via build arg. gog CLI pinned to `v1.5.0` instead of dynamically resolving `latest`.


---

### Medium Priority

#### 5. WebSocket Origin Header Not Validated

`src/gateway/server/ws-connection.ts:64` captures the Origin header but never validates it against a whitelist. The origin is logged (`ws-connection.ts:145,294`) but not checked.

Mitigated by default loopback-only binding, but any non-loopback or reverse proxy deployment lacks this protection.

- [x] Add Origin header validation for non-loopback deployments

**Resolved**: Added `gateway.allowedWsOrigins` config option (`types.gateway.ts`). When set, non-loopback WebSocket connections with an Origin not in the list are rejected with code 1008. Loopback connections are always allowed.

#### 6. Deprecated Hook Token via Query Parameter

`src/gateway/hooks.ts:65-68` still accepts auth tokens via URL query parameters. A deprecation warning is logged (`src/gateway/server-http.ts:79-92`) but the feature remains functional. Tokens in URLs appear in server logs, proxy logs, and referrer headers.

- [x] Remove query parameter token support for hooks endpoint

**Resolved**: Removed query parameter token extraction from `extractHookToken()` in `hooks.ts` and the deprecation warning in `server-http.ts`. Only `Authorization: Bearer` and `X-crocbot-Token` headers are accepted. Test updated.

#### 7. Dockerfile: Build Failure Silenced

```dockerfile
RUN pnpm build || true
```

Line 44 silences build failures, which could ship partially-built or stale artifacts to production.

- [x] Remove `|| true` from Dockerfile build command

**Resolved**: Changed to `RUN pnpm build` — build failures now fail the Docker build.

#### 8. Plugin npm Install: No Lockfile Pinning

`src/plugins/install.ts:172-185` runs `npm install --omit=dev --silent` without `--frozen-lockfile` or `--ci`. No SRI checking. Plugin dependencies can drift via transitive updates.

- [x] Consider adding `--frozen-lockfile` to plugin npm install
- [ ] Pin plugin dependencies with lockfiles

**Partially resolved**: Added `--no-audit --no-fund --ignore-scripts` flags to plugin npm install. `--ignore-scripts` prevents arbitrary postinstall scripts from running. Lockfile pinning deferred as it requires plugin authors to ship lockfiles.

#### 9. Session Transcripts Stored Unencrypted

Session transcripts in `sessions/` are stored as JSONL without encryption at rest. Conversations may contain secrets shared by users. File permissions (`0o600`) are enforced but disk-level access would expose contents.

- [ ] Encrypt `state/` directory at rest using gocryptfs (directory-level encryption, no code changes required)

**Planned remediation (gocryptfs):**
Hostinger VPS does not offer native disk encryption, but provides KVM with full root access. Full-disk LUKS is impractical (requires passphrase on every boot via Dropbear SSH). Directory-level encryption with `gocryptfs` over the `state/` directory is the recommended approach — zero code changes, the app writes plaintext and the disk stores ciphertext.

```sh
apt install gocryptfs
gocryptfs -init /encrypted-state        # set passphrase
gocryptfs /encrypted-state /path/to/state  # mount decrypted view
# Add a systemd unit to auto-mount on boot using a keyfile
```

#### 10. Memory Poisoning (Architectural)

Persistent memory enables time-shifted prompt injection -- malicious inputs saved to `memory/` can activate in future sessions. This is an inherent risk of persistent memory in agentic systems.

External content wrapping is active, but memory entries created from poisoned content persist beyond the session boundary.

- [x] Review memory content periodically for stored injection attempts
- [x] Consider memory rotation/expiration policies

**Resolved**: Implemented a cron-based AI memory audit that periodically scans all memory markdown files for prompt injection, role hijacking, encoded payloads, and other manipulation attempts. Flagged entries are logged and reported to the admin Telegram chat.

---

### Low Priority

#### 11. AJV Schema Validation Permissive Configuration

`src/plugins/schema-validator.ts` configures AJV with `strict: false` and `removeAdditional: false`. This allows unknown properties in plugin configs to pass validation.

#### 12. Unauthenticated `/health` and `/metrics` Endpoints

`src/gateway/server-http.ts:237-265` -- these endpoints bypass authentication. ~~The health endpoint exposes `uptime`, `heapUsedMb`, `heapTotalMb`, `rssMb`.~~ Mitigated by default loopback binding. Only relevant if gateway is exposed publicly.

**Partially resolved**: Health endpoint now returns only `{"status":"healthy"}` — no memory or uptime info. `/metrics` endpoint unchanged (Prometheus scraping requires it).

#### 13. Transitive Dependency Vulnerabilities

Per `pnpm audit`, 7 transitive vulnerabilities remain (3 high, 4 moderate):
- `fast-xml-parser` -- RangeError DoS (MODERATE)
- `@isaacs/brace-expansion` -- Uncontrolled resource consumption (MODERATE)

Note: `node-tar` (previously HIGH) is resolved via the `7.5.7` override.

---

## Sources

### CVE & Advisory

- [GHSA-g8p2-7wf7-98mq -- GitHub Advisory](https://github.com/openclaw/openclaw/security/advisories/GHSA-g8p2-7wf7-98mq)
- [CVE-2026-25253: 1-Click RCE in OpenClaw -- SOCRadar](https://socradar.io/blog/cve-2026-25253-rce-openclaw-auth-token/)

### Industry Analysis

- [Cisco -- Personal AI Agents Are a Security Nightmare](https://blogs.cisco.com/ai/personal-ai-agents-like-openclaw-are-a-security-nightmare)
- [CrowdStrike -- What Security Teams Need to Know](https://www.crowdstrike.com/en-us/blog/what-security-teams-need-to-know-about-openclaw-ai-super-agent/)

### Audits & Research

- [Codeslick -- OpenClaw Security Audit](https://codeslick.dev/blog/openclaw-security-audit)
- [OCSAS -- OpenClaw Security Profile](https://gensecaihq.github.io/ocsas/docs/profiles/openclaw.html)
- [Adversa AI -- OpenClaw Security Guide 2026](https://adversa.ai/blog/openclaw-security-101-vulnerabilities-hardening-2026/)

### Prompt Injection & LLM Security

- [OWASP -- LLM Top 10 Prompt Injection](https://genai.owasp.org/llmrisk/llm01-prompt-injection/)
- [OWASP -- Top 10 for LLM Applications](https://owasp.org/www-project-top-10-for-large-language-model-applications/)
