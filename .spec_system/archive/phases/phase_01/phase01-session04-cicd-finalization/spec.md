# Session Specification

**Session ID**: `phase01-session04-cicd-finalization`
**Phase**: 01 - Production Hardening and Deployment
**Status**: Not Started
**Created**: 2026-01-30

---

## 1. Session Overview

This session finalizes the CI/CD pipelines for the lean Telegram-only crocbot codebase. After completing the Phase 00 stripping (native apps, extensions, channels) and Phase 01 hardening (technical debt cleanup, Docker optimization, gateway hardening), the CI/CD infrastructure still references removed components and includes configurations for platforms that no longer exist.

The primary goal is to audit and clean up all GitHub Actions workflows, remove obsolete Dependabot configurations (Swift/Gradle for deleted native apps), verify security scanning operates correctly on the reduced codebase, and ensure the Docker release pipeline functions with the optimized single-platform focus. This bridges development-ready code with production deployment readiness.

Completing this session ensures the CI/CD system is efficient, accurate, and maintainable for the Telegram-only architecture, eliminating confusion from legacy configurations and reducing CI run times.

---

## 2. Objectives

1. Remove Dependabot configurations for deleted platforms (Swift/macOS, Gradle/Android, Swabble)
2. Verify all GitHub Actions workflows pass without errors or warnings
3. Confirm security scanning (CodeQL, npm-audit, dependency-review) works correctly
4. Validate Docker release workflow builds and pushes multi-arch images successfully
5. Update labeler.yml if any patterns reference removed paths

---

## 3. Prerequisites

### Required Sessions
- [x] `phase01-session01-clean-technical-debt` - TTS stubs and technical debt removed
- [x] `phase01-session02-docker-optimization` - Docker build optimized for production
- [x] `phase01-session03-gateway-hardening` - Gateway hardened for production

### Required Tools/Knowledge
- GitHub Actions workflow syntax and best practices
- Dependabot configuration options
- Docker multi-stage builds and GitHub Container Registry
- CodeQL security scanning

### Environment Requirements
- GitHub repository access for workflow testing
- Ability to view workflow run results
- Docker registry (ghcr.io) push permissions for release testing

---

## 4. Scope

### In Scope (MVP)
- Audit and clean `.github/dependabot.yml` (remove Swift, Gradle ecosystems)
- Review `.github/workflows/ci.yml` for removed feature references
- Review `.github/workflows/security.yml` for accuracy
- Review `.github/workflows/docker-release.yml` for production readiness
- Review `.github/workflows/install-smoke.yml` for current codebase
- Review `.github/labeler.yml` for obsolete path patterns
- Verify workflow-sanity.yml, labeler.yml, auto-response.yml are appropriate
- Run local verification of lint/build/test to confirm CI expectations
- Document any manual deployment steps discovered

### Out of Scope (Deferred)
- Gateway application code changes - *Reason: Session 03 complete; no gateway changes needed*
- Kubernetes/Helm deployment - *Reason: Future phase if needed; current focus is Docker/VPS*
- Multiple environment configurations (staging/prod) - *Reason: Single deployment target for now*
- CI performance optimization beyond removing dead code - *Reason: Focus on correctness first*

---

## 5. Technical Approach

### Architecture
The CI/CD system uses GitHub Actions with the following workflow structure:
- **ci.yml**: Primary quality gate (lint, test, build, format, protocol check) on multiple platforms (Ubuntu, Windows, macOS)
- **security.yml**: Security scanning (CodeQL, dependency-review, npm-audit) on schedule and PRs
- **docker-release.yml**: Multi-arch Docker image builds (amd64/arm64) on push to main and tags
- **install-smoke.yml**: Installation verification tests
- **Supporting workflows**: labeler.yml, auto-response.yml, workflow-sanity.yml

### Design Patterns
- **Matrix strategy**: Parallel job execution for different runtimes (node, bun) and platforms
- **Retry logic**: Robust handling of transient failures (submodule checkout, corepack)
- **Native runners**: Platform-specific runners (blacksmith for Ubuntu/Windows, macos-latest)
- **GitHub Container Registry**: Multi-arch manifest creation for Docker images

