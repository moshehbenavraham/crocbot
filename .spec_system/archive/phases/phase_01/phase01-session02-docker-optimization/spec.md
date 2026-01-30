# Session Specification

**Session ID**: `phase01-session02-docker-optimization`
**Phase**: 01 - Production Hardening and Deployment
**Status**: Not Started
**Created**: 2026-01-30

---

## 1. Session Overview

This session optimizes the Docker image for production deployment on VPS/Coolify/Ubuntu hosting environments. Following the aggressive codebase reduction in Phase 00 (60%+ source code removed), the current Dockerfile no longer reflects the lean, Telegram-only footprint. The image likely contains unnecessary build artifacts and dependencies.

The optimization focuses on implementing a proper multi-stage build that separates build-time dependencies from the runtime image, reducing image size to under 300MB, and ensuring fast startup times (under 10 seconds). This work is foundational for Session 03 (Gateway Hardening) which requires a stable, production-ready container for testing.

The deliverables include an optimized Dockerfile with multi-stage builds, verified docker-compose configuration, documented environment requirements, and tested health/lifecycle behavior.

---

## 2. Objectives

1. Reduce Docker image size to under 300MB through multi-stage build optimization
2. Achieve container startup time under 10 seconds with verified health endpoint
3. Ensure graceful shutdown handling (SIGTERM) and proper restart behavior
4. Validate docker-compose.yml works for local development and production-like testing

---

## 3. Prerequisites

### Required Sessions
- [x] `phase01-session01-clean-technical-debt` - provides clean codebase with TTS stubs removed
- [x] `phase00-session05-remove-dependencies` - provides reduced dependency footprint

### Required Tools/Knowledge
- Docker and docker-compose installed locally
- Understanding of Node.js production deployment patterns
- Familiarity with multi-stage Docker builds

### Environment Requirements
- Docker Engine 20.10+ (for multi-stage build support)
- Sufficient disk space for build testing (~2GB for layer caching)
- Network access for base image pulls

---

## 4. Scope

### In Scope (MVP)
- Implement multi-stage Dockerfile (builder stage + runtime stage)
- Switch runtime base from `node:22-bookworm` to `node:22-slim` or Alpine
- Remove Bun installation from runtime image (build-only dependency)
- Prune dev dependencies and build artifacts from final image
- Verify health endpoint (`/health`) responds correctly in container
- Test startup time measurement and optimization
- Verify graceful SIGTERM shutdown handling
- Test container restart behavior with docker-compose
- Document required environment variables
- Verify no secrets baked into image layers

### Out of Scope (Deferred)
- Gateway application hardening - *Reason: Session 03 scope*
- CI/CD Docker build pipeline - *Reason: Session 04 scope*
- Kubernetes/Helm configurations - *Reason: VPS/Coolify target, not k8s*
- ARM64/multi-arch builds - *Reason: Focus on x86_64 for VPS deployment*

---

## 5. Technical Approach

### Architecture
The Dockerfile will use a two-stage build pattern:

1. **Builder Stage** (`node:22-bookworm`): Install all dependencies including devDependencies, run TypeScript compilation, build UI assets. This stage has Bun, pnpm, and full toolchain.

2. **Runtime Stage** (`node:22-slim`): Copy only `dist/`, `node_modules/` (production only), `package.json`, and UI build output. No compilers, no Bun, no dev tooling.

### Design Patterns
- **Multi-stage builds**: Separate build environment from runtime for minimal image
- **Layer caching**: Order COPY commands from least to most frequently changing
- **Non-root user**: Continue using `node` user for security hardening
- **Health checks**: Native Docker HEALTHCHECK instruction

### Technology Stack
- Base image: `node:22-slim` (Debian-based, smaller than bookworm)
- Package manager: pnpm for production install (`--prod`)
- Entry point: `node dist/index.js`
- Health endpoint: HTTP GET `/health` on port 18789

---

## 6. Deliverables

