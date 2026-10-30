# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Security

- undici 7.30.0 → 7.30.1 on the direct/cheerio path (GHSA-xjj6-f33q-929c, GHSA-4w7w-5xrc-9h26, GHSA-2m5v-pch6-74hx, GHSA-qrxm-fqhp-jwvm).
- Cache-trace redaction is broader: credential-like header-name substrings (auth, token, secret, pass, key, jwt, hmac, sig, cookie, session, credential, ...), any `Bearer` value, Basic credentials (first token with `:`, decoding to `user:pass`, or 8+ chars), `token=` params, Digest/AWS SigV4/HOBA/ApiKey/Key/SSWS schemes, and scheme-less `sk-…`, JWT, Stripe, GitHub, Slack, AWS access key id and Google API key shapes are redacted. It prefers over-redaction (trace only).

### Added

- **Security hardening (Phase 06)**: Ported three upstream security measures -- SSRF guards with DNS pinning on all outbound fetch sites (webhook alerts, skill downloads, media fetches), Telegram download timeouts with AbortSignal enforcement (30s metadata, 60s downloads), and path traversal validation via assertMediaPath on all media storage operations. Integration test suite validates private IP blocking (RFC 1918, link-local, loopback, IPv6-mapped), redirect chain SSRF prevention, protocol validation, null byte safety, and Unicode path edge cases. Security bypass audit completed with no critical findings.

### Changed

- **Upgrade note: Node >=22.19.0 required**: the runtime guard now matches `engines.node` (`>=22.19.0`, needed by `@earendil-works/pi-*` 0.79.10 and undici 8.12.2). On Node 22.0–22.18 crocbot now exits with code 1 and prints "crocbot requires Node >=22.19.0." (the previous guard accepted any Node >=22.0.0). Upgrade Node before updating; the daemon's system-Node check uses the same floor.
- **Build tooling migration (Phase 05)**: Replaced tsc production builds with tsdown bundler powered by rolldown. Three entry points (index, CLI entry, plugin-sdk) now produce optimized flat output in dist/ with ~5s total build time. Unified tsconfig.json targets ES2023 with NodeNext module resolution and noEmit-only type checking. Stricter oxlint rules enabled (134 rules, type-aware) with oxfmt replacing Prettier for formatting. Zero `any` types remain in source. CI workflows, Docker multi-stage builds, and plugin-sdk .d.ts generation validated end-to-end.

## [2026.1.63] - 2026-02-05

### Fixed

- **Grammy timeout recovery**: Added `.error` property traversal in `collectErrorCandidates()` for Grammy HttpError, "timed out" message pattern to recoverable snippets, and scoped unhandled rejection handler in Telegram monitor. Prevents bot crashes from network timeouts.
- **Session transcript repair**: Ported JSONL file repair, tool call sanitization (missing input fields), and guarded append for crash-resilient session files. Prevents API rejections from malformed transcripts.

## [2026.1.57] - 2026-02-05

### Added

- **Telegram model buttons**: Interactive inline keyboard for browsing AI providers and selecting models via `/model` and `/models` commands. Supports pagination, provider grouping, and works in DM, group, and forum topic contexts.

## [2026.1.56] - 2026-02-04

### Changed

- Restart awareness for SIGTERM handling
- Version bump and documentation fixes

## [2026.1.55] - 2026-02-04

### Added

- Config redaction for sensitive values
- Self-repair skill for automatic recovery
- Restart awareness improvements

### Fixed

- Miscellaneous bug fixes

## [2026.1.46] - 2026-02-04

### Added

- Operational runbooks for incident response, backup/restore, and troubleshooting
- Health check documentation
- Log analysis guides

## [2026.1.45] - 2026-02-03

### Added

- Structured logging with tslog
- Metrics and monitoring infrastructure
- Error reporting and alerting system

## [2026.1.40] - 2026-02-02

### Changed

- Docker optimization with multi-stage builds
- Gateway hardening improvements
- CI/CD finalization

## [2026.1.30] - 2026-02-01

### Changed

- Technical debt cleanup
- Internal documentation updates

## [2026.1.20] - 2026-01-30

### Changed

- Simplified build process
- Removed unused dependencies
- Refactored dead code

## [2026.1.10] - 2026-01-28

### Removed

- Native app support (macOS, Windows, Linux desktop)
- Additional channel providers (Discord, Slack, etc.)
- Mobile code and extensions

### Changed

- Telegram-only architecture (see ADR-0001)
