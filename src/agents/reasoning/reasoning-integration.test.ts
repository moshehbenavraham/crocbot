import { DatabaseSync } from "node:sqlite";

import type { AssistantMessageEvent } from "@mariozechner/pi-ai";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { emitAgentEvent, onAgentEvent } from "../../infra/agent-events.js";
import type { AgentEventPayload } from "../../infra/agent-events.js";
import { resolveAdapter } from "./adapter-registry.js";
import { ReasoningBudgetTracker, initBudgetTrackerListener } from "./budget-tracker.js";
import { ChatGenerationResult } from "./generation-result.js";
import { ReasoningTraceStore, initTraceStoreListener } from "./trace-store.js";
import type { ReasoningChunk } from "./types.js";

// ---------------------------------------------------------------------------
// Mock SSE event constructors (per-provider wire format simulation)
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
  return { type: "thinking_start", contentIndex, delta: "", partial } as AssistantMessageEvent;
}

function thinkingDelta(delta: string, contentIndex = 0): AssistantMessageEvent {
  return { type: "thinking_delta", contentIndex, delta, partial } as AssistantMessageEvent;
}

function thinkingEnd(contentIndex = 0): AssistantMessageEvent {
  return { type: "thinking_end", contentIndex, delta: "", partial } as AssistantMessageEvent;
}

function textDelta(delta: string, contentIndex = 0): AssistantMessageEvent {
  return { type: "text_delta", contentIndex, delta, partial } as AssistantMessageEvent;
}

// ---------------------------------------------------------------------------
// Pipeline runner: adapter -> accumulator
// ---------------------------------------------------------------------------

interface PipelineResult {
  result: ChatGenerationResult;
  deltas: string[];
  chunks: ReasoningChunk[];
}

function runAdapterPipeline(
  model: string,
  provider: string,
  events: AssistantMessageEvent[],
): PipelineResult {
  const adapter = resolveAdapter({ model, provider });
  const result = new ChatGenerationResult({ adapterId: adapter.id });
  adapter.reset();

  const deltas: string[] = [];
  const chunks: ReasoningChunk[] = [];

  for (const evt of events) {
    if (
      evt.type === "thinking_start" ||
      evt.type === "thinking_delta" ||
      evt.type === "thinking_end"
    ) {
      const chunk = adapter.parseChunk(evt);
      if (chunk) {
        chunks.push(chunk);
        result.addChunk(chunk);
        const delta = result.getReasoningDelta();
        if (delta) {
          deltas.push(delta);
        }
      }
    } else if (evt.type === "text_delta") {
      // For tag-fallback, text_delta goes through adapter
      const chunk = adapter.parseChunk(evt);
      if (chunk) {
        chunks.push(chunk);
        result.addChunk(chunk);
        const delta = result.getReasoningDelta();
        if (delta) {
          deltas.push(delta);
        }
      } else {
        // Non-reasoning text_delta goes to response
        result.addResponseText(evt.delta);
      }
    }
  }

  return { result, deltas, chunks };
}

// ---------------------------------------------------------------------------
// Trace/budget integration context
// ---------------------------------------------------------------------------

interface TraceContext {
  db: DatabaseSync;
  store: ReasoningTraceStore;
  tracker: ReasoningBudgetTracker;
  budgetEvents: AgentEventPayload[];
  teardown: () => void;
}

function createTraceContext(opts?: {
  maxTokens?: number;
  warningPercent?: number;
  retentionDays?: number;
  enabled?: boolean;
}): TraceContext {
  const db = new DatabaseSync(":memory:");
  const store = new ReasoningTraceStore(db, {
    retentionDays: opts?.retentionDays ?? 7,
    enabled: opts?.enabled ?? true,
  });
  const tracker = new ReasoningBudgetTracker({
    maxReasoningTokensPerSession: opts?.maxTokens ?? 10000,
    warningThresholdPercent: opts?.warningPercent ?? 80,
    runId: "run-000",
    sessionKey: "session-000",
  });

  const unsubStore = initTraceStoreListener(store);
  const unsubBudget = initBudgetTrackerListener(tracker);

  const budgetEvents: AgentEventPayload[] = [];
  const unsubCapture = onAgentEvent((evt) => {
    if (evt.stream === "budget") {
      budgetEvents.push(evt);
    }
  });

  return {
    db,
    store,
    tracker,
    budgetEvents,
    teardown: () => {
      unsubStore();
      unsubBudget();
      unsubCapture();
      db.close();
    },
  };
}