### Files to Create
| File | Purpose | Est. Lines |
|------|---------|------------|
| `docs/docker-env-vars.md` | Document required environment variables | ~50 |

### Files to Modify
| File | Changes | Est. Lines Changed |
|------|---------|------------|
| `Dockerfile` | Implement multi-stage build, switch to slim base | ~40 |
| `docker-compose.yml` | Add HEALTHCHECK, verify volume mounts | ~10 |
| `.dockerignore` | Ensure dev artifacts excluded | ~5 |

---

## 7. Success Criteria

### Functional Requirements
- [ ] `docker build -t crocbot:test .` completes successfully
- [ ] `docker images crocbot:test` shows size under 300MB
- [ ] Container starts and reaches healthy state in under 10 seconds
- [ ] `curl http://localhost:18789/health` returns `{"status":"healthy",...}`
- [ ] `docker stop` triggers graceful shutdown (SIGTERM handled)
- [ ] `docker-compose up -d` works with proper volume mounts
- [ ] No secrets or API keys baked into image layers

### Testing Requirements
- [ ] Manual build and size verification
- [ ] Manual startup time measurement (`docker run` to health response)
- [ ] Manual shutdown test (graceful termination)
- [ ] docker-compose integration test

### Quality Gates
- [ ] All files ASCII-encoded
- [ ] Unix LF line endings
- [ ] Dockerfile follows best practices (hadolint clean)
- [ ] No unnecessary files in final image layer

---

## 8. Implementation Notes

### Key Considerations
- The current Dockerfile installs Bun for build scripts, but Bun should not be in the runtime image
- UI build currently uses `pnpm ui:install && pnpm ui:build` which may need adjustment
- The `CROCBOT_A2UI_SKIP_MISSING=1` flag suggests optional A2UI bundling
- Current base `node:22-bookworm` is ~400MB; `node:22-slim` is ~70MB

### Potential Challenges
- **UI assets location**: Ensure UI build output is correctly copied to runtime stage
- **pnpm patches**: Patched dependencies must work correctly after production install
- **Signal handling**: Node.js requires `--init` or tini for proper PID 1 signal handling (docker-compose already has `init: true`)
- **Layer ordering**: Balance cache efficiency with logical grouping

### Relevant Considerations
- [P00] **pnpm patches require exact versions**: Verify patched dependencies work in production container context after `pnpm install --prod`
- [P00] **Conservative dependency removal**: Build and test after each Dockerfile change to catch issues early
- [P00] **Stub files for disabled features**: TTS/pairing stubs should not pull additional dependencies into container

### ASCII Reminder
All output files must use ASCII-only characters (0-127).

---

## 9. Testing Strategy

### Unit Tests
- N/A (infrastructure changes, not code changes)

### Integration Tests
- Docker build completes without errors
- Container starts with expected environment variables
- Health endpoint responds to HTTP requests

### Manual Testing
1. Build image: `docker build -t crocbot:test .`
2. Check size: `docker images crocbot:test --format "{{.Size}}"`
3. Run container: `docker run -d --name crocbot-test -p 18789:18789 crocbot:test gateway --bind loopback --port 18789`
4. Wait for health: `until curl -sf http://localhost:18789/health; do sleep 1; done`
5. Measure startup: Time from `docker run` to successful health check
6. Test shutdown: `docker stop crocbot-test` and verify clean exit
7. Test compose: `docker-compose up -d` with valid env vars

### Edge Cases
- Container behavior when required env vars missing
- Restart loop prevention (restart policy behavior)
- Health check during startup grace period

---

## 10. Dependencies

### External Libraries
- `node:22-slim`: Docker base image
- pnpm: Package manager (build stage only, runtime uses npm for production install)

### Other Sessions
- **Depends on**: `phase01-session01-clean-technical-debt` (clean codebase)
- **Depended by**: `phase01-session03-gateway-hardening` (production container), `phase01-session04-ci-cd-docker-pipeline` (build automation)

---

## Next Steps

Run `/tasks` to generate the implementation task checklist.
