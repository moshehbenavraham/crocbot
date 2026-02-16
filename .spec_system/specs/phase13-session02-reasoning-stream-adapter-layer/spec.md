# Session Specification

**Session ID**: `phase13-session02-reasoning-stream-adapter-layer`
**Phase**: 13 - Reasoning Model Support
**Status**: Not Started
**Created**: 2026-02-16

---

## 1. Session Overview

This session implements the per-provider reasoning stream adapter layer that normalizes native reasoning events from OpenAI o1/o3, Anthropic extended thinking, and DeepSeek-R1 into a common `ReasoningChunk` interface. The adapters consume Pi-AI SDK `thinking_start/delta/end` events -- which the SDK already normalizes from provider-specific wire formats -- and produce a unified chunk stream that downstream components (accumulator, trace store) will consume.

The adapter layer is the foundational building block of Phase 13. Session 01 established that the Pi-AI SDK natively exposes `thinking_delta` events that crocbot currently filters out at a single line in the message handler. This session creates the normalization infrastructure: type definitions, four concrete adapters (OpenAI, Anthropic, DeepSeek, tag-fallback), and a registry that resolves the correct adapter by model/provider metadata at message start. All adapters produce identical `ReasoningChunk` objects regardless of the underlying provider format.

Without this adapter layer, Session 03 (accumulator) has no normalized chunk stream to consume, and Session 04 (trace storage) has no reasoning content to persist. This is the critical path dependency for the entire phase.

---

## 2. Objectives

1. Define `ReasoningChunk` and `ReasoningStreamAdapter` TypeScript interfaces as the public contract for reasoning event normalization
2. Implement four concrete adapters (OpenAI, Anthropic, DeepSeek, tag-fallback) that parse SDK `AssistantMessageEvent` events into `ReasoningChunk` objects
3. Implement an adapter registry with priority-ordered model-to-adapter resolution (OpenAI -> Anthropic -> DeepSeek -> Tag Fallback)
4. Achieve full unit test coverage for all adapters and registry with real-world SSE payload samples including edge cases (empty deltas, cross-chunk tag boundaries, unknown models)

---

## 3. Prerequisites

### Required Sessions
- [x] `phase13-session01-research-and-architecture-design` - Provider wire format documentation, `ReasoningChunk`/`ReasoningStreamAdapter` interface designs, Pi-AI SDK audit confirming native `thinking_delta` event support, integration point map

### Required Tools/Knowledge
- Pi-AI SDK type definitions (`AssistantMessageEvent`, `ThinkingContent`, `TextContent`)
- Existing tag-based infrastructure (`THINKING_TAG_SCAN_RE`, `stripBlockTags`, `blockState`)
- Vitest testing framework with colocated test file convention

### Environment Requirements
- Node 22+ runtime
- pnpm package manager
- `@mariozechner/pi-ai` and `@mariozechner/pi-agent-core` installed (type definitions)

---

## 4. Scope

### In Scope (MVP)
- `ReasoningChunk` interface with `provider`, `phase`, `text`, `contentIndex`, `isComplete`, `metadata` fields
- `ReasoningStreamAdapter` interface with `id`, `canHandle()`, `parseChunk()`, `reset()` methods
- OpenAI adapter: parse `thinking_start/delta/end` SDK events for models matching `o1*`, `o3*`, `o4*`
- Anthropic adapter: parse `thinking_start/delta/end` SDK events for Anthropic provider
- DeepSeek adapter: parse `thinking_start/delta/end` SDK events for models matching `*reasoner*` or `*r1*`
- Tag-fallback adapter: parse `text_delta` events containing `<think>` tags using existing `THINKING_TAG_SCAN_RE` patterns with stateful cross-chunk boundary handling
- Adapter registry: priority-ordered `canHandle()` resolution with model/provider metadata input
- Barrel export (`index.ts`) for clean public API surface
- Unit tests for each adapter with SDK event fixtures (start/delta/end sequences, empty deltas, unknown events)
- Unit tests for tag-fallback adapter with cross-chunk `<think>` tag boundary cases
- Unit tests for registry resolution logic (exact matches, fallback behavior, unknown models)

### Out of Scope (Deferred)
- `ChatGenerationResult` accumulator class - *Reason: Session 03 deliverable*
- Integration into `pi-embedded-subscribe.handlers.messages.ts` event routing - *Reason: Session 03 wires adapters into the streaming pipeline*
- Trace storage and SQLite schema - *Reason: Session 04 deliverable*
- Budget tracking and threshold warnings - *Reason: Session 04 deliverable*
- Expanding the event filter gate (line 59 of handlers.messages.ts) - *Reason: Session 03 integration concern*

---

## 5. Technical Approach

### Architecture

The adapter layer follows a Strategy pattern where each provider has a dedicated adapter implementing the common `ReasoningStreamAdapter` interface. The adapter registry acts as the strategy resolver, iterating adapters in priority order and locking the first match at message start.

