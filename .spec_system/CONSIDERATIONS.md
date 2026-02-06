# Considerations

> Institutional memory for AI assistants. Updated between phases via /carryforward.
> **Line budget**: 600 max | **Last updated**: Phase 06 (2026-02-06)

---

## Active Concerns

Items requiring attention in upcoming phases. Review before each session.

### Technical Debt
<!-- Max 5 items -->

- [P00] **Stub files for disabled features**: API-compatible stubs remain for TTS, pairing, Bonjour (`src/tts/tts.ts`, `src/pairing/`, `src/infra/device-pairing.ts`, etc.). Functional code removed but stubs maintain type compatibility. Consider full removal in future cleanup phase.

- [P00] **18 pre-existing E2E test failures**: Tests across 16 files fail due to config redaction changes, node stub response changes, and stale auth expectations. Unit tests all pass (3946/3946); only E2E affected. See `.spec_system/audit/known-issues.md`.

- [P06] **Plugin fetch calls not SSRF-guarded**: The 5 user-facing fetch call sites are now guarded, but dynamically-loaded plugin code may contain fetch calls not captured by static analysis. Plugin sandboxing is a separate concern from core SSRF guards. If plugins are ever allowed to fetch user-provided URLs, they need SSRF coverage.

### External Dependencies
<!-- Max 5 items -->

- [P00] **WhatsApp types retained**: `src/config/types.whatsapp.ts` kept because WhatsApp web provider (`src/provider-web.ts`) still in use. Assess if this provider is still needed.

- [P05] **GitHub Actions billing blocker**: All CI workflows fail with payment/spending-limit error on `moshehbenavraham` account. Fix billing in GitHub Settings -> Billing & plans. Blocks all CI validation until resolved.

- [P06] **npm audit vulnerabilities**: `pnpm audit` reports 7 vulnerabilities (3 high, 4 moderate) in transitive deps: `node-tar` (arbitrary file), `fast-xml-parser` (RangeError DoS), `@isaacs/brace-expansion` (uncontrolled resource). CI uses `continue-on-error: true` so not blocking.

### Performance / Security
<!-- Max 5 items -->

- [P06] **SSRF guard coverage is call-site-based**: 70 fetch call sites inventoried; 5 user-facing sites now guarded, 65 trusted-API sites not guarded. If any trusted endpoint becomes user-configurable in the future, it needs SSRF review. See research doc: `.spec_system/PRD/phase_06/research/security-hardening-delta.md`.

- [P06] **Telegram download timeouts**: Metadata (getFile) = 30s, content (downloadFile) = 60s. If legitimate large file downloads time out, these values need tuning. Currently hardcoded defaults — not user-configurable.

### Architecture
<!-- Max 5 items -->

- [P00] **Telegram-only channel registry**: Codebase now assumes single-channel (Telegram). Any future channel additions need registry reconstruction in `src/channels/registry.ts`.

- [P00] **Plugin system intact**: Core plugin system (`src/plugins/`) preserved for runtime plugin loading even though bundled extensions removed. Future plugins can still be loaded.

- [P06] **Security guard architecture**: Three-layer defense — SSRF (`src/infra/net/ssrf.ts` + `fetch-guard.ts`), download timeouts (`src/telegram/download.ts`), path traversal (`src/agents/sandbox-paths.ts` + `src/media/store.ts`). All new security code follows upstream patterns for future merge compatibility.

---

## Lessons Learned

Proven patterns and anti-patterns. Reference during implementation.

### What Worked
<!-- Max 15 items -->

- [P00] **Incremental verification**: Running build/lint/test after each major change catches issues early. Remove/modify one category at a time.

- [P00] **Reference tracing before deletion**: Grep for all imports/references before deleting or modifying code. In P06 this meant inventorying all 70 fetch call sites before adding SSRF guards.

- [P00] **Scope discipline**: Defer out-of-scope cleanups to later sessions. Keeps sessions focused and manageable.

- [P00] **TypeScript as refactoring guide**: Strict typing effectively identifies necessary updates after changes. Let compiler errors guide the cleanup.

- [P00] **Bottom-up deletion order**: Delete leaf files first, then work up to widely-imported files. Minimizes TypeScript error cascades.

