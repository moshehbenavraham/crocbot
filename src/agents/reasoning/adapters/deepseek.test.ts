import type { AssistantMessageEvent } from "@mariozechner/pi-ai";
import { describe, expect, it } from "vitest";

import { DeepSeekReasoningAdapter } from "./deepseek.js";

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

describe("DeepSeekReasoningAdapter", () => {
  describe("canHandle", () => {
    it("returns true for models containing 'reasoner'", () => {
      const adapter = new DeepSeekReasoningAdapter();
      expect(adapter.canHandle({ model: "deepseek-reasoner", provider: "deepseek" })).toBe(true);
      expect(adapter.canHandle({ model: "deepseek-reasoner-v2", provider: "deepseek" })).toBe(true);
    });

    it("returns true for models containing 'r1'", () => {
      const adapter = new DeepSeekReasoningAdapter();
      expect(adapter.canHandle({ model: "deepseek-r1", provider: "deepseek" })).toBe(true);
      expect(adapter.canHandle({ model: "deepseek-r1-lite", provider: "deepseek" })).toBe(true);
    });

    it("matches regardless of provider (e.g., openrouter, azure)", () => {
      const adapter = new DeepSeekReasoningAdapter();
      expect(adapter.canHandle({ model: "deepseek-r1", provider: "openrouter" })).toBe(true);
      expect(adapter.canHandle({ model: "deepseek-reasoner", provider: "azure" })).toBe(true);
      expect(adapter.canHandle({ model: "deepseek-r1", provider: "" })).toBe(true);
    });

    it("is case-insensitive", () => {
      const adapter = new DeepSeekReasoningAdapter();
      expect(adapter.canHandle({ model: "DeepSeek-R1", provider: "deepseek" })).toBe(true);
      expect(adapter.canHandle({ model: "DEEPSEEK-REASONER", provider: "deepseek" })).toBe(true);
    });

    it("returns false for non-reasoning deepseek models", () => {
      const adapter = new DeepSeekReasoningAdapter();
      expect(adapter.canHandle({ model: "deepseek-chat", provider: "deepseek" })).toBe(false);
      expect(adapter.canHandle({ model: "deepseek-coder", provider: "deepseek" })).toBe(false);
    });

    it("returns false for empty model", () => {
      const adapter = new DeepSeekReasoningAdapter();
      expect(adapter.canHandle({ model: "", provider: "deepseek" })).toBe(false);
    });
  });

  describe("parseChunk", () => {
    it("maps thinking_start to ReasoningChunk with phase start", () => {
      const adapter = new DeepSeekReasoningAdapter();
      const chunk = adapter.parseChunk(thinkingStart(0));
      expect(chunk).toEqual({
        provider: "deepseek",
        phase: "start",
        text: "",
        contentIndex: 0,
        isComplete: false,
        metadata: {},
      });
    });

    it("maps thinking_delta to ReasoningChunk with phase delta", () => {
      const adapter = new DeepSeekReasoningAdapter();
      const chunk = adapter.parseChunk(thinkingDelta("Analyzing the problem..."));
      expect(chunk).toEqual({
        provider: "deepseek",
        phase: "delta",
        text: "Analyzing the problem...",
        contentIndex: 0,
        isComplete: false,
        metadata: {},
      });
    });

    it("maps thinking_end to ReasoningChunk with phase end", () => {
      const adapter = new DeepSeekReasoningAdapter();
      const chunk = adapter.parseChunk(thinkingEnd("full reasoning"));
      expect(chunk).toEqual({
        provider: "deepseek",
        phase: "end",
        text: "",
        contentIndex: 0,
        isComplete: true,
        metadata: {},
      });
    });

    it("returns null for text_delta events", () => {
      const adapter = new DeepSeekReasoningAdapter();
      expect(adapter.parseChunk(textDelta("Hello"))).toBeNull();
    });

    it("returns null for done events", () => {
      const adapter = new DeepSeekReasoningAdapter();
      const done = { type: "done", reason: "stop", message: partial } as AssistantMessageEvent;
      expect(adapter.parseChunk(done)).toBeNull();
    });

    it("handles empty delta text", () => {
      const adapter = new DeepSeekReasoningAdapter();
      const chunk = adapter.parseChunk(thinkingDelta(""));
      expect(chunk?.text).toBe("");
      expect(chunk?.phase).toBe("delta");
    });

    it("preserves contentIndex from event", () => {
      const adapter = new DeepSeekReasoningAdapter();
      const chunk = adapter.parseChunk(thinkingDelta("text", 5));
      expect(chunk?.contentIndex).toBe(5);
    });

    it("handles full lifecycle: start -> delta(s) -> end", () => {
      const adapter = new DeepSeekReasoningAdapter();

      const start = adapter.parseChunk(thinkingStart());
      expect(start?.phase).toBe("start");

      const delta1 = adapter.parseChunk(thinkingDelta("Part A "));
      expect(delta1?.text).toBe("Part A ");

      const delta2 = adapter.parseChunk(thinkingDelta("Part B "));
      expect(delta2?.text).toBe("Part B ");

      const delta3 = adapter.parseChunk(thinkingDelta("Part C"));
      expect(delta3?.text).toBe("Part C");

      const end = adapter.parseChunk(thinkingEnd("Part A Part B Part C"));
      expect(end?.phase).toBe("end");
      expect(end?.isComplete).toBe(true);
    });
  });

  describe("reset", () => {
    it("clears internal state", () => {
      const adapter = new DeepSeekReasoningAdapter();
      adapter.parseChunk(thinkingStart());
      adapter.reset();
      const chunk = adapter.parseChunk(thinkingStart());
      expect(chunk?.phase).toBe("start");
    });
  });

  describe("id", () => {
    it("returns deepseek", () => {
      const adapter = new DeepSeekReasoningAdapter();
      expect(adapter.id).toBe("deepseek");
    });
  });
});
