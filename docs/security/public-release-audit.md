# Pre-Public-Release Security Audit

**Date**: 2026-02-08
**Status**: Pending remediation

---

## Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 5 |
| HIGH | 10 |
| MEDIUM | 14 |
| LOW | 6 |

**Git history**: Clean -- no real secrets were ever committed. No `git filter-branch` / BFG cleanup needed.

### What's Already Good

- `.env` is properly gitignored and was never committed
- `detect-secrets` pre-commit hook configured with baseline
- CI runs secret scanning via `detect-secrets`
- Config redaction module (`src/config/redact.ts`) sanitizes output
- Docker Compose uses `${VAR:-}` env var references, no hardcoded secrets
- `SOUL.md`, `USER.md`, `MEMORY.md`, `TOOLS.md` are NOT tracked
- `.001_ORIGINAL/` is properly gitignored
- Dockerfile uses explicit COPY (not `COPY . .`)
- Log redaction implemented and tested

---

## CRITICAL Findings

### C1. Partial ElevenLabs API key in tracked docs

- **File**: `docs/ongoing-projects/active-deploy_session01-14.md:464`
- **Content**: `"apiKey": "sk_89c36ce3..."`
- **Risk**: Even truncated, this narrows brute-force space.
- **Action**: Replace with `"apiKey": "<redacted>"`. Rotate the ElevenLabs key.

### C2. Real phone numbers in tracked docs

- **Files**: `docs/ongoing-projects/active-deploy.md:140`, `docs/ongoing-projects/voice-call-upstream-sync.md:373-374`
- **Content**: `+972525936481` (personal Israeli mobile), `+18164514915` (Twilio from number)
- **Action**: Replace with placeholder E.164 numbers like `+15550001234`.

### C3. Hardcoded personal Telegram user ID in source

- **Files**: `src/gateway/server-close.ts:13`, `src/gateway/server.impl.ts:475`
- **Content**: `const RESTART_NOTIFY_USER_ID = "1415494277";`
- **Risk**: Anyone running the code notifies YOUR Telegram account on restart.
- **Action**: Move to config/env var (e.g. `CROCBOT_ADMIN_USER_ID`).

### C4. Real person name + phone number in test fixtures

- **Files**: `src/auto-reply/reply.raw-body.test.ts:52,157,208`, `src/auto-reply/reply/session.test.ts:117`
- **Content**: `Jake McInteer` + `+6421807830`
- **Risk**: PII combination -- real name linked to real phone number.
- **Action**: Replace with `John Doe` + `+15550001234`.

### C5. Additional real phone number in e2e test

- **File**: `src/gateway/server.agent.gateway-server-agent-a.e2e.test.ts:173`
- **Content**: `+436769770569`
- **Action**: Replace with placeholder number.

---

## HIGH Findings

### H1. `docs/ongoing-projects/` contains extensive PII

- **Files**: 10 tracked files in `docs/ongoing-projects/`
- **Content**: Home directory paths (`/home/aiwithapex/...`), ngrok domain (`krox.ngrok.io`), Telegram bot username (`@KroxTheBot`), Slack workspace IDs (`T07M2GRLGC9`, user `U0AD8P1B63D`), email (`krox@aiwithapex.com`), hostname (`host=krox`), ElevenLabs voice ID, real city name (`Modiin Ilit`).
- **Action**: Either gitignore `docs/ongoing-projects/` or scrub all PII.

### H2. Hardcoded user paths in tracked skills

- **Files**: `skills/self-repair/SKILL.md:17-18,29,62`, `skills/nano-banana-pro/SKILL.md:12,16,21`
- **Content**: `/home/aiwithapex/projects/crocbot`, `/home/aiwithapex/croc`, `/home/aiwithapex/.local/bin/claude`
- **Action**: Replace with relative paths or template variables.

### H3. AGENTS.md instructs agents to read `.env` for credentials

- **File**: `AGENTS.md:10` (symlinked as `CLAUDE.md` and `GEMINI.md`)
- **Content**: "Read `.env` in this repo -- it contains credentials"
- **Action**: Reword to "Copy `.env.example` to `.env` and fill in your own keys."

