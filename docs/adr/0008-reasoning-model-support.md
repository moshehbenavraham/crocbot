# 8. Reasoning Model Support

**Status:** Accepted
**Date:** 2026-02-16

## Context

Phase 13 adds native reasoning model support to crocbot. Reasoning models -- OpenAI o1/o3/o4-mini, Anthropic Claude with extended thinking, DeepSeek-R1 -- generate intermediate chain-of-thought tokens before producing final responses. These reasoning tokens improve answer quality for complex tasks but introduce architectural challenges: heterogeneous wire formats across providers, streaming event model differences, token budget tracking needs, and trace storage requirements for audit and analysis.

Crocbot already has tag-based reasoning infrastructure from the v0.1.117 upstream sync: `<think>` tag parsing, block promotion, streaming detection, CLI display, Telegram blocking, session persistence, WebSocket broadcast, and OpenAI reasoning replay. However, this tag-based approach only works when reasoning content arrives embedded in text content as `<think>` tags. Native reasoning events from the Pi-AI SDK (`thinking_start`, `thinking_delta`, `thinking_end`) are filtered out at line 59 of `pi-embedded-subscribe.handlers.messages.ts` and never reach the processing pipeline.

The Pi-AI SDK already normalizes all three provider formats into a common `thinking_delta` event model. The key architectural question is how to consume these native events alongside the existing tag-based fallback, accumulate reasoning and response content, track token budgets per session, and persist reasoning traces for audit.

## Decision

### 1. Adapter pattern for provider-specific reasoning events

A `ReasoningStreamAdapter` interface normalizes SDK streaming events to a common `ReasoningChunk` type. Four concrete adapters handle the provider landscape:

- **OpenAI adapter**: Handles `thinking_delta` events from o1/o3/o4-mini models. Maps SDK-normalized events to `ReasoningChunk`.
- **Anthropic adapter**: Handles `thinking_delta` events from Claude extended thinking. Maps SDK-normalized events to `ReasoningChunk`.
- **DeepSeek adapter**: Handles `thinking_delta` events from DeepSeek-R1. Maps SDK-normalized events to `ReasoningChunk`.
- **Tag fallback adapter**: Handles `<think>` tags embedded in `text_delta` events. Reuses existing `THINKING_TAG_SCAN_RE` / `blockState.thinking` / `stripBlockTags()` infrastructure. Activated when no native adapter matches or when models route through third-party providers that transform SSE streams.

Adapter selection uses a strategy pattern: at `message_start`, the resolver iterates adapters in priority order (OpenAI -> Anthropic -> DeepSeek -> Tag Fallback) and locks in the first adapter where `canHandle(model, provider)` returns `true`. The adapter is fixed for the message duration -- no mid-stream fallback to avoid duplicate processing.

The event filter gate at line 59 of `pi-embedded-subscribe.handlers.messages.ts` is expanded to also accept `thinking_start`, `thinking_delta`, and `thinking_end` events. These are routed through the active adapter to produce `ReasoningChunk` objects.

### 2. ChatGenerationResult accumulator

A `ChatGenerationResult` class accumulates streaming chunks, routing reasoning content (from adapters) and text content (from `text_delta` events) into separate buffers. It provides:

- **Chunk routing**: Reasoning chunks from the adapter append to `reasoningText`; text deltas append to `responseText`.
- **Cross-chunk tag boundary handling**: When the tag fallback adapter is active, text deltas pass through the existing `stripBlockTags()` function which maintains stateful `blockState.thinking` tracking. When a native adapter is active, tag stripping is bypassed.
- **Delta computation**: Each `appendReasoningChunk()` and `appendTextDelta()` call returns the delta (new text since last call) for incremental UI updates.
- **Usage recording**: `recordUsage()` normalizes provider-specific token fields (`completion_tokens_details.reasoning_tokens` for OpenAI/DeepSeek, computed from delta length for Anthropic) to a common `reasoningTokens` count.

The accumulator is created at `message_start` and finalized at `message_end`. It replaces the ad-hoc delta tracking in the current `emitReasoningStream()` function.

### 3. Reasoning trace storage

A `reasoning_traces` SQLite table stores completed reasoning traces for audit, export, and analysis. Schema follows the `consolidation-schema.ts` idempotent migration pattern:

