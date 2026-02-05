# crocbot Upstream Sync - Product Requirements Document

## Overview

This PRD defines the work to port valuable changes from the upstream OpenClaw repository to crocbot. The upstream codebase was pulled on 2026-02-04 and resides in `.001_ORIGINAL/` for reference during implementation.

The upstream repository has accumulated significant improvements across four areas: new features (QMD vector memory, Telegram model buttons), bug fixes (Grammy timeouts, cron delivery, session repair), build tooling (tsdown bundler, unified tsconfig, stricter linting), and security hardening (SSRF guards, download timeouts, exec allowlist, path traversal fixes, TLS 1.3). This work selectively adopts changes that benefit crocbot's Telegram-first, single-user deployment model.

**Research Note**: Deep analysis revealed that some upstream changes are not directly portable due to architectural differences introduced during crocbot's strip-down (e.g., cron delivery model, exec allowlist already implemented). The phases below reflect these findings.

## Goals

1. Improve crocbot stability by porting critical bug fixes from upstream
2. Harden security posture with SSRF guards, timeout enforcement, and path validation
3. Modernize build tooling for faster builds and stricter type safety
4. Selectively adopt features that enhance the Telegram experience

## Non-Goals

- Porting all upstream changes indiscriminately
- Adopting QMD vector memory (requires external binary, overkill for single-user)
- Supporting channels beyond Telegram and CLI
- Maintaining backwards compatibility with pre-stripped crocbot versions
- Porting changes related to removed components (native apps, Matrix, Twitch, etc.)

## Users and Use Cases

### Primary Users

- **Single Operator**: The sole user running crocbot as a personal AI assistant via Telegram and CLI

### Key Use Cases

1. Interact with crocbot via Telegram without crashes during network interruptions
2. Trust that external URL fetches are protected against SSRF attacks
3. Recover gracefully from session file corruption after crashes
4. Switch AI models easily using Telegram inline buttons (deferred feature)

## Requirements

### MVP Requirements (Phases 03-06)

- Port Grammy timeout recovery to prevent Telegram bot crashes (requires adding 3 specific fixes)
- Add SSRF guards for all remote media and URL fetches
- Implement download timeouts for Telegram file operations
- Port session transcript repair for crash resilience
- Add path traversal validation for file operations
- Migrate to tsdown for faster production builds
- Enable stricter TypeScript and linting rules

### Already Implemented (No Port Needed)

- **Exec allowlist hardening** - crocbot already has comprehensive exec security in `src/infra/exec-approvals.ts` (1,268 lines) with shell token blocking, quote-aware parsing, path resolution validation, and default-deny policies

### Deferred Requirements

- QMD vector memory backend (requires external `qmd` binary, overkill for single-user)
- Telegram inline button model selection (nice-to-have enhancement)
- TLS 1.3 minimum (production uses Coolify reverse proxy for TLS termination)

## Non-Functional Requirements

- **Performance**: Build times should decrease with tsdown migration
- **Security**: All remote fetches must pass SSRF validation; no path traversal vulnerabilities
- **Reliability**: Telegram bot must recover gracefully from network timeouts
- **Maintainability**: Stricter linting catches issues earlier; unified tsconfig simplifies builds

## Constraints and Dependencies

- Upstream reference codebase in `.001_ORIGINAL/` must be preserved during implementation
- Changes must not break existing Telegram or CLI functionality
- Security fixes take priority over feature additions
- Build tooling changes must not require new system dependencies
- Node 22+ runtime requirement remains unchanged

## Phases

This system delivers the product via phases. Each phase is implemented via multiple 2-4 hour sessions (12-25 tasks each).

| Phase | Name | Sessions | Status |
|-------|------|----------|--------|
| 00 | Strip Moltbot to minimal footprint for VPS/Coolify/Ubuntu deployment | 8 | Complete |
| 01 | Production Hardening and Deployment | 5 | Complete |
| 02 | Operational Maturity and Observability | 4/5 | Session 5 Deferred; Complete |
| 03 | Upstream Features Port | 3 | Complete |
| 04 | Upstream Bug Fixes Port | 3 | Started |
| 05 | Upstream Build Tooling Port | TBD | Not Started |
| 06 | Upstream Security Hardening Port | TBD | Not Started |