### H4. `.github/FUNDING.yml` sponsors upstream author

- **File**: `.github/FUNDING.yml:1`
- **Content**: `custom: ['https://github.com/sponsors/steipete']`
- **Action**: Update or remove.

### H5. `.env.example` is incomplete

- **Missing**: `OPENAI_API_KEY`, `BRAVE_API_KEY`, `NGROK_AUTHTOKEN`, `NGROK_DOMAIN`, `GOG_*`
- **Action**: Add all env vars with placeholder values.

### H6. Real Tailscale hostname in test fixtures

- **Files**: `src/commands/gateway-status.test.ts:205,210,227`, `src/infra/ssh-config.test.ts:22,54`, `src/infra/widearea-dns.test.ts:36,41`
- **Content**: `peters-mac-studio-1.sheep-coho.ts.net`
- **Action**: Replace with `my-host.example-tailnet.ts.net`.

### H7. Personal email in security policy

- **File**: `docs/reference/security-policy.md:13`
- **Content**: `steipete@gmail.com`
- **Action**: Use a project-specific email or GitHub security advisories.

### H8. Personal email of contributor

- **File**: `docs/start/index.md:210`
- **Content**: `nacho.iacovino@gmail.com`
- **Action**: Remove; GitHub handle `@nachoiacovino` is sufficient.

### H9. Real ngrok domain in docs

- **Files**: `docs/ongoing-projects/voice-call-upstream-sync.md:376-377`, `docs/ongoing-projects/active-deploy.md:134,137`
- **Content**: `krox.ngrok.io`, webhook URL `https://krox.ngrok.io/voice/webhook`
- **Action**: Replace with `your-domain.ngrok.io`.

### H10. Real Telegram bot username and user ID in docs

- **Files**: `docs/ongoing-projects/active-deploy.md:13`, `docs/ongoing-projects/active-deploy_session01-14.md:108,173,206`
- **Content**: `@KroxTheBot`, `"allowFrom": ["1415494277"]`
- **Action**: Replace with `@YourBotName` and `YOUR_TELEGRAM_USER_ID`.

---

## MEDIUM Findings

### M1. `.gitignore` gaps

- **Missing patterns**: `.env.*` (only `.env` covered), `*.pem`, `*.key`, `*.p12`, `credentials/`, `secrets/`, `*.log`, `.idea/`, `Thumbs.db`
- **Action**: Add missing patterns.

### M2. GitHub App ID from upstream in workflows

- **Files**: `.github/workflows/labeler.yml:18`, `.github/workflows/auto-response.yml:18`
- **Content**: `app-id: "2729701"` (from upstream project)
- **Action**: Update to your own GitHub App or switch to `GITHUB_TOKEN`.

### M3. LICENSE credits only upstream author

- **File**: `LICENSE`
- **Content**: `Copyright (c) 2025 Peter Steinberger`
- **Action**: Add `Copyright (c) 2025-2026 [Your Name]` above the original.

### M4. `.spec_system/` directory tracked (289 files)

- **Risk**: Internal development session state, not useful to external contributors.
- **Action**: Consider adding to `.gitignore`.

### M5. Legacy upstream identifier in source

- **File**: `src/daemon/constants.ts:13`
- **Content**: `com.steipete.crocbot.gateway`
- **Action**: Review if this constant is still needed; update domain if so.

### M6. Invalid security email in docs

- **File**: `docs/gateway/security/index.md:694`
- **Content**: `security@github.com/moshehbenavraham/crocbot` (malformed)
- **Action**: Fix to a real security contact email.

### M7. Upstream test fixture paths and usernames

- **Files**: Multiple test files
- **Content**: `/Users/steipete/.crocbot/`, `/Users/tyleryust/Library/Messages/`, `process.env.USER = "steipete"`, `Peter-Mac-Studio`, `SenderName: "Peter Steinberger"`
- **Action**: Replace with generic test paths/names.

### M8. Real WhatsApp group JID in docs and tests

- **Files**: `docs/concepts/channel-routing.md:60`, `docs/gateway/configuration.md:260`, `src/config/config.broadcast.test.ts:13,32`
- **Content**: `120363403215116621@g.us`
- **Action**: Replace with `123456789@g.us`.

