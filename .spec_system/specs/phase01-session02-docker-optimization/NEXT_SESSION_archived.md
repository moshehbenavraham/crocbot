# NEXT_SESSION.md

## Session Recommendation

**Generated**: 2026-01-30
**Project State**: Phase 01 - Production Hardening and Deployment
**Completed Sessions**: 9 (8 in Phase 00, 1 in Phase 01)

---

## Recommended Next Session

**Session ID**: `phase01-session02-docker-optimization`
**Session Name**: Docker Optimization
**Estimated Duration**: 2-4 hours
**Estimated Tasks**: 15-20

---

## Why This Session Next?

### Prerequisites Met
- [x] Session 01 complete (technical debt cleaned) - TTS stubs removed, BlueBubbles provider removed, WhatsApp types consolidated
- [x] Phase 00 complete (codebase stripped to Telegram-only)
- [x] Docker environment available (existing Dockerfile and docker-compose.yml)

### Dependencies
- **Builds on**: `phase01-session01-clean-technical-debt` - clean codebase ready for optimization
- **Enables**: `phase01-session03-gateway-hardening` - production-ready container for hardening work

### Project Progression
Docker optimization is the logical next step because:
1. Technical debt has been cleaned, providing a stable base for optimization
2. The Dockerfile needs optimization now that 60%+ of source code was removed in Phase 00
3. Container size and startup time directly impact deployment efficiency on VPS/Coolify
4. This work blocks gateway hardening (Session 03) which depends on containerized testing

---

## Session Overview

### Objective
Optimize the Docker image for production deployment, ensuring minimal size, fast startup, and proper configuration for VPS/Coolify/Ubuntu hosting environments.

### Key Deliverables
1. Optimized Dockerfile with minimal image size (target: under 300MB)
2. Verified docker-compose.yml for local development
3. Documented environment variable requirements
4. Tested health check configuration
5. Verified startup (under 10 seconds) and graceful shutdown behavior

### Scope Summary
- **In Scope (MVP)**: Dockerfile optimization, multi-stage build verification, image size testing, health endpoint, docker-compose config, env var handling, startup/shutdown tests, restart behavior
- **Out of Scope**: Gateway application hardening (Session 03), CI/CD Docker build pipeline (Session 04), Kubernetes/Helm configurations

---

## Technical Considerations

### Technologies/Patterns
- Docker multi-stage builds
- Node.js 22+ Alpine base images
- pnpm for production dependencies
- Health endpoint integration

### Potential Challenges
- Balancing image size with build speed
- Ensuring all production dependencies included after aggressive cleanup
- Health endpoint configuration in containerized environment
- Graceful shutdown signal handling (SIGTERM)

### Relevant Considerations
- [P00] **Stub files for disabled features**: TTS/pairing stubs remain but should not impact Docker image. Verify stubs don't pull unnecessary dependencies.
- [P00] **Conservative dependency removal**: Phase 00 lesson - verify build after each change. Apply same discipline to Docker layer optimization.
- [P00] **pnpm patches require exact versions**: Ensure patched dependencies work correctly in container context.

---

## Alternative Sessions

If this session is blocked:
1. **phase01-session03-gateway-hardening** - Can start if Docker is acceptable as-is, but not recommended (container optimization informs hardening)
2. **phase01-session05-internal-docs-cleanup** - Independent work that can run in parallel, but lower priority than production infrastructure

---

## Next Steps

Run `/sessionspec` to generate the formal specification.