## Phase 03: Upstream Features Port

### Objectives

1. Evaluate and selectively port Telegram inline button model selection
2. Document QMD vector memory architecture for potential future adoption

### Scope

**From UPSTREAM_FEATURES.md:**

- **Telegram Inline Button Model Selection** - Interactive buttons for browsing and selecting AI models in Telegram. Key files: `src/telegram/model-buttons.ts`, `src/telegram/bot-handlers.ts`. Includes callback data patterns, pagination, and provider navigation.

- **QMD Vector Memory** (document only, do not implement) - Optional vector memory backend for semantic search. Requires external `qmd` binary. Document the architecture in case future requirements warrant adoption.

### Key Files in `.001_ORIGINAL/`

- `src/telegram/model-buttons.ts` - Button building utilities
- `src/telegram/bot-handlers.ts` - Callback query handler
- `src/auto-reply/reply/commands-models.ts` - Model data provider
- `src/memory/qmd-manager.ts` - QMD manager (reference only)
- `src/config/types.memory.ts` - Memory configuration types (reference only)

### Sessions

| Session | Name | Status |
|---------|------|--------|
| 01 | Research Upstream Features | Complete |
| 02 | Telegram Model Buttons Implementation | Complete |
| 03 | Feature Validation and Documentation | Complete |

**Phase Completed**: 2026-02-05

## Phase 04: Upstream Bug Fixes Port

### Objectives

1. Eliminate Telegram bot crashes from Grammy network errors
2. Prevent session file corruption from causing API rejections

### Scope

**From UPSTREAM_BUGFIXES.md:**

- **Grammy Timeout Recovery** - Three specific fixes needed in crocbot:
  1. Add `.error` property traversal in `collectErrorCandidates()` - Grammy's HttpError wraps errors in `.error` not `.cause`
  2. Add "timed out" message pattern to `RECOVERABLE_MESSAGE_SNIPPETS` - Grammy returns "timed out after X seconds"
  3. Register scoped unhandled rejection handler in `monitor.ts` for Grammy HttpError

  Key files: `src/telegram/network-errors.ts`, `src/telegram/monitor.ts`.

  **Port Status**: Infrastructure exists (global handler in `src/infra/unhandled-rejections.ts`, HttpError imported in `send.ts`). Fixes are additive and low-risk.

- **Tool Call Repair** - Repairs malformed tool calls (missing input), fixes tool use/result pairing, repairs session file JSONL. Key files: `src/agents/session-transcript-repair.ts`, `src/agents/session-file-repair.ts`.

### Descoped: Cron Job Delivery Fixes

**NOT PORTABLE** - crocbot's cron implementation has architectural differences from upstream:
- Upstream uses separate `CronDelivery` object with dedicated `delivery.ts` module
- crocbot embedded delivery config directly in payload during strip-down
- Type system mismatch: upstream `job.delivery` vs crocbot `job.payload.deliver`
- Missing infrastructure: `resolveCronDeliveryPlan()`, `mergeCronDelivery()`, etc.

If cron delivery issues arise, they must be fixed within crocbot's simplified model rather than ported from upstream.

### Key Files in `.001_ORIGINAL/`

- `src/telegram/network-errors.ts` - Network error handling
- `src/telegram/monitor.ts` - Telegram monitoring
- `src/agents/session-transcript-repair.ts` - Transcript repair logic
- `src/agents/session-file-repair.ts` - Session file repair logic

### Sessions

| Session | Name | Status |
|---------|------|--------|
| 01 | Grammy Timeout Recovery | Complete |
| 02 | Session Transcript Repair | Not Started |
| 03 | Bug Fix Validation | Not Started |

Session stubs defined in `.spec_system/PRD/phase_04/`.

## Phase 05: Upstream Build Tooling Port

