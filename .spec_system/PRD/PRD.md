# crocbot - Product Requirements Document

## Overview

This PRD defines Arc 3 of crocbot development: a second upstream sync with the OpenClaw repository. The upstream codebase was pulled on 2026-02-22 (4,642 commits since the previous sync at `6b1f485ce`) and resides in `.001_ORIGINAL/`. A filtered analysis identified ~280 actionable items across security patches, bug fixes, performance improvements, stability fixes, and shared infrastructure refactors.

**Arc 3 - Upstream Sync II (Phases 16-21)**: Cherry-pick objective improvements from the 2026-02-22 upstream pull. Filter criteria: only changes that improve crocbot stability, security, performance, or correctness. Telegram-only channel. Linux-only platform. All Discord/macOS/Windows/iOS/Android/Signal/iMessage/WhatsApp/BlueBubbles/Feishu/LINE/Matrix/MS Teams/Zalo/Nostr/IRC/webchat/Control UI changes excluded.

**Research Note**: Each phase begins with a triage session that audits upstream commits against crocbot's stripped-down architecture. Many fixes will be N/A due to removed components (multi-channel, native apps, web UI). The phase scopes below reflect the full candidate list; actual implementation scope narrows after triage.

## Goals

1. Close critical security gaps identified in the upstream sync (SSRF bypasses, path traversal variants, injection vectors)
2. Fix gateway session management bugs that cause ghost sessions, reply loss, and config corruption
3. Fix agent runtime bugs causing deadlocks, token count drift, and dropped tool results
4. Fix Telegram-specific bugs (webhook retry storms, command menu pollution, reply threading)
5. Fix cron scheduler bugs (silent heartbeat death, stale next-run times, queue item loss)
6. Fix memory/knowledge bugs (scope bypass, ranking corruption, null-byte metadata)
7. Fix config persistence bugs (env var expansion destroying portability, defaults corrupting persisted config)
8. Fix plugin/hook lifecycle bugs (unwired hooks, FD exhaustion, duplicate warnings)
9. Improve performance on hot gateway paths, CLI startup, and memory-intensive operations
10. Improve reliability with bounded memory growth, crash recovery, and deadlock prevention
11. Update Docker infrastructure with pinned base images and supply-chain security

## Non-Goals

- Porting all 4,642 upstream commits indiscriminately
- Supporting channels beyond Telegram and CLI
- Porting Discord/Signal/iMessage/WhatsApp/Matrix/MS Teams/Zalo/Nostr/IRC/webchat changes
- Porting macOS/Windows/iOS/Android platform-specific changes
- Porting Control UI or web dashboard changes
- Adopting new upstream features not in the filtered list
- Test-only refactors (~1,200 upstream commits) unless they fix real bugs
- Dependency version bumps with no functional impact

## Users and Use Cases

### Primary Users

- **Single Operator**: The sole user running crocbot as a personal AI assistant via Telegram and CLI

### Key Use Cases

1. Trust that security patches close real attack surfaces (SSRF bypasses, path traversal variants)
2. Expect gateway to handle session resets, config changes, and restarts without losing replies
3. Expect agent runs to complete without deadlocks, token count drift, or dropped results
4. Expect Telegram to handle webhooks without retry storms or command menu pollution
5. Expect cron jobs to execute reliably without silent scheduler death

## Requirements

### Critical Security Requirements (Phase 16)

- Close SSRF bypass via `::ffff:127.0.0.1` IPv6 notation and gateway URL overrides
- Block path traversal via `../` in apply_patch, symlink escape, and archive extraction variants
- Harden input sanitization (Unicode homoglyphs, oversized base64, ReDoS-vulnerable regex)
- Fix OAuth CSRF, auth rate-limiting, and token validation gaps
- Block shell expansion in safe binary paths and harden npm install safety
- Complete credential redaction and prevent info leakage in error responses
- Close ACP permission bypass via HTTP tools

### Stability Requirements (Phases 17-20)

