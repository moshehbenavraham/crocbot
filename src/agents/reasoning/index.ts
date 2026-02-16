// Public API for the reasoning stream adapter layer.

// Types and interfaces
export type {
  AdapterMeta,
  ReasoningChunk,
  ReasoningChunkInit,
  ReasoningPhase,
  ReasoningStreamAdapter,
} from "./types.js";
export { createReasoningChunk } from "./types.js";

// Adapters
export { AnthropicReasoningAdapter } from "./adapters/anthropic.js";
export { DeepSeekReasoningAdapter } from "./adapters/deepseek.js";
export { TagFallbackAdapter } from "./adapters/fallback.js";
export { OpenAiReasoningAdapter } from "./adapters/openai.js";

// Registry
export { getAdapters, resolveAdapter } from "./adapter-registry.js";

// Accumulator
export { ChatGenerationResult } from "./generation-result.js";
export type { ChatGenerationResultOptions, ThinkingPair } from "./generation-result.js";
