import { DatabaseSync } from "node:sqlite";

import { describe, expect, it, beforeEach, afterEach } from "vitest";

import { ReasoningTraceStore, initTraceStoreListener } from "./trace-store.js";
import { ReasoningBudgetTracker, initBudgetTrackerListener } from "./budget-tracker.js";
import { emitAgentEvent, onAgentEvent } from "../../infra/agent-events.js";
import type { AgentEventPayload } from "../../infra/agent-events.js";

describe("trace-integration", () => {
  let db: DatabaseSync;
  let store: ReasoningTraceStore;
  let unsubTraceStore: () => void;

  beforeEach(() => {
    db = new DatabaseSync(":memory:");
    store = new ReasoningTraceStore(db);
    unsubTraceStore = initTraceStoreListener(store);
  });

  afterEach(() => {
    unsubTraceStore();
    db.close();
  });

  describe("event-driven trace persistence", () => {
    it("stores a trace when a thinking event is emitted", () => {
      emitAgentEvent({
        runId: "run-001",
        stream: "thinking",
        sessionKey: "session-abc",
        data: {
          sessionKey: "session-abc",
          runId: "run-001",
          model: "o3-mini",
          provider: "openai",
          reasoningText: "Let me analyze this step by step...",
          reasoningTokens: 200,
          totalTokens: 450,
          durationMs: 1500,
          metadata: { adapterId: "openai" },
        },
      });

      const traces = store.queryBySession("session-abc");
      expect(traces).toHaveLength(1);
      expect(traces[0].model).toBe("o3-mini");
      expect(traces[0].provider).toBe("openai");
      expect(traces[0].reasoningText).toBe("Let me analyze this step by step...");
      expect(traces[0].reasoningTokens).toBe(200);
      expect(traces[0].totalTokens).toBe(450);
    });

    it("stores multiple traces from multiple events", () => {
      for (let i = 0; i < 3; i++) {
        emitAgentEvent({
          runId: `run-${i}`,
          stream: "thinking",
          sessionKey: "multi-session",
          data: {
            sessionKey: "multi-session",
            runId: `run-${i}`,
            model: "o3-mini",
            provider: "openai",
            reasoningText: `Thinking step ${i}`,
            reasoningTokens: 100 + i * 50,
            totalTokens: 200 + i * 50,
            durationMs: 0,
          },
        });
      }

      const traces = store.query({ sessionKey: "multi-session" });
      expect(traces).toHaveLength(3);
    });

    it("ignores non-thinking events", () => {
      emitAgentEvent({
        runId: "run-001",
        stream: "assistant",
        data: { text: "Hello!" },
      });

      emitAgentEvent({
        runId: "run-001",
        stream: "tool",
        data: { toolName: "search" },
      });

      expect(store.count()).toBe(0);
    });

    it("does not store when store is disabled", () => {
      unsubTraceStore();
      const db2 = new DatabaseSync(":memory:");
      const disabledStore = new ReasoningTraceStore(db2, { enabled: false });
      const unsub = initTraceStoreListener(disabledStore);

      emitAgentEvent({
        runId: "run-001",
        stream: "thinking",
        data: {
          sessionKey: "s1",
          runId: "run-001",
          model: "o3",
          provider: "openai",
          reasoningText: "thinking...",
          reasoningTokens: 100,
          totalTokens: 200,
          durationMs: 0,
        },
      });

      expect(disabledStore.count()).toBe(0);
      unsub();
      db2.close();
    });
  });

  describe("budget tracker event integration", () => {
    it("accumulates tokens from thinking events", () => {
      const tracker = new ReasoningBudgetTracker({
        maxReasoningTokensPerSession: 1000,
        warningThresholdPercent: 80,
        runId: "run-001",
        sessionKey: "budget-session",
      });
      const unsubBudget = initBudgetTrackerListener(tracker);

      emitAgentEvent({
        runId: "run-001",
        stream: "thinking",
        data: {
          sessionKey: "budget-session",
          runId: "run-001",
          model: "o3",
          provider: "openai",
          reasoningText: "thinking",
          reasoningTokens: 300,
          totalTokens: 500,
          durationMs: 0,
        },
      });

      expect(tracker.tokens).toBe(300);
      unsubBudget();
    });

    it("emits warning event when threshold is reached via events", () => {
      const budgetEvents: AgentEventPayload[] = [];
      const unsubCapture = onAgentEvent((evt) => {
        if (evt.stream === "budget") {
          budgetEvents.push(evt);
        }
      });

      const tracker = new ReasoningBudgetTracker({
        maxReasoningTokensPerSession: 1000,
        warningThresholdPercent: 80,
        runId: "run-001",
        sessionKey: "warn-session",
      });
      const unsubBudget = initBudgetTrackerListener(tracker);

      emitAgentEvent({
        runId: "run-001",
        stream: "thinking",
        data: {
          reasoningTokens: 800,
          totalTokens: 1000,
          durationMs: 0,
        },
      });

      expect(tracker.status).toBe("warning");
      const warnings = budgetEvents.filter((e) => e.data.type === "warning");
      expect(warnings).toHaveLength(1);

      unsubBudget();
      unsubCapture();
    });
  });

  describe("retention cleanup", () => {
    it("removes expired traces while preserving recent ones", () => {
      // Insert an old trace directly.
      db.prepare(
        `INSERT INTO reasoning_traces
         (session_key, run_id, model, provider, reasoning_text,
          reasoning_tokens, total_tokens, duration_ms, metadata, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run("old", "run-old", "m1", "openai", "old thinking", 50, 100, 0, "{}", 1000);

      // Insert a recent trace via event.
      emitAgentEvent({
        runId: "run-new",
        stream: "thinking",
        data: {
          sessionKey: "new",
          runId: "run-new",
          model: "o3",
          provider: "openai",
          reasoningText: "recent thinking",
          reasoningTokens: 100,
          totalTokens: 200,
          durationMs: 0,
        },
      });

      expect(store.count()).toBe(2);

      const deleted = store.deleteExpired();
      expect(deleted).toBe(1);
      expect(store.count()).toBe(1);

      const remaining = store.queryBySession("new");
      expect(remaining).toHaveLength(1);
      expect(remaining[0].reasoningText).toBe("recent thinking");
    });
  });
});
