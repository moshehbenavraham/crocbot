# NEXT_SESSION.md

## Session Recommendation

**Generated**: 2026-01-30
**Project State**: Phase 00 - Strip Moltbot to minimal footprint for VPS/Coolify/Ubuntu deployment
**Completed Sessions**: 4

---

## Recommended Next Session

**Session ID**: `phase00-session05-remove-dependencies`
**Session Name**: Remove Unused Dependencies
**Estimated Duration**: 2-3 hours
**Estimated Tasks**: 12-18

---

## Why This Session Next?

### Prerequisites Met
- [x] Session 01 completed (native apps removed)
- [x] Session 02 completed (extensions removed)
- [x] Session 03 completed (non-Telegram channels removed)
- [x] Session 04 completed (build system simplified)
- [x] `pnpm build` completes successfully
- [x] Full test suite passes

### Dependencies
- **Builds on**: Session 04 (build simplification) - code that used these deps is now removed
- **Enables**: Session 06 (refactor dead code) - clean dependency tree makes refactoring safer

### Project Progression
Session 05 is the logical next step because:
1. All code that consumed the target dependencies has been removed in sessions 01-04
2. Dependency removal is lower risk than code refactoring (session 06)
3. Smaller `node_modules` will speed up subsequent development iterations
4. Clean dependency tree provides clear picture for dead code analysis in session 06
5. Docker image size reduction begins with dependency pruning

---

## Session Overview

### Objective
Remove all npm dependencies that were only used by removed native apps, extensions, and channels, reducing the final Docker image size and install time.

### Key Deliverables
1. `package.json` cleaned of removed channel/app dependencies
2. `pnpm-lock.yaml` regenerated with pruned dependencies
3. Build and runtime verification passed
4. Measurable reduction in `node_modules` size

### Scope Summary
- **In Scope (MVP)**: Discord deps (`@buape/carbon`, `discord-api-types`), Slack deps (`@slack/bolt`, `@slack/web-api`), WhatsApp deps (`@whiskeysockets/baileys`, `qrcode-terminal`), Line deps (`@line/bot-sdk`), Mobile deps (`@homebridge/ciao`, `node-edge-tts`), lockfile regeneration
- **Out of Scope**: Code refactoring (Session 06), Telegram dependencies (keep grammy ecosystem), Core CLI dependencies, Build tool dependencies

---

## Technical Considerations

### Technologies/Patterns
- pnpm package management
- Dependency tree analysis
- Lockfile regeneration

### Potential Challenges
- Hidden transitive dependencies that may still be needed
- Runtime-only imports not caught by static analysis
- pnpm patch dependencies requiring exact versions

### Relevant Considerations
No active concerns from CONSIDERATIONS.md apply to this session.

---

## Alternative Sessions

If this session is blocked:
1. **phase00-session06-refactor-dead-code** - If dependency removal causes unexpected issues, could proceed with code cleanup first (though less ideal)
2. **phase00-session08-update-documentation** - Documentation can be updated in parallel if dependency work is blocked

---

## Next Steps

Run `/sessionspec` to generate the formal specification.
