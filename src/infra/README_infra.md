# src/infra/

Infrastructure utilities — networking, security, exec management, and system integration.

## Structure

```
infra/
  net/        # Network security (SSRF protection, fetch guards)
  secrets/    # Secrets masking pipeline (registry, masker, boundary transports)
  outbound/   # Outbound request management
  tls/        # TLS certificate handling
```

## Key Files

| File                 | Purpose                                                            |
| -------------------- | ------------------------------------------------------------------ |
| `net/ssrf.ts`        | SSRF protection: private IP/hostname blocking, redirect validation |
| `net/fetch-guard.ts` | Guarded fetch wrapper with timeouts and DNS pinning                |
| `exec-approvals.ts`  | Shell command allowlisting and token blocking                      |
| `update-check.ts`    | Version update checking                                            |
| `update-runner.ts`   | Runs the update process                                            |

## Secrets Masking (`secrets/`)

Prevents credential leakage across all output boundaries. The SecretsRegistry auto-discovers secrets from environment variables and config, then masks them at every output path.

| File                             | Purpose                                                     |
| -------------------------------- | ----------------------------------------------------------- |
| `secrets/registry.ts`            | SecretsRegistry singleton: init, register, mask, unmask     |
| `secrets/masker.ts`              | Aho-Corasick masker with sequential fallback (<10 patterns) |
| `secrets/init.ts`                | Registry initialization helper (two-phase: env then config) |
| `secrets/logging-transport.ts`   | tslog masking transport                                     |
| `secrets/stream-masker.ts`       | Streaming mask detector for cross-chunk boundaries          |
| `secrets/llm-masking.ts`         | LLM context wrapping decorator                              |
| `secrets/unmask-exec.ts`         | Tool argument unmasking at execution boundary               |
| `secrets/tool-result-masking.ts` | AgentMessage content masking                                |
| `secrets/error-masking.ts`       | Error output masking                                        |

## Security

This module is critical for security. The SSRF guards (`net/ssrf.ts`, `net/fetch-guard.ts`) protect all outbound HTTP requests from server-side request forgery by:

- Blocking requests to private IP ranges
- Validating redirect targets
- Enforcing AbortSignal timeouts
- DNS pinning to prevent rebinding attacks

The secrets masking pipeline (`secrets/`) provides seven-boundary defense:

- Logging (masking transport)
- Config snapshots (deep masking)
- LLM context (wrapper before provider calls)
- Streaming output (cross-chunk boundary detection)
- Tool results (after execution)
- Telegram output (messages, drafts, edits, media)
- Error formatting (formatErrorMessage, formatUncaughtError)

## Related

- Security validation: `src/security/`
- Exec tool: `src/agents/tools/`
- MCP integration: `src/mcp/` (tool results masked via secrets pipeline)