- Fix gateway ghost sessions from case mismatches and reply loss during restarts
- Fix agent deadlocks during compaction timeouts and token count drift
- Fix Telegram webhook retry storms from missing timeout responses
- Fix cron heartbeat scheduler silent death from wake handler races
- Fix memory scope deny bypass and multi-collection ranking corruption
- Fix config env var expansion destroying portability on write
- Fix plugin hooks that were defined but never invoked
- Fix media binary files being processed as text

### Performance and Reliability Requirements (Phase 21)

- Optimize gateway session/ws/routing hot paths
- Speed up CLI startup with lazy loading and deferred route handlers
- Bound memory growth in diagnostic state, directory cache, abort maps, and run sequences
- Add crash recovery for outbound delivery pipeline
- Replace file-based session locks with in-process Promise chain mutex
- Update Docker images with pinned base image digests

### Deferred Requirements

- Test-only refactors (~1,200 upstream commits) -- adopt selectively as needed
- CI runner upgrades (Blacksmith) -- not applicable to crocbot's CI
- Cosmetic refactors to unused modules (~200 commits)
- Dependency bumps with no functional impact (~100 commits)

## Non-Functional Requirements

- **Security**: All identified SSRF bypasses, path traversal variants, and injection vectors closed
- **Stability**: No new deadlocks, memory leaks, or silent failures introduced
- **Performance**: Gateway hot paths and CLI startup measurably improved
- **Compatibility**: All changes pass existing test suite; no regressions in Telegram or CLI

## Constraints and Dependencies

- Upstream reference codebase in `.001_ORIGINAL/` (2026-02-22 pull) must be preserved
- Changes must not break existing Telegram or CLI functionality
- Security fixes take absolute priority over all other categories
- Each phase begins with triage to filter N/A items before implementation
- Cron delivery architecture differs from upstream (Phase 04 research finding); adapt rather than blindly port
- Some SHAs in the filtered list use placeholder suffixes (e.g., `cb995c4X`) -- search by message context
- Existing Phase 06 SSRF guards and Phase 09 secrets masking provide foundation for new patches

## Phases

This PRD delivers via phases. Each phase is implemented via multiple 2-4 hour sessions (12-25 tasks each).

| Phase | Name | Sessions | Status |
|-------|------|----------|--------|
| 16 | Critical Security Hardening II | 5 | Complete |
| 17 | Core Runtime Stability | 5 | Complete |
| 18 | Telegram and Messaging Pipeline | 4 | Pending |
| 19 | Cron, Memory, and Config | 5 | Pending |
| 20 | Plugins, Media, CLI, and Infrastructure | 5 | Pending |
| 21 | Performance, Refactors, and Build | 4 | Pending |

---

## Phase 16: Critical Security Hardening II

### Objectives

1. Audit all ~65 upstream security patches against crocbot's stripped-down codebase
2. Close SSRF bypass vectors not covered by Phase 06
3. Block all path traversal and filesystem escape variants
4. Harden input sanitization, auth, execution, and data leak prevention
5. Fix ACP permission gaps

### Scope

**From filtered-final-list.md Section 1 (~65 items):**

- **1.1 SSRF & Network Hardening** (6 items) -- IPv6-mapped address bypass (`::ffff:127.0.0.1`), gateway URL SSRF prevention, tool gateway URL override restriction, private/loopback/metadata IP blocking in link-understanding. Phase 06 implemented core SSRF guards in `src/infra/net/ssrf.ts`; these close bypass variants.

- **1.2 Path Traversal & Filesystem Escapes** (10 items) -- apply_patch `../` escape, symlink-follow delete variant, workspace containment defaults, sandbox file tool guards, hook manifest path escapes, archive extraction hardening (zip-slip prevention, decompression bomb limits), media localRoots bypass, trace/download output path containment.

- **1.3 Injection & Input Sanitization** (8 items) -- chat.send payload injection, transcript tool-call block sanitization, Unicode angle bracket homoglyphs, ReDoS-vulnerable control-char regex replacement, oversized base64 rejection, bounded webhook body handling, rawCommand/argv consistency enforcement, unsafe param stringification in gateway.

