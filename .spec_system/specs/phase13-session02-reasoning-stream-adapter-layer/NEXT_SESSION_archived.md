# NEXT_SESSION.md

## Session Recommendation

**Generated**: 2026-02-16
**Project State**: Phase 13 - Reasoning Model Support
**Completed Sessions**: 65 of 70+ total

---

## Recommended Next Session

**Session ID**: `phase13-session02-reasoning-stream-adapter-layer`
**Session Name**: Reasoning Stream Adapter Layer
**Estimated Duration**: 2-4 hours
**Estimated Tasks**: ~20

---

## Why This Session Next?

### Prerequisites Met
- [x] Phase 12 (AI-Powered Memory Consolidation) completed
- [x] Session 01 research completed with provider wire format documentation
- [x] Pi-AI SDK streaming event behavior documented (in Session 01 research deliverables)
- [x] Existing tag-based reasoning infrastructure mapped (from v0.1.117 upstream sync)

### Dependencies
- **Builds on**: Phase 13 Session 01 (Research and Architecture Design) -- uses the `ReasoningChunk` interface design, adapter pattern, and integration point map produced by the research session
- **Enables**: Session 03 (Chat Generation Result Accumulator) -- the accumulator consumes `ReasoningChunk` events produced by the adapters built in this session

### Project Progression
This is the natural next step in Phase 13's linear dependency chain: research (01) -> adapters (02) -> accumulator (03) -> storage/budget (04) -> validation (05). Session 01 completed the architecture design and provider wire format documentation. Session 02 now implements the foundational adapter layer that all subsequent sessions depend on. Without the per-provider adapters, the accumulator (Session 03) has no normalized chunk stream to consume, and the trace storage (Session 04) has no reasoning content to persist.

---

## Session Overview

### Objective
Implement per-provider reasoning stream adapters that detect and parse native `reasoning_delta` events from OpenAI o1/o3, Anthropic extended thinking, and DeepSeek-R1, normalizing to a common `ReasoningChunk` interface with fallback to tag parsing.

### Key Deliverables
1. `src/agents/reasoning/types.ts` -- `ReasoningChunk` and `ReasoningStreamAdapter` interfaces
2. `src/agents/reasoning/adapters/openai.ts` -- OpenAI o1/o3 reasoning adapter
3. `src/agents/reasoning/adapters/anthropic.ts` -- Anthropic extended thinking adapter
4. `src/agents/reasoning/adapters/deepseek.ts` -- DeepSeek-R1 tag-based adapter
5. `src/agents/reasoning/adapters/fallback.ts` -- Generic tag-parsing fallback adapter
6. `src/agents/reasoning/adapter-registry.ts` -- Model-to-adapter resolution
7. Colocated unit tests for all adapters and registry

### Scope Summary
- **In Scope (MVP)**: `ReasoningChunk` interface, `ReasoningStreamAdapter` interface, OpenAI/Anthropic/DeepSeek/fallback adapters, adapter registry with model-to-adapter resolution, unit tests with real-world SSE payload samples
- **Out of Scope**: `ChatGenerationResult` accumulator (Session 03), trace storage and budget tracking (Session 04), integration into `pi-embedded-subscribe.ts` streaming pipeline (Session 03)

---

## Technical Considerations

### Technologies/Patterns
- Per-provider adapter pattern with common `ReasoningChunk` normalization interface
- Adapter registry for model-to-adapter resolution (similar to existing model-router pattern from Phase 11)
- Cross-chunk tag boundary handling for DeepSeek-R1 `<think>` tag extraction
- Leverages existing `THINKING_TAG_SCAN_RE` / `FINAL_TAG_SCAN_RE` patterns from `pi-embedded-subscribe.ts`

### Potential Challenges
- Provider SSE wire format variance: OpenAI uses `reasoning_delta` event type, Anthropic uses `content_block_delta` with `thinking_delta` sub-type, DeepSeek embeds reasoning in `text_delta` with XML tags
- Pi-AI SDK may mask native reasoning events behind a unified `text_delta` -- adapter needs to detect whether raw events are available or fall back to tag parsing
- Cross-chunk partial tag boundaries for DeepSeek-R1 (e.g., `<thi` + `nk>`) require stateful parsing

### Relevant Considerations
- [P07] **Bun tsc build fails on upstream dep types**: Pi-AI SDK type definitions may have gaps for reasoning event types; verify against actual runtime behavior
- [P09] **Secrets masking pipeline**: Reasoning content must eventually be masked before storage (Session 04 concern, but adapter design should not preclude it)

---

## Alternative Sessions

If this session is blocked:
1. **phase13-session04-reasoning-trace-storage-and-budget-tracking** -- The SQLite schema and budget tracker have fewer dependencies on the adapter layer and could theoretically be scaffolded independently, though the hook into `ChatGenerationResult` finalization would remain stubbed
2. **phase14 (Projects and Isolated Workspaces)** -- Entirely independent phase that could be started if Phase 13 is blocked on provider API access or SDK limitations

---

## Next Steps

Run `/sessionspec` to generate the formal specification.
