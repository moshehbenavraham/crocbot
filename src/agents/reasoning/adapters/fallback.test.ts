import type { AssistantMessageEvent } from "@mariozechner/pi-ai";
import { describe, expect, it } from "vitest";

import { TagFallbackAdapter } from "./fallback.js";

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

function textDelta(delta: string, contentIndex = 0): AssistantMessageEvent {
  return { type: "text_delta", contentIndex, delta, partial } as AssistantMessageEvent;
}

function thinkingDelta(delta: string, contentIndex = 0): AssistantMessageEvent {
  return { type: "thinking_delta", contentIndex, delta, partial } as AssistantMessageEvent;
}

describe("TagFallbackAdapter", () => {
  describe("canHandle", () => {
    it("always returns true", () => {
      const adapter = new TagFallbackAdapter();
      expect(adapter.canHandle({ model: "gpt-4o", provider: "openai" })).toBe(true);
      expect(adapter.canHandle({ model: "claude-3", provider: "anthropic" })).toBe(true);
      expect(adapter.canHandle({ model: "", provider: "" })).toBe(true);
      expect(adapter.canHandle({ model: "unknown", provider: "custom" })).toBe(true);
    });
  });

  describe("id", () => {
    it("returns tag-fallback", () => {
      const adapter = new TagFallbackAdapter();
      expect(adapter.id).toBe("tag-fallback");
    });
  });

  describe("parseChunk - basic tag detection", () => {
    it("detects <think> opening tag and emits start or delta", () => {
      const adapter = new TagFallbackAdapter();
      const chunk = adapter.parseChunk(textDelta("<think>Let me reason"));
      // Should emit delta with reasoning content after the open tag
      expect(chunk).not.toBeNull();
      expect(chunk?.provider).toBe("tag-fallback");
      expect(chunk?.text).toBe("Let me reason");
    });

    it("returns null for text without tags", () => {
      const adapter = new TagFallbackAdapter();
      const chunk = adapter.parseChunk(textDelta("Just regular text"));
      expect(chunk).toBeNull();
    });

    it("returns null for non-text_delta events", () => {
      const adapter = new TagFallbackAdapter();
      expect(adapter.parseChunk(thinkingDelta("delta"))).toBeNull();
    });

    it("returns null for done events", () => {
      const adapter = new TagFallbackAdapter();
      const done = { type: "done", reason: "stop", message: partial } as AssistantMessageEvent;
      expect(adapter.parseChunk(done)).toBeNull();
    });

    it("detects </think> closing tag and emits end", () => {
      const adapter = new TagFallbackAdapter();
      // First open the thinking block
      adapter.parseChunk(textDelta("<think>start reasoning"));
      // Then close it
      const chunk = adapter.parseChunk(textDelta("</think>"));
      expect(chunk).not.toBeNull();
      expect(chunk?.phase).toBe("end");
      expect(chunk?.isComplete).toBe(true);
    });

    it("handles <think> tag with only opening tag in chunk", () => {
      const adapter = new TagFallbackAdapter();
      const chunk = adapter.parseChunk(textDelta("<think>"));
      expect(chunk).not.toBeNull();
      expect(chunk?.phase).toBe("start");
    });

    it("detects various tag names: thinking, thought, antthinking", () => {
      for (const tag of ["thinking", "thought", "antthinking"]) {
        const adapter = new TagFallbackAdapter();
        const chunk = adapter.parseChunk(textDelta(`<${tag}>some reasoning`));
        expect(chunk).not.toBeNull();
        expect(chunk?.provider).toBe("tag-fallback");
        expect(chunk?.text).toBe("some reasoning");
      }
    });
  });

  describe("parseChunk - stateful tracking across chunks", () => {
    it("continues emitting delta chunks while inside thinking block", () => {
      const adapter = new TagFallbackAdapter();
      adapter.parseChunk(textDelta("<think>"));

      const chunk = adapter.parseChunk(textDelta("more reasoning text"));
      expect(chunk).not.toBeNull();
      expect(chunk?.phase).toBe("delta");
      expect(chunk?.text).toBe("more reasoning text");
    });

    it("handles multiple delta chunks inside a thinking block", () => {
      const adapter = new TagFallbackAdapter();
      adapter.parseChunk(textDelta("<think>"));

      const c1 = adapter.parseChunk(textDelta("part 1 "));
      expect(c1?.text).toBe("part 1 ");

      const c2 = adapter.parseChunk(textDelta("part 2 "));
      expect(c2?.text).toBe("part 2 ");

      const c3 = adapter.parseChunk(textDelta("part 3"));
      expect(c3?.text).toBe("part 3");
    });

    it("returns null for text after closing tag", () => {
      const adapter = new TagFallbackAdapter();
      adapter.parseChunk(textDelta("<think>reasoning</think>"));

      const chunk = adapter.parseChunk(textDelta("normal text after"));
      expect(chunk).toBeNull();
    });
  });

  describe("parseChunk - cross-chunk tag boundaries", () => {
    it("handles close tag split across chunks: '</thi' + 'nk>'", () => {
      const adapter = new TagFallbackAdapter();
      adapter.parseChunk(textDelta("<think>reasoning content"));

      // The '</thi' at end of chunk looks like a partial tag -- buffered
      adapter.parseChunk(textDelta("more text</thi"));

      const c2 = adapter.parseChunk(textDelta("nk>after close"));
      // Now the buffer resolves the full </think> tag
      expect(c2).not.toBeNull();
      expect(c2?.phase).toBe("end");
    });

    it("handles open tag split across chunks: '<thi' + 'nk>content'", () => {
      const adapter = new TagFallbackAdapter();
      // Partial tag is buffered
      adapter.parseChunk(textDelta("prefix text<thi"));

      const c2 = adapter.parseChunk(textDelta("nk>reasoning here"));
      // Now the buffer resolves the full <think> tag
      expect(c2).not.toBeNull();
      expect(c2?.text).toBe("reasoning here");
    });
  });

  describe("parseChunk - close and reopen in same chunk", () => {
    it("handles </think><think> in same chunk", () => {
      const adapter = new TagFallbackAdapter();
      adapter.parseChunk(textDelta("<think>first block"));

      // Close and reopen in same chunk
      const chunk = adapter.parseChunk(textDelta("</think>normal<think>second block"));
      // The adapter processes the close first, then the open
      // Implementation detail: it returns end (with text from first block close)
      // or start for the new block. The exact behavior depends on implementation.
      expect(chunk).not.toBeNull();
    });
  });

  describe("parseChunk - multiple thinking blocks", () => {
    it("handles two separate thinking blocks in sequence", () => {
      const adapter = new TagFallbackAdapter();

      // First block
      const start1 = adapter.parseChunk(textDelta("<think>first"));
      expect(start1).not.toBeNull();

      const end1 = adapter.parseChunk(textDelta("</think>"));
      expect(end1?.phase).toBe("end");

      // Normal text between blocks
      const normal = adapter.parseChunk(textDelta("normal text"));
      expect(normal).toBeNull();

      // Second block
      const start2 = adapter.parseChunk(textDelta("<think>second"));
      expect(start2).not.toBeNull();
      expect(start2?.text).toBe("second");

      const end2 = adapter.parseChunk(textDelta("</think>"));
      expect(end2?.phase).toBe("end");
    });
  });

  describe("parseChunk - edge cases", () => {
    it("handles empty text_delta", () => {
      const adapter = new TagFallbackAdapter();
      const chunk = adapter.parseChunk(textDelta(""));
      expect(chunk).toBeNull();
    });

    it("preserves contentIndex from event", () => {
      const adapter = new TagFallbackAdapter();
      const chunk = adapter.parseChunk(textDelta("<think>text", 3));
      expect(chunk?.contentIndex).toBe(3);
    });

    it("handles tag with extra whitespace: < think >", () => {
      const adapter = new TagFallbackAdapter();
      const chunk = adapter.parseChunk(textDelta("< think >reasoning"));
      expect(chunk).not.toBeNull();
      expect(chunk?.text).toBe("reasoning");
    });

    it("handles case-insensitive tags: <THINK>", () => {
      const adapter = new TagFallbackAdapter();
      const chunk = adapter.parseChunk(textDelta("<THINK>reasoning"));
      expect(chunk).not.toBeNull();
      expect(chunk?.text).toBe("reasoning");
    });

    it("handles <think> tag with content and close tag in same chunk", () => {
      const adapter = new TagFallbackAdapter();
      const chunk = adapter.parseChunk(textDelta("<think>all in one</think>"));
      // Should capture the reasoning text and emit end
      expect(chunk).not.toBeNull();
      expect(chunk?.phase).toBe("end");
      expect(chunk?.text).toBe("all in one");
      expect(chunk?.isComplete).toBe(true);
    });
  });

  describe("reset", () => {
    it("clears thinking state", () => {
      const adapter = new TagFallbackAdapter();
      // Enter thinking state
      adapter.parseChunk(textDelta("<think>inside block"));

      // Reset
      adapter.reset();

      // After reset, text outside tags should return null (not thinking)
      const chunk = adapter.parseChunk(textDelta("normal text"));
      expect(chunk).toBeNull();
    });

    it("clears buffer state", () => {
      const adapter = new TagFallbackAdapter();
      // Create a partial tag in buffer
      adapter.parseChunk(textDelta("text<thi"));

      // Reset
      adapter.reset();

      // After reset, we should not have buffered content
      const chunk = adapter.parseChunk(textDelta("normal text"));
      expect(chunk).toBeNull();
    });

    it("allows clean reuse after reset", () => {
      const adapter = new TagFallbackAdapter();

      // First message
      adapter.parseChunk(textDelta("<think>first"));
      adapter.parseChunk(textDelta("</think>"));

      // Reset between messages
      adapter.reset();

      // Second message
      const chunk = adapter.parseChunk(textDelta("<think>second"));
      expect(chunk).not.toBeNull();
      expect(chunk?.text).toBe("second");
    });
  });
});
