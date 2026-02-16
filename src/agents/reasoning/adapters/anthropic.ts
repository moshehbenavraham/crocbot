import type { AssistantMessageEvent } from "@mariozechner/pi-ai";

import { createReasoningChunk } from "../types.js";
import type { ReasoningChunk, ReasoningStreamAdapter } from "../types.js";

const PROVIDER_ID = "anthropic" as const;

/**
 * Anthropic extended thinking adapter.
 *
 * Handles `thinking_start/delta/end` SDK events for Anthropic models.
 * The Pi-AI SDK normalizes Anthropic's `content_block_delta` wire format
 * (with `thinking_delta` type) into the common thinking event model.
 *
 * Anthropic's `thinking_end` event includes the full thinking text in
 * the `content` field. This adapter captures it as metadata so downstream
 * consumers can verify accumulated text against the final content.
 */
export class AnthropicReasoningAdapter implements ReasoningStreamAdapter {
  readonly id = PROVIDER_ID;

  private thinkingActive = false;

  canHandle(params: { model: string; provider: string }): boolean {
    return params.provider === "anthropic";
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

      case "thinking_end": {
        this.thinkingActive = false;
        // Anthropic includes the full thinking text and optional signature
        // in the thinking_end event. Capture as metadata.
        const metadata: Record<string, unknown> = {};
        if (event.content) {
          metadata.fullContent = event.content;
        }
        // Extract thinkingSignature if present in the partial message
        const thinkingBlock = event.partial?.content?.[event.contentIndex];
        if (
          thinkingBlock &&
          typeof thinkingBlock === "object" &&
          "type" in thinkingBlock &&
          thinkingBlock.type === "thinking" &&
          "thinkingSignature" in thinkingBlock &&
          typeof thinkingBlock.thinkingSignature === "string"
        ) {
          metadata.thinkingSignature = thinkingBlock.thinkingSignature;
        }
        return createReasoningChunk({
          provider: PROVIDER_ID,
          phase: "end",
          contentIndex: event.contentIndex,
          metadata,
        });
      }

      default:
        return null;
    }
  }

  reset(): void {
    this.thinkingActive = false;
  }
}
