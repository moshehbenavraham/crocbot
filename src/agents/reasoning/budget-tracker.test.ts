import { describe, expect, it, beforeEach, afterEach } from "vitest";

import { ReasoningBudgetTracker } from "./budget-tracker.js";
import type { BudgetTrackerOptions } from "./budget-tracker.js";
import { onAgentEvent } from "../../infra/agent-events.js";
import type { AgentEventPayload } from "../../infra/agent-events.js";

function makeOptions(overrides: Partial<BudgetTrackerOptions> = {}): BudgetTrackerOptions {
  return {
    maxReasoningTokensPerSession: 10000,
    warningThresholdPercent: 80,
    runId: "run-001",
    sessionKey: "test-session",
    ...overrides,
  };
}

describe("ReasoningBudgetTracker", () => {
  let tracker: ReasoningBudgetTracker;
  let capturedEvents: AgentEventPayload[];
  let unsubscribe: () => void;

  beforeEach(() => {
    capturedEvents = [];
    unsubscribe = onAgentEvent((evt) => {
      if (evt.stream === "budget") {
        capturedEvents.push(evt);
      }
    });
    tracker = new ReasoningBudgetTracker(makeOptions());
  });

  afterEach(() => {
    unsubscribe();
  });

  describe("initialization", () => {
    it("starts with 0 tokens", () => {
      expect(tracker.tokens).toBe(0);
    });

    it("starts with ok status", () => {
      expect(tracker.status).toBe("ok");
    });

    it("reports unlimited when maxTokens is 0", () => {
      const unlimited = new ReasoningBudgetTracker(
        makeOptions({ maxReasoningTokensPerSession: 0 }),
      );
      expect(unlimited.isUnlimited).toBe(true);
      expect(unlimited.status).toBe("ok");
    });
  });

  describe("addTokens", () => {
    it("increments cumulative count", () => {
      tracker.addTokens(100);
      expect(tracker.tokens).toBe(100);

      tracker.addTokens(200);
      expect(tracker.tokens).toBe(300);
    });

    it("ignores zero count", () => {
      tracker.addTokens(0);
      expect(tracker.tokens).toBe(0);
    });

    it("ignores negative count", () => {
      tracker.addTokens(100);
      tracker.addTokens(-50);
      expect(tracker.tokens).toBe(100);
    });
  });

  describe("warning threshold", () => {
    it("emits warning at threshold percent", () => {
      // 80% of 10000 = 8000
      tracker.addTokens(8000);
      expect(tracker.status).toBe("warning");
      expect(capturedEvents).toHaveLength(1);
      expect(capturedEvents[0].data.type).toBe("warning");
      expect(capturedEvents[0].data.reasoningTokens).toBe(8000);
      expect(capturedEvents[0].data.maxReasoningTokens).toBe(10000);
      expect(capturedEvents[0].data.percent).toBe(80);
    });

    it("does not emit duplicate warnings", () => {
      tracker.addTokens(8000);
      expect(capturedEvents).toHaveLength(1);

      tracker.addTokens(500);
      // Should still be only 1 warning event
      expect(capturedEvents).toHaveLength(1);
    });

    it("emits warning on exact threshold", () => {
      tracker.addTokens(7999);
      expect(capturedEvents).toHaveLength(0);

      tracker.addTokens(1);
      expect(capturedEvents).toHaveLength(1);
      expect(capturedEvents[0].data.type).toBe("warning");
    });
  });

  describe("exceeded threshold", () => {
    it("emits exceeded at 100%", () => {
      tracker.addTokens(10000);
      expect(tracker.status).toBe("exceeded");
      // May have warning + exceeded or just exceeded depending on implementation
      const exceededEvents = capturedEvents.filter((e) => e.data.type === "exceeded");
      expect(exceededEvents).toHaveLength(1);
      expect(exceededEvents[0].data.percent).toBe(100);
    });

    it("does not emit duplicate exceeded events", () => {
      tracker.addTokens(10000);
      tracker.addTokens(5000);

      const exceededEvents = capturedEvents.filter((e) => e.data.type === "exceeded");
      expect(exceededEvents).toHaveLength(1);
    });

    it("exceeded event includes runId and sessionKey", () => {
      tracker.addTokens(10000);
      const exceeded = capturedEvents.find((e) => e.data.type === "exceeded");
      expect(exceeded).toBeDefined();
      expect(exceeded!.runId).toBe("run-001");
      expect(exceeded!.sessionKey).toBe("test-session");
    });
  });

  describe("unlimited mode", () => {
    it("never emits warnings when maxTokens is 0", () => {
      const unlimited = new ReasoningBudgetTracker(
        makeOptions({ maxReasoningTokensPerSession: 0 }),
      );
      unlimited.addTokens(1000000);
      expect(unlimited.status).toBe("ok");
      expect(capturedEvents).toHaveLength(0);
    });
  });

  describe("reset", () => {
    it("clears token count", () => {
      tracker.addTokens(5000);
      tracker.reset();
      expect(tracker.tokens).toBe(0);
    });

    it("clears warning state", () => {
      tracker.addTokens(8000);
      expect(capturedEvents).toHaveLength(1);

      tracker.reset();
      tracker.addTokens(8000);
      // Should emit a new warning after reset
      expect(capturedEvents).toHaveLength(2);
    });

    it("returns to ok status", () => {
      tracker.addTokens(10000);
      expect(tracker.status).toBe("exceeded");

      tracker.reset();
      expect(tracker.status).toBe("ok");
    });
  });

  describe("setRunId", () => {
    it("updates runId for subsequent events", () => {
      tracker.setRunId("run-002", "new-session");
      tracker.addTokens(8000);

      expect(capturedEvents[0].runId).toBe("run-002");
    });
  });

  describe("fromConfig", () => {
    it("creates options with defaults", () => {
      const opts = ReasoningBudgetTracker.fromConfig(undefined, "run-1");
      expect(opts.maxReasoningTokensPerSession).toBe(0);
      expect(opts.warningThresholdPercent).toBe(80);
      expect(opts.runId).toBe("run-1");
    });

    it("uses config values when provided", () => {
      const opts = ReasoningBudgetTracker.fromConfig(
        { maxReasoningTokensPerSession: 5000, warningThresholdPercent: 90 },
        "run-2",
        "session-key",
      );
      expect(opts.maxReasoningTokensPerSession).toBe(5000);
      expect(opts.warningThresholdPercent).toBe(90);
      expect(opts.sessionKey).toBe("session-key");
    });
  });
});