- **1.4 Auth & Access Control** (14 items) -- Status detail redaction for non-admin, OAuth state CSRF prevention, TLS pin trust-on-first-use, approval id device binding, system.run approval bypass, gateway param allowlisting, node.invoke exec bypass, hook/device token auth hardening, device pairing token generation, auth rate-limiting and brute-force protection, canvas IP auth restriction, sandbox bridge auth, literal "undefined"/"null" token rejection.

- **1.5 Execution Hardening** (8 items) -- Shell expansion blocking in safeBins, CLI cleanup PID scoping, plugin/hook npm `--ignore-scripts`, skills install safety, exec PATH handling, heredoc `<<` operator allowlisting, safeBins refinement.

- **1.6 Data Leak Prevention** (10 items) -- Incomplete credential redaction completion, error response sanitization, `String(undefined)` coercion prevention, skills status secret redaction, WebSocket log header sanitization, web tool transcript hardening, config snapshot resolved field redaction, webhook vs internal hook audit classification, extended audit hardening.

- **1.7 ACP** (5 items) -- OC-02 HTTP tool deny bypass, dangerous tool auto-approval blocking, safe kind inference tightening, non-read/search permission prompts, gateway tool re-enable warnings.

### Upstream Reference

The complete upstream codebase is available at `.001_ORIGINAL/` for diffing and reference. Key files to compare against crocbot:

- `.001_ORIGINAL/src/infra/net/ssrf.ts` -- SSRF protection (existing in crocbot; needs bypass fixes)
- `.001_ORIGINAL/src/agents/tools/` -- Tool containment and path validation
- `.001_ORIGINAL/src/infra/exec-approvals.ts` -- Exec security (existing; needs safeBins fix)
- `.001_ORIGINAL/src/gateway/server.ts` -- Gateway auth and rate limiting
- `.001_ORIGINAL/src/infra/secrets/` -- Credential redaction (existing from Phase 09)

Use `diff` between `.001_ORIGINAL/src/` and `src/` to identify exact changes needed per commit.

### Sessions

| Session | Name | Status |
|---------|------|--------|
| 01 | Security Triage and Applicability Audit | Complete |
| 02 | Network, SSRF, and Filesystem Hardening | Complete |
| 03 | Input Sanitization and Auth Hardening | Complete |
| 04 | Execution Hardening and Data Leak Prevention | Complete |
| 05 | ACP Fixes and Security Validation | Complete |

---

## Phase 17: Core Runtime Stability

### Objectives

1. Fix gateway session management bugs (ghost sessions, reply loss, config merge errors)
2. Fix agent runtime bugs (deadlocks during compaction, token count drift, dropped tool results)
3. Fix session/process management bugs (lock races, transcript path confusion, hanging CLI)
4. Harden reliability with bounded memory growth and crash recovery

### Scope

**From filtered-final-list.md Sections 3, 4, 8, 16 (~57 items, after deduplication):**

- **Gateway Fixes** (Section 3, ~15 items) -- Abort active runs during sessions.reset, await reset handler result, route bare `/new` and `/reset`, handle sync reset handlers, merge config.patch arrays by id, prefer explicit token over stored auth, normalize session key casing, relax HTTP tool deny typing, bound agentRunSeq map, optimize sessions/ws/routing, defer restart until all replies sent, prune expired hook auth state, increase WebSocket max payload to 5 MB.

- **Agent Fixes** (Section 4, ~16 items) -- Suppress NO_REPLY when message tool already sent text, force store=true for direct OpenAI responses, return timeout reply on empty timed-out runs, classify empty-chunk as timeout, accept read file_path alias, reduce prompt token bloat from exec/context, prevent session lock deadlock on compaction timeout, add safety timeout to session.compact(), wait for agent idle before flushing tool results, stabilize overflow compaction retries, sanitize tool call id for transcript, respect session model override, update totalTokens after compaction, preserve exec override after compaction, guard undefined context file paths, strip leading whitespace in sanitizeUserFacingText.

