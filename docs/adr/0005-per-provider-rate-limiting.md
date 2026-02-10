# 5. Per-Provider Rate Limiting

**Status:** Accepted
**Date:** 2026-02-10

## Context

Agentic loops can generate rapid sequences of LLM API calls, risking cost overruns and provider rate limit violations (429 storms). When multiple API keys are configured per provider, there was no mechanism to distribute load or rotate keys on failure. Transient provider errors (timeouts, 5xx) caused immediate failure instead of retrying.

## Decision

Implement a four-layer rate limiting pipeline in `src/infra/`:

1. **ProviderRateLimiter** (`provider-rate-limiter.ts`): Sliding window log algorithm enforcing per-provider RPM (requests per minute) and TPM (tokens per minute) limits. Zero overhead when no limits are configured (pass-through mode). 60-second window with automatic entry cleanup.

2. **KeyPool** (`key-pool.ts`): Health-aware round-robin API key selection. Composes with the auth profile system (cooldown state) and rate limiter (capacity checks) to select the best available key. Returns `null` when all keys are exhausted -- callers handle backpressure.

3. **LLM Retry** (`llm-retry.ts` + `retry.ts`): Transient error retry with exponential backoff and jitter. Classifies HTTP 408/429/500/502/503/504 and network errors (ECONNRESET, ETIMEDOUT, etc.) as retryable. Parses Retry-After headers from provider responses. Default: 3 attempts, 300ms-30s delay range, 0.25 jitter.

4. **Rate Limit Middleware** (`rate-limit-middleware.ts`): Pre-flight/post-flight wrapper for LLM call sites. Pre-flight checks capacity via `tryAcquire()`, post-flight records actual token usage via `recordUsage()`. Includes `estimateTokens()` heuristic (chars / 4) for pre-flight estimation.

Configuration via `rateLimits` key in crocbot config:
```json5
{
  rateLimits: {
    defaults: { rpm: 60, tpm: 100000 },
    providers: {
      anthropic: { rpm: 50, tpm: 80000 }
    }
  }
}
```

## Consequences

### Enables
- Cost control: Configurable RPM/TPM limits per provider prevent runaway API spend
- Key rotation: Multiple keys per provider with automatic round-robin and failover
- Resilience: Transient errors retried with backoff instead of immediate failure
- Observability: Structured logs for throttle/reject/retry/usage events

### Prevents
- 429 storms from uncontrolled agentic loops
- Single-key exhaustion when multiple keys are available
- Immediate failure on transient network issues

### Trade-offs
- In-memory state: Rate limiter state is lost on restart (acceptable -- windows are 60s)
- Token estimation is heuristic (chars/4) before actual provider response
- Each layer adds minimal latency (<1ms combined for the hot path)
- No persistent rate limit state sharing across process restarts