```sql
CREATE TABLE IF NOT EXISTS reasoning_traces (
  id TEXT PRIMARY KEY,
  session_key TEXT NOT NULL,
  run_id TEXT NOT NULL,
  model TEXT NOT NULL,
  provider TEXT NOT NULL,
  reasoning_text TEXT NOT NULL,
  reasoning_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  metadata TEXT DEFAULT '{}',
  created_at INTEGER NOT NULL
);
```

Indexed on `session_key`, `run_id`, `model`, and `created_at` for efficient queries. Retention is configurable with a default of 30 days, enforced by `pruneOlderThan()`.

The trace store subscribes to agent events via `onAgentEvent()` at application startup. It listens for `stream: "thinking"` events to accumulate reasoning text during streaming, then persists the complete trace when the generation finishes.

Reasoning text passes through the Phase 9 secrets masking pipeline before storage, adding a 6th masking boundary to the existing 5-boundary pipeline (logging, config, LLM call, tool result, Telegram output).

### 4. Per-session reasoning budget tracker

A `ReasoningBudgetTracker` tracks cumulative reasoning token consumption per session. Configuration:

- `maxReasoningTokensPerSession`: Hard limit (default 500,000 tokens, 0 = unlimited)
- `warningThresholdPercent`: Emit warning at this percentage (default 80%)

The tracker emits events via `emitAgentEvent()` with `stream: "budget"`:
- `reasoning_budget_warning` at the warning threshold
- `reasoning_budget_exceeded` at 100%

The budget tracker operates at the session level (total reasoning tokens per session), complementing the Phase 10 rate limiter which operates at the provider level (RPM/TPM per sliding window). Budget checks run after rate limiter checks succeed.

### 5. Preserving tag-based fallback

The existing tag-based reasoning infrastructure is preserved in its entirety:
- `THINKING_TAG_SCAN_RE` / `FINAL_TAG_SCAN_RE` regexes
- `blockState.thinking` cross-chunk tracking
- `stripBlockTags()` stateful stripping
- `promoteThinkingTagsToBlocks()` post-stream conversion
- `extractAssistantThinking()` final message extraction

These serve as the fallback adapter path and continue to handle models accessed through third-party providers, open-weight deployments (vLLM, Ollama), and any model that emits `<think>` tags in text content rather than native reasoning events.

## Consequences

### Enables
- Native `thinking_delta` event consumption from the Pi-AI SDK (previously filtered out)
- Real-time reasoning token streaming to CLI and WebSocket clients via native events (lower latency than tag scanning)
- Per-session reasoning token budget tracking with configurable thresholds and warnings
- Reasoning trace audit trail with SQLite storage, session/run queries, and configurable retention
- Normalized provider abstraction: four adapters hide the OpenAI, Anthropic, DeepSeek, and tag-based format differences behind a common `ReasoningChunk` interface

### Preserves
- Tag-based reasoning fallback for third-party providers, open-weight models, and proxy deployments
- Existing `emitReasoningStream()` and `emitAgentEvent()` infrastructure
- Existing reasoning mode configuration (`"off"`, `"on"`, `"stream"`)
- Phase 9 secrets masking pipeline (extended with 6th boundary for trace storage)
- Phase 10 per-provider rate limiting (budget tracker is complementary, not replacement)

### Trade-offs
- Adapter selection is locked at `message_start` -- if a native adapter is selected but the model unexpectedly sends tag-based reasoning, the tags will not be processed (mitigated by conservative `canHandle()` checks and tag fallback as lowest priority)
- Trace storage increases SQLite database size by 1-10KB per reasoning interaction (mitigated by configurable retention and pruning)
- Budget tracker is in-memory per session -- budget state is lost on process restart (acceptable: budget is a guardrail, not a billing mechanism)
- Anthropic reasoning token count is estimated from delta text length (no dedicated `thinking_tokens` field in usage), introducing slight inaccuracy (mitigated by using characters/4 as conservative estimate)

### Dependencies
- Phase 11 (ADR-0006): Model role routing identifies reasoning models via `ModelRouter`
- Phase 10 (ADR-0005): Per-provider rate limiting for complementary budget checks
- Phase 9 (ADR-0004): Secrets masking pipeline for reasoning trace storage