- **Session & Process** (Section 8, ~12 items) -- Replace file-based session store lock with Promise chain mutex, replace proper-lockfile with lightweight file locks, resolve multi-agent transcript paths (3 related commits), normalize absolute sessionFile paths, preserve verbose/thinking/tts overrides across /new and /reset, reject pending promises on lane clear, dedicated CommandLaneClearedError, ensure CLI exits after command, close stdin for non-pty runs, archive old transcripts on /new and /reset.

- **Memory Bounding** (Section 16, partial) -- Bound in-memory diagnostic session state, bound directory cache growth, bound abort memory map, bound agent run sequence tracking, cap local shell output buffering. Thread starter cache bounding is Slack-specific (excluded).

### Upstream Reference

The complete upstream codebase is available at `.001_ORIGINAL/` for diffing and reference. Key files to compare against crocbot:

- `.001_ORIGINAL/src/gateway/server.ts` -- Session management and routing
- `.001_ORIGINAL/src/agents/pi-embedded-runner.ts` -- Agent runtime loop
- `.001_ORIGINAL/src/agents/session-*.ts` -- Session file management and locking
- `.001_ORIGINAL/src/agents/pi-embedded-subscribe.ts` -- Streaming and tool result handling

Use `diff` between `.001_ORIGINAL/src/` and `src/` to identify exact changes needed per commit. The upstream `.001_ORIGINAL/.git` history can be queried with `git -C .001_ORIGINAL log` and `git -C .001_ORIGINAL show <sha>` to inspect individual fix commits.

### Sessions

| Session | Name | Status |
|---------|------|--------|
| 01 | Research and Triage | Complete (2026-02-23) |
| 02 | Gateway Session and Routing Fixes | Complete (2026-02-23) |
| 03 | Agent Compaction, Deadlock, and Token Fixes | Complete (2026-02-23) |
| 04 | Session Management and Process Fixes | Complete (2026-02-23) |
| 05 | Memory Bounding and Validation | Complete (2026-02-23) |

---

## Phase 18: Telegram and Messaging Pipeline

### Objectives

1. Fix Telegram webhook retry storms and command menu issues
2. Fix auto-reply threading, delivery targeting, and crash recovery
3. Align replyToMode defaults with upstream

### Scope

**From filtered-final-list.md Sections 2, 10 (~24 items):**

- **Telegram Fixes** (Section 2, ~12 items) -- Return webhook timeout responses to prevent retry storms, require sender ids for allowlist auth, exclude plugin commands from setMyCommands when `native=false`, enforce Telegram 100-command limit with warning, scope skill commands to resolved agent, auto-wrap `.md` file references in backticks, change default replyToMode from "first" to "off" (3 related commits across code, extension, and docs), expose /compact command in Telegram native menu, share Telegram outbound param parsing, extract native command menu helpers.

- **Auto-Reply & Outbound** (Section 10, ~12 items) -- Preserve off-mode semantics in auto-reply threading, auto-inject replyToCurrent for reply threading, return error instead of silently redirecting to allowList[0], strip leading whitespace in block streaming reply path, extract block delivery normalization, honour explicit `[[reply_to_*]]` tags when replyToMode is off, outbound delivery crash recovery, retain announce queue items on send failure, thread replyToId and threadId through message tool send action, pass explicit delivery targets for auto-reply.

### Upstream Reference

The complete upstream codebase is available at `.001_ORIGINAL/` for diffing and reference. Key files to compare against crocbot:

- `.001_ORIGINAL/src/telegram/bot-handlers.ts` -- Webhook handling and timeout responses
- `.001_ORIGINAL/src/telegram/commands.ts` -- Command menu management
- `.001_ORIGINAL/src/auto-reply/reply/*.ts` -- Reply threading and mode handling
- `.001_ORIGINAL/src/auto-reply/outbound.ts` -- Delivery pipeline and crash recovery
- `.001_ORIGINAL/src/agents/tools/message-tool.ts` -- Message tool threading

Use `git -C .001_ORIGINAL show <sha>` to inspect individual fix commits and `diff .001_ORIGINAL/src/telegram/ src/telegram/` to see current divergence.

### Sessions