```
SDK Event (AssistantMessageEvent)
    |
    v
[Adapter Registry] --resolve(model, provider)--> [Concrete Adapter]
    |                                                     |
    v                                                     v
canHandle() priority:                             parseChunk(event)
  1. OpenAI                                           |
  2. Anthropic                                        v
  3. DeepSeek                                   ReasoningChunk | null
  4. Tag Fallback (always matches)
```

All three native adapters (OpenAI, Anthropic, DeepSeek) share the same parsing logic since the Pi-AI SDK normalizes all provider formats into `thinking_start/delta/end` events. The distinction is in `canHandle()` -- identifying which provider produced the event -- and in `metadata` population (e.g., Anthropic signatures, OpenAI effort levels).

The tag-fallback adapter takes a different path: it receives `text_delta` events (not `thinking_*` events) and applies stateful regex-based tag detection to extract reasoning content embedded in the text stream.

### Design Patterns
- **Strategy Pattern**: Adapter registry selects the active adapter via `canHandle()` priority chain
- **Adapter Pattern**: Each provider adapter normalizes SDK events to common `ReasoningChunk` interface
- **Stateful Parser**: Tag-fallback adapter maintains `thinking` state across chunk boundaries for partial tag handling

### Technology Stack
- TypeScript 5.x (strict mode, ESM)
- `@mariozechner/pi-ai` types (`AssistantMessageEvent`)
- Vitest for unit testing
- Existing `THINKING_TAG_SCAN_RE` regex from `src/agents/pi-embedded-subscribe.ts`

---

## 6. Deliverables

### Files to Create
| File | Purpose | Est. Lines |
|------|---------|------------|
| `src/agents/reasoning/types.ts` | `ReasoningChunk` and `ReasoningStreamAdapter` interfaces | ~70 |
| `src/agents/reasoning/adapters/openai.ts` | OpenAI o1/o3/o4-mini reasoning adapter | ~80 |
| `src/agents/reasoning/adapters/anthropic.ts` | Anthropic extended thinking adapter | ~80 |
| `src/agents/reasoning/adapters/deepseek.ts` | DeepSeek-R1 reasoning adapter | ~80 |
| `src/agents/reasoning/adapters/fallback.ts` | Tag-based fallback adapter with stateful parsing | ~130 |
| `src/agents/reasoning/adapter-registry.ts` | Model-to-adapter resolution with priority ordering | ~60 |
| `src/agents/reasoning/index.ts` | Barrel export for public API | ~15 |
| `src/agents/reasoning/adapters/openai.test.ts` | OpenAI adapter unit tests | ~120 |
| `src/agents/reasoning/adapters/anthropic.test.ts` | Anthropic adapter unit tests | ~120 |
| `src/agents/reasoning/adapters/deepseek.test.ts` | DeepSeek adapter unit tests | ~120 |
| `src/agents/reasoning/adapters/fallback.test.ts` | Tag-fallback adapter unit tests with boundary cases | ~180 |
| `src/agents/reasoning/adapter-registry.test.ts` | Registry resolution unit tests | ~120 |

### Files to Modify
| File | Changes | Est. Lines |
|------|---------|------------|
| (none) | Session 02 is self-contained; integration into the streaming pipeline is Session 03 | ~0 |

---

## 7. Success Criteria

### Functional Requirements
- [ ] `ReasoningChunk` interface matches the design from Session 01 research document (Section 6.1)
- [ ] `ReasoningStreamAdapter` interface matches the design from Session 01 research document (Section 6.2)
- [ ] OpenAI adapter `canHandle()` returns `true` for models starting with `o1`, `o3`, `o4` with provider `openai`
- [ ] Anthropic adapter `canHandle()` returns `true` for provider `anthropic`
- [ ] DeepSeek adapter `canHandle()` returns `true` for models containing `reasoner` or `r1` with provider `deepseek`
- [ ] Tag-fallback adapter `canHandle()` always returns `true` (lowest priority fallback)
- [ ] All native adapters correctly parse `thinking_start` -> `ReasoningChunk { phase: "start" }`
- [ ] All native adapters correctly parse `thinking_delta` -> `ReasoningChunk { phase: "delta", text: ... }`
- [ ] All native adapters correctly parse `thinking_end` -> `ReasoningChunk { phase: "end", isComplete: true }`
- [ ] All native adapters return `null` for non-thinking events (`text_delta`, `text_start`, etc.)
- [ ] Tag-fallback adapter detects `<think>` tags in `text_delta` events and produces `ReasoningChunk` objects
- [ ] Tag-fallback adapter handles cross-chunk partial tag boundaries (e.g., `<thi` + `nk>`)
- [ ] Adapter registry resolves correct adapter in priority order
- [ ] Adapter registry falls back to tag-fallback when no native adapter matches

### Testing Requirements
- [ ] Unit tests written and passing for all four adapters
- [ ] Unit tests written and passing for adapter registry
- [ ] Edge cases covered: empty deltas, unknown event types, multiple thinking blocks, reset between messages
- [ ] Cross-chunk tag boundary tests for fallback adapter
- [ ] All tests pass via `pnpm test`