### Objectives

1. Achieve faster production builds with tsdown migration
2. Unify TypeScript configuration for src and ui directories
3. Enable stricter linting rules to catch issues earlier

### Scope

**From UPSTREAM_BUILD_TOOLING.md:**

- **tsdown Migration** - Replace tsc with tsdown for ~10x faster bundling. Requires `tsdown.config.ts`, explicit entry points, NODE_ENV toggle for production detection.

- **Merged tsconfigs** - Unify `src/` and `ui/` under single tsconfig. Use NodeNext module resolution, ES2023 target, include DOM types for UI.

- **pnpm check Script** - Add convenience script running `pnpm tsgo && pnpm lint && pnpm format`.

- **Stricter Linting** - Enable `typescript/no-explicit-any`, `no-unnecessary-template-expression`, perf category rules.

### Key Files in `.001_ORIGINAL/`

- `tsdown.config.ts` - tsdown bundler configuration
- `tsconfig.json` - Unified TypeScript configuration
- `.oxlintrc.json` - Oxlint rule configuration
- `package.json` - Script definitions

### Sessions (To Be Defined)

Sessions are defined via `/phasebuild` as `session_NN_name.md` stubs under `.spec_system/PRD/phase_05/`.

## Phase 06: Upstream Security Hardening Port

### Objectives

1. Block SSRF attacks on all remote URL fetches
2. Prevent DoS from slow or malicious file downloads
3. Block path traversal attempts in file operations

### Scope

**From UPSTREAM_SECURITY_HARDENING.md:**

- **SSRF Guards** - IP address blocking (private ranges), hostname blocking (localhost, .local, .internal), DNS pinning, redirect validation. Key files: `src/infra/net/ssrf.ts`, `src/infra/net/fetch-guard.ts`, `src/media/fetch.ts`.

- **Telegram Download Timeouts** - Add AbortSignal.timeout to getFile and downloadFile operations. Key file: `src/telegram/download.ts`.

- **Path Traversal Fixes** - Validate file paths stay within sandbox root. Key file: `src/agents/tools/message-tool.ts`.

### Already Implemented (No Port Needed)

- **Exec Allowlist Hardening** - crocbot already has comprehensive exec security:
  - Shell token blocking (`>`, `<`, backticks, `$()`, newlines)
  - Quote-aware command parsing
  - Path resolution validation with realpath
  - Glob-based allowlist patterns (path-based, not name-based)
  - Default-deny policy for sandbox mode
  - Safe bins precheck (jq, grep, etc. without file args)
  - Recent hardening in version 2026.1.54 (commit 1aa9e7ecb)

### Descoped: TLS 1.3 Minimum

**NOT NEEDED** - crocbot production deployments use Coolify reverse proxy for TLS termination:
- Coolify provides automatic Let's Encrypt certificate management
- Gateway runs HTTP internally (`0.0.0.0:8080`) behind the proxy
- Direct TLS at gateway level is optional and only for special cases (VPN, Tailscale)
- Current minimum is TLSv1.2 when direct TLS is enabled
- Upgrading to TLS 1.3 would only affect direct-access scenarios, not production

### Key Files in `.001_ORIGINAL/`

- `src/infra/net/ssrf.ts` - SSRF protection logic
- `src/infra/net/fetch-guard.ts` - Guarded fetch wrapper
- `src/media/fetch.ts` - Media fetching with guards
- `src/telegram/download.ts` - Telegram file operations
- `src/agents/tools/message-tool.ts` - File path validation

### Sessions (To Be Defined)

Sessions are defined via `/phasebuild` as `session_NN_name.md` stubs under `.spec_system/PRD/phase_06/`.

## Technical Stack

- **Language**: TypeScript (strict mode, ESM)
- **Runtime**: Node.js 22+
- **Package Manager**: pnpm
- **Build Tool**: tsdown (to be migrated)
- **Linter**: oxlint
- **Formatter**: oxfmt
- **Test Framework**: Vitest
- **Telegram SDK**: grammy, @grammyjs/runner, @grammyjs/transformer-throttler