| Session | Name | Status |
|---------|------|--------|
| 01 | Research and Triage | Pending |
| 02 | Telegram Core Fixes | Pending |
| 03 | Auto-Reply and Outbound Delivery Fixes | Pending |
| 04 | Messaging Validation | Pending |

---

## Phase 19: Cron, Memory, and Config

### Objectives

1. Fix cron scheduler bugs (heartbeat death, stale next-run, delivery targeting)
2. Fix memory/knowledge bugs (scope bypass, ranking corruption, index verification)
3. Fix config persistence bugs (env var expansion, default corruption, schema validation)

### Scope

**From filtered-final-list.md Sections 5, 6, 7 (~46 items):**

- **Cron Fixes** (Section 5, ~19 items) -- Prevent list/status from skipping recurring jobs, recompute all next-run times after job update, deliver cron output to explicit targets, pass agent identity through delivery path, preserve prompts for tagged interval events, skip startup replay for interrupted running jobs, preserve queued items on drain retries, skip relay only for explicit delivery config, prevent duplicate delivery for isolated announce mode, harden isolated announce fallback, use job config for cleanup retention, exempt wake/hook from empty-heartbeat skip, align prompt with filtered reminder events, prevent ghost reminder notifications, refine heartbeat event detection, prevent heartbeat scheduler death from wake handler race, prevent heartbeat scheduler death when runOnce throws, reset stale execution state after SIGUSR1, make wakeMode busy-wait configurable.

  **Note**: Phase 04 research found cron delivery architecture differs from upstream. Each fix must be evaluated against crocbot's simplified cron model where delivery config is embedded in payload.

- **Memory & Knowledge** (Section 6, ~17 items) -- Prevent QMD scope deny bypass, avoid multi-collection query ranking corruption, verify qmd index artifact after reindex, keep status dirty state stable, self-heal null-byte collection metadata, prefer exact docid lookup in qmd index, cap qmd command output buffering, robustly parse noisy qmd JSON output, optimize qmd readFile for line-window reads, skip unchanged session export writes, parse scope once in qmd scope checks, treat prefixed no-results markers as empty, handle fallback init failures gracefully, make QMD status checks side-effect free, default qmd searchMode to search, use QAT embedding model variant, reduce watcher FD pressure for markdown sync, instruct agents to append rather than overwrite memory files.

- **Config & Settings** (Section 7, ~10 items) -- Preserve `${VAR}` env var references when writing config (2 related commits for broader path coverage), use raw config for set/unset instead of runtime-merged, enforce default-free persistence in write path, forensic config write audit and watch attribution, log config overwrite audits, auto-enable configured plugins, accept `$schema` key in root config, exclude peer-specific bindings from guild-wide matching.

### Upstream Reference

The complete upstream codebase is available at `.001_ORIGINAL/` for diffing and reference. Key files to compare against crocbot:

- `.001_ORIGINAL/src/cron/scheduler.ts` -- Cron scheduler core and heartbeat
- `.001_ORIGINAL/src/cron/delivery.ts` -- Cron delivery (different architecture in crocbot -- see Phase 04 research finding)
- `.001_ORIGINAL/src/memory/qmd-manager.ts` -- QMD memory backend
- `.001_ORIGINAL/src/memory/manager.ts` -- Memory manager core
- `.001_ORIGINAL/src/config/config-store.ts` -- Config persistence and write path

Use `git -C .001_ORIGINAL show <sha>` to inspect individual fix commits. For cron fixes, compare `.001_ORIGINAL/src/cron/` against `src/cron/` carefully -- delivery architecture diverges significantly.

### Sessions

| Session | Name | Status |
|---------|------|--------|
| 01 | Research and Triage | Pending |
| 02 | Cron Scheduler and Heartbeat Fixes | Pending |
| 03 | Memory, Knowledge, and QMD Fixes | Pending |
| 04 | Config Persistence and Settings Fixes | Pending |
| 05 | Validation | Pending |

---

## Phase 20: Plugins, Media, CLI, and Infrastructure

### Objectives

