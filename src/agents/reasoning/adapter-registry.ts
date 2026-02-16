import type { ReasoningStreamAdapter } from "./types.js";

import { AnthropicReasoningAdapter } from "./adapters/anthropic.js";
import { DeepSeekReasoningAdapter } from "./adapters/deepseek.js";
import { TagFallbackAdapter } from "./adapters/fallback.js";
import { OpenAiReasoningAdapter } from "./adapters/openai.js";

/**
 * Priority-ordered list of reasoning stream adapters.
 *
 * Resolution order:
 *   1. OpenAI  -- matches o1*, o3*, o4* models with openai provider
 *   2. Anthropic -- matches anthropic provider
 *   3. DeepSeek -- matches models containing "reasoner" or "r1"
 *   4. Tag Fallback -- always matches (lowest priority, catches everything)
 */
const DEFAULT_ADAPTERS: readonly ReasoningStreamAdapter[] = [
  new OpenAiReasoningAdapter(),
  new AnthropicReasoningAdapter(),
  new DeepSeekReasoningAdapter(),
  new TagFallbackAdapter(),
] as const;

/**
 * Resolve the appropriate reasoning adapter for a model/provider combination.
 *
 * Iterates adapters in priority order and returns the first one whose
 * `canHandle()` returns `true`. The tag-fallback adapter always returns
 * `true`, guaranteeing a match.
 */
export function resolveAdapter(params: {
  model: string;
  provider: string;
}): ReasoningStreamAdapter {
  const adapter = DEFAULT_ADAPTERS.find((a) => a.canHandle(params));
  // Tag-fallback always matches, so this is guaranteed to find one.
  // The non-null assertion is safe here; defensive check for completeness.
  if (!adapter) {
    throw new Error(
      `No reasoning adapter found for model=${params.model} provider=${params.provider}`,
    );
  }
  return adapter;
}

/** Return the full list of registered adapters in priority order. */
export function getAdapters(): readonly ReasoningStreamAdapter[] {
  return DEFAULT_ADAPTERS;
}
