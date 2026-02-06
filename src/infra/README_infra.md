# src/infra/

Infrastructure utilities — networking, security, exec management, and system integration.

## Structure

```
infra/
  net/        # Network security (SSRF protection, fetch guards)
  outbound/   # Outbound request management
  tls/        # TLS certificate handling
```

## Key Files

| File | Purpose |
|------|---------|
| `net/ssrf.ts` | SSRF protection: private IP/hostname blocking, redirect validation |
| `net/fetch-guard.ts` | Guarded fetch wrapper with timeouts and DNS pinning |
| `exec-approvals.ts` | Shell command allowlisting and token blocking |
| `update-check.ts` | Version update checking |
| `update-runner.ts` | Runs the update process |

## Security

This module is critical for security. The SSRF guards (`net/ssrf.ts`, `net/fetch-guard.ts`) protect all outbound HTTP requests from server-side request forgery by:
- Blocking requests to private IP ranges
- Validating redirect targets
- Enforcing AbortSignal timeouts
- DNS pinning to prevent rebinding attacks

## Related

- Security validation: `src/security/`
- Exec tool: `src/agents/tools/`
