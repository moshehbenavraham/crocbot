# src/security/

Security validation, auditing, and hardening utilities.

## Key Files

| File                  | Purpose                       |
| --------------------- | ----------------------------- |
| `audit.ts`            | Security audit runner         |
| `filesystem.ts`       | Filesystem access validation  |
| `external-content.ts` | External content sanitization |
| `ssrf-fixes.ts`       | SSRF mitigation helpers       |
| `path-traversal.ts`   | Path traversal prevention     |

## Purpose

Provides security validation that runs during `crocbot doctor` and at runtime:

- Audits filesystem permissions
- Validates external content safety
- Prevents path traversal attacks
- Hardens outbound request handling

## Related

- Network security: `src/infra/net/`
- Security docs: [Security guide](https://aiwithapex.mintlify.app/gateway/security)
