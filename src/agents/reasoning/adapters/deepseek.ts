import type { AssistantMessageEvent } from "@mariozechner/pi-ai";

import { createReasoningChunk } from "../types.js";
import type { ReasoningChunk, ReasoningStreamAdapter } from "../types.js";

const PROVIDER_ID = "deepseek" as const;

/** Case-insensitive patterns that indicate DeepSeek reasoning models. */
const MODEL_PATTERNS = [/reasoner/i, /r1/i];

function isDeepSeekReasoningModel(model: string): boolean {
  return MODEL_PATTERNS.some((re) => re.test(model));
}

/**
 * DeepSeek-R1 reasoning adapter.
 *
 * Handles `thinking_start/delta/end` SDK events for DeepSeek reasoning models.
 * The Pi-AI SDK normalizes DeepSeek's `delta.reasoning_content` wire format
 * into the common thinking event model.
 *
 * DeepSeek models may be accessed through various providers (official API,
 * OpenRouter, Azure), so `canHandle()` matches on model name patterns
 * (`*reasoner*`, `*r1*`) rather than requiring provider === "deepseek".
 */
export class DeepSeekReasoningAdapter implements ReasoningStreamAdapter {
  readonly id = PROVIDER_ID;

  private thinkingActive = false;

  canHandle(params: { model: string; provider: string }): boolean {
    return isDeepSeekReasoningModel(params.model);
  }

  parseChunk(event: AssistantMessageEvent): ReasoningChunk | null {
    switch (event.type) {
      case "thinking_start":
        this.thinkingActive = true;
        return createReasoningChunk({
          provider: PROVIDER_ID,
          phase: "start",
          contentIndex: event.contentIndex,
        });

      case "thinking_delta":
        return createReasoningChunk({
          provider: PROVIDER_ID,
          phase: "delta",
          text: event.delta,
          contentIndex: event.contentIndex,
        });

      case "thinking_end":
        this.thinkingActive = false;
        return createReasoningChunk({
          provider: PROVIDER_ID,
          phase: "end",
          contentIndex: event.contentIndex,
        });

      default:
        return null;
    }
  }

  reset(): void {
    this.thinkingActive = false;
  }
}
