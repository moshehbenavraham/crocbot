import type { AssistantMessageEvent } from "@mariozechner/pi-ai";
import { describe, expect, it } from "vitest";

import { resolveAdapter } from "./adapter-registry.js";
import { ChatGenerationResult } from "./generation-result.js";
import type { ReasoningChunk } from "./types.js";

// ---------------------------------------------------------------------------
// Test helpers -- minimal SDK event constructors
// ---------------------------------------------------------------------------

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
  return {
    type: "thinking_start",
    contentIndex,
    delta: "",
    partial,
  } as AssistantMessageEvent;
}

function thinkingDelta(delta: string, contentIndex = 0): AssistantMessageEvent {
  return {
    type: "thinking_delta",
    contentIndex,
    delta,
    partial,
  } as AssistantMessageEvent;
}

function thinkingEnd(contentIndex = 0): AssistantMessageEvent {
  return {
    type: "thinking_end",
    contentIndex,
    delta: "",
    partial,
  } as AssistantMessageEvent;
}

function textDelta(delta: string, contentIndex = 0): AssistantMessageEvent {
  return {
    type: "text_delta",
    contentIndex,
    delta,
    partial,
  } as AssistantMessageEvent;
}

// ---------------------------------------------------------------------------
// Integration tests: adapter -> accumulator pipeline
// ---------------------------------------------------------------------------

