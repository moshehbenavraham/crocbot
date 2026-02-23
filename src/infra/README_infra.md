# src/infra/

Infrastructure utilities — networking, security, exec management, rate limiting, and system integration.

## Structure

```
infra/
  net/        # Network security (SSRF protection, fetch guards)
  secrets/    # Secrets masking pipeline (registry, masker, boundary transports)
  outbound/   # Outbound request management
  tls/        # TLS certificate handling
```

## Key Files

| File                              | Purpose                                                                        |
| --------------------------------- | ------------------------------------------------------------------------------ |
| `net/ssrf.ts`                     | SSRF protection: private IP/hostname blocking, IPv6-mapped bypass prevention, redirect validation |
| `net/fetch-guard.ts`              | Guarded fetch wrapper with timeouts and DNS pinning                            |
| `exec-approvals.ts`               | Shell command allowlisting, shell expansion blocking, heredoc handling          |
| `path-output.ts`                  | Output path containment (constrainOutputPath)                                  |
| `http-body.ts`                    | Bounded HTTP body reading with configurable limits                             |
| `archive.ts`                      | Archive extraction with zip-slip prevention and decompression bomb limits       |
| `provider-rate-limiter.ts`        | Sliding window RPM/TPM enforcement per provider                                |
| `provider-rate-limiter-config.ts` | Rate limiter config types and resolution                                       |
| `rate-limiter-instance.ts`        | Singleton rate limiter instance                                                |
| `key-pool.ts`                     | Health-aware round-robin API key selection                                     |
| `llm-retry.ts`                    | LLM transient error classification and retry policy                            |
| `retry.ts`                        | Generic retry with exponential backoff and jitter                              |
| `retry-policy.ts`                 | Retry policy types                                                             |
| `rate-limit-middleware.ts`        | Pre-flight/post-flight wrapper for LLM call sites                              |
| `update-check.ts`                 | Version update checking                                                        |
| `update-runner.ts`                | Runs the update process                                                        |

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

## Rate Limiting

Per-provider rate limiting with API key rotation and transient error retry. Four-layer pipeline:

1. **ProviderRateLimiter** -- Sliding window log algorithm enforcing RPM and TPM per provider. Zero overhead in pass-through mode (no limits configured).
2. **KeyPool** -- Health-aware round-robin across multiple API keys per provider. Integrates cooldown state from the auth profile system with rate limiter capacity checks.
3. **retryAsync + createLlmRetryOptions** -- Transient error retry with exponential backoff and jitter. Classifies 408/429/5xx as retryable, parses Retry-After headers.
4. **withRateLimitCheck** -- Call-site middleware wrapping LLM fetch calls with pre-flight capacity check and post-flight usage recording.

Configuration via `rateLimits` in crocbot config:

```json5
{
  rateLimits: {
    defaults: { rpm: 60, tpm: 100000 },
    providers: {
      anthropic: { rpm: 50, tpm: 80000 },
      openai: { rpm: 60 },
    },
  },
}
```

## Security

This module is critical for security. The SSRF guards (`net/ssrf.ts`, `net/fetch-guard.ts`) protect all outbound HTTP requests from server-side request forgery by:

- Blocking requests to private IP ranges (including IPv6-mapped IPv4 bypass prevention)
- Validating redirect targets
- Enforcing AbortSignal timeouts
- DNS pinning to prevent rebinding attacks

Additional hardening modules:

- `path-output.ts` constrains output file paths to prevent writes outside allowed directories
- `http-body.ts` enforces configurable size limits on inbound HTTP request bodies
- `archive.ts` prevents zip-slip path traversal and decompression bomb attacks during extraction
- `exec-approvals.ts` blocks shell expansion patterns and handles heredoc operators safely

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
- LLM providers: `src/providers/` (rate limiter wraps provider calls)
