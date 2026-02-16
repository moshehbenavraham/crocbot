# PRD Phase 13: Reasoning Model Support

**Status**: In Progress
**Sessions**: 5
**Estimated Duration**: 5-10 days

**Progress**: 2/5 sessions (40%)

---

## Overview

Complete native reasoning model support for o1/o3, DeepSeek-R1, and Claude extended thinking. The v0.1.117 upstream sync already delivered substantial tag-based reasoning infrastructure (tag parsing, block promotion, streaming detection, CLI display, Telegram blocking, session persistence, WebSocket broadcast, and OpenAI reasoning replay). This phase fills the remaining gaps: native `reasoning_delta` stream parsing from provider SSE responses, a `ChatGenerationResult` accumulator that cleanly separates reasoning from response content, reasoning token budget tracking, dedicated trace storage for debugging/audit, and true real-time streaming display from native reasoning events.

---

## Progress Tracker

| Session | Name | Status | Est. Tasks | Validated |
|---------|------|--------|------------|-----------|
| 01 | Research and Architecture Design | Complete | 20 | 2026-02-16 |
| 02 | Reasoning Stream Adapter Layer | Complete | 20 | 2026-02-16 |
| 03 | Chat Generation Result Accumulator | Not Started | ~20 | - |
| 04 | Reasoning Trace Storage and Budget Tracking | Not Started | ~20 | - |
| 05 | Integration Testing and Validation | Not Started | ~20 | - |

---

## Completed Sessions

### Session 01: Research and Architecture Design
- **Completed**: 2026-02-16
- **Tasks**: 20/20
- **Deliverables**: Research document (reasoning-stream-formats.md), ADR-0008 (reasoning-model-support.md)
- **Key Finding**: Pi-AI SDK natively exposes thinking events; crocbot filters them out at one line (handlers.messages.ts:59)

### Session 02: Reasoning Stream Adapter Layer
- **Completed**: 2026-02-16
- **Tasks**: 20/20
- **Deliverables**: ReasoningChunk/ReasoningStreamAdapter interfaces, 4 adapters (OpenAI, Anthropic, DeepSeek, tag-fallback), adapter registry, 89 unit tests
- **Key Decision**: Simplified partial tag regex to character class approach; open+close in same chunk emits single "end" phase

---

## Upcoming Sessions

- Session 03: Chat Generation Result Accumulator

---

## Objectives

1. Parse native `reasoning_delta` events from OpenAI o1/o3, Anthropic extended thinking, and DeepSeek-R1 SSE streams
2. Build a `ChatGenerationResult` accumulator that routes reasoning vs response chunks and handles cross-chunk tag boundaries
3. Track reasoning token budget consumption per session with warnings when approaching limits
4. Store reasoning traces in a queryable table indexed by session, turn, model, and timestamp
5. Enable true real-time streaming of reasoning content as chunks arrive (not waiting for text_end)

---

## Prerequisites

- Phase 12 completed (memory consolidation uses utility model infrastructure this phase also relies on)
- Phase 11 completed (model role architecture provides reasoning model identification)
- Phase 10 completed (rate limiter tracks reasoning model usage)

---

## Technical Considerations

### Architecture

The reasoning support system adds four components on top of the existing tag-based infrastructure:

1. **Reasoning Stream Adapter** (`src/agents/reasoning/stream-adapter.ts`) -- Per-provider adapter that detects and parses native `reasoning_delta` events from SSE streams. OpenAI o1/o3 emits `reasoning_delta` in streaming responses. Anthropic extended thinking uses `content_block_delta` with `type: "thinking_delta"`. DeepSeek-R1 embeds reasoning in `<think>` tags within standard `text_delta`. Each adapter normalizes to a common `ReasoningChunk` interface. Falls back to tag parsing for models without native support.

2. **ChatGenerationResult Accumulator** (`src/agents/reasoning/generation-result.ts`) -- TypeScript class that accumulates streaming chunks, routes `reasoning_delta` vs `text_delta`, handles cross-chunk partial tag boundaries (existing `THINKING_TAG_SCAN_RE` / `FINAL_TAG_SCAN_RE` patterns), and provides delta computation (new content since last emission). Configurable thinking tag patterns for extensibility. Reference: Agent Zero `models.py` lines 89-195.

3. **Budget Tracker** (`src/agents/reasoning/budget-tracker.ts`) -- Parse `usage.reasoning_tokens` from provider API responses. Track per-session consumption. Emit warnings when approaching configurable limits (default: 80% threshold). Expose metrics via agent events for dashboard/logging. Works alongside the existing rate limiter per-role budget from Phase 10.

4. **Trace Storage** (`src/agents/reasoning/trace-store.ts`) -- SQLite table `reasoning_traces` indexed by `session_id`, `turn_index`, `model`, `timestamp`. Store reasoning text, token count, duration, and metadata. Queryable for post-mortem debugging. CLI command for trace export (`crocbot reasoning traces`). Selective retention policy (configurable TTL, default 7 days).

### Already Implemented (from v0.1.117 upstream sync)

