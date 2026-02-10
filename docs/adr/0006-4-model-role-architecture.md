# 6. 4-Model-Role Architecture

**Status:** Accepted
**Date:** 2026-02-10

## Context

Every agentic turn -- including mechanical background tasks like memory flush, context compaction, heartbeat checks, and recall filtering -- uses the same expensive reasoning model. This is wasteful: these tasks are mechanical, require no creative reasoning, and produce structured output that cheaper models handle equally well. An inventory of the codebase found 8 distinct LLM call sites, of which 4 are utility tasks that can be routed to a cheaper model for an estimated 20-35% cost reduction.

Agent Zero's reference implementation demonstrates a proven 4-role model pattern (chat, utility, embedding, browser) with per-role rate limiting and configuration. crocbot already has infrastructure for per-provider rate limiting (ADR 0005, Phase 10) and model override fields on heartbeat and cron jobs. The architecture extends these patterns to all call sites.

## Decision

Implement a 2-role model architecture (reasoning + utility) with pattern-based task classification, graceful degradation, and per-role rate limiting:

1. **Config schema extension**: Add an optional `roles` mapping to `AgentDefaultsConfig` with `reasoning` and `utility` keys. Each key maps to a model reference string or an object with model reference and parameter overrides. Missing keys fall back to the primary model (backward compatible).

2. **Pattern-based task classification**: Each LLM call site has a fixed classification (reasoning or utility) determined by its context in the code, not by LLM inference. Reasoning: user chat, cron jobs, followup messages. Utility: compaction, memory flush, heartbeat, LLM task extension.

3. **Model router**: A `ModelRouter` interface that accepts a task classification and returns the resolved model. The router composes with the existing `resolveModel()` function and falls back to the reasoning model when the utility model is unavailable or fails.

4. **Rate limiter per-role extension**: Extend the existing `ProviderRateLimiter` to optionally track usage per model role. Per-role limits are enforced in addition to per-provider limits. The `withRateLimitCheck` middleware accepts an optional `role` parameter.

5. **Graceful degradation**: Missing role config, unavailable models, and API errors all fall back to the reasoning model. The utility model is purely a cost optimization -- removing it degrades cost efficiency but not functionality.

## Consequences

### Enables
- Cost optimization: Route mechanical tasks to models that are 5-20x cheaper per token
- Per-role rate limiting: Separate capacity budgets for reasoning and utility tasks
- Observability: Structured logs distinguish reasoning vs utility model usage
- Future extensibility: Additional roles (embeddings, browser) can be added without schema changes

### Prevents
- Reasoning model waste on mechanical tasks (compaction, memory flush, heartbeat)
- Single model bottleneck when utility tasks can use separate capacity

### Trade-offs
- Two roles (reasoning, utility) instead of Agent Zero's four -- embedding is already a separate provider and browser is out of scope for crocbot. This keeps complexity minimal
- Pattern-based classification is static (no runtime task analysis) -- this avoids the latency and cost of LLM-based classification but means new call sites must be manually classified
- Per-role rate limits add a second dimension to the sliding window state (modest memory increase, ~1KB per role per provider)
- Utility model quality may be lower for edge cases -- mitigated by graceful degradation to reasoning model on failure