1. Fix plugin/hook lifecycle bugs (unwired hooks, FD exhaustion, install issues)
2. Fix media processing bugs (binary MIME handling, path allowlists, payload bounds)
3. Fix CLI bugs (unrecognized commands, hanging, import cycles)
4. Fix exec/sandbox bugs (container file ops, bind mounts, approval races)
5. Fix miscellaneous bugs (streaming, timestamps, bootstrap, provider errors)

### Scope

**From filtered-final-list.md Sections 9, 11, 12, 13, 14 (~56 items):**

- **Plugins, Hooks & Skills** (Section 9, ~12 items) -- Suppress false duplicate plugin warnings (2 commits for symlinked extensions), wire 9 unwired plugin hooks to core code, dispatch before/after_tool_call hooks from both execution paths, deduplicate before_tool_call in toToolDefinitions, replace console logging with subsystem logging in hook loader, avoid skills watcher FD exhaustion, stabilize watcher targets and include agent skills, support `file:` npm specs in plugin install, clean remote skills cache on disconnect, run plugin gateway_stop hooks before message exit (2 commits for different code paths).

- **CLI Fixes** (Section 11, ~10 items) -- Stop agents command from being unrecognized, stop message send from hanging after delivery, avoid runtime import cycle in routed commands, fix lazy maintenance command registration, remove grouped placeholders before register, route logs to stderr during shell completion output, guard read-only process.noDeprecation on Node 23+, improve sqlite missing runtime error, add type safety to models status command, fix `/status` showing incorrect context percentage.

- **Media Fixes** (Section 12, ~10 items) -- Treat binary application mimes as non-text, strip MEDIA: prefix in loadWebMediaInternal, propagate workspace root for image allowlist, allow workspace and sandbox media paths, include state workspace/sandbox in local path allowlist, bound input media payload sizes, classify `text/*` MIME types as documents, recognize MP3 and M4A as voice-compatible audio, increase image tool maxTokens from 512 to 4096, strip audio attachments after successful transcription.

- **Exec & Sandbox** (Section 13, ~8 items) -- Execute sandboxed file ops inside containers, honor bind mounts in sandbox file tools, add shared bind-aware fs path resolver, pass docker.env into sandbox container, align workspace guidance with container workdir, ensure exec approval registered before returning, add exec approval flow for agent tool run action, close stdin for non-pty runs.

- **Miscellaneous** (Section 14, ~16 items) -- Remove bundled soul-evil hook, stop enforcing `<final>` for ollama, ignore tools.exec.pathPrepend for node hosts, return user-facing message on 429 rate limit, disable streaming to prevent Venice SDK crash, preserve streamed text when final payload regresses, preserve streamed text across tool boundary deltas, preserve active stream during concurrent run finals, ignore non-word chars when stripping HEARTBEAT_OK token, include provider name in billing errors, local timezone in console log timestamps (2 commits), create BOOTSTRAP.md regardless of workspace state, persist bootstrap onboarding state, force dashboard command to use localhost URL, use os.tmpdir fallback paths for temp files.

### Upstream Reference

The complete upstream codebase is available at `.001_ORIGINAL/` for diffing and reference. Key files to compare against crocbot:

- `.001_ORIGINAL/src/plugins/loader.ts` -- Plugin discovery, hook wiring, and lifecycle
- `.001_ORIGINAL/src/cli/commands/*.ts` -- CLI command implementations
- `.001_ORIGINAL/src/media/fetch.ts` -- Media pipeline and MIME handling
- `.001_ORIGINAL/src/agents/tools/exec.ts` -- Execution, sandbox, and approval flow
- `.001_ORIGINAL/src/agents/pi-embedded-subscribe.ts` -- Streaming text preservation

Use `git -C .001_ORIGINAL show <sha>` to inspect individual fix commits and `git -C .001_ORIGINAL log --oneline --all -- <path>` to find all commits touching a specific file.

### Sessions

| Session | Name | Status |
|---------|------|--------|
| 01 | Research and Triage | Pending |
| 02 | Plugin, Hook, and Skill Fixes | Pending |
| 03 | Media and CLI Fixes | Pending |
| 04 | Exec, Sandbox, and Miscellaneous Fixes | Pending |
| 05 | Validation | Pending |

