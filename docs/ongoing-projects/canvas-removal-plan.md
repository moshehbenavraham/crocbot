# Canvas System Removal Plan

Remove the Canvas host, A2UI renderer, canvas agent tool, canvas CLI commands, and all gateway canvas wiring. The canvas system is a macOS/iOS/Android native-app feature (WKWebView panel) with zero value for crocbot's Telegram + CLI deployment.

**Note:** `@napi-rs/canvas` (optional dep for PDF image extraction in `src/media/input-files.ts`) is **unrelated** to the canvas host system and must NOT be removed. Likewise, `src/types/pdfjs-dist-legacy.d.ts` references `canvas` as a PDF.js render target — also unrelated and must be kept. `skills/obsidian/SKILL.md` mentions Obsidian's `.canvas` file format — also unrelated.

---

## Session Progress

### Session 1 (completed Phases 1-6b, partial Phase 7)

**Completed:** Phases 1, 2, 3, 4, 5, 6, 6b, and Phase 7 partial (deletions + package.json + ci.yml + test-env.ts)

### Session 2 (completed Phase 7 remainder, Phase 8)

**Completed:** Phase 7 (all CROCBOT_SKIP_CANVAS_HOST env var removals) and Phase 8 (all documentation updates).

### Session 3 (completed Phase 9 verification + lint fix)

**Completed:** Phase 9 build/lint/test verification. Found and fixed 2 leftover unused variables (`port`, `gatewayHost`) in ws-connection chain that were only used for canvas URL resolution.

