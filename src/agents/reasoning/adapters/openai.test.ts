import type { AssistantMessageEvent } from "@mariozechner/pi-ai";
import { describe, expect, it } from "vitest";

import { OpenAiReasoningAdapter } from "./openai.js";

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

function thinkingEnd(content: string, contentIndex = 0): AssistantMessageEvent {
  return { type: "thinking_end", contentIndex, content, partial } as AssistantMessageEvent;
}

function textDelta(delta: string, contentIndex = 0): AssistantMessageEvent {
  return { type: "text_delta", contentIndex, delta, partial } as AssistantMessageEvent;
}

describe("OpenAiReasoningAdapter", () => {
  describe("canHandle", () => {
    it("returns true for o1 models with openai provider", () => {
      const adapter = new OpenAiReasoningAdapter();
      expect(adapter.canHandle({ model: "o1-preview", provider: "openai" })).toBe(true);
      expect(adapter.canHandle({ model: "o1-mini", provider: "openai" })).toBe(true);
      expect(adapter.canHandle({ model: "o1", provider: "openai" })).toBe(true);
    });

    it("returns true for o3 models with openai provider", () => {
      const adapter = new OpenAiReasoningAdapter();
      expect(adapter.canHandle({ model: "o3-mini", provider: "openai" })).toBe(true);
      expect(adapter.canHandle({ model: "o3", provider: "openai" })).toBe(true);
    });

    it("returns true for o4 models with openai provider", () => {
      const adapter = new OpenAiReasoningAdapter();
      expect(adapter.canHandle({ model: "o4-mini", provider: "openai" })).toBe(true);
    });

    it("returns false for non-reasoning openai models", () => {
      const adapter = new OpenAiReasoningAdapter();
      expect(adapter.canHandle({ model: "gpt-4o", provider: "openai" })).toBe(false);
      expect(adapter.canHandle({ model: "gpt-4-turbo", provider: "openai" })).toBe(false);
      expect(adapter.canHandle({ model: "gpt-3.5-turbo", provider: "openai" })).toBe(false);
    });

    it("returns false for non-openai provider even with reasoning model name", () => {
      const adapter = new OpenAiReasoningAdapter();
      expect(adapter.canHandle({ model: "o1-preview", provider: "anthropic" })).toBe(false);
      expect(adapter.canHandle({ model: "o3-mini", provider: "deepseek" })).toBe(false);
    });

    it("returns false for empty model or provider", () => {
      const adapter = new OpenAiReasoningAdapter();
      expect(adapter.canHandle({ model: "", provider: "openai" })).toBe(false);
      expect(adapter.canHandle({ model: "o1", provider: "" })).toBe(false);
    });

    it("is case-insensitive for model name", () => {
      const adapter = new OpenAiReasoningAdapter();
      expect(adapter.canHandle({ model: "O1-Preview", provider: "openai" })).toBe(true);
      expect(adapter.canHandle({ model: "O3-MINI", provider: "openai" })).toBe(true);
    });
  });

  describe("parseChunk", () => {
    it("maps thinking_start to ReasoningChunk with phase start", () => {
      const adapter = new OpenAiReasoningAdapter();
      const chunk = adapter.parseChunk(thinkingStart(0));
      expect(chunk).toEqual({
        provider: "openai",
        phase: "start",
        text: "",
        contentIndex: 0,
        isComplete: false,
        metadata: {},
      });
    });

    it("maps thinking_delta to ReasoningChunk with phase delta", () => {
      const adapter = new OpenAiReasoningAdapter();
      const chunk = adapter.parseChunk(thinkingDelta("Let me think..."));
      expect(chunk).toEqual({
        provider: "openai",
        phase: "delta",
        text: "Let me think...",
        contentIndex: 0,
        isComplete: false,
        metadata: {},
      });
    });

    it("maps thinking_end to ReasoningChunk with phase end and isComplete", () => {
      const adapter = new OpenAiReasoningAdapter();
      const chunk = adapter.parseChunk(thinkingEnd("full text"));
      expect(chunk).toEqual({
        provider: "openai",
        phase: "end",
        text: "",
        contentIndex: 0,
        isComplete: true,
        metadata: {},
      });
    });

    it("returns null for text_delta events", () => {
      const adapter = new OpenAiReasoningAdapter();
      expect(adapter.parseChunk(textDelta("Hello"))).toBeNull();
    });

    it("returns null for done events", () => {
      const adapter = new OpenAiReasoningAdapter();
      const done = { type: "done", reason: "stop", message: partial } as AssistantMessageEvent;
      expect(adapter.parseChunk(done)).toBeNull();
    });

    it("handles empty delta text", () => {
      const adapter = new OpenAiReasoningAdapter();
      const chunk = adapter.parseChunk(thinkingDelta(""));
      expect(chunk).toEqual({
        provider: "openai",
        phase: "delta",
        text: "",
        contentIndex: 0,
        isComplete: false,
        metadata: {},
      });
    });

    it("preserves contentIndex from event", () => {
      const adapter = new OpenAiReasoningAdapter();
      const chunk = adapter.parseChunk(thinkingDelta("text", 3));
      expect(chunk?.contentIndex).toBe(3);
    });

    it("handles full lifecycle: start -> delta(s) -> end", () => {
      const adapter = new OpenAiReasoningAdapter();

      const start = adapter.parseChunk(thinkingStart());
      expect(start?.phase).toBe("start");

      const delta1 = adapter.parseChunk(thinkingDelta("Step 1: "));
      expect(delta1?.phase).toBe("delta");
      expect(delta1?.text).toBe("Step 1: ");

      const delta2 = adapter.parseChunk(thinkingDelta("Step 2: "));
      expect(delta2?.phase).toBe("delta");
      expect(delta2?.text).toBe("Step 2: ");

      const end = adapter.parseChunk(thinkingEnd("full"));
      expect(end?.phase).toBe("end");
      expect(end?.isComplete).toBe(true);
    });
  });

  describe("reset", () => {
    it("clears internal state", () => {
      const adapter = new OpenAiReasoningAdapter();
      adapter.parseChunk(thinkingStart());
      adapter.reset();
      // After reset, adapter should work cleanly for a new message
      const chunk = adapter.parseChunk(thinkingStart());
      expect(chunk?.phase).toBe("start");
    });
  });

  describe("id", () => {
    it("returns openai", () => {
      const adapter = new OpenAiReasoningAdapter();
      expect(adapter.id).toBe("openai");
    });
  });
});