---

## Phase 21: Performance, Refactors, and Build

### Objectives

1. Optimize gateway hot paths and CLI startup latency
2. Adopt shared infrastructure refactors that reduce code duplication
3. Update Docker images with pinned base images for supply-chain security
4. Establish green baseline for Arc 3

### Scope

**From filtered-final-list.md Sections 15, 17, 18 (~35 items):**

- **Performance** (Section 15, ~12 items) -- Optimize gateway sessions/ws/routing hot path, speed up CLI startup, slim route-first bootstrap with lazy route handlers, skip idle channel shutdown work, split skills formatting for CLI perf, reduce read-only startup overhead, cache session list transcript fields, skip eager debug formatting in diagnostics (2 commits), memoize readability dependency loading, use `.abort.bind()` instead of arrow closures to prevent memory leaks.

- **Shared Refactors** (Section 17, ~16 items) -- Dedupe PATH prepend helpers, dedupe daemon exec wrappers, dedupe plugin SDK alias lookup, share directive handling params for auto-reply, share base64 mime sniff helper, share response size limiter for media, share bearer auth helper for gateway, share gateway prompt builder, reuse runWithConcurrency for memory, share file lock via plugin-sdk, share safe json stringify, share shell argv tokenizer, share gateway server plugin mocks, centralize exec approval timeout, share tool policy pipeline, centralize default policy steps.

- **Docker & Build** (Section 18, ~7 items) -- Pin Dockerfile base image to SHA digest and run as `node` user with optional browser pre-install, pin Dockerfile.sandbox to SHA digest, pin Dockerfile.sandbox-browser to SHA digest, create Dockerfile.sandbox-common shared base layer, remove duplicate daemon-cli entry from build, add daemon-cli bundle for legacy shim, restore daemon-cli legacy shim.

### Upstream Reference

The complete upstream codebase is available at `.001_ORIGINAL/` for diffing and reference. Key files to compare against crocbot:

- `.001_ORIGINAL/src/gateway/server.ts` -- Gateway hot path optimization target
- `.001_ORIGINAL/src/cli/index.ts` -- CLI startup path and lazy loading
- `.001_ORIGINAL/src/shared/` -- Shared utility extraction targets
- `.001_ORIGINAL/Dockerfile*` -- Container infrastructure and base image pinning

Use `git -C .001_ORIGINAL show <sha>` to inspect individual commits. For shared refactors, check if the upstream utility already exists in `.001_ORIGINAL/src/shared/` before creating new files -- many deduplication targets are already extracted upstream.

### Sessions

| Session | Name | Status |
|---------|------|--------|
| 01 | Research and Triage | Pending |
| 02 | Performance Optimizations | Pending |
| 03 | Shared Refactors and Infrastructure | Pending |
| 04 | Docker, Build, and Final Validation | Pending |

---

## Technical Stack

- **Language**: TypeScript (strict mode, ESM)
- **Runtime**: Node.js 22+
- **Package Manager**: pnpm
- **Build Tool**: tsdown (rolldown-based bundler)
- **Linter**: oxlint
- **Formatter**: oxfmt
- **Test Framework**: Vitest
- **Telegram SDK**: grammy, @grammyjs/runner, @grammyjs/transformer-throttler

## Success Criteria

### Security (Phase 16)

- [x] All applicable SSRF bypass vectors closed (IPv6-mapped, gateway URL, tool overrides)
- [x] Path traversal variants blocked (apply_patch, symlink, archive extraction, media roots)
- [x] Input sanitization hardened (Unicode homoglyphs, base64 limits, regex safety, webhook bounds)
- [x] Auth gaps closed (OAuth CSRF, rate-limiting, token validation, approval binding)
- [x] Credential redaction complete; no secrets in error responses, logs, or config snapshots
- [x] ACP permission bypasses closed

### Stability (Phases 17-20)

