# Security Hardening Delta Analysis

**Phase**: 06 - Upstream Security Hardening Port
**Session**: phase06-session01-research-security-hardening-delta
**Created**: 2026-02-05
**Grammy Version**: ^1.39.3
**Node Runtime**: 22+

---

## Table of Contents

1. [Call Site Inventory](#1-call-site-inventory)
2. [SSRF Delta Analysis](#2-ssrf-delta-analysis)
3. [Fetch-Guard Gap Analysis](#3-fetch-guard-gap-analysis)
4. [Telegram Download Timeouts](#4-telegram-download-timeouts)
5. [Path Traversal Delta Analysis](#5-path-traversal-delta-analysis)
6. [Risk Assessment](#6-risk-assessment)
7. [Implementation Plan for Sessions 02-04](#7-implementation-plan-for-sessions-02-04)

---

## 1. Call Site Inventory

### 1.1 fetch() Call Sites

| # | File | Line | Purpose | Boundary | SSRF Needed |
|---|------|------|---------|----------|-------------|
| 1 | src/providers/github-copilot-auth.ts | 47 | GitHub Copilot device code request | core | No (trusted API) |
| 2 | src/providers/github-copilot-auth.ts | 79 | GitHub Copilot access token poll | core | No (trusted API) |
| 3 | src/providers/qwen-portal-oauth.ts | 15 | Qwen OAuth token exchange | core | No (trusted API) |
| 4 | src/providers/github-copilot-token.ts | 107 | GitHub Copilot token fetch | core | No (trusted API) |
| 5 | src/tts/tts.ts | 1049 | ElevenLabs TTS API | core | No (trusted API) |
| 6 | src/tts/tts.ts | 1104 | OpenAI TTS API | core | No (trusted API) |
| 7 | src/browser/client-fetch.ts | 40 | Browser client HTTP request | gateway | No (localhost) |
| 8 | src/browser/server-context.ts | 58 | Browser server context fetch | gateway | No (localhost) |
| 9 | src/browser/server-context.ts | 73 | Browser server context fetch | gateway | No (localhost) |
| 10 | src/browser/cdp.helpers.ts | 114 | Chrome DevTools Protocol fetch | gateway | No (localhost) |
| 11 | src/browser/cdp.helpers.ts | 129 | Chrome DevTools Protocol fetch | gateway | No (localhost) |
| 12 | src/browser/chrome.ts | 84 | Chrome version from CDP | gateway | No (localhost) |
| 13 | src/browser/pw-session.ts | 403 | Playwright CDP target list | gateway | No (localhost) |
| 14 | src/memory/embeddings-openai.ts | 34 | OpenAI embeddings API | core | No (trusted API) |
| 15 | src/memory/batch-gemini.ts | 137 | Gemini batch file upload | core | No (trusted API) |
| 16 | src/memory/batch-gemini.ts | 169 | Gemini batch job creation | core | No (trusted API) |
| 17 | src/memory/batch-gemini.ts | 196 | Gemini batch status check | core | No (trusted API) |
| 18 | src/memory/batch-gemini.ts | 214 | Gemini batch result download | core | No (trusted API) |
| 19 | src/memory/embeddings-gemini.ts | 77 | Gemini embeddings API | core | No (trusted API) |
| 20 | src/memory/embeddings-gemini.ts | 102 | Gemini batch embeddings | core | No (trusted API) |
| 21 | src/memory/batch-openai.ts | 84 | OpenAI batch file upload | core | No (trusted API) |
| 22 | src/memory/batch-openai.ts | 100 | OpenAI batch job creation | core | No (trusted API) |
| 23 | src/memory/batch-openai.ts | 142 | OpenAI batch status poll | core | No (trusted API) |
| 24 | src/memory/batch-openai.ts | 157 | OpenAI batch result download | core | No (trusted API) |
| 25 | src/alerting/notifier-webhook.ts | 56 | Webhook notification to custom URL | core | YES (user-configured URL) |
| 26 | src/telegram/download.ts | 12 | Telegram getFile metadata | telegram | No (trusted API) |
| 27 | src/telegram/download.ts | 34 | Telegram file download from CDN | telegram | No (trusted API) |
| 28 | src/telegram/audit.ts | 35 | Telegram group audit (wrapper) | telegram | No (trusted API) |
| 29 | src/telegram/probe.ts | 28 | Telegram API probe (wrapper) | telegram | No (trusted API) |
| 30 | src/infra/update-check.ts | 296 | npm registry version check | core | No (trusted API) |
| 31 | src/infra/fetch.ts | 33-51 | Fetch wrapper (AbortSignal normalization) | core | N/A (wrapper) |
| 32 | src/agents/models-config.providers.ts | 99 | Ollama model list | agents | No (localhost) |
| 33 | src/agents/opencode-zen-models.ts | 273 | OpenCode Zen model list | agents | No (trusted API) |
| 34 | src/agents/venice-models.ts | 338 | Venice AI model list | agents | No (trusted API) |
| 35 | src/agents/minimax-vlm.ts | 69 | Minimax VLM API | agents | No (trusted API) |
| 36 | src/agents/sandbox/browser.ts | 28 | Sandbox browser CDP check | agents | No (localhost) |
| 37 | src/agents/skills-install.ts | 183 | Download skill package from URL | agents | YES (user-provided URL) |
| 38 | src/agents/tools/web-fetch.ts | 217 | Agent web_fetch tool | agents | YES (user-provided URL) |
| 39 | src/agents/tools/web-fetch.ts | 307 | Firecrawl API fallback | agents | No (trusted API) |
| 40 | src/agents/tools/web-search.ts | 321 | LLM completion for search | agents | No (trusted API) |
| 41 | src/agents/tools/web-search.ts | 420 | Brave/search results fetch | agents | No (trusted API) |
| 42 | src/agents/model-scan.ts | 197 | OpenRouter models catalog | agents | No (trusted API) |
| 43 | src/agents/chutes-oauth.ts | 75 | Chutes user info fetch | agents | No (trusted API) |
| 44 | src/agents/chutes-oauth.ts | 110 | Chutes token exchange | agents | No (trusted API) |
| 45 | src/channels/plugins/onboarding/telegram.ts | 90 | Telegram onboarding verify | telegram | No (trusted API) |
| 46 | src/media/fetch.ts | 85 | Remote media download (wrapper) | core | YES (user-provided URL) |
| 47 | src/media/input-files.ts | 170 | Remote input file fetch | core | YES (user-provided URL) |
| 48 | src/media-understanding/providers/deepgram/audio.ts | 52 | Deepgram audio API (wrapper) | core | No (trusted API) |
| 49 | src/media-understanding/providers/google/audio.ts | 55 | Google audio API (wrapper) | core | No (trusted API) |
| 50 | src/media-understanding/providers/google/video.ts | 55 | Google video API (wrapper) | core | No (trusted API) |
| 51 | src/media-understanding/providers/openai/audio.ts | 42 | OpenAI audio API (wrapper) | core | No (trusted API) |
| 52 | src/infra/provider-usage.fetch.claude.ts | 46-114 | Claude usage metrics | core | No (trusted API) |
| 53 | src/infra/provider-usage.fetch.copilot.ts | 18 | Copilot usage metrics | core | No (trusted API) |
| 54 | src/infra/provider-usage.fetch.gemini.ts | 19 | Gemini usage metrics | core | No (trusted API) |
| 55 | src/infra/provider-usage.fetch.antigravity.ts | 217-257 | Antigravity usage metrics | core | No (trusted API) |
| 56 | src/infra/provider-usage.fetch.codex.ts | 37 | Codex usage metrics | core | No (trusted API) |
| 57 | src/infra/provider-usage.fetch.minimax.ts | 315 | Minimax usage metrics | core | No (trusted API) |
| 58 | src/infra/provider-usage.fetch.zai.ts | 27 | ZAI usage metrics | core | No (trusted API) |

### 1.2 Extension fetch() Call Sites

| # | File | Line | Purpose | Boundary | SSRF Needed |
|---|------|------|---------|----------|-------------|
| 59 | extensions/google-antigravity-auth/index.ts | 181 | Google OAuth token exchange | extensions | No (trusted API) |
| 60 | extensions/google-antigravity-auth/index.ts | 218 | Google user email fetch | extensions | No (trusted API) |
| 61 | extensions/google-antigravity-auth/index.ts | 244 | Google Code Assist config | extensions | No (trusted API) |
| 62 | extensions/google-gemini-cli-auth/oauth.ts | 315 | Gemini CLI token exchange | extensions | No (trusted API) |
| 63 | extensions/google-gemini-cli-auth/oauth.ts | 351 | Gemini CLI user info | extensions | No (trusted API) |
| 64 | extensions/google-gemini-cli-auth/oauth.ts | 390 | Gemini CLI Code Assist load | extensions | No (trusted API) |
| 65 | extensions/google-gemini-cli-auth/oauth.ts | 444 | Gemini CLI onboard user | extensions | No (trusted API) |
| 66 | extensions/google-gemini-cli-auth/oauth.ts | 498 | Gemini CLI operation status | extensions | No (trusted API) |
| 67 | extensions/voice-call/src/providers/tts-openai.ts | 113 | OpenAI TTS for voice call | extensions | No (trusted API) |
| 68 | extensions/voice-call/src/providers/telnyx.ts | 54 | Telnyx telecom API | extensions | No (trusted API) |
| 69 | extensions/voice-call/src/providers/plivo.ts | 71 | Plivo telecom API | extensions | No (trusted API) |
| 70 | extensions/voice-call/src/providers/twilio/api.ts | 26 | Twilio telecom API | extensions | No (trusted API) |

### 1.3 http/https/Third-Party Client Call Sites

No call sites using `http.get()`, `http.request()`, `https.get()`, `https.request()`, `axios`, `got`, or `undici` direct client were found. All HTTP traffic goes through `fetch()` or fetch wrappers. The `undici` package is used only for `Agent`/`Dispatcher` (DNS pinning in ssrf.ts), not for direct HTTP requests.

### 1.4 Summary by Security Boundary

| Boundary | Total Sites | Needs SSRF Guard | Already Safe | Notes |
|----------|-------------|------------------|-------------|-------|
| core | 35 | 3 | 32 | Webhook notifier, media fetch, input files need guards |
| agents | 11 | 2 | 9 | web_fetch tool, skills-install need guards |
| gateway | 7 | 0 | 7 | All localhost CDP/browser requests |
| telegram | 5 | 0 | 5 | All Telegram API endpoints (trusted) |
| extensions | 12 | 0 | 12 | All trusted third-party API endpoints |
| **Total** | **70** | **5** | **65** | |

### 1.5 Call Sites Requiring SSRF Guard

These 5 call sites accept user-provided or user-configured URLs and must be protected:

| # | File | Line | Reason | Current Protection |
|---|------|------|--------|--------------------|
| 1 | src/alerting/notifier-webhook.ts | 56 | User-configured webhook URL | None |
| 2 | src/agents/skills-install.ts | 183 | User-provided skill URL | None |
| 3 | src/agents/tools/web-fetch.ts | 217 | Agent-provided arbitrary URL | Has undici Dispatcher with resolvePinnedHostname |
| 4 | src/media/fetch.ts | 85 | User-provided media URL | Uses fetcher wrapper (no SSRF) |
| 5 | src/media/input-files.ts | 170 | User-provided input file URL | Has undici Dispatcher with resolvePinnedHostname |

Note: web-fetch.ts (#3) and input-files.ts (#5) already use `resolvePinnedHostname()` + undici Dispatcher for SSRF protection. The remaining 3 call sites have no SSRF protection.

---

## 2. SSRF Delta Analysis

### 2.1 Upstream ssrf.ts Overview

**File**: `.001_ORIGINAL/src/infra/net/ssrf.ts` (309 lines)

The upstream module provides a complete SSRF defense with:
- IP range blocking (IPv4 private, IPv6 private, IPv4-mapped IPv6)
- Hostname blocklist (localhost, metadata.google.internal, *.local, *.internal, *.localhost)
- DNS resolution with pinning to prevent DNS rebinding
- Policy-based validation with allowlists
- undici Dispatcher integration for secure HTTP connections

### 2.2 Crocbot ssrf.ts Overview

**File**: `src/infra/net/ssrf.ts` (281 lines)

Crocbot has a partial port of the upstream ssrf.ts. The core IP validation, hostname blocking, DNS pinning, and dispatcher creation are present. Missing: the policy-based `resolvePinnedHostnameWithPolicy()` function and the `SsrFPolicy` type.

### 2.3 Function-by-Function Delta

| Function | Upstream | Crocbot | Delta | Decision | Rationale |
|----------|----------|---------|-------|----------|-----------|
| `SsrFBlockedError` | Present | Present | Identical | Keep | No change needed |
| `LookupFn` type | Exported (`export type`) | Not exported (`type`) | Export missing | Adopt | fetch-guard.ts needs the export |
| `SsrFPolicy` type | Present | Missing | Entirely absent | Adopt | Required for policy-based SSRF validation |
| `normalizeHostname()` | Present | Present | Identical | Keep | No change needed |
| `normalizeHostnameSet()` | Present | Missing | Entirely absent | Adopt | Required by resolvePinnedHostnameWithPolicy |
| `parseIpv4()` | Present | Present | Identical | Keep | No change needed |
| `parseIpv4FromMappedIpv6()` | Present | Present | Identical | Keep | No change needed |
| `isPrivateIpv4()` | Present | Present | Identical | Keep | No change needed |
| `isPrivateIpAddress()` | Present | Present | Identical | Keep | No change needed |
| `isBlockedHostname()` | Present | Present | Identical | Keep | No change needed |
| `createPinnedLookup()` | Present | Present | Identical | Keep | No change needed |
| `PinnedHostname` type | Present | Present | Identical | Keep | No change needed |
| `resolvePinnedHostnameWithPolicy()` | Present | Missing | Entirely absent | Adopt | New function; crocbot's resolvePinnedHostname has this logic inlined without policy |
| `resolvePinnedHostname()` | Delegates to WithPolicy | Standalone (no policy) | Different impl | Adopt | Refactor to delegate to WithPolicy, matching upstream |
| `createPinnedDispatcher()` | Present | Present | Identical | Keep | No change needed |
| `closeDispatcher()` | Present | Present | Identical | Keep | No change needed |
| `assertPublicHostname()` | Present | Present | Identical | Keep | No change needed |

### 2.4 Blocked IP Ranges Delta

| Range | CIDR | Upstream | Crocbot | Delta |
|-------|------|----------|---------|-------|
| "This" network | 0.0.0.0/8 | Blocked | Blocked | Identical |
| Private 10.x | 10.0.0.0/8 | Blocked | Blocked | Identical |
| Loopback | 127.0.0.0/8 | Blocked | Blocked | Identical |
| Link-local | 169.254.0.0/16 | Blocked | Blocked | Identical |
| Private 172.16-31.x | 172.16.0.0/12 | Blocked | Blocked | Identical |
| Private 192.168.x | 192.168.0.0/16 | Blocked | Blocked | Identical |
| Carrier-grade NAT | 100.64.0.0/10 | Blocked | Blocked | Identical |
| IPv6 loopback | ::1 | Blocked | Blocked | Identical |
| IPv6 unspecified | :: | Blocked | Blocked | Identical |
| IPv6 link-local | fe80::/10 | Blocked | Blocked | Identical |
| IPv6 site-local | fec0::/10 | Blocked | Blocked | Identical |
| IPv6 unique local | fc00::/7 | Blocked | Blocked | Identical |
| IPv4-mapped IPv6 | ::ffff:x.x.x.x | Blocked | Blocked | Identical |

All blocked IP ranges are identical between upstream and crocbot. No new ranges added upstream.

### 2.5 Blocked Hostnames Delta

| Pattern | Type | Upstream | Crocbot | Delta |
|---------|------|----------|---------|-------|
| localhost | Exact | Blocked | Blocked | Identical |
| metadata.google.internal | Exact | Blocked | Blocked | Identical |
| *.localhost | Suffix | Blocked | Blocked | Identical |
| *.local | Suffix | Blocked | Blocked | Identical |
| *.internal | Suffix | Blocked | Blocked | Identical |

All blocked hostnames are identical. No new patterns added upstream.

### 2.6 SSRF Delta Summary

The core SSRF validation logic (IP ranges, hostname blocking, DNS pinning) is identical between upstream and crocbot. The only differences are:

1. **Missing `SsrFPolicy` type and `resolvePinnedHostnameWithPolicy()`** -- upstream added policy-based validation that allows callers to specify `allowPrivateNetwork` and `allowedHostnames`. This is required by `fetch-guard.ts`.
2. **`LookupFn` not exported** -- upstream exports this type; needed by `fetch-guard.ts`.
3. **Missing `normalizeHostnameSet()` helper** -- used by `resolvePinnedHostnameWithPolicy()`.
4. **`resolvePinnedHostname()` implementation differs** -- upstream delegates to `resolvePinnedHostnameWithPolicy()` with empty policy; crocbot has standalone implementation.

---

## 3. Fetch-Guard Gap Analysis

### 3.1 Upstream fetch-guard.ts Overview

**File**: `.001_ORIGINAL/src/infra/net/fetch-guard.ts` (172 lines)

This file provides `fetchWithSsrFGuard()`, a comprehensive fetch wrapper that coordinates SSRF validation, DNS pinning, manual redirect handling, and timeout enforcement. It is the primary mechanism upstream uses to make safe outbound HTTP requests.

### 3.2 Crocbot Status

**`src/infra/net/fetch-guard.ts` does not exist in crocbot.** This is the single largest security gap between upstream and crocbot. Without this wrapper, each call site must independently implement SSRF validation, redirect safety, and timeout handling (and most do not).

### 3.3 Function and Type Inventory

| Export | Kind | Purpose | Integration Requirements |
|--------|------|---------|--------------------------|
| `GuardedFetchOptions` | Type | Options for guarded fetch (url, timeout, redirect limit, policy, signal) | Needs `SsrFPolicy`, `LookupFn` from ssrf.ts |
| `GuardedFetchResult` | Type | Result with response, finalUrl, and release() cleanup | Consumer must call release() to avoid leaks |
| `fetchWithSsrFGuard()` | Function | Main guarded fetch implementation | Depends on 4 functions from ssrf.ts |
| `FetchLike` | Type (internal) | Fetch function signature for DI | Uses globalThis.fetch as default |
| `isRedirectStatus()` | Function (internal) | Checks 301/302/303/307/308 | Pure function, no deps |
| `buildAbortSignal()` | Function (internal) | Combines timeout + external signal | Uses AbortController, setTimeout |

### 3.4 Redirect Validation Logic

The upstream `fetchWithSsrFGuard()` handles redirects manually (`redirect: "manual"` in fetch init):

1. **Loop detection**: Tracks visited URLs in a Set; throws on revisit
2. **Count limit**: Default 3 redirects; configurable via `maxRedirects`
3. **Missing location**: Throws if redirect response lacks Location header
4. **Per-hop SSRF validation**: Each redirect target URL gets its own DNS resolution and SSRF validation, preventing redirect-based SSRF bypass (attacker redirects from safe host to internal IP)
5. **Response body cleanup**: Cancels response body before following redirect
6. **Dispatcher cleanup**: Closes previous dispatcher before creating new one for redirect target

This is critical security infrastructure -- without manual redirect handling, a `fetch()` following redirects automatically could be redirected from a public URL to an internal/private address, bypassing SSRF checks.

### 3.5 Timeout Integration

The `buildAbortSignal()` helper creates a combined abort signal:

- **Timeout only**: Creates AbortController with `setTimeout(() => controller.abort(), timeoutMs)`
- **External signal only**: Passes through as-is
- **Both**: Composes them; whichever fires first wins
- **Cleanup**: Returns a cleanup function that clears timeout and removes abort listener
- **Already-aborted signal**: Immediately aborts if external signal is already aborted

The timeout applies to the entire fetch chain including all redirects.

### 3.6 Adaptation Notes

The upstream `fetchWithSsrFGuard()` can be ported verbatim to crocbot. It depends only on:
- `ssrf.ts` exports (which crocbot already mostly has; gap is SsrFPolicy + resolvePinnedHostnameWithPolicy)
- `undici` Dispatcher type (already in crocbot's dependencies)
- Standard Web APIs (URL, AbortController, fetch)

No adaptation needed for crocbot's stripped-down architecture -- the function is channel-agnostic and has no dependencies on removed infrastructure.

---

## 4. Telegram Download Timeouts

### 4.1 Upstream Download Timeout Implementation

**File**: `.001_ORIGINAL/src/telegram/download.ts`

Upstream adds `AbortSignal.timeout(timeoutMs)` to both Telegram file operations:

**getTelegramFile()** -- metadata request:
- Default timeout: 30 seconds
- Signal: `{ signal: AbortSignal.timeout(timeoutMs) }`
- Parameter: `timeoutMs = 30_000`

**downloadTelegramFile()** -- file content download:
- Default timeout: 60 seconds
- Signal: `{ signal: AbortSignal.timeout(timeoutMs) }`
- Parameter: `timeoutMs = 60_000`

### 4.2 Crocbot Current State

**File**: `src/telegram/download.ts`

Crocbot's version has **no timeout protection** on either operation:
- `getTelegramFile()` -- no signal parameter, no timeout
- `downloadTelegramFile()` -- no signal parameter, no timeout

This means requests can hang indefinitely if the Telegram API is slow or unresponsive, potentially causing resource exhaustion in the gateway process.

### 4.3 Other Upstream Timeout Patterns

| File | Function | Pattern | Timeout |
|------|----------|---------|---------|
| src/telegram/probe.ts | probeTelegram() | Manual AbortController + setTimeout | Configurable |
| src/telegram/audit.ts | audit() | Manual AbortController + setTimeout | Configurable |
| src/telegram/monitor.ts | runner config | Grammy runner.fetch.timeout | 30s |
| src/infra/net/fetch-guard.ts | buildAbortSignal() | AbortController + setTimeout + signal composition | Configurable |

### 4.4 Grammy API Analysis

**Grammy v1.39.3 getFile signature**:
```
getFile(file_id: string, signal?: AbortSignal): Promise<File>
```

Grammy's `getFile()` accepts an optional `AbortSignal` as the second parameter. This means:
- `ctx.getFile(AbortSignal.timeout(30_000))` works natively
- No Grammy upgrade or workaround needed

However, crocbot's download path uses **custom fetch calls** (not Grammy's getFile) in `src/telegram/download.ts`. The timeout must be added to these raw `fetch()` calls directly.

The `resolveMedia()` function in `src/telegram/bot/delivery.ts` (lines 262-383) calls `ctx.getFile()` without passing a signal. This should also be updated.

### 4.5 AbortSignal.timeout in Node 22+

`AbortSignal.timeout(ms)` is available since Node 15.0.0. Crocbot requires Node 22.12+, so this API is fully available with zero compatibility concerns. It is the recommended pattern for timeout enforcement:
- Automatic cleanup (no manual clearTimeout needed)
- Creates a non-settable timeout that cannot be extended
- Throws `TimeoutError` (DOMException with name "TimeoutError") on expiry

### 4.6 Upstream Network Error Recovery

**File**: `.001_ORIGINAL/src/telegram/network-errors.ts`

Upstream classifies these as recoverable timeout errors:
- `ETIMEDOUT`, `ESOCKETTIMEDOUT` -- Node socket timeouts
- `UND_ERR_CONNECT_TIMEOUT`, `UND_ERR_HEADERS_TIMEOUT`, `UND_ERR_BODY_TIMEOUT` -- undici timeouts
- Error names: `TimeoutError`, `ConnectTimeoutError`, `HeadersTimeoutError`, `BodyTimeoutError`, `AbortError`

Crocbot should verify its `network-errors.ts` includes these error codes for proper timeout recovery.

### 4.7 Integration Approach

1. Add `timeoutMs` parameter with defaults to `getTelegramFile()` (30s) and `downloadTelegramFile()` (60s)
2. Pass `AbortSignal.timeout(timeoutMs)` as signal to fetch calls
3. Update `resolveMedia()` in delivery.ts to pass `AbortSignal.timeout()` to `ctx.getFile()`
4. Verify network-errors.ts handles TimeoutError for proper retry behavior

---

## 5. Path Traversal Delta Analysis

### 5.1 Upstream sandbox-paths.ts Overview

**File**: `.001_ORIGINAL/src/agents/sandbox-paths.ts`

Provides two-layer path validation:
- **Sync layer**: `isInsideSandbox()`, `isSafeSandboxPath()` -- fast checks without I/O
- **Async layer**: `assertSandboxPath()` -- realpath resolution + symlink detection
- **Helpers**: `resolveSandboxPath()`, `normalizeSandboxPath()`, `hasUnicodeSpaces()`

Key validations:
- Path must be within sandbox root after realpath resolution
- Symlinks must not escape sandbox boundary
- Unicode space characters are detected and rejected
- Paths are normalized to prevent `.`/`..` traversal

### 5.2 Crocbot sandbox-paths.ts Overview

**File**: `src/agents/sandbox-paths.ts`

Crocbot's sandbox-paths.ts is **byte-for-byte identical** to upstream. All 7 functions are present with identical implementations:
- `hasUnicodeSpaces()` -- Unicode space detection
- `normalizeSandboxPath()` -- Path normalization
- `resolveSandboxPath()` -- Path resolution within sandbox
- `isSafeSandboxPath()` -- Sync safety check
- `isInsideSandbox()` -- Sync containment check
- `assertSandboxPath()` -- Async validation with realpath + symlink check
- `SandboxPathError` -- Custom error class

### 5.3 Function-by-Function Delta

| Function | Upstream | Crocbot | Delta | Decision | Rationale |
|----------|----------|---------|-------|----------|-----------|
| hasUnicodeSpaces | Present | Present | Identical | Keep | No change needed |
| normalizeSandboxPath | Present | Present | Identical | Keep | No change needed |
| resolveSandboxPath | Present | Present | Identical | Keep | No change needed |
| isSafeSandboxPath | Present | Present | Identical | Keep | No change needed |
| isInsideSandbox | Present | Present | Identical | Keep | No change needed |
| assertSandboxPath | Present | Present | Identical | Keep | No change needed |
| SandboxPathError | Present | Present | Identical | Keep | No change needed |

### 5.4 message-tool.ts Sandbox Integration

| Integration Point | Upstream | Crocbot | Delta | Decision |
|-------------------|----------|---------|-------|----------|
| `assertSandboxPath` import | Present | Missing | Removed | Adopt -- restore import |
| `sandboxRoot` option in MessageToolOptions | Present | Missing | Removed | Adopt -- restore option |
| `requireExplicitTarget` option | Present | Missing | Removed | Adopt -- restore option |
| Path validation block in execute() | Present (~10 lines) | Missing | Removed | Adopt -- restore validation |
| `filterActionsForContext()` | Full implementation | Simplified to no-op | Gutted | Adapt -- restore security-relevant parts |
| `buildPresenceSchema()` | Present | Missing | Removed | Reject -- UI feature, not security |

### 5.5 Path Traversal Delta Summary

The sandbox-paths library is complete and identical -- the gap is entirely in **message-tool.ts integration**. Upstream's message-tool.ts calls `assertSandboxPath()` before file operations to ensure agents cannot escape their sandbox. Crocbot removed this integration during strip-down, creating a path traversal vulnerability:

1. Agents can read files outside their sandbox directory
2. Agents can create symlinks pointing outside the sandbox
3. Unicode space obfuscation in paths is not caught at the tool level

The fix requires restoring the `assertSandboxPath()` call in message-tool.ts's execute() method, the `sandboxRoot` option in MessageToolOptions, and the path validation guard.

---

## 6. Risk Assessment

| # | Change | Impact | Complexity | Regression Risk | Session | Priority | Rationale |
|---|--------|--------|------------|-----------------|---------|----------|-----------|
| 1 | Port fetch-guard.ts | High | Medium | Low | 02 | P0 | Central SSRF wrapper; enables safe fetch across codebase |
| 2 | Update ssrf.ts (add SsrFPolicy, resolvePinnedHostnameWithPolicy) | High | Low | Low | 02 | P0 | Required by fetch-guard.ts; backward-compatible additions |
| 3 | Add SSRF guard to notifier-webhook.ts | High | Low | Low | 02 | P1 | User-configured URL with no current protection |
| 4 | Add SSRF guard to skills-install.ts | High | Low | Low | 02 | P1 | User-provided URL with no current protection |
| 5 | Add SSRF guard to media/fetch.ts | Medium | Low | Low | 02 | P1 | User-provided URL; wrapper function |
| 6 | Restore message-tool.ts sandbox integration | High | Low | Medium | 03 | P0 | Path traversal vulnerability; agents can escape sandbox |
| 7 | Add timeout to getTelegramFile() | Medium | Low | Low | 03 | P1 | Prevents hung requests; 30s default |
| 8 | Add timeout to downloadTelegramFile() | Medium | Low | Low | 03 | P1 | Prevents hung downloads; 60s default |
| 9 | Add AbortSignal to resolveMedia() ctx.getFile() | Medium | Low | Low | 03 | P1 | Grammy getFile already accepts signal |
| 10 | Verify network-errors.ts timeout recovery | Low | Low | Low | 03 | P2 | Ensures timeout errors trigger retry logic |
| 11 | Validate all SSRF-guarded call sites | High | Low | Low | 04 | P0 | Confirm guards prevent internal IP access |
| 12 | Validate path traversal prevention | High | Low | Low | 04 | P0 | Confirm sandbox escape is blocked |
| 13 | Validate timeout behavior | Medium | Low | Low | 04 | P1 | Confirm timeouts fire and errors propagate |

### Risk Rating Key

- **Impact**: Security consequence if the vulnerability is exploited
  - High: Internal network access, credential exposure, data exfiltration
  - Medium: Service degradation, resource exhaustion
  - Low: Minor operational impact
- **Complexity**: Implementation effort
  - Low: < 50 lines, single file, clear pattern
  - Medium: 50-200 lines, 2-3 files, some design decisions
- **Regression Risk**: Chance of breaking existing functionality
  - Low: Additive change, no behavior modification
  - Medium: Modifies existing code path, needs testing

---

## 7. Implementation Plan for Sessions 02-04

### 7.1 Session 02: SSRF Guards

| Order | File | Change | Depends On | Est. Effort |
|-------|------|--------|-----------|-------------|
| 1 | src/infra/net/ssrf.ts | Export `LookupFn`, add `SsrFPolicy` type, add `normalizeHostnameSet()`, add `resolvePinnedHostnameWithPolicy()`, refactor `resolvePinnedHostname()` to delegate | None | 30 min |
| 2 | src/infra/net/ssrf.test.ts | Add tests for new SsrFPolicy functionality (allowPrivateNetwork, allowedHostnames) | Step 1 | 30 min |
| 3 | src/infra/net/fetch-guard.ts | Port upstream file verbatim (172 lines) | Step 1 | 20 min |
| 4 | src/infra/net/fetch-guard.test.ts | Write tests for fetchWithSsrFGuard (redirect handling, SSRF blocking, timeout, loop detection) | Step 3 | 45 min |
| 5 | src/alerting/notifier-webhook.ts | Wrap fetch call with fetchWithSsrFGuard or resolvePinnedHostname | Steps 1-3 | 15 min |
| 6 | src/agents/skills-install.ts | Wrap fetch call with fetchWithSsrFGuard | Steps 1-3 | 15 min |
| 7 | src/media/fetch.ts | Integrate fetchWithSsrFGuard into fetchRemoteMedia wrapper | Steps 1-3 | 15 min |
| 8 | Existing SSRF call sites | Verify web-fetch.ts and input-files.ts continue to work with updated ssrf.ts | Steps 1-2 | 15 min |

**Total estimated**: ~3 hours

### 7.2 Session 03: Download Timeouts and Path Traversal

| Order | File | Change | Depends On | Est. Effort |
|-------|------|--------|-----------|-------------|
| 1 | src/telegram/download.ts | Add `timeoutMs` parameters with defaults (30s/60s), add `AbortSignal.timeout(timeoutMs)` to fetch calls | None | 20 min |
| 2 | src/telegram/download.test.ts | Add timeout tests (verify AbortSignal.timeout is passed, mock timeout behavior) | Step 1 | 30 min |
| 3 | src/telegram/bot/delivery.ts | Pass `AbortSignal.timeout()` to `ctx.getFile()` calls in resolveMedia() | Step 1 | 15 min |
| 4 | src/telegram/network-errors.ts | Verify TimeoutError, AbortError, and undici timeout codes are in recoverable list | None | 10 min |
| 5 | src/agents/tools/message-tool.ts | Restore `assertSandboxPath` import, `sandboxRoot` option, path validation in execute() | None | 30 min |
| 6 | src/agents/tools/message-tool.test.ts | Add path traversal prevention tests (escape attempts, symlink bypass, unicode spaces) | Step 5 | 30 min |

**Total estimated**: ~2.5 hours

### 7.3 Session 04: Security Validation

| Order | Validation | Verifies | Method |
|-------|-----------|----------|--------|
| 1 | SSRF guard blocks private IPs | fetchWithSsrFGuard rejects 127.0.0.1, 10.x, 192.168.x | Unit test + manual |
| 2 | SSRF guard blocks metadata endpoints | fetchWithSsrFGuard rejects metadata.google.internal | Unit test |
| 3 | SSRF guard handles redirects safely | Redirect to private IP is blocked | Unit test |
| 4 | Timeout fires on slow response | AbortSignal.timeout triggers after configured ms | Unit test with mock |
| 5 | Path traversal blocked | assertSandboxPath rejects ../../../etc/passwd | Unit test |
| 6 | Symlink escape blocked | assertSandboxPath rejects symlinks outside sandbox | Unit test |
| 7 | Webhook SSRF protection | notifier-webhook.ts rejects internal URLs | Integration test |
| 8 | Skills install SSRF protection | skills-install.ts rejects internal URLs | Integration test |
| 9 | Media fetch SSRF protection | media/fetch.ts rejects internal URLs | Integration test |
| 10 | Existing tests pass | Full test suite green after all security changes | pnpm test |
| 11 | Build passes | pnpm build succeeds | pnpm build |

**Total estimated**: ~2 hours

### 7.4 Dependency Graph

```
Session 02 (SSRF Guards)
  |
  +-- ssrf.ts updates (SsrFPolicy, resolvePinnedHostnameWithPolicy)
  |     |
  |     +-- fetch-guard.ts (new file, depends on ssrf.ts exports)
  |           |
  |           +-- notifier-webhook.ts (uses fetchWithSsrFGuard)
  |           +-- skills-install.ts (uses fetchWithSsrFGuard)
  |           +-- media/fetch.ts (uses fetchWithSsrFGuard)
  |
Session 03 (Timeouts + Path Traversal) -- independent of Session 02
  |
  +-- download.ts timeouts (AbortSignal.timeout)
  |     |
  |     +-- delivery.ts (passes signal to ctx.getFile)
  |
  +-- message-tool.ts (restore assertSandboxPath integration)
  |
Session 04 (Validation) -- depends on Sessions 02 and 03
  |
  +-- Validates all changes from Sessions 02 and 03
```

Sessions 02 and 03 are independent and could theoretically run in parallel, but sequential ordering is recommended for cleaner validation in Session 04.

### 7.5 Limitations

- Dynamically-loaded plugin code may contain fetch calls not captured by static grep analysis. Plugin sandboxing is a separate concern from SSRF guards on core code.
- Some call sites may use aliases or wrapper functions that obscure the underlying HTTP client. The inventory captured known wrapper patterns (fetchImpl, fetcher, fetchJson, fetchWithTimeout) but additional wrappers may exist in less-explored code paths.
- Extension fetch calls (12 sites) all target trusted API endpoints. If extensions are ever allowed to fetch user-provided URLs, they would need SSRF coverage.
- The 65 "already safe" call sites target trusted, hardcoded API endpoints. If any of these endpoints become user-configurable in the future, they would need SSRF review.

---