### Quality Gates
- [ ] All files ASCII-encoded
- [ ] Unix LF line endings
- [ ] `.js` extensions in all ESM imports
- [ ] No `any` types -- use `unknown` with type guards
- [ ] `interface` for object shapes, `type` for unions
- [ ] Explicit return types on exported functions
- [ ] camelCase for variables/functions, PascalCase for interfaces/types
- [ ] `pnpm build` passes (zero type errors)
- [ ] `pnpm lint` passes (zero lint issues)

---

## 8. Implementation Notes

### Key Considerations
- The Pi-AI SDK normalizes all three provider wire formats into a common `thinking_start/delta/end` event model. The native adapters (OpenAI, Anthropic, DeepSeek) share similar parsing logic -- the differentiator is `canHandle()` resolution and metadata population.
- The tag-fallback adapter is the only adapter that receives `text_delta` events rather than `thinking_*` events. It must maintain stateful tracking for cross-chunk tag boundaries.
- Import the `AssistantMessageEvent` type from `@mariozechner/pi-ai` -- this is the SDK's discriminated union that all adapters consume.
- The `THINKING_TAG_SCAN_RE` regex is defined locally in `pi-embedded-subscribe.ts` (line 24). For the fallback adapter, either re-import the shared `THINKING_TAG_RE` from `src/shared/text/reasoning-tags.ts` or define a local pattern. Prefer the shared module to avoid duplication.

### Potential Challenges
- **SDK type definitions may have gaps**: The Bun tsc build already fails on upstream dep types (CONSIDERATIONS P07). Verify `AssistantMessageEvent` includes all thinking event types at runtime. If types are incomplete, use type assertions with comments explaining why.
- **Tag-fallback cross-chunk boundaries**: The `<think>` tag can split across chunk boundaries (e.g., `<thi` + `nk>`). The fallback adapter must buffer partial tags and resolve them on the next chunk. Reuse the proven `blockState` pattern from `pi-embedded-subscribe.ts`.
- **DeepSeek model name matching**: DeepSeek models may be accessed through various providers (official API, OpenRouter, Azure). The `canHandle()` logic should match on model name patterns (`*reasoner*`, `*r1*`), not just provider name, to catch these cases.

### Relevant Considerations
- [P07] **Bun tsc build fails on upstream dep types**: Pi-AI SDK type definitions may have gaps for reasoning event types. The adapters should handle this gracefully with runtime type narrowing rather than assuming compile-time type completeness.
- [P09] **Secrets masking pipeline**: Reasoning content will eventually need masking before storage (Session 04 concern). Adapter design does not need to address masking, but the `ReasoningChunk.text` field must carry raw text without transformation so the masking boundary can be applied downstream.

### ASCII Reminder
All output files must use ASCII-only characters (0-127).

---

## 9. Testing Strategy

### Unit Tests
- Each adapter tested in isolation with mock `AssistantMessageEvent` objects
- Test the full lifecycle: `reset()` -> `parseChunk(thinking_start)` -> `parseChunk(thinking_delta)` (multiple) -> `parseChunk(thinking_end)`
- Test `parseChunk()` returns `null` for non-thinking events
- Test `canHandle()` with various model/provider combinations
- Test tag-fallback with `text_delta` events containing `<think>` tags

### Integration Tests
- Not in scope for this session. Integration testing (adapter + accumulator + pipeline) is Session 05.

### Manual Testing
- Not applicable -- this session produces library code with no UI surface. Manual testing occurs in Session 03 when adapters are wired into the streaming pipeline.

### Edge Cases
- Empty `thinking_delta` events (delta is empty string)
- Multiple consecutive `thinking_delta` events (accumulation)
- `thinking_end` with content string (Anthropic includes full thinking text in `content` field of `thinking_end`)
- `text_delta` events with no `<think>` tags (fallback adapter returns null)
- `text_delta` events with partial `<think>` tag at chunk boundary
- `text_delta` events with `<think>` tag closing and reopening in same chunk
- `text_delta` events with nested `<think>` tags (should not nest, but handle gracefully)
- Unknown model/provider combinations (registry falls back to tag-fallback)
- `canHandle()` with empty or undefined model/provider strings
- `reset()` clears all internal state between messages

---

## 10. Dependencies

### External Libraries
- `@mariozechner/pi-ai`: SDK type definitions (`AssistantMessageEvent`, `ThinkingContent`)
- `vitest`: Test framework

### Other Sessions
- **Depends on**: `phase13-session01-research-and-architecture-design` (interface designs, wire format documentation, integration point map)
- **Depended by**: `phase13-session03-chat-generation-result-accumulator` (accumulator consumes `ReasoningChunk` events), `phase13-session04-reasoning-trace-storage-and-budget-tracking` (trace store persists reasoning content), `phase13-session05-integration-testing-and-validation` (full-stack integration tests)

---

## Next Steps

Run `/tasks` to generate the implementation task checklist.
