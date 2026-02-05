# Task Checklist

**Session ID**: `phase05-session02-tsdown-migration`
**Total Tasks**: 18
**Created**: 2026-02-05

---

## Legend

- `[x]` = Completed
- `[ ]` = Pending
- `[P]` = Parallelizable (can run with other [P] tasks)
- `[S0502]` = Session reference (Phase 05, Session 02)
- `TNNN` = Task ID

---

## Progress Summary

| Category | Total | Done | Remaining |
|----------|-------|------|-----------|
| Setup | 3 | 3 | 0 |
| Foundation | 3 | 3 | 0 |
| Implementation | 6 | 6 | 0 |
| Testing | 6 | 6 | 0 |
| **Total** | **18** | **18** | **0** |

---

## Setup (3 tasks)

Capture baselines and install dependencies.

- [x] T001 [S0502] Record tsc build baseline: time `pnpm build`, capture dist/ directory listing and file sizes for comparison
- [x] T002 [S0502] Install tsdown as devDependency: `pnpm add -D tsdown@^0.20.1` (`package.json`)
- [x] T003 [S0502] Update rolldown from 1.0.0-rc.1 to 1.0.0-rc.2 in devDependencies (`package.json`)

---

## Foundation (3 tasks)

Create tsdown configuration and prepare tsconfig for emit handoff.

- [x] T004 [S0502] Create `tsdown.config.ts` with 3 entry points: index, entry, plugin-sdk (`tsdown.config.ts`)
- [x] T005 [S0502] Add `noEmit: true` to tsconfig.json compilerOptions and remove `noEmitOnError` (`tsconfig.json`)
- [x] T006 [S0502] Verify tsdown config syntax by running `npx tsdown --help` or dry-run to confirm config loads

---

## Implementation (6 tasks)

Swap build command and add convenience scripts.

- [x] T007 [S0502] Replace `tsc -p tsconfig.json` with `tsdown` in the `build` script, preserving all post-build steps (`package.json`)
- [x] T008 [S0502] Add `check` script: `tsc --noEmit && pnpm lint && pnpm format` (`package.json`)
- [x] T009 [S0502] Run `pnpm build` and verify exit code 0 with tsdown producing output
- [x] T010 [S0502] Verify dist/index.js exists, is valid ESM, and preserves `#!/usr/bin/env node` shebang
- [x] T011 [S0502] Verify dist/entry.js exists, is valid ESM, and preserves `#!/usr/bin/env node` shebang
- [x] T012 [S0502] Verify dist/plugin-sdk/index.js exists with corresponding `.d.ts` type declarations

---

## Testing (6 tasks)

Regression testing, manual verification, and quality gates.

- [x] T013 [S0502] Run `pnpm test` and verify all tests pass (baseline: 4051 pass, 2 skip, 0 fail)
- [x] T014 [S0502] Run `pnpm check` and verify type-checking, linting, and formatting all pass
- [x] T015 [S0502] [P] Verify post-build artifacts: canvas assets copied, hook metadata present, build-info.json written
- [x] T016 [S0502] [P] Manual test: run `node dist/entry.js --help` and `node dist/entry.js --version` to verify CLI works
- [x] T017 [S0502] [P] Validate all modified/created files are ASCII-encoded with Unix LF line endings, no `any` types introduced
- [x] T018 [S0502] Record tsdown build time and document comparison vs tsc baseline in implementation-notes.md

---

## Completion Checklist

Before marking session complete:

- [ ] All tasks marked `[x]`
- [ ] All tests passing
- [ ] All files ASCII-encoded
- [ ] implementation-notes.md updated
- [ ] Ready for `/validate`

---

## Notes

### Parallelization
Tasks T015, T016, T017 can be worked on simultaneously after T013 passes.

### Key Reference
- Upstream tsdown.config.ts in `.001_ORIGINAL/tsdown.config.ts` (4 entries; crocbot needs 3 -- drop `extensionAPI.ts`)
- Current build script: `pnpm canvas:a2ui:bundle && tsc -p tsconfig.json && <post-build steps>`
- tsdown replaces only the `tsc -p tsconfig.json` step; all other pipeline steps unchanged

### Dependencies
- T001 must complete first (baseline capture)
- T002-T003 must complete before T004-T006
- T004-T005 must complete before T007
- T007 must complete before T009
- T009 must complete before T010-T018
- T013-T014 must pass before declaring session complete

---

## Next Steps

Run `/implement` to begin AI-led implementation.