**Phase 7 findings:**
- `gateway-cli-backend.live.test.ts` was already clean (Session 1's killed agent completed its work)
- `gateway.e2e.test.ts` had partial edits: save+set removed but restore at line 268 remained — fixed
- `gateway-models.profiles.live.test.ts` still had all 3 references (save/set/restore) — fixed
- All other files (7 test files + 1 shell script) cleaned of skipCanvas/CROCBOT_SKIP_CANVAS_HOST

**Phase 8 findings:**
- All 24 doc files cleaned (every file listed in the plan)
- `active-deploy_session01-14.md` left as archival record (only historical mentions)
- `active-deploy.md` canvas TODO marked `[x]` (completed) — word "canvas" remains in the completed checklist item

**Verification passed:**
- `grep -ri "CROCBOT_SKIP_CANVAS_HOST" *.{ts,sh,yml}` — zero matches
- `grep -r "canvas-host|canvasHost" src/` — zero matches
- `grep -ri "a2ui" src/` — zero matches
- `grep -ri "canvas" src/` — only @napi-rs/canvas (media/input-files.ts, types/napi-rs-canvas.d.ts), PDF.js canvas (types/pdfjs-dist-legacy.d.ts), and types/README_types.md (about @napi-rs/canvas)
- `grep -ri "canvas" skills/` — only Obsidian `.canvas` file format
- `grep -ri "canvas" docs/` — only this plan file, active-deploy.md (completed TODO), active-deploy_session01-14.md (archival)

**Remaining:** Phase 9 (verify builds/tests, clean dist, delete this plan file)

---

## Phase 1: Remove agent tool, skill, and agent-level references — DONE

- [x] Delete `src/agents/tools/canvas-tool.ts`
- [x] Remove `createCanvasTool` import and call from `src/agents/crocbot-tools.ts` (line 7 import, line 77 call)
- [x] Remove canvas mock from `src/agents/test-helpers/fast-core-tools.ts` (lines 14-16)
- [x] Delete `src/agents/pi-embedded-subscribe.subscribe-embedded-pi-session.includes-canvas-action-metadata-tool-summaries.test.ts` (or remove canvas references if test covers other tools too)
- [x] Delete `skills/canvas/SKILL.md`
- [x] Remove canvas from `src/agents/system-prompt.ts`:
  - Line 216: `canvas: "Present/eval/snapshot the Canvas"` from tool descriptions
  - Line 244: `"canvas"` from `toolOrder` array
  - Line 369: `"- canvas: present/eval/snapshot the Canvas"` from help text
- [x] Remove canvas from `src/agents/tool-policy.ts`:
  - Line 30: `"canvas"` from `"group:ui"` array
  - Line 40: `"canvas"` from `"group:crocbot"` array
- [x] Remove `"canvas"` from `DEFAULT_TOOL_DENY` in `src/agents/sandbox/constants.ts` (line 33)
- [x] Remove canvas capability filter from `src/agents/tools/nodes-utils.ts` — `pickDefaultNode` filters by `n.caps.includes("canvas")` (lines 89-90); replace with a non-canvas capability or remove the filter
- [x] Remove `"canvas"` entry from `src/agents/tool-display.json` (lines 108-120: emoji, title, and all canvas actions)
- [x] Remove `"canvas"` from tool name arrays in `src/agents/pi-tools.create-clawdbot-coding-tools.adds-claude-style-aliases-schemas-without-dropping-b.test.ts` (line 10)
- [x] Remove `"canvas"` from tool set in `src/agents/pi-tools.create-clawdbot-coding-tools.adds-claude-style-aliases-schemas-without-dropping.test.ts` (line 256)

## Phase 2: Remove CLI commands — DONE

- [x] Delete `src/cli/nodes-cli/register.canvas.ts`
- [x] Delete `src/cli/nodes-cli/a2ui-jsonl.ts`
- [x] Delete `src/cli/nodes-canvas.ts`
- [x] Delete `src/cli/nodes-canvas.test.ts`
- [x] Remove `registerNodesCanvasCommands` import and call from `src/cli/nodes-cli/register.ts` (line 5 import, line 27 call)
- [x] Replace `canvas.eval` example in `src/cli/nodes-cli/register.invoke.ts` help text (line 140) with `camera.snap`
- [x] Remove canvas references from `src/cli/program/help.ts` — `--dev` flag description mentions `(browser/canvas)` (line 37); updated to `(browser)`
- [x] Remove canvas snapshot test in `src/cli/program.nodes-media.test.ts` (lines 389-431)
- [x] Remove canvas from mock fixtures and expectations in `src/cli/program.nodes-basic.test.ts`
- [x] Remove canvas capability from mock fixture in `src/cli/nodes-cli.coverage.test.ts` (line 12: `caps: ["canvas"]`)

## Phase 3: Remove canvas host server and A2UI — DONE

- [x] Delete `src/canvas-host/` directory entirely
- [x] Delete `src/infra/canvas-host-url.ts`
- [x] ~~Delete `src/types/napi-rs-canvas.d.ts`~~ — **KEEP**: this is for `@napi-rs/canvas` (PDF extraction), NOT the canvas host.
- [x] Delete `vendor/a2ui/` directory entirely

## Phase 4: Remove gateway integration (17 files) — DONE

- [x] server-runtime-config.ts — removed `canvasHostEnabled`
- [x] server-runtime-state.ts — removed canvas imports, params, handler creation, return value
- [x] server-http.ts — removed canvas imports, params, request handling, upgrade handler
- [x] server.impl.ts — removed all canvas wiring
- [x] server-ws-runtime.ts — removed canvas params
- [x] server/ws-connection.ts — removed canvas URL resolution
- [x] server/ws-connection/message-handler.ts — removed canvasHostUrl
- [x] server-close.ts — removed canvas imports and cleanup
- [x] config-reload.ts — removed canvasHost prefix
- [x] node-command-policy.ts — removed CANVAS_COMMANDS array and spreads
- [x] server-discovery-runtime.ts — removed canvasPort param
- [x] test-helpers.mocks.ts — removed canvasHostPort and config injection
- [x] test-helpers.server.ts — removed skipCanvasHost save/restore
- [x] server.models-voicewake-misc.e2e.test.ts — removed canvas port test + import + unused testState/testTailnetIPv4 imports
- [x] server.roles-allowlist-update.e2e.test.ts — replaced canvas.snapshot → camera.snap
- [x] server.ios-client-id.e2e.test.ts — changed caps: ["canvas"] → caps: []
- [x] server.nodes.late-invoke.test.ts — replaced canvas.snapshot → camera.snap
- [x] protocol/schema/frames.ts — removed canvasHostUrl field

## Phase 5: Remove config schema and port defaults — DONE

- [x] Remove `CanvasHostConfig` type from `src/config/types.gateway.ts`
- [x] Remove `CanvasHostConfig` import from `src/config/types.crocbot.ts`
- [x] Remove `canvasHost?: CanvasHostConfig` from `src/config/types.crocbot.ts`
- [x] Remove `canvasHost` from zod schema in `src/config/zod-schema.ts`
- [x] Remove `DEFAULT_CANVAS_HOST_PORT` constant from `src/config/port-defaults.ts`
- [x] Remove `deriveDefaultCanvasHostPort()` function from `src/config/port-defaults.ts`

## Phase 6: Remove gateway protocol reference — DONE (completed as part of Phase 4)

- [x] Remove `canvasHostUrl` from handshake frame schema in `src/gateway/protocol/schema/frames.ts`

## Phase 6b: Remove remaining source-level canvas references — DONE

- [x] Remove canvas from iOS/Android app capability text in `src/wizard/onboarding.finalize.ts` — updated to `(camera)`
- [x] Remove canvas port comment from `src/browser/profiles.ts` — updated to remove `(canvas at 18793)`
- [x] Update `AGENTS.md` workspace directory list — removed `canvas/`
- [x] Update `.env.example` workspace layout comment — removed `canvas/` entry
- [x] Update `src/README_src.md` directory table — removed `canvas-host/` row
- [x] `src/types/README_types.md` — no canvas reference found, skipped
- [x] Update `scripts/README_scripts.md` — removed `canvas-a2ui-copy.ts` entry
- [x] Update `skills/README_skills.md` — removed `canvas/` skill entry

## Phase 7: Remove build and bundle tooling — DONE

- [x] Delete `scripts/build/bundle-a2ui.sh`
- [x] Delete `scripts/build/canvas-a2ui-copy.ts`
- [x] Delete `src/scripts/canvas-a2ui-copy.test.ts`
- [x] In `package.json` build script: removed `pnpm canvas:a2ui:bundle &&` and `&& node --import tsx scripts/build/canvas-a2ui-copy.ts`
- [x] Remove `canvas:a2ui:bundle` script entry from `package.json`
- [x] Remove `dist/canvas-host/**` from `files` array in `package.json`
- [x] Remove `pnpm canvas:a2ui:bundle &&` from `.github/workflows/ci.yml` (all 3 occurrences)
- [x] Remove `CROCBOT_CANVAS_HOST_PORT` handling from `test/test-env.ts` (save + delete)
- [x] Remove `CROCBOT_SKIP_CANVAS_HOST` env var references from all test/script files:
  - [x] `src/gateway/gateway.e2e.test.ts` — Session 1 agent partially edited (save+set removed); Session 2 removed remaining restore line
  - [x] `src/gateway/gateway-models.profiles.live.test.ts` — Session 2 removed all 3 references (save/set/restore)
  - [x] `src/gateway/gateway-cli-backend.live.test.ts` — already clean (Session 1 agent completed)
  - [x] `src/commands/onboard-non-interactive.gateway.test.ts` — Session 2 removed save/set/restore
  - [x] `src/commands/onboard-non-interactive.ai-gateway.test.ts` — Session 2 removed save/set/restore
  - [x] `src/commands/onboard-non-interactive.token.test.ts` — Session 2 removed save/set/restore
  - [x] `src/cli/gateway.sigterm.test.ts` — Session 2 removed env line
  - [x] `test/provider-timeout.e2e.test.ts` — Session 2 removed save/set/restore block
  - [x] `test/gateway.multi.e2e.test.ts` — Session 2 removed env line
  - [x] `scripts/e2e/gateway-network-docker.sh` — Session 2 removed docker env line

## Phase 8: Update documentation — DONE

- [x] Remove canvas references from `docs/tools/index.md` (tool docs, group:ui listing, canvas section, canvas render flow)
- [x] Remove canvas references from `docs/tools/multi-agent-sandbox-tools.md` (group:ui listing)
- [x] Remove canvas references from `docs/cli/index.md` (7 `nodes canvas` command entries, renamed section header)
- [x] Remove canvas references from `docs/cli/nodes.md` (frontmatter summary + read_when)
- [x] Remove canvas references from `docs/nodes/index.md` (frontmatter, examples, 3 entire canvas sections, capability note)
- [x] Remove canvas references from `docs/concepts/agent-workspace.md` (canvas/ directory entry)
- [x] Remove canvas references from `docs/concepts/multi-agent.md` (canvas from deny list)
- [x] Remove canvas references from `docs/gateway/configuration.md` (entire canvasHost section, env listing, derived ports comment, restart list)
- [x] Remove canvas references from `docs/gateway/configuration-examples.md`
- [x] Remove canvas references from `docs/gateway/index.md` (canvas file server description, A2UI reference)
- [x] Remove canvas references from `docs/gateway/protocol.md` (canvasHostUrl)
- [x] Remove canvas references from `docs/gateway/bridge-protocol.md`
- [x] Remove canvas references from `docs/gateway/security/index.md`
- [x] Remove canvas references from `docs/gateway/logging.md`
- [x] Remove canvas references from `docs/gateway/multiple-gateways.md` (Canvas in port comment)
- [x] Remove canvas references from `docs/gateway/sandbox-vs-tool-policy-vs-elevated.md`
- [x] Remove canvas references from `docs/start/getting-started.md` (A2UI bundle step)
- [x] Remove canvas references from `docs/install/docker.md` (host-only tools list)
- [x] Remove canvas references from `docs/reference/RELEASING.md` (A2UI build step)
- [x] Remove canvas references from `docs/help/faq.md` (3 references: capabilities, node capabilities, restart note)
- [x] Remove canvas references from `docs/help/debugging.md` (derived ports comment)
- [x] Remove canvas references from `docs/adr/0002-multi-stage-docker-build.md` (optional deps, @napi-rs/canvas line)
- [x] Remove canvas references from `docs/reference/AGENTS.default.md` (Canvas UI layout guideline)
- [x] Remove canvas references from `docs/ongoing-projects/active-deploy.md` (audit issue + mark TODO completed)
- [x] Review canvas references in `docs/ongoing-projects/active-deploy_session01-14.md` — left as archival record (historical deployment log)

## Phase 9: Verify and clean up

- [x] `pnpm build` passes — **verified Session 3**
- [x] `pnpm lint` passes (no unused imports) — **verified Session 3** (found 2 leftover unused vars `port`/`gatewayHost` in `ws-connection.ts` from canvas URL resolution removal — fixed in `ws-connection.ts`, `server-ws-runtime.ts`, and `server.impl.ts`)
- [x] `pnpm test` passes — **verified Session 3** (652 files, 3927 tests passed; 1 pre-existing EBADF in session-write-lock.test.ts — well-documented known issue, unrelated)
- [x] Gateway starts without errors — **verified Session 4** (clean restart, active/running, no errors in startup logs)
- [x] No remaining imports of deleted files (`grep -r "canvas-host" src/` returns nothing) — **verified Session 2**
- [x] No remaining `CROCBOT_SKIP_CANVAS_HOST` references — **verified Session 2**
- [x] No remaining `CROCBOT_CANVAS_HOST_PORT` references — **verified Session 2**
- [x] `grep -r "a2ui" src/` returns nothing — **verified Session 2**
- [x] `grep -ri "canvas" src/` returns only `@napi-rs/canvas` + PDF.js — **verified Session 2** (also `src/types/README_types.md` mentions "Canvas rendering" which describes `@napi-rs/canvas`)
- [x] `grep -ri "canvas" skills/` returns only Obsidian `.canvas` — **verified Session 2**
- [x] `rm -rf dist/canvas-host/` to clean built output — **verified Session 3** (directory does not exist; `tsdown` build step cleans `dist/` before rebuild)
- [ ] Delete this plan file (`docs/ongoing-projects/canvas-removal-plan.md`)

### Session 3 (completed Phase 9 verification + lint fix)

**Completed:** Phase 9 build/lint/test verification. Found and fixed 2 leftover unused variables from canvas removal.

**Phase 9 findings:**
- `pnpm build` — passed clean on first run
- `pnpm lint` — failed with 2 errors: `port` and `gatewayHost` were destructured but never used in `src/gateway/server/ws-connection.ts` (lines 45-46). These were only used for canvas URL resolution (removed in Session 1 Phase 4). Fixed by removing the params from:
  - `src/gateway/server/ws-connection.ts` (type + destructuring)
  - `src/gateway/server-ws-runtime.ts` (type + pass-through)
  - `src/gateway/server.impl.ts` (call site)
- After fix: `pnpm build` passed, `pnpm lint` passed (0 errors, 0 warnings)
- `pnpm test` — 652 files, 3927 tests passed, 2 skipped, 1 pre-existing EBADF error (well-documented known issue in session-write-lock.test.ts)
- `dist/canvas-host/` — does not exist (tsdown cleans dist/ on build)

**Remaining:** Only gateway live-start verification and deleting this plan file.

### Session 4 (independent audit — 2026-02-06)

**Auditor:** Senior engineer independent review of all prior session work.

**Methodology:** Systematic grep-based verification of every claim in the plan. Zero trust — no assumption carried forward from prior sessions.

**Full-repo scan results (re-verified from scratch):**
- `grep -ri "canvasHost|canvas-host|CanvasHost|CANVAS_HOST|createCanvasTool|registerNodesCanvas|skipCanvas" src/ test/ scripts/ .github/` — **zero matches** (confirmed clean)
- `grep -ri "a2ui" src/` — **zero matches** (confirmed clean)
- `grep -ri "CROCBOT_SKIP_CANVAS_HOST|CROCBOT_CANVAS_HOST_PORT|CROCBOT_A2UI" *.{ts,js,sh,yml,json}` — **zero matches**
- `grep -ri "canvas" src/` — **only** `@napi-rs/canvas` (media/input-files.ts, types/napi-rs-canvas.d.ts), PDF.js canvas (types/pdfjs-dist-legacy.d.ts), types/README_types.md ("Canvas rendering" = @napi-rs/canvas description) — all expected, unrelated to canvas host system
- `grep -ri "canvas" skills/` — **only** Obsidian `.canvas` file format reference
- `grep -ri "canvas" docs/` — **only** this plan file, `active-deploy.md` completed `[x]` checkbox, `active-deploy_session01-14.md` archival record
- `grep -ri "canvas" package.json` — **only** `@napi-rs/canvas` optional dependency
- `grep -ri "canvas" .github/workflows/ci.yml` — **zero matches**
- `grep -ri "canvas" .dockerignore .env.example AGENTS.md docs/docs.json` — **zero matches**
- All deleted directories confirmed gone: `src/canvas-host/`, `vendor/a2ui/`, `skills/canvas/`, `ui/` — **no files found**
- All deleted files confirmed gone: `src/agents/tools/canvas-tool.ts`, `src/infra/canvas-host-url.ts`, `scripts/build/bundle-a2ui.sh`, `scripts/build/canvas-a2ui-copy.ts`, etc. — **no files found**

**Build/lint/test verification:**
- `pnpm build` — **passed** (135 files, 4828.84 kB, 4220ms)
- `pnpm lint` — **passed** (0 warnings, 0 errors, 2133 files, 134 rules)
- `pnpm test` — **passed** (652 files, 3927 tests, 2 skipped, 1 pre-existing EBADF in session-write-lock.test.ts — known issue, unrelated)

**Issues found and fixed in this session:**
1. **`.oxlintrc.json` line 37** — stale `ignorePatterns` entry `"src/canvas-host/a2ui/a2ui.bundle.js"` referencing a deleted file. **Fixed:** removed the entry.
2. **`.spec_system/specs/phase07-session01-e2e-test-audit-and-triage/fixture-map.md` line 69** — stale `resolveCanvasHostUrl` listed as a dependency of `server.models-voicewake-misc.e2e.test.ts` (function was removed during canvas removal). **Fixed:** removed from the dependency list.

**Not fixed (archival — intentional):**
- `.spec_system/archive/` files — historical phase 05 documents reference canvas-host/a2ui as they describe the pre-removal build system. These are archival records and should not be modified.

**Remaining items:**
1. `Gateway starts without errors` — runtime check (requires `systemctl --user restart crocbot-gateway` or `node dist/index.js gateway` on the deployment server)
2. `Delete this plan file` — should only be done after gateway start verification

### Session 5 notes (for next session)
- The canvas removal is **code-complete and verified**. Build, lint, and tests all pass.
- The only remaining work is operational: start the gateway to confirm no runtime errors, then delete this plan file.
- Two files were modified in Session 4 (audit fixes):
  - `.oxlintrc.json` — removed stale `src/canvas-host/a2ui/a2ui.bundle.js` from `ignorePatterns`
  - `.spec_system/specs/phase07-session01-e2e-test-audit-and-triage/fixture-map.md` — removed stale `resolveCanvasHostUrl` from fixture dependency list

---

## Environment variables removed by this plan

| Variable | Location | Purpose |
|----------|----------|---------|
| `CROCBOT_SKIP_CANVAS_HOST` | server-runtime-config.ts, canvas-host/server.ts, 10 test files, 1 e2e script | Disable canvas host |
| `CROCBOT_CANVAS_HOST_PORT` | test/test-env.ts, e2e tests | Override canvas port |
| `CROCBOT_A2UI_SRC_DIR` | canvas-a2ui-copy.ts | A2UI source override |
| `CROCBOT_A2UI_OUT_DIR` | canvas-a2ui-copy.ts | A2UI output override |
| `CROCBOT_A2UI_SKIP_MISSING` | canvas-a2ui-copy.ts | Skip missing A2UI assets |

## Files deleted (complete list)

```
src/canvas-host/                          (entire directory)
src/agents/tools/canvas-tool.ts
src/agents/pi-embedded-subscribe.subscribe-embedded-pi-session.includes-canvas-action-metadata-tool-summaries.test.ts
src/cli/nodes-cli/register.canvas.ts
src/cli/nodes-cli/a2ui-jsonl.ts
src/cli/nodes-canvas.ts
src/cli/nodes-canvas.test.ts
src/infra/canvas-host-url.ts
src/scripts/canvas-a2ui-copy.test.ts
scripts/build/bundle-a2ui.sh
scripts/build/canvas-a2ui-copy.ts
skills/canvas/SKILL.md
vendor/a2ui/                              (entire directory)
```

## Files modified (complete list)

```
src/agents/crocbot-tools.ts               (remove import + call)
src/agents/test-helpers/fast-core-tools.ts (remove mock)
src/agents/system-prompt.ts               (remove canvas from tool descriptions, toolOrder, help text)
src/agents/tool-policy.ts                 (remove canvas from group:ui + group:crocbot)
src/agents/sandbox/constants.ts           (remove canvas from DEFAULT_TOOL_DENY)
src/agents/tools/nodes-utils.ts           (remove canvas capability filter in pickDefaultNode)
src/agents/tool-display.json              (remove canvas tool entry)
src/agents/pi-tools.create-clawdbot-coding-tools.adds-claude-style-aliases-schemas-without-dropping-b.test.ts (remove "canvas" from tool names)
src/agents/pi-tools.create-clawdbot-coding-tools.adds-claude-style-aliases-schemas-without-dropping.test.ts (remove "canvas" from tool set)
src/cli/nodes-cli/register.ts             (remove import + call)
src/cli/nodes-cli/register.invoke.ts      (replace canvas.eval example)
src/cli/program/help.ts                   (remove canvas from --dev help text)
src/cli/program.nodes-media.test.ts       (remove canvas snapshot test)
src/cli/program.nodes-basic.test.ts       (remove canvas from mock data + expectations)
src/cli/nodes-cli.coverage.test.ts        (remove canvas capability from fixture)
src/wizard/onboarding.finalize.ts         (remove canvas from iOS/Android capability text)
src/browser/profiles.ts                   (remove canvas from port reservation comment)
src/config/types.gateway.ts               (remove CanvasHostConfig)
src/config/types.crocbot.ts               (remove canvasHost field + import)
src/config/zod-schema.ts                  (remove canvasHost schema)
src/config/port-defaults.ts               (remove DEFAULT_CANVAS_HOST_PORT + deriveDefaultCanvasHostPort)
src/gateway/server.impl.ts                (remove canvas wiring; Session 3: remove unused port/gatewayHost from attachGatewayWsHandlers call)
src/gateway/server-runtime-config.ts      (remove canvasHostEnabled)
src/gateway/server-runtime-state.ts       (remove canvas handler)
src/gateway/server-http.ts                (remove canvas HTTP handling)
src/gateway/server-close.ts               (remove canvas cleanup)
src/gateway/server-ws-runtime.ts          (remove canvas params; Session 3: remove unused port/gatewayHost from type + pass-through)
src/gateway/server/ws-connection.ts       (remove canvas URL resolution; Session 3: remove unused port/gatewayHost from type + destructuring)
src/gateway/server/ws-connection/message-handler.ts (remove canvasHostUrl)
src/gateway/config-reload.ts              (remove canvas prefix)
src/gateway/node-command-policy.ts        (remove CANVAS_COMMANDS + spreads)
src/gateway/server-discovery-runtime.ts   (remove canvasPort param)
src/gateway/test-helpers.mocks.ts         (remove canvasHostPort + config injection + config return)
src/gateway/test-helpers.server.ts        (remove skipCanvasHost save/restore)
src/gateway/server.models-voicewake-misc.e2e.test.ts (remove canvas port test + import)
src/gateway/server.roles-allowlist-update.e2e.test.ts (replace canvas.snapshot command refs)
src/gateway/server.ios-client-id.e2e.test.ts (remove canvas capability from fixture)
src/gateway/server.nodes.late-invoke.test.ts (replace canvas.snapshot command in fixture)
src/gateway/protocol/schema/frames.ts     (remove canvasHostUrl field)
src/gateway/gateway.e2e.test.ts           (remove CROCBOT_SKIP_CANVAS_HOST handling)
src/gateway/gateway-models.profiles.live.test.ts (remove CROCBOT_SKIP_CANVAS_HOST handling)
src/gateway/gateway-cli-backend.live.test.ts (remove CROCBOT_SKIP_CANVAS_HOST handling)
src/commands/onboard-non-interactive.gateway.test.ts (remove CROCBOT_SKIP_CANVAS_HOST)
src/commands/onboard-non-interactive.ai-gateway.test.ts (remove CROCBOT_SKIP_CANVAS_HOST)
src/commands/onboard-non-interactive.token.test.ts (remove CROCBOT_SKIP_CANVAS_HOST)
src/cli/gateway.sigterm.test.ts           (remove CROCBOT_SKIP_CANVAS_HOST)
test/test-env.ts                          (remove CROCBOT_CANVAS_HOST_PORT handling)
test/provider-timeout.e2e.test.ts         (remove CROCBOT_SKIP_CANVAS_HOST)
test/gateway.multi.e2e.test.ts            (remove CROCBOT_SKIP_CANVAS_HOST env var)
scripts/e2e/gateway-network-docker.sh     (remove CROCBOT_SKIP_CANVAS_HOST env var)
.github/workflows/ci.yml                  (remove canvas:a2ui:bundle from 3 test commands)
package.json                              (remove build scripts, files entry)
AGENTS.md                                 (remove canvas/ from workspace dir list; CLAUDE.md + GEMINI.md are symlinks)
.env.example                              (remove canvas/ from workspace layout comment)
src/README_src.md                         (remove canvas-host/ row)
scripts/README_scripts.md                 (remove canvas-a2ui-copy.ts entry)
skills/README_skills.md                   (remove canvas/ skill entry)
docs/ (25-26 files)                       (remove canvas references)
```
