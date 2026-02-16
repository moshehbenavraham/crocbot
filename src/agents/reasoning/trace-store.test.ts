import { DatabaseSync } from "node:sqlite";

import { describe, expect, it, beforeEach, afterEach } from "vitest";

import { ReasoningTraceStore, parseReasoningTokens } from "./trace-store.js";
import type { InsertTraceParams } from "./trace-store.js";

function makeTrace(overrides: Partial<InsertTraceParams> = {}): InsertTraceParams {
  return {
    sessionKey: "test-session",
    runId: "run-001",
    model: "o3-mini",
    provider: "openai",
    reasoningText: "Let me think about this...",
    reasoningTokens: 150,
    totalTokens: 300,
    durationMs: 1200,
    metadata: { adapterId: "openai" },
    ...overrides,
  };
}

describe("ReasoningTraceStore", () => {
  let db: DatabaseSync;
  let store: ReasoningTraceStore;

  beforeEach(() => {
    db = new DatabaseSync(":memory:");
    store = new ReasoningTraceStore(db);
  });

  afterEach(() => {
    db.close();
  });

  describe("insert", () => {
    it("inserts a trace and returns a row ID", () => {
      const id = store.insert(makeTrace());
      expect(id).toBeGreaterThan(0);
    });

    it("stores all fields correctly", () => {
      store.insert(makeTrace());
      const traces = store.queryBySession("test-session");
      expect(traces).toHaveLength(1);
      const t = traces[0];
      expect(t.sessionKey).toBe("test-session");
      expect(t.runId).toBe("run-001");
      expect(t.model).toBe("o3-mini");
      expect(t.provider).toBe("openai");
      expect(t.reasoningText).toBe("Let me think about this...");
      expect(t.reasoningTokens).toBe(150);
      expect(t.totalTokens).toBe(300);
      expect(t.durationMs).toBe(1200);
      expect(t.metadata).toEqual({ adapterId: "openai" });
      expect(t.createdAt).toBeGreaterThan(0);
    });

    it("handles zero-length reasoning text", () => {
      store.insert(makeTrace({ reasoningText: "", reasoningTokens: 0 }));
      const traces = store.queryBySession("test-session");
      expect(traces).toHaveLength(1);
      expect(traces[0].reasoningText).toBe("");
      expect(traces[0].reasoningTokens).toBe(0);
    });

    it("stores very large reasoning text without truncation", () => {
      const largeText = "x".repeat(60000);
      store.insert(makeTrace({ reasoningText: largeText }));
      const traces = store.queryBySession("test-session");
      expect(traces[0].reasoningText).toBe(largeText);
      expect(traces[0].reasoningText).toHaveLength(60000);
    });
  });

  describe("queryBySession", () => {
    it("returns matching traces for a session key", () => {
      store.insert(makeTrace({ sessionKey: "session-a" }));
      store.insert(makeTrace({ sessionKey: "session-b" }));
      store.insert(makeTrace({ sessionKey: "session-a" }));

      const results = store.queryBySession("session-a");
      expect(results).toHaveLength(2);
      expect(results.every((t) => t.sessionKey === "session-a")).toBe(true);
    });

    it("returns empty array for non-existent session", () => {
      const results = store.queryBySession("nonexistent");
      expect(results).toEqual([]);
    });

    it("respects limit parameter", () => {
      for (let i = 0; i < 5; i++) {
        store.insert(makeTrace({ sessionKey: "session-x" }));
      }
      const results = store.queryBySession("session-x", 3);
      expect(results).toHaveLength(3);
    });
  });

  describe("queryByModel", () => {
    it("returns matching traces for a model", () => {
      store.insert(makeTrace({ model: "o3-mini" }));
      store.insert(makeTrace({ model: "claude-3.5-sonnet" }));
      store.insert(makeTrace({ model: "o3-mini" }));

      const results = store.queryByModel("o3-mini");
      expect(results).toHaveLength(2);
      expect(results.every((t) => t.model === "o3-mini")).toBe(true);
    });

    it("returns empty array for non-existent model", () => {
      const results = store.queryByModel("nonexistent");
      expect(results).toEqual([]);
    });
  });

  describe("queryByTimeRange", () => {
    it("returns traces within a time range", () => {
      const now = Date.now();
      store.insert(makeTrace());

      const results = store.queryByTimeRange(now - 1000);
      expect(results).toHaveLength(1);
    });

    it("returns empty when time range excludes all traces", () => {
      store.insert(makeTrace());

      const farFuture = Date.now() + 100000;
      const results = store.queryByTimeRange(farFuture);
      expect(results).toEqual([]);
    });

    it("respects until parameter", () => {
      store.insert(makeTrace());
      const now = Date.now();

      const results = store.queryByTimeRange(0, now + 1000);
      expect(results).toHaveLength(1);

      const results2 = store.queryByTimeRange(0, 1);
      expect(results2).toEqual([]);
    });
  });

  describe("query (combined filters)", () => {
    it("combines session and model filters", () => {
      store.insert(makeTrace({ sessionKey: "s1", model: "m1" }));
      store.insert(makeTrace({ sessionKey: "s1", model: "m2" }));
      store.insert(makeTrace({ sessionKey: "s2", model: "m1" }));

      const results = store.query({ sessionKey: "s1", model: "m1" });
      expect(results).toHaveLength(1);
      expect(results[0].sessionKey).toBe("s1");
      expect(results[0].model).toBe("m1");
    });

    it("returns all traces with no filters", () => {
      store.insert(makeTrace({ sessionKey: "s1" }));
      store.insert(makeTrace({ sessionKey: "s2" }));

      const results = store.query();
      expect(results).toHaveLength(2);
    });
  });

  describe("deleteExpired", () => {
    it("removes traces older than retention period", () => {
      // Insert a trace with a very old created_at by manipulating the DB directly.
      db.prepare(
        `INSERT INTO reasoning_traces
         (session_key, run_id, model, provider, reasoning_text,
          reasoning_tokens, total_tokens, duration_ms, metadata, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run("old-session", "run-old", "m1", "openai", "old text", 100, 200, 500, "{}", 1000);

      store.insert(makeTrace({ sessionKey: "new-session" }));

      expect(store.count()).toBe(2);

      const deleted = store.deleteExpired();
      expect(deleted).toBe(1);
      expect(store.count()).toBe(1);

      const remaining = store.queryBySession("new-session");
      expect(remaining).toHaveLength(1);
    });

    it("returns 0 when no traces are expired", () => {
      store.insert(makeTrace());
      const deleted = store.deleteExpired();
      expect(deleted).toBe(0);
    });
  });

  describe("empty database", () => {
    it("returns empty results without errors", () => {
      expect(store.queryBySession("any")).toEqual([]);
      expect(store.queryByModel("any")).toEqual([]);
      expect(store.queryByTimeRange(0)).toEqual([]);
      expect(store.query()).toEqual([]);
      expect(store.count()).toBe(0);
      expect(store.deleteExpired()).toBe(0);
    });
  });

  describe("enabled flag", () => {
    it("reflects config enabled state", () => {
      const enabledStore = new ReasoningTraceStore(db, { enabled: true });
      expect(enabledStore.enabled).toBe(true);

      const db2 = new DatabaseSync(":memory:");
      const disabledStore = new ReasoningTraceStore(db2, { enabled: false });
      expect(disabledStore.enabled).toBe(false);
      db2.close();
    });

    it("defaults to enabled", () => {
      expect(store.enabled).toBe(true);
    });
  });
});

describe("parseReasoningTokens", () => {
  it("extracts from OpenAI usage shape", () => {
    const usage = {
      completion_tokens: 500,
      completion_tokens_details: {
        reasoning_tokens: 200,
      },
    };
    expect(parseReasoningTokens("openai", usage)).toBe(200);
  });

  it("extracts from OpenRouter usage shape (same as OpenAI)", () => {
    const usage = {
      completion_tokens_details: {
        reasoning_tokens: 150,
      },
    };
    expect(parseReasoningTokens("openrouter", usage)).toBe(150);
  });

  it("extracts from Anthropic usage shape", () => {
    const usage = {
      cache_creation_input_tokens: 300,
    };
    expect(parseReasoningTokens("anthropic", usage)).toBe(300);
  });

  it("returns 0 for missing usage object", () => {
    expect(parseReasoningTokens("openai", undefined)).toBe(0);
    expect(parseReasoningTokens("openai", null)).toBe(0);
  });

  it("returns 0 for empty usage object", () => {
    expect(parseReasoningTokens("openai", {})).toBe(0);
  });

  it("returns 0 for unknown provider with no generic field", () => {
    expect(parseReasoningTokens("unknown", { other: 100 })).toBe(0);
  });

  it("falls back to generic reasoning_tokens field", () => {
    expect(parseReasoningTokens("custom", { reasoning_tokens: 42 })).toBe(42);
  });

  it("returns 0 for non-positive token values", () => {
    expect(
      parseReasoningTokens("openai", {
        completion_tokens_details: { reasoning_tokens: 0 },
      }),
    ).toBe(0);
    expect(
      parseReasoningTokens("openai", {
        completion_tokens_details: { reasoning_tokens: -5 },
      }),
    ).toBe(0);
  });

  it("returns 0 for non-object usage", () => {
    expect(parseReasoningTokens("openai", "string")).toBe(0);
    expect(parseReasoningTokens("openai", 42)).toBe(0);
  });
});