- **Tag parsing**: `stripReasoningTagsFromText()` handles `<think>`, `<thinking>`, `<thought>`, `<antthinking>` tags with strict/preserve modes (`src/shared/text/reasoning-tags.ts`)
- **Block promotion**: `promoteThinkingTagsToBlocks()` converts XML thinking tags to `{ type: "thinking" }` content blocks (`src/agents/pi-embedded-utils.ts`)
- **Streaming detection**: `THINKING_TAG_SCAN_RE` / `FINAL_TAG_SCAN_RE` with cross-chunk boundary tracking via `blockState.thinking` (`src/agents/pi-embedded-subscribe.ts`)
- **CLI display**: `reasoningMode: "on" | "stream" | "off"` with `formatReasoningMessage()` and `onReasoningStream()` callbacks (`src/auto-reply/thinking.ts`)
- **Telegram blocking**: `stripReasoningTagsFromText()` applied before Telegram output
- **Session persistence**: Thinking blocks stored as `{ type: "thinking" }` content blocks in conversation JSONL
- **WebSocket broadcast**: `emitAgentEvent({ stream: "thinking", data: { text, delta } })` for real-time events (`src/infra/agent-events.ts`)
- **OpenAI reasoning replay**: `thinkingSignature` metadata wrapper for o1/o3 history across turns
- **Model catalog**: `reasoning: boolean` flag on model entries (`src/agents/model-catalog.ts`)

### Remaining Scope (What This Phase Builds)

- **Native `reasoning_delta` stream detection**: The pi-ai SDK currently emits `text_delta` only. Need adapter layer to parse native `reasoning_delta` from OpenAI o1/o3 and Anthropic extended thinking SSE streams, with fallback to tag parsing for models without native support.
- **`ChatGenerationResult` accumulator**: Chunk routing, cross-chunk boundary handling, delta computation, and unified reasoning/response separation.
- **Anthropic extended thinking budget tracking**: Parse `usage.reasoning_tokens`, track per-session consumption, warn on threshold approach.
- **Dedicated reasoning trace storage**: `reasoning_traces` table with queryable indexes, CLI export, retention policy.
- **Streaming-level reasoning display**: True real-time streaming from `reasoning_delta` events (current implementation uses manual delta computation against accumulated text).

### Technologies
- TypeScript (existing codebase conventions)
- SQLite for reasoning trace storage (existing sqlite infrastructure)
- Pi-AI SDK streaming events (existing subscription model)
- Vitest for unit and integration tests

### Risks
- **Provider SSE format variance**: OpenAI, Anthropic, and DeepSeek all have different wire formats for reasoning content. Mitigation: per-provider adapter with common `ReasoningChunk` interface; fallback to tag parsing always available.
- **Pi-SDK abstraction layer**: The pi-ai SDK may abstract away native reasoning events into generic text deltas. Mitigation: research session will determine if we need to intercept at the HTTP/SSE level or if the SDK exposes reasoning events natively. If SDK masks reasoning, we may need raw SSE parsing for specific providers.
- **Cross-chunk tag boundary corruption**: Thinking tags can span streaming chunk boundaries (e.g., `<thi` + `nking>`). Mitigation: existing `blockState.thinking` flag and `THINKING_TAG_SCAN_RE` already handle this; accumulator builds on proven patterns.
- **Trace storage volume**: Reasoning traces can be verbose (10K+ tokens per turn for extended thinking). Mitigation: configurable retention policy (7-day default TTL); optional compression; selective storage (only store for models with `reasoning: true`).
- **Budget tracking accuracy**: Token counts from provider responses may be delayed or approximate. Mitigation: track both streamed token estimates and final usage.reasoning_tokens from completion response; use final count for accounting.

### Relevant Considerations
- [P10] **Rate limiter composition pattern**: Reasoning models may have different RPM/TPM limits than standard models. Per-role budgets from Phase 11 already separate reasoning from utility. Budget tracker adds token-level granularity within the reasoning role.
- [P09] **Secrets masking pipeline**: Reasoning traces may contain secrets if the user's prompt included them. Masking must apply before trace storage. The existing 5-boundary masking pipeline covers this at the LLM response boundary.
- [P07] **Bun tsc build fails on upstream dep types**: Pi-SDK type changes (0.51.1 to 0.52.9) removed `discoverModels()`/`discoverAuthStorage()`. New reasoning adapter code must use the current constructor-based API pattern.

---

## Success Criteria

Phase complete when:
- [ ] All 5 sessions completed
- [ ] Native `reasoning_delta` events parsed from OpenAI o1/o3 streaming responses
- [ ] Anthropic extended thinking `thinking_delta` events parsed from streaming responses
- [ ] DeepSeek-R1 `<think>` tag reasoning extracted with fallback to tag parser
- [ ] `ChatGenerationResult` accumulator correctly separates reasoning from response content
- [ ] Cross-chunk tag boundaries handled without data loss or corruption
- [ ] Reasoning token budget tracked per session with configurable threshold warnings
- [ ] Reasoning traces stored in `reasoning_traces` SQLite table with queryable indexes
- [ ] CLI command for trace listing/export (`crocbot reasoning traces`)
- [ ] Trace retention policy enforced (configurable TTL, default 7 days)
- [ ] True real-time reasoning streaming (not buffered until text_end)
- [ ] Full test suite passes (`pnpm build && pnpm lint && pnpm test`)

---

## Dependencies

### Depends On
- Phase 12: AI-Powered Memory Consolidation (completed infrastructure, shared utility model patterns)
- Phase 11: 4-Model-Role Architecture (reasoning model identification via `ModelRouter`)
- Phase 10: Per-Provider Rate Limiting (per-role budgets for reasoning model calls)

### Enables
- Phase 14: Projects and Isolated Workspaces (per-project reasoning trace isolation)
- Phase 15: Knowledge Base Import Pipeline (reasoning traces as importable knowledge)
