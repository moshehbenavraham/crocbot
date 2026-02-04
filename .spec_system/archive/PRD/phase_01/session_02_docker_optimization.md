# Session 02: Docker Optimization

**Session ID**: `phase01-session02-docker-optimization`
**Status**: Not Started
**Estimated Tasks**: ~15-20
**Estimated Duration**: 2-4 hours

---

## Objective

Optimize the Docker image for production deployment, ensuring minimal size, fast startup, and proper configuration for VPS/Coolify/Ubuntu hosting environments.

---

## Scope

### In Scope (MVP)
- Review and optimize Dockerfile for lean build
- Verify multi-stage build removes dev dependencies
- Test Docker image size is under 300MB target
- Verify health endpoint works in containerized environment
- Test docker-compose.yml configuration
- Verify environment variable handling for secrets
- Test container startup time (target: under 10 seconds)
- Verify graceful shutdown handling
- Test container restart behavior
- Document any Docker-specific configuration requirements

### Out of Scope
- Gateway application hardening (Session 03)
- CI/CD Docker build pipeline (Session 04)
- Kubernetes/Helm configurations (future phase if needed)

---

## Prerequisites

- [ ] Session 01 complete (technical debt cleaned)
- [ ] Docker environment available
- [ ] Target VPS specifications known

---

## Deliverables

1. Optimized Dockerfile with minimal image size
2. Verified docker-compose.yml for local development
3. Documented environment variable requirements
4. Tested health check configuration
5. Verified startup and shutdown behavior

---

## Success Criteria

- [ ] Docker image size under 300MB
- [ ] Container starts in under 10 seconds
- [ ] Health endpoint responds correctly
- [ ] Graceful shutdown works
- [ ] No secrets in image
- [ ] `docker build` completes successfully
- [ ] `docker-compose up` works for local testing
- [ ] Gateway connects to Telegram from container
