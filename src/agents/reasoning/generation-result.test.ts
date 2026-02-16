import { describe, expect, it } from "vitest";

import { ChatGenerationResult } from "./generation-result.js";
import { createReasoningChunk } from "./types.js";

// Helper to create chunks for common phases
function startChunk(provider = "openai", text = ""): ReturnType<typeof createReasoningChunk> {
  return createReasoningChunk({ provider, phase: "start", text });
}
function deltaChunk(text: string, provider = "openai"): ReturnType<typeof createReasoningChunk> {
  return createReasoningChunk({ provider, phase: "delta", text });
}
function endChunk(provider = "openai", text = ""): ReturnType<typeof createReasoningChunk> {
  return createReasoningChunk({ provider, phase: "end", text });
}

describe("ChatGenerationResult", () => {
  describe("construction", () => {
    it("creates with default options", () => {
      const result = new ChatGenerationResult();
      expect(result.adapterId).toBe("");
      expect(result.reasoningText).toBe("");
      expect(result.responseText).toBe("");
      expect(result.isReasoning).toBe(false);
      expect(result.isFinalized).toBe(false);
      expect(result.thinkingPairs).toEqual([]);
    });

    it("creates with adapterId option", () => {
      const result = new ChatGenerationResult({ adapterId: "anthropic" });
      expect(result.adapterId).toBe("anthropic");
    });
  });

  describe("addChunk - reasoning phase routing", () => {
    it("handles start -> delta -> end sequence", () => {
      const result = new ChatGenerationResult();

      result.addChunk(startChunk());
      expect(result.isReasoning).toBe(true);
      expect(result.reasoningText).toBe("");

      result.addChunk(deltaChunk("Let me think"));
      expect(result.reasoningText).toBe("Let me think");
      expect(result.isReasoning).toBe(true);

      result.addChunk(deltaChunk(" about this"));
      expect(result.reasoningText).toBe("Let me think about this");

      result.addChunk(endChunk());
      expect(result.isReasoning).toBe(false);
      expect(result.reasoningText).toBe("Let me think about this");
    });

    it("handles start with text content", () => {
      const result = new ChatGenerationResult();
      result.addChunk(startChunk("openai", "Initial reasoning"));
      expect(result.reasoningText).toBe("Initial reasoning");
      expect(result.isReasoning).toBe(true);
    });

    it("handles end with text content", () => {
      const result = new ChatGenerationResult();
      result.addChunk(startChunk());
      result.addChunk(deltaChunk("thinking"));
      result.addChunk(endChunk("openai", " final thought"));
      expect(result.reasoningText).toBe("thinking final thought");
      expect(result.isReasoning).toBe(false);
    });

    it("handles delta without prior start (implicit start)", () => {
      const result = new ChatGenerationResult();
      result.addChunk(deltaChunk("orphan delta"));
      expect(result.isReasoning).toBe(true);
      expect(result.reasoningText).toBe("orphan delta");
    });
  });

  describe("addResponseText", () => {
    it("appends to response buffer", () => {
      const result = new ChatGenerationResult();
      result.addResponseText("Hello");
      result.addResponseText(" world");
      expect(result.responseText).toBe("Hello world");
    });

    it("ignores empty strings", () => {
      const result = new ChatGenerationResult();
      result.addResponseText("");
      expect(result.responseText).toBe("");
    });
  });

  describe("getReasoningDelta - cursor-based extraction", () => {
    it("returns all content on first call", () => {
      const result = new ChatGenerationResult();
      result.addChunk(startChunk());
      result.addChunk(deltaChunk("reasoning text"));

      expect(result.getReasoningDelta()).toBe("reasoning text");
    });

    it("returns only new content on subsequent calls", () => {
      const result = new ChatGenerationResult();
      result.addChunk(startChunk());
      result.addChunk(deltaChunk("first"));

      expect(result.getReasoningDelta()).toBe("first");

      result.addChunk(deltaChunk(" second"));
      expect(result.getReasoningDelta()).toBe(" second");
    });

    it("returns empty string when no new content", () => {
      const result = new ChatGenerationResult();
      result.addChunk(startChunk());
      result.addChunk(deltaChunk("text"));

      result.getReasoningDelta(); // consume
      expect(result.getReasoningDelta()).toBe("");
    });

    it("is idempotent when called twice without new content", () => {
      const result = new ChatGenerationResult();
      result.addChunk(startChunk());
      result.addChunk(deltaChunk("hello"));

      result.getReasoningDelta();
      expect(result.getReasoningDelta()).toBe("");
      expect(result.getReasoningDelta()).toBe("");
    });
  });

  describe("getResponseDelta - cursor-based extraction", () => {
    it("returns all content on first call", () => {
      const result = new ChatGenerationResult();
      result.addResponseText("response text");

      expect(result.getResponseDelta()).toBe("response text");
    });

    it("returns only new content on subsequent calls", () => {
      const result = new ChatGenerationResult();
      result.addResponseText("first");
      expect(result.getResponseDelta()).toBe("first");

      result.addResponseText(" second");
      expect(result.getResponseDelta()).toBe(" second");
    });

    it("returns empty string when no new content", () => {
      const result = new ChatGenerationResult();
      result.addResponseText("text");

      result.getResponseDelta();
      expect(result.getResponseDelta()).toBe("");
    });
  });

  describe("multi-turn thinking pairs", () => {
    it("produces a single pair for one reasoning/response cycle", () => {
      const result = new ChatGenerationResult();

      result.addChunk(startChunk());
      result.addChunk(deltaChunk("thinking about it"));
      result.addChunk(endChunk());
      result.addResponseText("Here is my answer");

      const pairs = result.finalize();
      expect(pairs).toHaveLength(1);
      expect(pairs[0]).toEqual(["thinking about it", "Here is my answer"]);
    });

    it("produces multiple pairs for multiple reasoning/response cycles", () => {
      const result = new ChatGenerationResult();

      // First turn
      result.addChunk(startChunk());
      result.addChunk(deltaChunk("first thought"));
      result.addChunk(endChunk());
      result.addResponseText("first answer");

      // Second turn
      result.addChunk(startChunk());
      result.addChunk(deltaChunk("second thought"));
      result.addChunk(endChunk());
      result.addResponseText("second answer");

      const pairs = result.finalize();
      expect(pairs).toHaveLength(2);
      expect(pairs[0]).toEqual(["first thought", "first answer"]);
      expect(pairs[1]).toEqual(["second thought", "second answer"]);
    });

    it("handles reasoning-only (no response text)", () => {
      const result = new ChatGenerationResult();
      result.addChunk(startChunk());
      result.addChunk(deltaChunk("only reasoning"));
      result.addChunk(endChunk());

      const pairs = result.finalize();
      expect(pairs).toHaveLength(1);
      expect(pairs[0]).toEqual(["only reasoning", ""]);
    });

    it("handles response-only (no reasoning)", () => {
      const result = new ChatGenerationResult();
      result.addResponseText("just a response");

      const pairs = result.finalize();
      expect(pairs).toHaveLength(1);
      expect(pairs[0]).toEqual(["", "just a response"]);
    });

    it("handles empty message (no reasoning, no response)", () => {
      const result = new ChatGenerationResult();

      const pairs = result.finalize();
      expect(pairs).toHaveLength(0);
    });
  });

  describe("finalize", () => {
    it("seals the accumulator", () => {
      const result = new ChatGenerationResult();
      result.addChunk(startChunk());
      result.addChunk(deltaChunk("text"));
      result.finalize();

      expect(result.isFinalized).toBe(true);
    });

    it("throws on addChunk after finalize", () => {
      const result = new ChatGenerationResult();
      result.finalize();

      expect(() => result.addChunk(deltaChunk("late"))).toThrow(
        "ChatGenerationResult is finalized",
      );
    });

    it("throws on addResponseText after finalize", () => {
      const result = new ChatGenerationResult();
      result.finalize();

      expect(() => result.addResponseText("late")).toThrow("ChatGenerationResult is finalized");
    });

    it("is safe to call multiple times", () => {
      const result = new ChatGenerationResult();
      result.addChunk(startChunk());
      result.addChunk(deltaChunk("text"));

      const pairs1 = result.finalize();
      const pairs2 = result.finalize();
      expect(pairs1).toEqual(pairs2);
    });

    it("closes open reasoning block on finalize", () => {
      const result = new ChatGenerationResult();
      result.addChunk(startChunk());
      result.addChunk(deltaChunk("unclosed reasoning"));
      // No end chunk - finalize should close it

      const pairs = result.finalize();
      expect(result.isReasoning).toBe(false);
      expect(pairs).toHaveLength(1);
      expect(pairs[0][0]).toBe("unclosed reasoning");
    });
  });

  describe("edge cases", () => {
    it("handles rapid start/end with no delta content", () => {
      const result = new ChatGenerationResult();
      result.addChunk(startChunk());
      result.addChunk(endChunk());

      expect(result.reasoningText).toBe("");
      expect(result.isReasoning).toBe(false);
    });

    it("handles empty delta text", () => {
      const result = new ChatGenerationResult();
      result.addChunk(startChunk());
      result.addChunk(deltaChunk(""));
      expect(result.reasoningText).toBe("");
    });

    it("handles multiple consecutive thinking blocks in one message", () => {
      const result = new ChatGenerationResult();

      // Block 1
      result.addChunk(startChunk());
      result.addChunk(deltaChunk("block1"));
      result.addChunk(endChunk());

      // Block 2 (no response text between blocks)
      result.addChunk(startChunk());
      result.addChunk(deltaChunk("block2"));
      result.addChunk(endChunk());

      result.addResponseText("final response");

      const pairs = result.finalize();
      // Two reasoning blocks with one response at the end
      expect(pairs.length).toBeGreaterThanOrEqual(1);
      // The combined reasoning should include both blocks
      const allReasoning = pairs.map((p) => p[0]).join("");
      expect(allReasoning).toContain("block1");
      expect(allReasoning).toContain("block2");
    });

    it("preserves delta extraction across finalization", () => {
      const result = new ChatGenerationResult();
      result.addChunk(startChunk());
      result.addChunk(deltaChunk("reasoning"));
      result.addResponseText("response");

      // Get deltas before finalize
      const rDelta = result.getReasoningDelta();
      const resDelta = result.getResponseDelta();
      expect(rDelta).toBe("reasoning");
      expect(resDelta).toBe("response");

      // Deltas are still accessible after finalize (just empty since cursor advanced)
      result.finalize();
      expect(result.getReasoningDelta()).toBe("");
      expect(result.getResponseDelta()).toBe("");
    });

    it("handles tag-fallback provider chunks", () => {
      const result = new ChatGenerationResult();

      // Tag-fallback adapter can emit end chunks with text (block opened+closed in same chunk)
      const chunk = createReasoningChunk({
        provider: "tag-fallback",
        phase: "end",
        text: "extracted reasoning from tags",
      });
      result.addChunk(chunk);

      expect(result.reasoningText).toBe("extracted reasoning from tags");
      expect(result.isReasoning).toBe(false);
    });

    it("handles interleaved reasoning and response", () => {
      const result = new ChatGenerationResult();

      // Reasoning first
      result.addChunk(startChunk());
      result.addChunk(deltaChunk("think"));
      result.addChunk(endChunk());

      // Then response
      result.addResponseText("answer part 1");
      result.addResponseText(" answer part 2");

      expect(result.reasoningText).toBe("think");
      expect(result.responseText).toBe("answer part 1 answer part 2");
    });
  });
});
