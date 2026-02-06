# Security Bypass Audit

**Session ID**: `phase06-session04-security-validation`
**Audit Date**: 2026-02-06
**Auditor**: AI-assisted implementation review

---

## Audit Scope

This audit covers all security measures implemented in Phase 06 Sessions 02-03:
1. SSRF guards with DNS pinning (Session 02)
2. Telegram download timeouts with AbortSignal (Session 03)
3. Path traversal validation with assertMediaPath (Session 03)

---

## Bypass Category Checklist

### 1. Redirect Chaining

| Vector | Status | Notes |
|--------|--------|-------|
| Public -> Private redirect | BLOCKED | `fetchWithSsrFGuard` validates DNS at each hop |
| Public -> Public -> Private chain | BLOCKED | Redirect loop re-evaluates SSRF policy per hop |
| Redirect loop detection | BLOCKED | Visited URL set prevents infinite loops |
| Max redirect enforcement | BLOCKED | Default limit of 3, configurable |
| Missing Location header | BLOCKED | Throws explicit error on 3xx without Location |
| Redirect to non-HTTP protocol | BLOCKED | Protocol validation at each hop (http/https only) |

**Finding**: The redirect validation in `fetch-guard.ts` performs full SSRF checks at every redirect hop. Each new URL is parsed, DNS-resolved, and validated against the private IP blocklist before any fetch occurs. No bypass path exists through redirect chaining.

### 2. DNS Rebinding

| Vector | Status | Notes |
|--------|--------|-------|
| DNS TTL manipulation | MITIGATED | DNS pinning locks resolved IPs for request lifetime |
| Multiple A records (public + private) | BLOCKED | All resolved addresses checked; any private IP blocks |
| TOCTOU between resolve and connect | MITIGATED | `createPinnedLookup` injects resolved IPs into undici Agent lookup |

**Finding**: DNS pinning via `resolvePinnedHostname()` resolves the hostname once, validates all returned addresses, then creates a pinned lookup function that returns only the validated addresses. This prevents the classic DNS rebinding attack where a second DNS query returns a private IP. The `createPinnedDispatcher()` ensures the connection uses the pinned addresses.

**Residual Risk**: If the DNS resolver returns only public IPs during resolution but the actual server behind that IP acts as a proxy to internal resources, DNS pinning cannot prevent this (application-layer proxy attack). This is inherent to all DNS-based SSRF mitigation and acceptable.

### 3. Double-Encoding

| Vector | Status | Notes |
|--------|--------|-------|
| `%252e%252e%252f` (double-encoded ../) | NOT APPLICABLE | `assertMediaPath` operates on `path.resolve()` output, not URL-decoded strings |
| `%2e%2e%2f` (single-encoded ../) | NOT APPLICABLE | Filesystem paths are not URL-decoded by `path.resolve()` |
| Mixed encoding in URLs | BLOCKED | `new URL()` normalizes URL encoding before hostname extraction |

**Finding**: Path traversal validation uses `path.resolve()` which operates on filesystem path semantics, not URL encoding. Percent-encoded sequences like `%2e%2e` are treated as literal directory names (a directory literally named "%2e%2e"), not as traversal sequences. The SSRF guard uses `new URL()` for parsing, which handles URL encoding normalization. No double-encoding bypass exists.

### 4. Null Bytes

| Vector | Status | Notes |
|--------|--------|-------|
| Null byte in file path (`file\x00.ext`) | BLOCKED | Node.js fs APIs throw ENOENT/EINVAL on null bytes in paths |
| Null byte in URL hostname | BLOCKED | `new URL()` rejects null bytes in hostnames |
| Null byte truncation in path comparison | NOT VULNERABLE | `path.resolve()` and `path.relative()` preserve null bytes in string comparison |

**Finding**: Node.js v22 filesystem APIs reject paths containing null bytes at the syscall level. The `assertMediaPath` function uses `path.resolve()` which preserves null bytes in the string, meaning the relative path comparison operates correctly. Even if a null byte were somehow passed through, the subsequent `fs.writeFile` call would reject it.

### 5. Symlink Traversal