### Technology Stack
- GitHub Actions (workflows, runners, caching)
- Docker Buildx with GHA cache
- pnpm 10.23.0 via corepack
- Node.js 22.x / Bun (latest)
- CodeQL, dependency-review-action, detect-secrets

---

## 6. Deliverables

### Files to Create
| File | Purpose | Est. Lines |
|------|---------|------------|
| (none) | All changes are modifications to existing files | - |

### Files to Modify
| File | Changes | Est. Lines Changed |
|------|---------|------------|
| `.github/dependabot.yml` | Remove Swift (3 ecosystems) and Gradle ecosystem configs | ~-60 |
| `.github/labeler.yml` | Remove any obsolete path patterns if found | ~0-5 |
| `.github/workflows/ci.yml` | Review and verify; likely no changes needed | ~0 |
| `.github/workflows/security.yml` | Review and verify; likely no changes needed | ~0 |
| `.github/workflows/docker-release.yml` | Review and verify; likely no changes needed | ~0 |
| `.github/workflows/install-smoke.yml` | Review and verify; likely no changes needed | ~0 |

---

## 7. Success Criteria

### Functional Requirements
- [ ] Dependabot only monitors npm and github-actions ecosystems
- [ ] All workflows pass when triggered (push to branch, PR)
- [ ] No references to removed platforms (iOS, Android, macOS, extensions) in workflow files
- [ ] Docker images build successfully for both amd64 and arm64
- [ ] Security scans complete without blocking issues

### Testing Requirements
- [ ] Local lint/build/test passes before committing changes
- [ ] Push changes and verify CI workflow runs successfully
- [ ] Verify Dependabot PR creation for npm dependencies (if any updates available)

### Quality Gates
- [ ] All files ASCII-encoded
- [ ] Unix LF line endings
- [ ] YAML syntax valid (no tabs in workflow files)
- [ ] Code follows project conventions

---

## 8. Implementation Notes

### Key Considerations
- Dependabot currently monitors 5 directories: root npm, github-actions, apps/macos, apps/shared/CrocbotKit, Swabble (Swift), and apps/android (Gradle)
- The Swift and Gradle directories no longer exist after Phase 00 session 01 (native app removal)
- Labeler.yml only references current paths (telegram, gateway, cli, etc.) - appears clean
- CI workflows use Blacksmith runners for faster builds

### Potential Challenges
- **Workflow run validation**: Cannot fully test workflow changes without pushing to GitHub; local YAML validation helps but is not comprehensive
- **Dependabot ecosystem removal**: Removing ecosystems that target deleted directories should be safe; Dependabot would error anyway

### Relevant Considerations
- [P00] **Internal docs reference removed features**: Workflow documentation may reference removed platforms; defer doc updates to Session 05
- [P00] **Scope discipline**: Focus on CI/CD only; any discovered gateway or code issues logged but not fixed in this session
- [P00] **Conservative dependency removal**: Apply same principle to Dependabot configs - remove one ecosystem at a time and verify

### ASCII Reminder
All output files must use ASCII-only characters (0-127).

---

## 9. Testing Strategy

### Unit Tests
- Not applicable; workflow files are not unit tested

### Integration Tests
- Push changes to a branch and observe GitHub Actions workflow runs
- Verify all jobs in ci.yml matrix pass
- Verify security.yml jobs complete

### Manual Testing
- Review Dependabot "Insights" page after changes to confirm ecosystem list
- Verify Docker release workflow succeeds on push to main (post-merge)
- Check GitHub Container Registry for new images

### Edge Cases
- Dependabot PR creation for actions updates (should still work after ecosystem removal)
- Matrix job failure isolation (one runtime/platform failure should not block others)

---

## 10. Dependencies

### External Libraries
- actions/checkout@v4
- actions/setup-node@v4
- oven-sh/setup-bun@v2
- docker/setup-buildx-action@v3
- docker/login-action@v3
- docker/metadata-action@v5
- docker/build-push-action@v6
- github/codeql-action@v3
- actions/dependency-review-action@v4

### Other Sessions
- **Depends on**: phase01-session03-gateway-hardening (gateway production-ready)
- **Depended by**: phase01-session05-internal-docs-cleanup (needs verified CI before final cleanup)

---

## Next Steps

Run `/tasks` to generate the implementation task checklist.
