# NEXT_SESSION.md

## Session Recommendation

**Generated**: 2026-01-30
**Project State**: Phase 00 - Strip Moltbot to minimal footprint for VPS/Coolify/Ubuntu deployment
**Completed Sessions**: 3 of 8

---

## Recommended Next Session

**Session ID**: `phase00-session04-simplify-build`
**Session Name**: Simplify Build and CI
**Estimated Duration**: 2-4 hours
**Estimated Tasks**: 15-20

---

## Why This Session Next?

### Prerequisites Met
- [x] Session 01 completed (native apps removed)
- [x] Session 02 completed (extensions removed)
- [x] Session 03 completed (channels removed)
- [x] Build completes successfully (verified in session 03 validation)

### Dependencies
- **Builds on**: Sessions 01-03 (all removal work complete)
- **Enables**: Session 05 (dependency removal) and Session 06 (dead code refactoring)

### Project Progression
Sessions 01-03 removed the bulk of the code (native apps, extensions, non-Telegram channels). The build system and CI pipelines still contain workflows, scripts, and configurations for all that removed code. Session 04 is the logical next step to clean up the build infrastructure before tackling dependency removal and code refactoring.

This follows the PRD implementation order: "Phase 5: Simplify build (depends on 1-3)".

---

## Session Overview

### Objective
Simplify the build system and CI pipelines by removing workflows, scripts, and configurations related to removed native apps, extensions, and channels.

### Key Deliverables
1. CI workflows cleaned up (only CLI/gateway/Telegram workflows remain)
2. `package.json` scripts simplified (remove app-specific scripts)
3. Unused build scripts removed from `scripts/` directory
4. Dockerfile optimized for minimal build
5. Test CI matrix simplified
6. `.github/labeler.yml` updated for remaining code

### Scope Summary
- **In Scope (MVP)**: CI workflow cleanup, package.json script simplification, build script removal, Dockerfile optimization, test matrix simplification, labeler config update
- **Out of Scope**: Dependency changes (Session 05), code refactoring (Session 06), documentation updates (Session 08)

---

## Technical Considerations

### Technologies/Patterns
- GitHub Actions workflow YAML
- pnpm/package.json scripts
- Docker multi-stage builds
- Vitest test configuration

### Potential Challenges
- Identifying all CI jobs that reference removed code
- Ensuring remaining CI jobs still pass after cleanup
- Dockerfile optimization without breaking existing functionality
- Script interdependencies that may not be immediately obvious

### Relevant Considerations
<!-- No active concerns in CONSIDERATIONS.md apply to this session -->
*None currently - CONSIDERATIONS.md has no active concerns recorded yet.*

---

## Alternative Sessions

If this session is blocked:
1. **phase00-session05-remove-dependencies** - Could proceed with dependency removal, though build cleanup is cleaner first
2. **phase00-session08-update-documentation** - Documentation can proceed in parallel if build work is blocked

---

## Next Steps

Run `/sessionspec` to generate the formal specification.