// ---------------------------------------------------------------------------
// Full pipeline orchestrator: adapter -> accumulator -> event -> trace + budget
// ---------------------------------------------------------------------------

interface FullPipelineResult extends PipelineResult {
  traces: ReturnType<ReasoningTraceStore["queryBySession"]>;
  tokenCount: number;
  budgetStatus: string;
}

function runFullPipeline(
  ctx: TraceContext,
  opts: {
    model: string;
    provider: string;
    events: AssistantMessageEvent[];
    sessionKey: string;
    runId: string;
    reasoningTokens: number;
    totalTokens?: number;
    durationMs?: number;
  },
): FullPipelineResult {
  const pipeline = runAdapterPipeline(opts.model, opts.provider, opts.events);
  const pairs = pipeline.result.finalize();
  const reasoningText = pairs.length > 0 ? pairs[0][0] : "";

  // Emit a thinking event (simulating what the message handler does at message_end)
  emitAgentEvent({
    runId: opts.runId,
    stream: "thinking",
    sessionKey: opts.sessionKey,
    data: {
      sessionKey: opts.sessionKey,
      runId: opts.runId,
      model: opts.model,
      provider: opts.provider,
      reasoningText,
      reasoningTokens: opts.reasoningTokens,
      totalTokens: opts.totalTokens ?? opts.reasoningTokens * 2,
      durationMs: opts.durationMs ?? 0,
      metadata: { adapterId: pipeline.result.adapterId },
    },
  });

  return {
    ...pipeline,
    traces: ctx.store.queryBySession(opts.sessionKey),
    tokenCount: ctx.tracker.tokens,
    budgetStatus: ctx.tracker.status,
  };
}

// ===========================================================================
// Test suites
// ===========================================================================

