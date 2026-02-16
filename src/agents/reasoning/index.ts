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

// Schema
export { ensureReasoningSchema, getReasoningSchemaVersion } from "./reasoning-schema.js";

// Trace store
export {
  ReasoningTraceStore,
  initTraceStoreListener,
  parseReasoningTokens,
} from "./trace-store.js";
export type {
  InsertTraceParams,
  ReasoningTrace,
  TraceQueryOptions,
  TraceStoreConfig,
} from "./trace-store.js";

// Budget tracker
export { ReasoningBudgetTracker, initBudgetTrackerListener } from "./budget-tracker.js";
export type { BudgetStatus, BudgetTrackerOptions } from "./budget-tracker.js";