## Success Criteria

- [ ] Telegram bot recovers gracefully from network timeouts without crashing
- [ ] All remote URL fetches pass SSRF validation
- [ ] File downloads have enforced timeouts
- [ ] Session files self-repair after crashes
- [ ] Production builds complete in under 30 seconds
- [ ] TypeScript strict mode passes with no `any` types in new code
- [ ] All lint rules pass without exclusions for new code

## Risks

- **API Incompatibility**: Upstream changes may assume features crocbot removed. Mitigation: Research confirmed cron delivery has incompatible architecture; descoped. Other fixes verified compatible.
- **Grammy Fix Conflicts**: Telegram error handling has partial implementation. Mitigation: Specific changes documented; fixes are additive, not replacing existing code.
- **Regression**: Ported code may introduce bugs in existing functionality. Mitigation: Run full test suite after each session; manual testing of Telegram flows.
- **Scope Creep**: Temptation to port "nice to have" features. Mitigation: Strict adherence to phase scope; defer to future phases if needed.

## Assumptions

- `.001_ORIGINAL/` contains a complete, working copy of upstream OpenClaw
- Upstream code quality is production-ready and well-tested
- Security fixes are critical and should be prioritized
- Build tooling changes will not require changes to CI/CD workflows
- Grammy timeout fixes are additive and will not break existing Telegram error handling
- Session transcript repair can be ported without cron delivery dependencies

## Research Findings

The following questions were researched and answered on 2026-02-04:

### 1. TLS Configuration

**Question**: Should TLS 1.3 minimum be enforced for gateway HTTPS, or does crocbot rely on reverse proxy termination?

**Finding**: Production deployments use Coolify reverse proxy for TLS termination. Gateway runs HTTP internally. Direct TLS at gateway level is optional (for VPN/Tailscale scenarios) with current minimum TLSv1.2.

**Decision**: Descope TLS 1.3 upgrade. Not needed for production architecture.

### 2. Grammy Timeout Compatibility

**Question**: Are there any crocbot-specific modifications to Telegram handling that would conflict with Grammy timeout fixes?

**Finding**: crocbot has partial implementation. Missing three specific fixes:
- `.error` property traversal in `collectErrorCandidates()` (Grammy HttpError uses `.error` not `.cause`)
- "timed out" message pattern (Grammy returns "timed out after X seconds")
- Scoped unhandled rejection handler in `monitor.ts`

The infrastructure exists (`registerUnhandledRejectionHandler`, HttpError imports). Fixes are additive.

**Decision**: Port is feasible with conflict resolution. Document specific changes needed in Phase 04.

### 3. Exec Allowlist Status

**Question**: Does crocbot use shell execution features that require the exec allowlist hardening?

**Finding**: crocbot ALREADY has comprehensive exec allowlist hardening in `src/infra/exec-approvals.ts` (1,268 lines):
- Shell token blocking (redirections, command substitution, newlines)
- Quote-aware parsing
- Path resolution with realpath
- Glob-based allowlist patterns (path-based, not name-based)
- Default-deny for sandbox, allowlist-required for gateway
- Recent hardening in version 2026.1.54

**Decision**: No port needed. Remove from Phase 06 scope.

### 4. Cron Implementation Compatibility

**Question**: Is the current cron implementation similar enough to upstream for delivery fixes to apply cleanly?

**Finding**: NOT compatible for direct porting. Significant architectural differences:
- Upstream: Separate `CronDelivery` object with dedicated `delivery.ts` module
- crocbot: Delivery config embedded in payload during strip-down
- Type mismatch: `job.delivery` (upstream) vs `job.payload.deliver` (crocbot)
- Missing infrastructure: `resolveCronDeliveryPlan()`, `mergeCronDelivery()`, etc.
- WhatsApp/multi-channel delivery logic intentionally removed

**Decision**: Descope cron delivery fixes from Phase 04. If issues arise, fix within crocbot's simplified model.
