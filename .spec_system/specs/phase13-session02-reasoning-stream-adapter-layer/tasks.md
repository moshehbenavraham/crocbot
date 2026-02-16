# Task Checklist

**Session ID**: `phase13-session02-reasoning-stream-adapter-layer`
**Total Tasks**: 20
**Estimated Duration**: 6-8 hours
**Created**: 2026-02-16

---

## Legend

- `[x]` = Completed
- `[ ]` = Pending
- `[P]` = Parallelizable (can run with other [P] tasks)
- `[S1302]` = Session reference (Phase 13, Session 02)
- `TNNN` = Task ID

---

## Progress Summary

| Category | Total | Done | Remaining |
|----------|-------|------|-----------|
| Setup | 3 | 3 | 0 |
| Foundation | 3 | 3 | 0 |
| Implementation | 7 | 7 | 0 |
| Testing | 7 | 7 | 0 |
| **Total** | **20** | **20** | **0** |

---

## Setup (3 tasks)

Initial configuration and environment preparation.

- [x] T001 [S1302] Create directory structure (`src/agents/reasoning/`, `src/agents/reasoning/adapters/`)
- [x] T002 [S1302] Verify Pi-AI SDK type availability -- confirm `AssistantMessageEvent` type exists and inspect `thinking_start/delta/end` event discriminants in `@mariozechner/pi-ai`
- [x] T003 [S1302] Audit existing tag infrastructure -- read `THINKING_TAG_SCAN_RE` from `src/agents/pi-embedded-subscribe.ts:24`, `THINKING_TAG_RE` from `src/shared/text/reasoning-tags.ts`, and `blockState`/`stripBlockTags` patterns to determine reuse strategy for fallback adapter

---

## Foundation (3 tasks)

Core type definitions and shared contracts.

- [x] T004 [S1302] Define `ReasoningChunk` interface (`src/agents/reasoning/types.ts`) -- fields: `provider`, `phase`, `text`, `contentIndex`, `isComplete`, `metadata` with readonly properties and strict typing
- [x] T005 [S1302] Define `ReasoningStreamAdapter` interface (`src/agents/reasoning/types.ts`) -- methods: `id`, `canHandle({ model, provider })`, `parseChunk(event)`, `reset()` with `AssistantMessageEvent` import
- [x] T006 [S1302] Define shared helper types and `createReasoningChunk` factory (`src/agents/reasoning/types.ts`) -- `ReasoningPhase` type union, `AdapterMeta` type alias, and a utility function for constructing chunk objects with defaults

---

## Implementation (7 tasks)

Main feature implementation -- four adapters, registry, and barrel export.

- [x] T007 [S1302] [P] Implement OpenAI adapter (`src/agents/reasoning/adapters/openai.ts`) -- `canHandle()` matches `o1*`, `o3*`, `o4*` models with `openai` provider; `parseChunk()` maps `thinking_start/delta/end` to `ReasoningChunk`; `reset()` clears state
- [x] T008 [S1302] [P] Implement Anthropic adapter (`src/agents/reasoning/adapters/anthropic.ts`) -- `canHandle()` matches `anthropic` provider; `parseChunk()` maps `thinking_start/delta/end` to `ReasoningChunk`; handles `thinking_end` content field (Anthropic includes full text in end event)
- [x] T009 [S1302] [P] Implement DeepSeek adapter (`src/agents/reasoning/adapters/deepseek.ts`) -- `canHandle()` matches models containing `reasoner` or `r1` (case-insensitive) regardless of provider; `parseChunk()` maps thinking events to `ReasoningChunk`
- [x] T010 [S1302] Implement tag-fallback adapter (`src/agents/reasoning/adapters/fallback.ts`) -- `canHandle()` always returns `true`; `parseChunk()` processes `text_delta` events with stateful `<think>` tag detection; handles cross-chunk partial tag boundaries using buffered parsing; reuses `THINKING_TAG_RE` from shared module
- [x] T011 [S1302] Implement adapter registry (`src/agents/reasoning/adapter-registry.ts`) -- priority-ordered adapter array (OpenAI -> Anthropic -> DeepSeek -> Tag Fallback); `resolve({ model, provider })` returns first matching adapter; `getAdapters()` for introspection
- [x] T012 [S1302] Create barrel export (`src/agents/reasoning/index.ts`) -- re-export all public types (`ReasoningChunk`, `ReasoningStreamAdapter`, `ReasoningPhase`), all adapters, and the registry
- [x] T013 [S1302] Validate build -- run `pnpm build` to confirm zero type errors across all new files; fix any import path issues (`.js` extensions) or type mismatches