| Vector | Status | Notes |
|--------|--------|-------|
| Symlink inside media dir pointing outside | PARTIAL | `assertMediaPath` checks logical path, not physical |
| Symlink creation by attacker | MITIGATED | Media directory has 0o700 permissions; only owner can create symlinks |
| Race condition (symlink created after check) | RESIDUAL | TOCTOU between assertMediaPath and file write |

**Finding**: `assertMediaPath` validates the logical path (the result of `path.resolve()`) rather than following symlinks. If a symlink already exists inside the media directory pointing outside, `assertMediaPath` would not detect it because `path.resolve()` does not resolve symlinks (use `fs.realpath()` for that). However, the media directory is created with 0o700 permissions and files are written with 0o600, limiting symlink creation to the process owner. Media content comes from controlled sources (Telegram API, validated URLs).

**Residual Risk**: Low. An attacker would need write access to the media directory to create a symlink, which requires compromising the process user. This is acceptable for the current threat model.

### 6. IPv6-Mapped IPv4 Addresses

| Vector | Status | Notes |
|--------|--------|-------|
| `::ffff:127.0.0.1` | BLOCKED | `isPrivateIpAddress` parses IPv6-mapped IPv4 and checks inner address |
| `::ffff:10.0.0.1` | BLOCKED | Same parsing extracts and validates the IPv4 component |
| `::ffff:169.254.169.254` | BLOCKED | Cloud metadata via mapped address blocked |
| `::1` (pure IPv6 loopback) | BLOCKED | Explicit check for `::1` |
| `fe80::` (link-local IPv6) | BLOCKED | Prefix match on `fe80:` |
| `fc00::`/`fd00::` (unique local) | BLOCKED | Prefix match on `fc` and `fd` |

**Finding**: The `isPrivateIpAddress` function in `ssrf.ts` correctly handles IPv6-mapped IPv4 addresses by detecting the `::ffff:` prefix and extracting the embedded IPv4 address for validation. Pure IPv6 private ranges (loopback, link-local, unique local) are also checked via prefix matching.

---

## Additional Observations

### Timeout Enforcement
- `getTelegramFile`: 30s default via `AbortSignal.timeout()`
- `downloadTelegramFile`: 60s default via `AbortSignal.timeout()`
- `fetchWithSsrFGuard`: Configurable `timeoutMs` with AbortSignal composition
- `WebhookNotifier`: 5s default timeout
- `downloadToFile` (media store): 60s default with `setTimeout` on request

All network operations have explicit timeouts. No unbounded network calls exist.

### Protocol Validation
All fetch paths validate `http:` and `https:` only. Non-HTTP protocols (`ftp:`, `file:`, `data:`, `javascript:`) are rejected before any network operation.

### Call Site Coverage
All three outbound fetch sites use `fetchWithSsrFGuard()`:
1. `src/alerting/notifier-webhook.ts` - Webhook POST delivery
2. `src/agents/skills-install.ts` - Skill download
3. `src/media/fetch.ts` - Remote media fetch (also uses `isBlockedHostname`/`isPrivateIpAddress` for custom fetchImpl path)

Additionally, `src/media/store.ts:downloadToFile()` uses `resolvePinnedHostname()` directly for DNS pinning on HTTP/HTTPS downloads.

---

## Summary

| Category | Verdict | Residual Risk |
|----------|---------|---------------|
| Redirect Chaining | No bypass found | None |
| DNS Rebinding | Mitigated by pinning | Application-layer proxy (acceptable) |
| Double-Encoding | Not applicable to path validation | None |
| Null Bytes | Blocked by Node.js runtime | None |
| Symlink Traversal | Logical path check only | Low (requires process user compromise) |
| IPv6-Mapped IPv4 | Fully blocked | None |
| Protocol Validation | HTTP/HTTPS only | None |
| Timeout Enforcement | All paths covered | None |

**Overall Assessment**: Phase 06 security measures provide robust protection against SSRF, path traversal, and timeout-based attacks. No critical bypass vectors were identified. The two residual risks (application-layer proxy for DNS rebinding, symlink TOCTOU) are acceptable given the threat model and require prior system compromise to exploit.
