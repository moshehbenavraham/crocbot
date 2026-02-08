# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Security hardening (Phase 06)**: Ported three upstream security measures -- SSRF guards with DNS pinning on all outbound fetch sites (webhook alerts, skill downloads, media fetches), Telegram download timeouts with AbortSignal enforcement (30s metadata, 60s downloads), and path traversal validation via assertMediaPath on all media storage operations. Integration test suite validates private IP blocking (RFC 1918, link-local, loopback, IPv6-mapped), redirect chain SSRF prevention, protocol validation, null byte safety, and Unicode path edge cases. Security bypass audit completed with no critical findings.

### Changed

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