---

## Testing (7 tasks)

Unit tests and quality assurance.

- [x] T014 [S1302] [P] Write OpenAI adapter unit tests (`src/agents/reasoning/adapters/openai.test.ts`) -- test `canHandle()` with o1/o3/o4 models and non-matching models; test full lifecycle (start -> delta(s) -> end); test null return for text events; test empty delta handling; test reset clears state
- [x] T015 [S1302] [P] Write Anthropic adapter unit tests (`src/agents/reasoning/adapters/anthropic.test.ts`) -- test `canHandle()` with anthropic provider; test thinking event lifecycle; test `thinking_end` with content field; test null for non-thinking events; test reset
- [x] T016 [S1302] [P] Write DeepSeek adapter unit tests (`src/agents/reasoning/adapters/deepseek.test.ts`) -- test `canHandle()` with `deepseek-reasoner`, `deepseek-r1` model names across different providers; test thinking event parsing; test null for non-thinking events; test reset
- [x] T017 [S1302] Write tag-fallback adapter unit tests (`src/agents/reasoning/adapters/fallback.test.ts`) -- test `canHandle()` always true; test `<think>` tag detection in text_delta events; test cross-chunk partial tag boundaries (`<thi` + `nk>`); test close+reopen in same chunk; test no-tag text returns null; test multiple thinking blocks; test reset clears buffer state
- [x] T018 [S1302] Write adapter registry unit tests (`src/agents/reasoning/adapter-registry.test.ts`) -- test priority ordering (OpenAI before Anthropic before DeepSeek before fallback); test exact resolution for each provider; test unknown model/provider falls back to tag-fallback; test empty/undefined model/provider strings
- [x] T019 [S1302] Run full test suite and lint -- `pnpm test` (all new + existing tests pass), `pnpm lint` (zero issues), `pnpm build` (zero errors)
- [x] T020 [S1302] Validate ASCII encoding and file conventions -- verify all 12 new files use ASCII-only characters (0-127), Unix LF line endings, `.js` import extensions, no `any` types, correct naming conventions (camelCase/PascalCase)

---

## Completion Checklist

Before marking session complete:

- [x] All tasks marked `[x]`
- [x] All tests passing
- [x] All files ASCII-encoded
- [x] implementation-notes.md updated
- [x] Ready for `/validate`

---

## Notes

### Parallelization
Tasks marked `[P]` can be worked on simultaneously:
- **T007, T008, T009**: The three native adapters (OpenAI, Anthropic, DeepSeek) are independent implementations of the same interface and can be built in parallel
- **T014, T015, T016**: Corresponding test files for the three native adapters are also parallelizable

### Task Timing
Target ~20-25 minutes per task.

### Dependencies
- T004-T006 (Foundation) must complete before T007-T012 (Implementation)
- T007-T009 (native adapters) can run in parallel after Foundation
- T010 (tag-fallback) depends on Foundation only; independent of native adapters
- T011 (registry) depends on all four adapters (T007-T010)
- T013 (build validation) depends on all implementation tasks
- T014-T016 (native adapter tests) can run in parallel after their respective adapters
- T017 (fallback tests) depends on T010
- T018 (registry tests) depends on T011
- T019-T020 (full suite validation) depend on all prior tasks

### Key Technical Notes
- The Pi-AI SDK normalizes all provider wire formats into `thinking_start/delta/end` -- native adapters share similar parsing logic; the differentiator is `canHandle()` resolution
- The tag-fallback adapter is the only adapter consuming `text_delta` events (not `thinking_*`)
- The `AssistantMessageEvent` type from `@mariozechner/pi-ai` may have incomplete type definitions (CONSIDERATIONS P07) -- use runtime type narrowing with `unknown` + type guards
- Reuse `THINKING_TAG_RE` from `src/shared/text/reasoning-tags.ts` in the fallback adapter to avoid regex duplication

---

## Next Steps

Run `/implement` to begin AI-led implementation.