- [P04] **Grammy HttpError `.error` traversal**: Grammy wraps errors in `.error` (not `.cause`). Verify library-specific error chain patterns rather than assuming standard `.cause` traversal.

- [P04] **Verbatim upstream port pattern**: When porting from upstream, match the upstream approach exactly first, then adapt only what the stripped-down architecture requires. Minimizes divergence and simplifies future merges.

- [P06] **Research-first security pattern**: Comprehensive call-site inventory (Session 01) before implementing guards (Sessions 02-03) ensures no gaps. The 70-site inventory found that only 5 needed guards — saved effort and prevented false positives on trusted APIs.

- [P06] **Layered security testing**: Unit tests for individual functions, then integration tests validating the full chain (SSRF + redirect + DNS pinning). Session 04 added 43 integration tests that caught edge cases unit tests missed.

- [P06] **AbortSignal.timeout() as standard pattern**: Node 22+ provides `AbortSignal.timeout(ms)` — automatic cleanup, non-extensible, throws `TimeoutError`. Use this instead of manual `AbortController` + `setTimeout` for simple timeout enforcement.

- [P05] **tsdown `external` for native modules**: Native `.node` files (`@napi-rs/canvas`, `@reflink/reflink`) must be listed in `tsdown.config.ts` `external` array. The bundler cannot process binary add-ons.

### What to Avoid
<!-- Max 10 items -->

- [P00] **Test coupling to fixtures**: Tests may have indirect dependencies on removed features through shared fixtures and plugin utilities. Test failures reveal hidden dependencies.

- [P00] **Dead code in unexpected places**: Infrastructure modules may retain code referencing removed features. Do a secondary pass after major removals.

- [P00] **Removing types still in use**: Always verify actual usage before deleting type definitions. WhatsApp types survived removal because web provider still uses them.

- [P06] **Guarding trusted-API fetches unnecessarily**: 65 of 70 fetch sites target hardcoded trusted endpoints (GitHub, OpenAI, Telegram API, etc.). Adding SSRF guards to these would add latency and complexity with no security benefit. Only guard user-provided/user-configurable URLs.

- [P06] **Manual redirect following without SSRF re-validation**: If using `redirect: "manual"` in fetch, each redirect hop must be re-validated against SSRF rules. Without this, an attacker redirects from a public URL to an internal IP, bypassing the initial SSRF check. `fetch-guard.ts` handles this correctly.

### Tool/Library Notes
<!-- Max 5 items -->

- [P00] **pnpm patches require exact versions**: Any dependency with `pnpm.patchedDependencies` must use exact version (no `^`/`~`).

- [P05] **tsdown config**: `skipNodeModulesBundle: true` but native modules need explicit `external`. Post-build scripts handle additional setup. Build: `pnpm build`.

- [P06] **undici Dispatcher for DNS pinning**: SSRF protection uses `undici.Agent` with custom `connect` option to pin DNS resolution. The `createPinnedDispatcher()` in `ssrf.ts` returns a dispatcher that must be closed via `closeDispatcher()` after use to prevent resource leaks.

---

## Resolved

Recently closed items (buffer - rotates out after 2 phases).

| Phase | Item | Resolution |
|-------|------|------------|
| P06 | SSRF guards for all user-facing fetches | `fetch-guard.ts` + integration into webhook, skills-install, media/fetch (38 new tests) |
| P06 | Telegram download timeouts | `AbortSignal.timeout()` on getFile (30s) and downloadFile (60s), 14 new tests |
| P06 | Path traversal in media store | `assertMediaPath()` guard in `store.ts`, rejects `../` and symlink escapes |
| P06 | Security validation | 43 integration tests, full suite (3946 tests, 0 failures), security audit clean |
| P05 | tsdown migration | Replaced tsc with tsdown bundler, native module externals configured |
| P05 | TypeScript config unification | Unified tsconfig across workspace packages |
| P05 | Stricter linting (oxlint) | Enabled stricter rules, cleaned all violations |
| P05 | CI integration for build tooling | All 5 pipeline bundles configured, runner migration to ubuntu-latest |
| P04 | Grammy timeout recovery | HttpError traversal, scoped rejection handler, error codes/patterns |
| P04 | Session transcript repair | JSONL file repair, tool call sanitization, guarded append |

---

*Auto-generated by /carryforward. Manual edits allowed but may be overwritten.*
