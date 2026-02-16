import type { AssistantMessageEvent } from "@mariozechner/pi-ai";
import { describe, expect, it } from "vitest";

import { AnthropicReasoningAdapter } from "./anthropic.js";

/** Minimal partial to satisfy the AssistantMessageEvent union. */
const partial = {
  role: "assistant",
  content: [],
  api: "",
  provider: "",
  model: "",
  usage: {},
  stopReason: "stop",
  timestamp: 0,
} as unknown as AssistantMessageEvent extends { partial: infer P } ? P : never;

function thinkingStart(contentIndex = 0): AssistantMessageEvent {
  return { type: "thinking_start", contentIndex, partial } as AssistantMessageEvent;
}

function thinkingDelta(delta: string, contentIndex = 0): AssistantMessageEvent {
  return { type: "thinking_delta", contentIndex, delta, partial } as AssistantMessageEvent;
}

function thinkingEnd(
  content: string,
  contentIndex = 0,
  opts?: { thinkingSignature?: string },
): AssistantMessageEvent {
  const thinkingBlock = {
    type: "thinking" as const,
    thinking: content,
    ...(opts?.thinkingSignature ? { thinkingSignature: opts.thinkingSignature } : {}),
  };
  const p = { ...partial, content: [] as unknown[] };
  // Place the thinking block at the correct contentIndex
  p.content[contentIndex] = thinkingBlock;
  return {
    type: "thinking_end",
    contentIndex,
    content,
    partial: p,
  } as unknown as AssistantMessageEvent;
}

function textDelta(delta: string, contentIndex = 0): AssistantMessageEvent {
  return { type: "text_delta", contentIndex, delta, partial } as AssistantMessageEvent;
}

describe("AnthropicReasoningAdapter", () => {
  describe("canHandle", () => {
    it("returns true for anthropic provider", () => {
      const adapter = new AnthropicReasoningAdapter();
      expect(adapter.canHandle({ model: "claude-3-opus-20240229", provider: "anthropic" })).toBe(
        true,
      );
      expect(
        adapter.canHandle({ model: "claude-3-5-sonnet-20241022", provider: "anthropic" }),
      ).toBe(true);
    });

    it("returns true for any model with anthropic provider", () => {
      const adapter = new AnthropicReasoningAdapter();
      expect(adapter.canHandle({ model: "some-unknown-model", provider: "anthropic" })).toBe(true);
    });

    it("returns false for non-anthropic providers", () => {
      const adapter = new AnthropicReasoningAdapter();
      expect(adapter.canHandle({ model: "claude-3-opus-20240229", provider: "openai" })).toBe(
        false,
      );
      expect(adapter.canHandle({ model: "claude-3-opus-20240229", provider: "deepseek" })).toBe(
        false,
      );
    });

    it("returns false for empty provider", () => {
      const adapter = new AnthropicReasoningAdapter();
      expect(adapter.canHandle({ model: "claude-3-opus-20240229", provider: "" })).toBe(false);
    });
  });

  describe("parseChunk", () => {
    it("maps thinking_start to ReasoningChunk with phase start", () => {
      const adapter = new AnthropicReasoningAdapter();
      const chunk = adapter.parseChunk(thinkingStart(0));
      expect(chunk).toEqual({
        provider: "anthropic",
        phase: "start",
        text: "",
        contentIndex: 0,
        isComplete: false,
        metadata: {},
      });
    });

    it("maps thinking_delta to ReasoningChunk with phase delta", () => {
      const adapter = new AnthropicReasoningAdapter();
      const chunk = adapter.parseChunk(thinkingDelta("I need to consider..."));
      expect(chunk).toEqual({
        provider: "anthropic",
        phase: "delta",
        text: "I need to consider...",
        contentIndex: 0,
        isComplete: false,
        metadata: {},
      });
    });

    it("maps thinking_end with content to ReasoningChunk with metadata", () => {
      const adapter = new AnthropicReasoningAdapter();
      const chunk = adapter.parseChunk(thinkingEnd("Full thinking text here"));
      expect(chunk).toEqual({
        provider: "anthropic",
        phase: "end",
        text: "",
        contentIndex: 0,
        isComplete: true,
        metadata: { fullContent: "Full thinking text here" },
      });
    });

    it("captures thinkingSignature in metadata when present", () => {
      const adapter = new AnthropicReasoningAdapter();
      const chunk = adapter.parseChunk(
        thinkingEnd("Full text", 0, { thinkingSignature: "sig-abc123" }),
      );
      expect(chunk?.metadata).toEqual({
        fullContent: "Full text",
        thinkingSignature: "sig-abc123",
      });
    });

    it("returns null for text_delta events", () => {
      const adapter = new AnthropicReasoningAdapter();
      expect(adapter.parseChunk(textDelta("Hello"))).toBeNull();
    });

    it("returns null for done events", () => {
      const adapter = new AnthropicReasoningAdapter();
      const done = { type: "done", reason: "stop", message: partial } as AssistantMessageEvent;
      expect(adapter.parseChunk(done)).toBeNull();
    });

    it("handles empty delta text", () => {
      const adapter = new AnthropicReasoningAdapter();
      const chunk = adapter.parseChunk(thinkingDelta(""));
      expect(chunk?.text).toBe("");
      expect(chunk?.phase).toBe("delta");
    });

    it("preserves contentIndex from event", () => {
      const adapter = new AnthropicReasoningAdapter();
      const chunk = adapter.parseChunk(thinkingDelta("text", 2));
      expect(chunk?.contentIndex).toBe(2);
    });

    it("handles full lifecycle: start -> delta(s) -> end", () => {
      const adapter = new AnthropicReasoningAdapter();

      const start = adapter.parseChunk(thinkingStart());
      expect(start?.phase).toBe("start");

      const delta1 = adapter.parseChunk(thinkingDelta("First part "));
      expect(delta1?.text).toBe("First part ");

      const delta2 = adapter.parseChunk(thinkingDelta("second part"));
      expect(delta2?.text).toBe("second part");

      const end = adapter.parseChunk(thinkingEnd("First part second part"));
      expect(end?.phase).toBe("end");
      expect(end?.isComplete).toBe(true);
      expect(end?.metadata).toHaveProperty("fullContent", "First part second part");
    });

    it("handles thinking_end with empty content", () => {
      const adapter = new AnthropicReasoningAdapter();
      const evt = {
        type: "thinking_end",
        contentIndex: 0,
        content: "",
        partial,
      } as AssistantMessageEvent;
      const chunk = adapter.parseChunk(evt);
      expect(chunk?.phase).toBe("end");
      expect(chunk?.isComplete).toBe(true);
      // Empty string is falsy, so fullContent should not be in metadata
      expect(chunk?.metadata).toEqual({});
    });
  });

  describe("reset", () => {
    it("clears internal state", () => {
      const adapter = new AnthropicReasoningAdapter();
      adapter.parseChunk(thinkingStart());
      adapter.reset();
      const chunk = adapter.parseChunk(thinkingStart());
      expect(chunk?.phase).toBe("start");
    });
  });

  describe("id", () => {
    it("returns anthropic", () => {
      const adapter = new AnthropicReasoningAdapter();
      expect(adapter.id).toBe("anthropic");
    });
  });
});