### M9. `crocbot@gmail.com` in docs and tests

- **Files**: `docs/automation/gmail-pubsub.md` (multiple lines), `docs/gateway/configuration.md:2554`, `src/hooks/gmail.test.ts`
- **Risk**: May be a real Gmail address.
- **Action**: Replace with `you@gmail.com` or `example@gmail.com` if not owned.

### M10. Qwen OAuth client ID hardcoded

- **File**: `src/providers/qwen-portal-oauth.ts:6`
- **Content**: `QWEN_OAUTH_CLIENT_ID = "f0304373b74a44d2b584a3fb70ca9e56"`
- **Action**: Consider moving to env var.

### M11. `.env` not in `.dockerignore`

- **File**: `.dockerignore`
- **Risk**: Defense-in-depth; if Dockerfile ever uses `COPY . .`, secrets would leak.
- **Action**: Add `.env` and `.env.*` (except `.env.example`) to `.dockerignore`.

### M12. Deployment hostname in docs

- **File**: `docs/ongoing-projects/agent-system-technical.md:326`
- **Content**: `host=krox`
- **Action**: Replace with `host=example-host`.

### M13. Neon.tech connection string in extension docs

- **File**: `extensions/open-prose/skills/prose/state/postgres.md:198`
- **Content**: `postgresql://user:pass@ep-name.us-east-2.aws.neon.tech/neondb`
- **Action**: Make endpoint more obviously fake: `ep-example-123`.

### M14. Private IP that looks deployment-specific

- **File**: `docs/gateway/remote-gateway-readme.md:40`
- **Content**: `172.27.187.184`
- **Action**: Replace with RFC 5737 TEST-NET address like `192.0.2.1`.

---

## LOW Findings

### L1. `moshehbenavraham` username throughout

Expected -- this is the repo owner's GitHub handle. URLs like `github.com/moshehbenavraham/crocbot` are intentional. **No action needed.**

### L2. Test fixtures with fake secrets

`src/config/redact.test.ts` has `sk-secret-key-123`, `super-secret-password`, etc. Clearly fake. **No action needed.**

### L3. Old Twilio sandbox number in git history

`+17343367101` in a deleted `.env.example`. Low risk (no auth token). **No action needed.**

### L4. ElevenLabs voice IDs in docs

Not secrets (public identifiers). **No action needed.**

### L5. `aiwithapex.mintlify.app` docs URL in README

Reveals docs subdomain. **Informational only.**

### L6. Self-signed test TLS cert+key in test file

- **File**: `src/gateway/client.test.ts:83-129`
- Test-only, localhost, expired 2026-01-21. Scanners will flag it but no real risk. **No action needed.**

---

## Recommended Remediation Order

| # | Action | Files Affected |
|---|--------|----------------|
| 1 | Scrub or gitignore `docs/ongoing-projects/` (covers C1, C2, H1, H9, H10) | 10 files |
| 2 | Replace real names + phones in test fixtures (C4, C5) | 3 test files |
| 3 | Move hardcoded Telegram user ID to config (C3) | 2 source files |
| 4 | Replace hardcoded paths in skills (H2) | 2 skill files |
| 5 | Reword AGENTS.md `.env` instruction (H3) | `AGENTS.md` |
| 6 | Replace Tailscale hostname in tests (H6) | 3 test files |
| 7 | Fix security policy + contributor emails (H7, H8) | 2 doc files |
| 8 | Update `.gitignore` with missing patterns (M1) | `.gitignore` |
| 9 | Update `.env.example` completeness (H5) | `.env.example` |
| 10 | Add `.env` to `.dockerignore` (M11) | `.dockerignore` |
| 11 | Fix FUNDING.yml, LICENSE, workflow app-ids (H4, M2, M3) | 4 files |
| 12 | Replace upstream PII in test fixtures (M7) | Multiple test files |
| 13 | Fix WhatsApp JID, gmail, security email (M8, M9, M6) | Multiple files |
| 14 | Consider gitignoring `.spec_system/` (M4) | `.spec_system/` |