describe("reasoning full pipeline integration", () => {
  let ctx: TraceContext;

  beforeEach(() => {
    ctx = createTraceContext();
  });

  afterEach(() => {
    ctx.teardown();
  });

  // -------------------------------------------------------------------------
  // T008: OpenAI o1/o3 full pipeline
  // -------------------------------------------------------------------------

  describe("OpenAI full pipeline", () => {
    it("processes o3-mini reasoning through entire pipeline", () => {
      const events: AssistantMessageEvent[] = [
        thinkingStart(),
        thinkingDelta("Let me reason"),
        thinkingDelta(" about this problem"),
        thinkingEnd(),
        textDelta("The answer is 42"),
      ];

      const result = runFullPipeline(ctx, {
        model: "o3-mini",
        provider: "openai",
        events,
        sessionKey: "openai-session",
        runId: "run-openai-001",
        reasoningTokens: 150,
        totalTokens: 300,
        durationMs: 500,
      });

      // Adapter resolution
      expect(result.result.adapterId).toBe("openai");

      // Accumulator output
      expect(result.result.reasoningText).toBe("Let me reason about this problem");
      expect(result.result.responseText).toBe("The answer is 42");
      expect(result.deltas.join("")).toBe("Let me reason about this problem");

      // Trace stored
      expect(result.traces).toHaveLength(1);
      expect(result.traces[0].model).toBe("o3-mini");
      expect(result.traces[0].provider).toBe("openai");
      expect(result.traces[0].reasoningText).toBe("Let me reason about this problem");
      expect(result.traces[0].reasoningTokens).toBe(150);
      expect(result.traces[0].totalTokens).toBe(300);
      expect(result.traces[0].durationMs).toBe(500);

      // Budget tracked
      expect(result.tokenCount).toBe(150);
      expect(result.budgetStatus).toBe("ok");
    });

    it("resolves openai adapter for o1 models", () => {
      const adapter = resolveAdapter({ model: "o1-preview", provider: "openai" });
      expect(adapter.id).toBe("openai");
    });

    it("resolves openai adapter for o4 models", () => {
      const adapter = resolveAdapter({ model: "o4-mini", provider: "openai" });
      expect(adapter.id).toBe("openai");
    });
  });

  // -------------------------------------------------------------------------
  // T009: Anthropic extended thinking full pipeline
  // -------------------------------------------------------------------------

  describe("Anthropic full pipeline", () => {
    it("processes claude extended thinking through entire pipeline", () => {
      const events: AssistantMessageEvent[] = [
        thinkingStart(),
        thinkingDelta("I need to analyze"),
        thinkingDelta(" the user request"),
        thinkingDelta(" carefully"),
        thinkingEnd(),
        textDelta("Based on my analysis, "),
        textDelta("here is the answer."),
      ];

      const result = runFullPipeline(ctx, {
        model: "claude-3.5-sonnet",
        provider: "anthropic",
        events,
        sessionKey: "anthropic-session",
        runId: "run-anthropic-001",
        reasoningTokens: 250,
        totalTokens: 500,
      });

      // Adapter resolution
      expect(result.result.adapterId).toBe("anthropic");

      // Reasoning/response separation
      expect(result.result.reasoningText).toBe("I need to analyze the user request carefully");
      expect(result.result.responseText).toBe("Based on my analysis, here is the answer.");

      // Thinking pairs
      const pairs = result.result.thinkingPairs;
      expect(pairs).toHaveLength(1);
      expect(pairs[0][0]).toBe("I need to analyze the user request carefully");
      expect(pairs[0][1]).toBe("Based on my analysis, here is the answer.");

      // Trace stored with correct fields
      expect(result.traces).toHaveLength(1);
      expect(result.traces[0].model).toBe("claude-3.5-sonnet");
      expect(result.traces[0].provider).toBe("anthropic");
      expect(result.traces[0].reasoningTokens).toBe(250);

      // Budget accounting
      expect(result.tokenCount).toBe(250);
      expect(result.budgetStatus).toBe("ok");
    });
  });

  // -------------------------------------------------------------------------
  // T010: DeepSeek-R1 full pipeline
  // -------------------------------------------------------------------------

  describe("DeepSeek-R1 full pipeline", () => {
    it("processes deepseek-reasoner through entire pipeline", () => {
      const events: AssistantMessageEvent[] = [
        thinkingStart(),
        thinkingDelta("Step 1: Parse input"),
        thinkingDelta("\nStep 2: Compute result"),
        thinkingEnd(),
        textDelta("The result is 7."),
      ];

      const result = runFullPipeline(ctx, {
        model: "deepseek-reasoner",
        provider: "deepseek",
        events,
        sessionKey: "deepseek-session",
        runId: "run-deepseek-001",
        reasoningTokens: 180,
      });

      // Adapter resolution
      expect(result.result.adapterId).toBe("deepseek");

      // Reasoning extraction
      expect(result.result.reasoningText).toBe("Step 1: Parse input\nStep 2: Compute result");
      expect(result.result.responseText).toBe("The result is 7.");

      // Trace persistence
      expect(result.traces).toHaveLength(1);
      expect(result.traces[0].model).toBe("deepseek-reasoner");
      expect(result.traces[0].provider).toBe("deepseek");
      expect(result.traces[0].reasoningTokens).toBe(180);

      // Budget
      expect(result.tokenCount).toBe(180);
    });

    it("resolves deepseek adapter for R1 models from OpenRouter", () => {
      const adapter = resolveAdapter({ model: "deepseek-r1-lite", provider: "openrouter" });
      expect(adapter.id).toBe("deepseek");
    });
  });

  // -------------------------------------------------------------------------
  // T011: Tag-fallback full pipeline
  // -------------------------------------------------------------------------

  describe("tag-fallback full pipeline", () => {
    it("processes unknown provider with think tags through fallback pipeline", () => {
      const events: AssistantMessageEvent[] = [
        textDelta("<think>Let me think"),
        textDelta(" about this</think>"),
        textDelta("Here is the answer."),
      ];

      const result = runFullPipeline(ctx, {
        model: "custom-model-v1",
        provider: "custom-provider",
        events,
        sessionKey: "fallback-session",
        runId: "run-fallback-001",
        reasoningTokens: 100,
      });

      // Adapter resolution
      expect(result.result.adapterId).toBe("tag-fallback");

      // Reasoning extraction from tags
      expect(result.result.reasoningText).toContain("Let me think");
      expect(result.result.reasoningText).toContain("about this");

      // Response text (non-tag content)
      expect(result.result.responseText).toBe("Here is the answer.");

      // Trace stored
      expect(result.traces).toHaveLength(1);
      expect(result.traces[0].provider).toBe("custom-provider");

      // Budget
      expect(result.tokenCount).toBe(100);
    });

    it("handles <thinking> tag variant", () => {
      const adapter = resolveAdapter({ model: "unknown", provider: "unknown" });
      adapter.reset();

      const chunk = adapter.parseChunk(textDelta("<thinking>deep thought</thinking>"));
      expect(chunk).not.toBeNull();
      expect(chunk!.text).toContain("deep thought");
    });
  });

  // -------------------------------------------------------------------------
  // T012: Cross-chunk boundary stress tests
  // -------------------------------------------------------------------------

  describe("cross-chunk boundary stress tests", () => {
    it("handles partial tag split: <thin + k>text</think>", () => {
      const adapter = resolveAdapter({ model: "gpt-4o", provider: "custom" });
      expect(adapter.id).toBe("tag-fallback");
      adapter.reset();

      const result = new ChatGenerationResult({ adapterId: adapter.id });

      const chunk1 = adapter.parseChunk(textDelta("<thin"));
      expect(chunk1).toBeNull(); // buffered

      const chunk2 = adapter.parseChunk(textDelta("k>reasoning here</think>"));
      if (chunk2) {
        result.addChunk(chunk2);
      }

      expect(result.reasoningText).toContain("reasoning here");
    });

    it("handles empty thinking block (start then immediate end)", () => {
      const events: AssistantMessageEvent[] = [
        thinkingStart(),
        thinkingEnd(),
        textDelta("Direct answer"),
      ];

      const pipeline = runAdapterPipeline("claude-3", "anthropic", events);
      expect(pipeline.result.reasoningText).toBe("");
      expect(pipeline.result.responseText).toBe("Direct answer");
    });

    it("handles very large reasoning text (10K+ characters)", () => {
      const largeText = "A".repeat(10000);
      const events: AssistantMessageEvent[] = [
        thinkingStart(),
        thinkingDelta(largeText),
        thinkingEnd(),
        textDelta("Summary"),
      ];

      const pipeline = runAdapterPipeline("o3-mini", "openai", events);
      expect(pipeline.result.reasoningText).toBe(largeText);
      expect(pipeline.result.reasoningText.length).toBe(10000);
      expect(pipeline.result.responseText).toBe("Summary");

      // Also verify trace storage handles large text
      emitAgentEvent({
        runId: "run-large",
        stream: "thinking",
        sessionKey: "large-session",
        data: {
          sessionKey: "large-session",
          runId: "run-large",
          model: "o3-mini",
          provider: "openai",
          reasoningText: largeText,
          reasoningTokens: 5000,
          totalTokens: 6000,
          durationMs: 0,
        },
      });

      const traces = ctx.store.queryBySession("large-session");
      expect(traces).toHaveLength(1);
      expect(traces[0].reasoningText.length).toBe(10000);
    });

    it("handles multiple thinking blocks in single message", () => {
      const events: AssistantMessageEvent[] = [
        thinkingStart(),
        thinkingDelta("First thought"),
        thinkingEnd(),
        textDelta("Part 1. "),
        thinkingStart(),
        thinkingDelta("Second thought"),
        thinkingEnd(),
        textDelta("Part 2."),
      ];

      const pipeline = runAdapterPipeline("claude-3.5-sonnet", "anthropic", events);
      const pairs = pipeline.result.finalize();

      // Should have 2 thinking pairs
      expect(pairs.length).toBeGreaterThanOrEqual(2);
      expect(pairs[0][0]).toBe("First thought");
      expect(pairs[0][1]).toBe("Part 1. ");
      expect(pairs[1][0]).toBe("Second thought");
      expect(pairs[1][1]).toBe("Part 2.");
    });

    it("handles tag fallback with split across multiple chunks", () => {
      const adapter = resolveAdapter({ model: "custom", provider: "custom" });
      adapter.reset();
      const result = new ChatGenerationResult({ adapterId: adapter.id });
      const allChunks: ReasoningChunk[] = [];

      // Simulate highly fragmented tags
      const fragments = ["<think>first ", "part of ", "reasoning</think>", "response text"];

      for (const frag of fragments) {
        const chunk = adapter.parseChunk(textDelta(frag));
        if (chunk) {
          allChunks.push(chunk);
          result.addChunk(chunk);
        } else {
          // Non-reasoning content after </think>
          // If not inside thinking, add as response
          if (frag === "response text") {
            result.addResponseText(frag);
          }
        }
      }

      expect(result.reasoningText).toContain("first ");
      expect(result.reasoningText).toContain("part of ");
      expect(result.reasoningText).toContain("reasoning");
    });
  });

  // -------------------------------------------------------------------------
  // T013: Budget tracker threshold integration tests
  // -------------------------------------------------------------------------

  describe("budget tracker threshold integration", () => {
    it("fires warning at 80% threshold via event system", () => {
      ctx.teardown();
      ctx = createTraceContext({ maxTokens: 1000, warningPercent: 80 });

      emitAgentEvent({
        runId: "run-warn",
        stream: "thinking",
        data: {
          reasoningTokens: 800,
          totalTokens: 1000,
          durationMs: 0,
        },
      });

      expect(ctx.tracker.status).toBe("warning");
      expect(ctx.tracker.tokens).toBe(800);

      const warnings = ctx.budgetEvents.filter((e) => e.data.type === "warning");
      expect(warnings).toHaveLength(1);
      expect(warnings[0].data.percent).toBe(80);
    });

    it("fires exceeded at 100% threshold via event system", () => {
      ctx.teardown();
      ctx = createTraceContext({ maxTokens: 500, warningPercent: 80 });

      emitAgentEvent({
        runId: "run-exceed",
        stream: "thinking",
        data: {
          reasoningTokens: 500,
          totalTokens: 700,
          durationMs: 0,
        },
      });

      expect(ctx.tracker.status).toBe("exceeded");
      expect(ctx.tracker.tokens).toBe(500);

      const exceeded = ctx.budgetEvents.filter((e) => e.data.type === "exceeded");
      expect(exceeded).toHaveLength(1);
      expect(exceeded[0].data.percent).toBe(100);
    });

    it("accumulates tokens across multiple pipeline runs", () => {
      ctx.teardown();
      ctx = createTraceContext({ maxTokens: 1000, warningPercent: 80 });

      // First turn: 300 tokens
      emitAgentEvent({
        runId: "run-multi-1",
        stream: "thinking",
        data: { reasoningTokens: 300, totalTokens: 500, durationMs: 0 },
      });
      expect(ctx.tracker.tokens).toBe(300);
      expect(ctx.tracker.status).toBe("ok");

      // Second turn: 300 tokens (total: 600)
      emitAgentEvent({
        runId: "run-multi-2",
        stream: "thinking",
        data: { reasoningTokens: 300, totalTokens: 500, durationMs: 0 },
      });
      expect(ctx.tracker.tokens).toBe(600);
      expect(ctx.tracker.status).toBe("ok");

      // Third turn: 300 tokens (total: 900 -> warning at 80% = 800)
      emitAgentEvent({
        runId: "run-multi-3",
        stream: "thinking",
        data: { reasoningTokens: 300, totalTokens: 500, durationMs: 0 },
      });
      expect(ctx.tracker.tokens).toBe(900);
      expect(ctx.tracker.status).toBe("warning");

      const warnings = ctx.budgetEvents.filter((e) => e.data.type === "warning");
      expect(warnings).toHaveLength(1);
    });

    it("produces no warnings in unlimited mode (maxTokens=0)", () => {
      ctx.teardown();
      ctx = createTraceContext({ maxTokens: 0, warningPercent: 80 });

      emitAgentEvent({
        runId: "run-unlimited",
        stream: "thinking",
        data: { reasoningTokens: 999999, totalTokens: 1000000, durationMs: 0 },
      });

      expect(ctx.tracker.isUnlimited).toBe(true);
      expect(ctx.tracker.status).toBe("ok");
      expect(ctx.tracker.tokens).toBe(999999);
      expect(ctx.budgetEvents).toHaveLength(0);
    });

    it("handles zero-token events gracefully", () => {
      ctx.teardown();
      ctx = createTraceContext({ maxTokens: 1000 });

      emitAgentEvent({
        runId: "run-zero",
        stream: "thinking",
        data: { reasoningTokens: 0, totalTokens: 100, durationMs: 0 },
      });

      expect(ctx.tracker.tokens).toBe(0);
      expect(ctx.tracker.status).toBe("ok");
    });
  });

  // -------------------------------------------------------------------------
  // T014: Trace lifecycle integration tests
  // -------------------------------------------------------------------------

  describe("trace lifecycle integration", () => {
    it("inserts via full pipeline and queries by session", () => {
      runFullPipeline(ctx, {
        model: "o3-mini",
        provider: "openai",
        events: [thinkingStart(), thinkingDelta("think"), thinkingEnd(), textDelta("reply")],
        sessionKey: "lifecycle-session",
        runId: "run-lc-001",
        reasoningTokens: 100,
      });

      const traces = ctx.store.queryBySession("lifecycle-session");
      expect(traces).toHaveLength(1);
      expect(traces[0].sessionKey).toBe("lifecycle-session");
      expect(traces[0].runId).toBe("run-lc-001");
    });

    it("queries by model across multiple sessions", () => {
      runFullPipeline(ctx, {
        model: "o3-mini",
        provider: "openai",
        events: [thinkingStart(), thinkingDelta("a"), thinkingEnd()],
        sessionKey: "s1",
        runId: "run-m1",
        reasoningTokens: 50,
      });

      runFullPipeline(ctx, {
        model: "o3-mini",
        provider: "openai",
        events: [thinkingStart(), thinkingDelta("b"), thinkingEnd()],
        sessionKey: "s2",
        runId: "run-m2",
        reasoningTokens: 60,
      });

      const byModel = ctx.store.queryByModel("o3-mini");
      expect(byModel).toHaveLength(2);
    });

    it("deletes expired traces while preserving recent ones", () => {
      // Insert an old trace directly into the DB
      ctx.db
        .prepare(
          `INSERT INTO reasoning_traces
         (session_key, run_id, model, provider, reasoning_text,
          reasoning_tokens, total_tokens, duration_ms, metadata, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run("old-session", "run-old", "o3", "openai", "old thinking", 50, 100, 0, "{}", 1000);

      // Insert a recent trace via full pipeline
      runFullPipeline(ctx, {
        model: "o3-mini",
        provider: "openai",
        events: [thinkingStart(), thinkingDelta("recent"), thinkingEnd()],
        sessionKey: "recent-session",
        runId: "run-recent",
        reasoningTokens: 100,
      });

      expect(ctx.store.count()).toBe(2);

      const deleted = ctx.store.deleteExpired();
      expect(deleted).toBe(1);
      expect(ctx.store.count()).toBe(1);

      const remaining = ctx.store.queryBySession("recent-session");
      expect(remaining).toHaveLength(1);
      expect(remaining[0].reasoningText).toBe("recent");
    });

    it("disabled store produces no traces", () => {
      ctx.teardown();
      ctx = createTraceContext({ enabled: false });

      emitAgentEvent({
        runId: "run-disabled",
        stream: "thinking",
        sessionKey: "disabled-session",
        data: {
          sessionKey: "disabled-session",
          runId: "run-disabled",
          model: "o3",
          provider: "openai",
          reasoningText: "should not store",
          reasoningTokens: 100,
          totalTokens: 200,
          durationMs: 0,
        },
      });

      expect(ctx.store.count()).toBe(0);
    });

    it("stores metadata from adapter in trace", () => {
      runFullPipeline(ctx, {
        model: "o3-mini",
        provider: "openai",
        events: [thinkingStart(), thinkingDelta("meta test"), thinkingEnd()],
        sessionKey: "meta-session",
        runId: "run-meta",
        reasoningTokens: 50,
      });

      const traces = ctx.store.queryBySession("meta-session");
      expect(traces).toHaveLength(1);
      const meta = traces[0].metadata;
      expect(meta).toBeDefined();
      expect(meta.adapterId).toBe("openai");
    });
  });

  // -------------------------------------------------------------------------
  // T015: Performance validation tests
  // -------------------------------------------------------------------------

  describe("performance validation", () => {
    it("adapter parsing completes within 5ms per chunk (5x CI margin)", () => {
      const adapter = resolveAdapter({ model: "o3-mini", provider: "openai" });

      // Warm-up run
      adapter.reset();
      adapter.parseChunk(thinkingStart());
      adapter.parseChunk(thinkingDelta("warmup"));
      adapter.parseChunk(thinkingEnd());

      // Timed run
      adapter.reset();
      const iterations = 100;
      const events: AssistantMessageEvent[] = [
        thinkingStart(),
        ...Array.from({ length: iterations }, (_, i) => thinkingDelta(`chunk-${i}`)),
        thinkingEnd(),
      ];

      const start = performance.now();
      for (const evt of events) {
        adapter.parseChunk(evt);
      }
      const elapsed = performance.now() - start;

      const avgPerChunk = elapsed / (iterations + 2);
      expect(avgPerChunk).toBeLessThan(5);
    });

    it("accumulator addChunk completes within 1ms per chunk", () => {
      const result = new ChatGenerationResult({ adapterId: "openai" });

      // Warm-up
      const warmup = new ChatGenerationResult();
      warmup.addChunk({
        provider: "openai",
        phase: "delta",
        text: "warmup",
        contentIndex: 0,
        isComplete: false,
        metadata: {},
      });

      // Timed run
      const iterations = 200;
      result.addChunk({
        provider: "openai",
        phase: "start",
        text: "",
        contentIndex: 0,
        isComplete: false,
        metadata: {},
      });

      const start = performance.now();
      for (let i = 0; i < iterations; i++) {
        result.addChunk({
          provider: "openai",
          phase: "delta",
          text: `delta-${i}`,
          contentIndex: 0,
          isComplete: false,
          metadata: {},
        });
        result.getReasoningDelta();
      }
      const elapsed = performance.now() - start;

      const avgPerChunk = elapsed / iterations;
      expect(avgPerChunk).toBeLessThan(1);
    });

    it("streaming delta emission latency stays under 50ms (5x CI margin)", () => {
      const adapter = resolveAdapter({ model: "claude-3.5-sonnet", provider: "anthropic" });
      adapter.reset();
      const result = new ChatGenerationResult({ adapterId: adapter.id });

      const chunkCount = 50;
      const events: AssistantMessageEvent[] = [
        thinkingStart(),
        ...Array.from({ length: chunkCount }, (_, i) =>
          thinkingDelta(`reasoning segment ${i} with some text content`),
        ),
        thinkingEnd(),
      ];

      const start = performance.now();
      for (const evt of events) {
        const chunk = adapter.parseChunk(evt);
        if (chunk) {
          result.addChunk(chunk);
          result.getReasoningDelta();
        }
      }
      const elapsed = performance.now() - start;

      expect(elapsed).toBeLessThan(50);
    });
  });
});