describe("adapter -> accumulator integration", () => {
  describe("native thinking events (Anthropic-style)", () => {
    it("processes thinking_start -> thinking_delta(s) -> thinking_end -> text_delta(s)", () => {
      const adapter = resolveAdapter({ model: "claude-3.5-sonnet", provider: "anthropic" });
      const result = new ChatGenerationResult({ adapterId: adapter.id });
      adapter.reset();

      const emittedDeltas: string[] = [];

      // Simulate native thinking event sequence
      const events: AssistantMessageEvent[] = [
        thinkingStart(),
        thinkingDelta("Let me"),
        thinkingDelta(" analyze"),
        thinkingDelta(" this"),
        thinkingEnd(),
        textDelta("Here is"),
        textDelta(" my answer"),
      ];

      for (const evt of events) {
        if (
          evt.type === "thinking_start" ||
          evt.type === "thinking_delta" ||
          evt.type === "thinking_end"
        ) {
          const chunk = adapter.parseChunk(evt);
          if (chunk) {
            result.addChunk(chunk);
            const delta = result.getReasoningDelta();
            if (delta) {
              emittedDeltas.push(delta);
            }
          }
        } else if (evt.type === "text_delta") {
          result.addResponseText(evt.delta);
        }
      }

      expect(result.reasoningText).toBe("Let me analyze this");
      expect(result.responseText).toBe("Here is my answer");
      expect(emittedDeltas.join("")).toBe("Let me analyze this");

      const pairs = result.finalize();
      expect(pairs).toHaveLength(1);
      expect(pairs[0]).toEqual(["Let me analyze this", "Here is my answer"]);
    });

    it("handles empty thinking block (start then immediate end)", () => {
      const adapter = resolveAdapter({ model: "claude-3.5-sonnet", provider: "anthropic" });
      const result = new ChatGenerationResult({ adapterId: adapter.id });
      adapter.reset();

      const startChunk = adapter.parseChunk(thinkingStart());
      if (startChunk) {
        result.addChunk(startChunk);
      }

      const endChunk = adapter.parseChunk(thinkingEnd());
      if (endChunk) {
        result.addChunk(endChunk);
      }

      result.addResponseText("direct answer");

      expect(result.reasoningText).toBe("");
      expect(result.responseText).toBe("direct answer");
    });
  });

  describe("tag-fallback path", () => {
    it("processes text_delta with <think> tags through fallback adapter", () => {
      const adapter = resolveAdapter({ model: "gpt-4o", provider: "custom" });
      expect(adapter.id).toBe("tag-fallback");

      const result = new ChatGenerationResult({ adapterId: adapter.id });
      adapter.reset();

      const events: AssistantMessageEvent[] = [
        textDelta("<think>Let me"),
        textDelta(" reason"),
        textDelta("</think>"),
        textDelta("The answer"),
        textDelta(" is 42"),
      ];

      for (const evt of events) {
        const chunk = adapter.parseChunk(evt);
        if (chunk) {
          result.addChunk(chunk);
        }
        // Only non-tag text goes to response (in real pipeline, stripBlockTags handles this)
        // For integration test, we skip response accumulation since it's handled externally
      }

      // The fallback adapter extracts reasoning from tags
      expect(result.reasoningText).toContain("Let me");
      expect(result.reasoningText).toContain("reason");
    });

    it("handles partial tag split across chunks", () => {
      const adapter = resolveAdapter({ model: "unknown", provider: "unknown" });
      expect(adapter.id).toBe("tag-fallback");

      const result = new ChatGenerationResult({ adapterId: adapter.id });
      adapter.reset();

      // Tag split across chunks: "<thin" + "k>reasoning</think>"
      const chunk1 = adapter.parseChunk(textDelta("<thin"));
      // Partial tag should be buffered, no chunk emitted
      expect(chunk1).toBeNull();

      const chunk2 = adapter.parseChunk(textDelta("k>reasoning text</think>"));
      if (chunk2) {
        result.addChunk(chunk2);
      }

      expect(result.reasoningText).toContain("reasoning text");
    });
  });

  describe("adapter resolution correctness", () => {
    it("resolves OpenAI adapter for o1/o3/o4 models", () => {
      const adapter = resolveAdapter({ model: "o3-mini", provider: "openai" });
      expect(adapter.id).toBe("openai");
    });

    it("resolves Anthropic adapter for anthropic provider", () => {
      const adapter = resolveAdapter({ model: "claude-3", provider: "anthropic" });
      expect(adapter.id).toBe("anthropic");
    });

    it("resolves DeepSeek adapter for reasoner models", () => {
      const adapter = resolveAdapter({ model: "deepseek-reasoner", provider: "deepseek" });
      expect(adapter.id).toBe("deepseek");
    });

    it("falls back to tag-fallback for unknown models", () => {
      const adapter = resolveAdapter({ model: "custom-model", provider: "custom" });
      expect(adapter.id).toBe("tag-fallback");
    });
  });

  describe("delta emission payloads", () => {
    it("produces correct delta/full-text pairs during streaming", () => {
      const adapter = resolveAdapter({ model: "claude-3.5-sonnet", provider: "anthropic" });
      const result = new ChatGenerationResult({ adapterId: adapter.id });
      adapter.reset();

      const payloads: Array<{ text: string; delta: string }> = [];

      const events: AssistantMessageEvent[] = [
        thinkingStart(),
        thinkingDelta("Step 1"),
        thinkingDelta(". Step 2"),
        thinkingDelta(". Step 3"),
        thinkingEnd(),
      ];

      for (const evt of events) {
        const chunk = adapter.parseChunk(evt);
        if (chunk) {
          result.addChunk(chunk);
          const delta = result.getReasoningDelta();
          if (delta) {
            payloads.push({
              text: result.reasoningText,
              delta,
            });
          }
        }
      }

      // Each payload should have the full accumulated text and just the new delta
      expect(payloads.length).toBeGreaterThanOrEqual(1);
      // The concatenation of all deltas should equal the full text
      const allDeltas = payloads.map((p) => p.delta).join("");
      expect(allDeltas).toBe(result.reasoningText);
      // The last payload's text should be the full reasoning text
      if (payloads.length > 0) {
        expect(payloads[payloads.length - 1].text).toBe(result.reasoningText);
      }
    });
  });

  describe("thinking pairs output", () => {
    it("produces correct pairs after full message sequence", () => {
      const adapter = resolveAdapter({ model: "claude-3.5-sonnet", provider: "anthropic" });
      adapter.reset();

      const result = new ChatGenerationResult({ adapterId: adapter.id });

      // Simulate full message: thinking -> response
      const thinkEvents: AssistantMessageEvent[] = [
        thinkingStart(),
        thinkingDelta("I need to consider"),
        thinkingDelta(" multiple factors"),
        thinkingEnd(),
      ];

      for (const evt of thinkEvents) {
        const chunk = adapter.parseChunk(evt);
        if (chunk) {
          result.addChunk(chunk);
        }
      }

      result.addResponseText("Based on my analysis, the answer is 42.");

      const pairs = result.finalize();
      expect(pairs).toHaveLength(1);
      expect(pairs[0][0]).toBe("I need to consider multiple factors");
      expect(pairs[0][1]).toBe("Based on my analysis, the answer is 42.");
    });

    it("handles message with no reasoning", () => {
      const result = new ChatGenerationResult();
      result.addResponseText("Simple response");

      const pairs = result.finalize();
      expect(pairs).toHaveLength(1);
      expect(pairs[0]).toEqual(["", "Simple response"]);
    });
  });

  describe("accumulator lifecycle", () => {
    it("is scoped to a single message (fresh instance per message)", () => {
      // Message 1
      const result1 = new ChatGenerationResult();
      result1.addChunk({
        provider: "openai",
        phase: "delta",
        text: "msg1 reasoning",
        contentIndex: 0,
        isComplete: false,
        metadata: {},
      });
      result1.addResponseText("msg1 response");
      result1.finalize();

      // Message 2 -- independent instance
      const result2 = new ChatGenerationResult();
      result2.addResponseText("msg2 response only");
      result2.finalize();

      // They should be completely independent
      expect(result1.reasoningText).toBe("msg1 reasoning");
      expect(result2.reasoningText).toBe("");
      expect(result2.responseText).toBe("msg2 response only");
    });

    it("rejects chunks after finalization", () => {
      const result = new ChatGenerationResult();
      result.finalize();

      const chunk: ReasoningChunk = {
        provider: "openai",
        phase: "delta",
        text: "late chunk",
        contentIndex: 0,
        isComplete: false,
        metadata: {},
      };

      expect(() => result.addChunk(chunk)).toThrow("finalized");
      expect(() => result.addResponseText("late text")).toThrow("finalized");
    });
  });
});
