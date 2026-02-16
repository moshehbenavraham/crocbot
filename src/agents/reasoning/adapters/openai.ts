import type { AssistantMessageEvent } from "@mariozechner/pi-ai";

import { createReasoningChunk } from "../types.js";
import type { ReasoningChunk, ReasoningStreamAdapter } from "../types.js";

const PROVIDER_ID = "openai" as const;

/** Model prefixes that indicate OpenAI reasoning models. */
const REASONING_PREFIXES = ["o1", "o3", "o4"];

function isReasoningModel(model: string): boolean {
  const lower = model.toLowerCase();
  return REASONING_PREFIXES.some((p) => lower.startsWith(p));
}

/**
 * OpenAI reasoning adapter.
 *
 * Handles `thinking_start/delta/end` SDK events for OpenAI o1/o3/o4 models.
 * The Pi-AI SDK normalizes the OpenAI wire format into these events.
 */
export class OpenAiReasoningAdapter implements ReasoningStreamAdapter {
  readonly id = PROVIDER_ID;

  private thinkingActive = false;

  canHandle(params: { model: string; provider: string }): boolean {
    return params.provider === "openai" && isReasoningModel(params.model);
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
