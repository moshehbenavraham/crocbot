# src/security/

Security validation, auditing, and hardening utilities.

## Key Files

| File                   | Purpose                                                    |
| ---------------------- | ---------------------------------------------------------- |
| `audit.ts`             | Security audit runner                                      |
| `audit-extra.sync.ts`  | Extended audit checks (config redaction, webhook safety)   |
| `filesystem.ts`        | Filesystem access validation                               |
| `external-content.ts`  | External content sanitization (Unicode homoglyph blocking) |
| `ssrf-fixes.ts`        | SSRF mitigation helpers                                    |
| `path-traversal.ts`    | Path traversal prevention                                  |
| `secret-equal.ts`      | Timing-safe string comparison via crypto.timingSafeEqual   |
| `transcript-repair.ts` | Tool-call block sanitization in transcripts                |

## Purpose

Provides security validation that runs during `crocbot doctor` and at runtime:

- Audits filesystem permissions and config snapshot redaction
- Validates external content safety (Unicode homoglyphs, angle bracket variants)
- Prevents path traversal attacks
- Hardens outbound request handling
- Timing-safe token comparison for auth boundaries
- Webhook safety audit classification

## Related

- Network security: `src/infra/net/`
- Security docs: [Security guide](https://aiwithapex.mintlify.app/gateway/security)