- [ ] No gateway ghost sessions or reply loss during config restarts
- [ ] No agent deadlocks during compaction or timeout scenarios
- [ ] Token counts accurate after compaction; exec overrides preserved
- [ ] Telegram webhook retry storms eliminated
- [ ] Cron heartbeat scheduler survives all error conditions
- [ ] Memory scope bypass closed; ranking correct across collections
- [ ] Config env var references preserved through write cycles
- [ ] All 9 unwired plugin hooks connected to core code
- [ ] Media binary files correctly classified; payload sizes bounded

### Performance and Reliability (Phase 21)

- [ ] Gateway hot path optimizations applied
- [ ] CLI startup time reduced via lazy loading
- [ ] All identified memory growth vectors bounded
- [ ] Docker images use pinned base image digests
- [ ] Shared utility deduplication reduces code surface

### Overall

- [ ] Full test suite passes after each phase (`pnpm test` -- 0 failures)
- [ ] Build clean after each phase (`pnpm build` -- 0 errors)
- [ ] Lint clean after each phase (`pnpm lint` -- 0 errors)
- [ ] No regressions in existing Telegram or CLI functionality

## Risks

- **Architectural Mismatch**: Many upstream fixes assume features crocbot removed (multi-channel, sandbox containers, web UI). Mitigation: Triage session at start of each phase audits applicability before implementation.

- **Cron Delivery Architecture**: crocbot's cron model differs from upstream -- delivery config embedded in payload vs separate CronDelivery object (Phase 04 research finding). Mitigation: Evaluate each cron fix against crocbot's simplified model; adapt rather than blindly port.

- **Placeholder SHAs**: Some SHAs in the filtered list use approximate suffixes (e.g., `cb995c4X`). Mitigation: Search by commit message and file context rather than exact SHA.

- **Security Patch Interactions**: Security patches may interact with each other or with existing Phase 06 SSRF guards and Phase 09 secrets masking. Mitigation: Test each patch in isolation before combining; verify no double-guarding or performance regression.

- **Dependency on Unported Upstream Code**: Some fixes may reference upstream infrastructure not present in crocbot (e.g., separate `CronDelivery` module, `ToolProfileId` framework). Mitigation: Port supporting infrastructure first or adapt to existing crocbot patterns.

- **Test Coverage Gaps**: Upstream test changes were excluded from the filtered list (~1,200 test-only commits). Mitigation: Write crocbot-specific tests for each ported fix; leverage upstream test patterns as reference.

- **Scope Inflation After Triage**: Triage may reveal dependencies requiring additional infrastructure ports. Mitigation: Defer infrastructure that exceeds session budget to subsequent sessions; document in implementation notes.

## Assumptions

- `.001_ORIGINAL/` contains the complete 2026-02-22 upstream pull (4,642 commits)
- The filtered list in `docs/ongoing-projects/filtered-final-list.md` accurately identifies applicable changes
- Upstream fixes are well-tested and production-quality
- Security patches are critical even if the attack surface seems theoretical for single-user deployment
- Many upstream fixes will be N/A after triage due to removed components (~40-60% exclusion rate expected)
- crocbot's existing security infrastructure (Phase 06 SSRF, Phase 09 secrets) provides a solid foundation
- Phase 04's cron delivery incompatibility finding still applies; each cron fix needs individual evaluation

## Reference Documents

- **Upstream pull log**: `.001_ORIGINAL/docs/upstream-pull-2026-02-22.md` (4,642 commits)
- **Filtered candidate list**: `docs/ongoing-projects/filtered-final-list.md` (~280 items across 18 categories)
- **Previous PRD (Arc 1+2)**: `.spec_system/PRD/completed-and-draft-prd/completed02-PRD.md` (Phases 00-15)
- **Coding conventions**: `.spec_system/CONVENTIONS.md`
- **Institutional memory**: `.spec_system/CONSIDERATIONS.md`
- **Phase 04 cron finding**: Previous PRD, Research Finding #4 (cron delivery architecture incompatibility)
- **Phase 06 SSRF baseline**: Previous PRD, Phase 06 scope (5 user-facing fetch sites guarded)
- **Phase 09 secrets baseline**: Previous PRD, Phase 09 scope (5-boundary masking pipeline)
