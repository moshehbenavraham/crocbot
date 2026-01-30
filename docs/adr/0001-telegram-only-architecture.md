# 1. Telegram-Only Architecture

**Status:** Accepted
**Date:** 2026-01-30

## Context

The original codebase supported multiple messaging channels (Discord, Slack, Signal, iMessage, WhatsApp, Line) and native apps (macOS, iOS, Android). This created unnecessary complexity for a focused VPS deployment scenario.

The project was restructured to focus exclusively on Telegram as the messaging channel, with a lean CLI + Gateway architecture.

## Decision

Strip the codebase to:
- CLI interface for configuration and management
- Gateway server for always-on operation
- Telegram channel only (via grammY)
- Docker-first deployment

All other channels, native apps, and associated code were removed.

## Consequences

### Enables
- Significantly reduced codebase (~60-70% reduction)
- Smaller Docker images (688MB vs 2.6GB)
- Faster builds and tests
- Simpler maintenance
- Focused feature development

### Trade-offs
- No support for Discord, Slack, Signal, iMessage, WhatsApp, or Line
- No native macOS, iOS, or Android apps
- Users requiring other channels must use alternative solutions
